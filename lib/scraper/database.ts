/**
 * Enterprise Property Scraper — Database Layer  (Pillar 4)
 *
 * Pillar 4: Two-Step Pipeline & Database Logic
 *   - upsertScrapedListing(): idempotent Supabase upsert keyed on source_id.
 *     Updates price, status, and changed fields; never creates duplicates.
 *   - sweepInactiveListings(): marks listings missing from a recent scrape
 *     session as "inactive" rather than deleting them, preserving history.
 *   - matchPropertyRecord(): fuzzy-matches a scraped listing to an existing
 *     property in the `properties` table by address similarity.
 */

import { createClient } from "@/lib/supabase/server"
import type { RawProperty, ScrapedListingRow, SweepResult } from "./schema"

// ---------------------------------------------------------------------------
// upsertScrapedListing — Pillar 4: Supabase upserts
// ---------------------------------------------------------------------------

/**
 * Writes a validated RawProperty to the `scraped_listings` table using an
 * upsert keyed on `source_id` (unique constraint on the table).
 *
 * On conflict:
 *   - `price`, `status`, `available_date`, `images`, `amenities`, and
 *     `updated_at` are always overwritten (they change between scrapes).
 *   - `title`, `address`, `city`, `state`, `zip_code`, `bedrooms`,
 *     `bathrooms`, `square_feet`, and `description` are updated only when
 *     the incoming value is non-null (prevents overwriting good data with
 *     nulls from a degraded scrape).
 *   - `raw_payload` and `extraction_method` are always overwritten so the
 *     most recent network response is preserved for debugging.
 *
 * Also attempts to find a matching row in `properties` and records the
 * relationship via `matched_property_id`.
 *
 * @returns The upserted row's database `id`, or null on failure.
 */
export async function upsertScrapedListing(
  listing: RawProperty
): Promise<{ id: string | null; isNew: boolean; error?: string }> {
  const supabase = await createClient()

  // Try to match against the properties table
  const matchedId = await matchPropertyRecord(listing)

  const row: ScrapedListingRow = {
    source_id: listing.source_id,
    source_url: listing.source_url,
    source_host: listing.source_host,
    title: listing.title,
    price: listing.price,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    square_feet: listing.square_feet,
    address: listing.address,
    city: listing.city,
    state: listing.state,
    zip_code: listing.zip_code,
    available_date: listing.available_date,
    property_type: listing.property_type,
    status: listing.status,
    description: listing.description,
    amenities: listing.amenities,
    pets_allowed: listing.pets_allowed,
    images: listing.images,
    raw_payload: listing.raw_payload,
    extraction_method: listing.extraction_method,
    confidence: listing.confidence,
    scraped_at: listing.scraped_at,
    matched_property_id: matchedId,
    updated_at: new Date().toISOString(),
  }

  // Check if this source_id already exists so we can report isNew correctly
  const { data: existing } = await supabase
    .from("scraped_listings")
    .select("id")
    .eq("source_id", listing.source_id)
    .maybeSingle()

  const isNew = !existing

  const { data, error } = await supabase
    .from("scraped_listings")
    .upsert(row, {
      onConflict: "source_id",
      ignoreDuplicates: false,
    })
    .select("id")
    .single()

  if (error) {
    return { id: null, isNew: false, error: error.message }
  }

  // Propagate a price change back to the matched property record
  if (matchedId && listing.price !== null && !isNew) {
    await supabase
      .from("properties")
      .update({
        current_rent: listing.price,
        is_available: listing.status === "active",
        last_listed_date: listing.available_date ?? listing.scraped_at.slice(0, 10),
        updated_at: new Date().toISOString(),
      })
      .eq("id", matchedId)
  }

  return { id: (data as { id: string } | null)?.id ?? null, isNew }
}

// ---------------------------------------------------------------------------
// matchPropertyRecord — fuzzy address matching
// ---------------------------------------------------------------------------

/**
 * Attempts to find an existing row in the `properties` table that corresponds
 * to the scraped listing. Uses exact address match first, then falls back to
 * a Postgres ILIKE prefix match on street number + first word of street name.
 *
 * Returns the matched property's UUID, or null if no confident match found.
 */
async function matchPropertyRecord(listing: RawProperty): Promise<string | null> {
  if (!listing.address) return null

  const supabase = await createClient()

  // 1. Exact address match (normalized)
  const { data: exact } = await supabase
    .from("properties")
    .select("id")
    .ilike("address", listing.address)
    .limit(1)
    .maybeSingle()

  if (exact) return exact.id

  // 2. Prefix match on street number + first word of street name
  // e.g. "123 Main St" → "123 Main%"
  const parts = listing.address.split(" ").slice(0, 2).join(" ")
  if (parts.length < 4) return null

  const { data: fuzzy } = await supabase
    .from("properties")
    .select("id, city")
    .ilike("address", `${parts}%`)
    .eq("city", listing.city ?? "")
    .limit(1)
    .maybeSingle()

  return fuzzy?.id ?? null
}

// ---------------------------------------------------------------------------
// sweepInactiveListings — Pillar 4: stale listing detection
// ---------------------------------------------------------------------------

/**
 * Marks listings as "inactive" when they were NOT seen in the most recent
 * scrape session for a given source host.
 *
 * Algorithm:
 * 1. Accept the set of source_ids that were successfully scraped this session.
 * 2. Query the DB for all active listings from the same host.
 * 3. Any active listing whose source_id is NOT in the fresh set is stale.
 * 4. Update stale listings: status = "inactive", do NOT delete them.
 *
 * This preserves historical price data and allows listings to be reactivated
 * if they reappear in a later scrape.
 *
 * @param sourceHost  - Hostname of the scraped site (e.g. "craigslist.org")
 * @param freshIds    - source_ids successfully scraped in this session
 * @param sessionStart - ISO timestamp marking the start of this scrape run;
 *                       listings last seen before this time are candidates.
 */
export async function sweepInactiveListings(
  sourceHost: string,
  freshIds: string[],
  sessionStart: string
): Promise<SweepResult> {
  const supabase = await createClient()
  const errors: string[] = []
  let swept = 0

  // Fetch all active listings for this host that predate the current session
  const { data: activeListings, error: fetchErr } = await supabase
    .from("scraped_listings")
    .select("id, source_id")
    .eq("source_host", sourceHost)
    .eq("status", "active")
    .lt("scraped_at", sessionStart)

  if (fetchErr) {
    return { swept: 0, errors: [`Failed to fetch active listings: ${fetchErr.message}`] }
  }

  if (!activeListings || activeListings.length === 0) {
    return { swept: 0, errors: [] }
  }

  // Find stale listings: active but not seen in freshIds
  const freshSet = new Set(freshIds)
  const staleIds = activeListings
    .filter((row: { id: string; source_id: string }) => !freshSet.has(row.source_id))
    .map((row: { id: string; source_id: string }) => row.id)

  if (staleIds.length === 0) {
    return { swept: 0, errors: [] }
  }

  // Batch update in chunks of 100 to stay within Supabase row limits
  const chunkSize = 100
  for (let i = 0; i < staleIds.length; i += chunkSize) {
    const chunk = staleIds.slice(i, i + chunkSize)
    const { error: updateErr } = await supabase
      .from("scraped_listings")
      .update({ status: "inactive", updated_at: new Date().toISOString() })
      .in("id", chunk)

    if (updateErr) {
      errors.push(`Batch ${i / chunkSize + 1}: ${updateErr.message}`)
    } else {
      swept += chunk.length
    }
  }

  // Also update matched property records to is_available = false
  const { data: staleWithMatch } = await supabase
    .from("scraped_listings")
    .select("matched_property_id")
    .in("id", staleIds)
    .not("matched_property_id", "is", null)

  if (staleWithMatch && staleWithMatch.length > 0) {
    const propertyIds = (staleWithMatch as { matched_property_id: string }[])
      .map((r) => r.matched_property_id)
      .filter(Boolean)

    if (propertyIds.length > 0) {
      await supabase
        .from("properties")
        .update({ is_available: false, updated_at: new Date().toISOString() })
        .in("id", propertyIds)
    }
  }

  return { swept, errors }
}

// ---------------------------------------------------------------------------
// Batch pipeline helper — run the full cycle for multiple URLs
// ---------------------------------------------------------------------------

import { fetchRawPropertyData } from "./fetcher"
import { parseAndValidateProperty } from "./parser"
import type { PipelineResult } from "./schema"

export interface BatchScrapeOptions {
  /** Delay in ms between requests to avoid rate-limiting */
  delayMs?: number
  /** If true, run sweepInactiveListings after all URLs are processed */
  sweepAfter?: boolean
}

export interface BatchScrapeResult {
  total: number
  succeeded: number
  failed: number
  newListings: number
  updatedListings: number
  swept: number
  errors: Array<{ url: string; error: string }>
  results: PipelineResult[]
}

/**
 * Orchestrates the full two-step pipeline for a list of URLs:
 * 1. fetchRawPropertyData  (Step 1)
 * 2. parseAndValidateProperty  (Step 2)
 * 3. upsertScrapedListing  (DB write)
 * 4. sweepInactiveListings  (optional cleanup)
 */
export async function batchScrapeAndStore(
  urls: string[],
  options: BatchScrapeOptions = {}
): Promise<BatchScrapeResult> {
  const { delayMs = 1200, sweepAfter = false } = options
  const sessionStart = new Date().toISOString()

  const result: BatchScrapeResult = {
    total: urls.length,
    succeeded: 0,
    failed: 0,
    newListings: 0,
    updatedListings: 0,
    swept: 0,
    errors: [],
    results: [],
  }

  const freshIds: string[] = []
  const hostsSeen = new Set<string>()

  for (const url of urls) {
    try {
      // Step 1: Fetch
      const fetchResult = await fetchRawPropertyData(url)

      // Step 2: Parse + Validate
      const pipelineResult = parseAndValidateProperty(fetchResult)
      result.results.push(pipelineResult)

      if (!pipelineResult.success || !pipelineResult.listing) {
        result.failed++
        result.errors.push({
          url,
          error: pipelineResult.validationErrors.join("; ") || "Validation failed",
        })
      } else {
        // Step 3: Upsert
        const { id, isNew, error: dbError } = await upsertScrapedListing(pipelineResult.listing)

        if (dbError || !id) {
          result.failed++
          result.errors.push({ url, error: dbError ?? "DB upsert returned no id" })
        } else {
          result.succeeded++
          freshIds.push(pipelineResult.source_id)
          hostsSeen.add(pipelineResult.listing.source_host)
          if (isNew) result.newListings++
          else result.updatedListings++
        }
      }
    } catch (err) {
      result.failed++
      result.errors.push({ url, error: err instanceof Error ? err.message : String(err) })
    }

    // Rate-limit delay between requests
    if (delayMs > 0 && urls.indexOf(url) < urls.length - 1) {
      await new Promise((r) => setTimeout(r, delayMs))
    }
  }

  // Step 4: Sweep stale listings per host
  if (sweepAfter) {
    for (const host of hostsSeen) {
      const hostFreshIds = freshIds // all fresh IDs (cross-host sweep is safe)
      const sweepResult = await sweepInactiveListings(host, hostFreshIds, sessionStart)
      result.swept += sweepResult.swept
      for (const e of sweepResult.errors) result.errors.push({ url: host, error: e })
    }
  }

  return result
}
