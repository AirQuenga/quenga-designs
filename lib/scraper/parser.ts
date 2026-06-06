/**
 * Enterprise Property Scraper — Parsing Layer  (Pillar 2 + 3)
 *
 * Step 2 of the two-step pipeline:  parseAndValidateProperty()
 *
 * Accepts a RawFetchResult (the output of fetchRawPropertyData) and returns
 * a fully validated, Zod-normalised RawProperty — or a structured error.
 *
 * Extraction priority (Pillar 2):
 *   1. Intercepted API / XHR JSON payloads  (richest, most stable)
 *   2. __NEXT_DATA__                         (server-rendered state)
 *   3. application/ld+json                   (structured metadata)
 *   4. Cheerio regex / CSS selector fallback (last resort)
 */

import * as cheerio from "cheerio"
import {
  RawPropertySchema,
  normalizeAddress,
  deriveSourceId,
  type RawProperty,
  type RawPropertyInput,
  type PipelineResult,
} from "./schema"
import type { RawFetchResult } from "./types"

// ---------------------------------------------------------------------------
// Regex helpers (shared with the cheerio fallback path)
// ---------------------------------------------------------------------------

function parsePrice(text: string): number | null {
  if (!text) return null
  const cleaned = text.replace(/deposit|fee|application|refundable/gi, "")
  const matches = cleaned.match(/\$?\s?(\d{1,3}(?:,\d{3})*|\d{3,5})(?:\s?\/\s?(?:mo|month|per\s*month))?/gi)
  if (!matches) return null
  const numbers = matches
    .map((m) => Number(m.replace(/[^\d]/g, "")))
    .filter((n) => n >= 300 && n <= 50000)
  return numbers[0] ?? null
}

function parseBedrooms(text: string): number | null {
  if (!text) return null
  if (/\bstudio\b/i.test(text)) return 0
  const m = text.match(/(\d+(?:\.\d)?)\s*[-]?\s*(?:br|bed|bedroom|bd)\b/i)
  return m ? Math.round(Number(m[1])) : null
}

function parseBathrooms(text: string): number | null {
  if (!text) return null
  const m = text.match(/(\d+(?:\.\d)?)\s*[-]?\s*(?:ba|bath|bathroom)\b/i)
  return m ? Number(m[1]) : null
}

function parseSqFt(text: string): number | null {
  if (!text) return null
  const m = text.match(/(\d{1,3}(?:,\d{3})?|\d{3,5})\s*(?:sq\.?\s*ft|sqft|square\s*feet|sf)\b/i)
  if (!m) return null
  const n = Number(m[1].replace(/,/g, ""))
  return n >= 100 && n <= 20000 ? n : null
}

function parseDate(text: string): string | null {
  if (!text) return null
  if (/\b(now|immediate|asap|today|available\s*now)\b/i.test(text)) {
    return new Date().toISOString().slice(0, 10)
  }
  const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/)
  if (iso) return iso[1]
  const d = new Date(text)
  return !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : null
}

function parsePets(text: string): boolean | null {
  if (!text) return null
  if (/\b(no\s*pets?|pets?\s*not\s*allowed|pet[\s-]?free)\b/i.test(text)) return false
  if (/\b(pets?\s*(ok|allowed|welcome|friendly)|cats?\s*ok|dogs?\s*ok)\b/i.test(text)) return true
  return null
}

function parseAmenities(text: string): string[] {
  const patterns: [RegExp, string][] = [
    [/\b(washer\s*[\/&]?\s*dryer|w\/d|in.?unit\s+laundry)\b/i, "Washer/Dryer"],
    [/\b(dishwasher)\b/i, "Dishwasher"],
    [/\b(garage|parking|carport)\b/i, "Parking"],
    [/\b(pool|swimming)\b/i, "Pool"],
    [/\b(gym|fitness|workout)\b/i, "Gym"],
    [/\b(a\/?c|air\s*condition|central\s*air|hvac)\b/i, "A/C"],
    [/\b(balcony|patio|deck)\b/i, "Balcony/Patio"],
    [/\b(hardwood|wood\s*floor)\b/i, "Hardwood Floors"],
    [/\b(fireplace)\b/i, "Fireplace"],
    [/\b(yard|garden|backyard)\b/i, "Yard"],
    [/\b(storage)\b/i, "Storage"],
    [/\b(furnished)\b/i, "Furnished"],
    [/\b(utilities?\s*included|all\s*bills?\s*paid)\b/i, "Utilities Included"],
    [/\b(ev\s*charging|electric\s*vehicle)\b/i, "EV Charging"],
    [/\b(pet.?friendly|pets?\s*(ok|allowed))\b/i, "Pet Friendly"],
  ]
  return [...new Set(patterns.flatMap(([re, name]) => (re.test(text) ? [name] : [])))]
}

// ---------------------------------------------------------------------------
// Strategy 1: Intercepted API / XHR payload extraction
// ---------------------------------------------------------------------------

/**
 * Walks the intercepted JSON payloads looking for something that contains
 * property-like fields. Returns the first plausible candidate.
 */
function extractFromApiPayloads(payloads: Record<string, unknown>[]): Partial<RawPropertyInput> | null {
  for (const payload of payloads) {
    const candidate = walkForPropertyObject(payload)
    if (candidate) return candidate
  }
  return null
}

type JsonObject = Record<string, unknown>

function walkForPropertyObject(obj: unknown, depth = 0): Partial<RawPropertyInput> | null {
  if (depth > 6 || !obj || typeof obj !== "object") return null

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const result = walkForPropertyObject(item, depth + 1)
      if (result) return result
    }
    return null
  }

  const o = obj as JsonObject

  // Heuristic: objects that look like a property listing
  const hasPrice = "price" in o || "rent" in o || "rentAmount" in o || "listPrice" in o
  const hasBeds = "bedrooms" in o || "beds" in o || "numberOfBedrooms" in o
  const hasAddr = "address" in o || "streetAddress" in o || "situs" in o

  if ((hasPrice || hasBeds) && hasAddr) {
    return {
      price: (o.price ?? o.rent ?? o.rentAmount ?? o.listPrice) as number | string | null,
      bedrooms: (o.bedrooms ?? o.beds ?? o.numberOfBedrooms) as number | string | null,
      bathrooms: (o.bathrooms ?? o.baths ?? o.numberOfBathroomsTotal) as number | string | null,
      square_feet: (o.squareFeet ?? o.livingArea ?? o.floorSize) as number | string | null,
      address: (o.address ?? o.streetAddress ?? o.situs) as string | null,
      city: (o.city ?? o.addressLocality) as string | null,
      state: (o.state ?? o.addressRegion) as string | null,
      zip_code: (o.zipcode ?? o.postalCode ?? o.zip) as string | null,
      available_date: (o.availableDate ?? o.moveInDate) as string | null,
      property_type: (o.propertyType ?? o.homeType ?? o.type) as string | null,
      pets_allowed: (o.petsAllowed ?? o.pets) as boolean | null,
      amenities: Array.isArray(o.amenities) ? (o.amenities as string[]) : [],
      description: (o.description ?? o.summary) as string | null,
    }
  }

  // Recurse into child objects
  for (const key of Object.keys(o)) {
    const child = (o as JsonObject)[key]
    const result = walkForPropertyObject(child, depth + 1)
    if (result) return result
  }

  return null
}

// ---------------------------------------------------------------------------
// Strategy 2: __NEXT_DATA__ extraction
// ---------------------------------------------------------------------------

function extractFromNextData(nextData: Record<string, unknown>): Partial<RawPropertyInput> | null {
  // Try common Next.js page-props shapes used by major listing sites
  const pageProps = (nextData?.props as JsonObject)?.pageProps as JsonObject | undefined
  if (!pageProps) return null

  // Try known shapes — cast through unknown for dynamic key access
  const initialData = pageProps?.initialData as JsonObject | undefined
  const initialReduxState = pageProps?.initialReduxState as JsonObject | undefined
  const gdp = initialReduxState?.gdp as JsonObject | undefined
  const currentListingDetails = initialReduxState?.currentListingDetails as JsonObject | undefined
  const serverData = pageProps?.serverData as JsonObject | undefined

  const candidates = [
    pageProps?.property,
    pageProps?.listing,
    initialData?.listing,
    initialData?.property,
    pageProps?.gdpClientCache,
    gdp?.building,
    currentListingDetails?.listing,
    serverData?.listingData,
  ]

  for (const c of candidates) {
    const result = walkForPropertyObject(c)
    if (result) return result
  }

  return null
}

// ---------------------------------------------------------------------------
// Strategy 3: application/ld+json extraction
// ---------------------------------------------------------------------------

function extractFromLdJson(blocks: Record<string, unknown>[]): Partial<RawPropertyInput> | null {
  for (const block of blocks) {
    const items = Array.isArray(block) ? block : [block]
    for (const item of items as JsonObject[]) {
      if (!item || typeof item !== "object") continue

      const type = String(item["@type"] ?? "").toLowerCase()
      if (!type.includes("apartment") && !type.includes("residence") && !type.includes("place") && !type.includes("offer")) {
        continue
      }

      const addr = item.address as JsonObject | undefined
      return {
        title: item.name as string | null,
        description: item.description as string | null,
        price: (item.offers as JsonObject)?.price as number | string | null,
        bedrooms: item.numberOfBedrooms as number | string | null,
        bathrooms: item.numberOfBathroomsTotal as number | string | null,
        square_feet: (item.floorSize as JsonObject)?.value as number | string | null,
        address: addr?.streetAddress as string | null,
        city: addr?.addressLocality as string | null,
        state: addr?.addressRegion as string | null,
        zip_code: addr?.postalCode as string | null,
        images: Array.isArray(item.image)
          ? (item.image as string[]).filter((i) => typeof i === "string").slice(0, 8)
          : typeof item.image === "string"
          ? [item.image]
          : [],
      }
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Strategy 4: Cheerio / regex fallback
// ---------------------------------------------------------------------------

function extractFromHtml(url: string, html: string): Partial<RawPropertyInput> {
  const $ = cheerio.load(html)
  const host = new URL(url).hostname.replace(/^www\./, "")

  // Build a rich text haystack from semantic content blocks
  const blocks: string[] = []
  $(
    "h1, h2, h3, p, li, span, div, " +
      ".price, [class*='price'], [class*='Price'], [class*='rent'], [class*='Rent'], " +
      "[class*='detail'], [class*='feature'], [class*='amenity'], " +
      "[itemprop], [data-testid], [class*='bed'], [class*='bath'], [class*='sq']"
  ).each((_, el) => {
    const t = $(el).text().replace(/\s+/g, " ").trim()
    if (t.length > 2 && t.length < 1000) blocks.push(t)
  })

  const bodyText = blocks.join(" | ")
  const metaDesc =
    $('meta[name="description"]').attr("content") ||
    $('meta[property="og:description"]').attr("content") ||
    ""
  const metaTitle =
    $('meta[property="og:title"]').attr("content") || $("h1").first().text().trim() || $("title").text().trim()
  const haystack = `${metaTitle} | ${metaDesc} | ${bodyText}`

  // Site-specific overrides
  let siteTitle: string | null = null
  let sitePrice: number | null = null
  let siteAddress: string | null = null

  if (/craigslist/i.test(host)) {
    siteTitle = $("#titletextonly").text().trim() || null
    sitePrice = parsePrice($(".price").first().text())
    siteAddress = $("[data-latitude]").attr("data-address") ?? null
  } else if (/zillow/i.test(host)) {
    siteAddress = $('h1[class*="address"]').text().trim() || $('[data-testid="bdp-summary-address"]').text().trim() || null
  } else if (/apartments\.com/i.test(host)) {
    siteTitle = $('h1[class*="propertyName"], h1').first().text().trim() || null
    siteAddress = $('[class*="propertyAddress"], [data-testid="address"]').text().trim() || null
    sitePrice = parsePrice($('[class*="pricingColumn"], [class*="rentLabel"]').first().text())
  }

  // Extract images
  const images: string[] = []
  const seenImgs = new Set<string>()
  $("img[src], img[data-src], meta[property='og:image']").each((_, el) => {
    let src = $(el).attr("src") || $(el).attr("data-src") || $(el).attr("content")
    if (!src) return
    try {
      src = new URL(src, url).href
    } catch {
      return
    }
    const w = parseInt($(el).attr("width") ?? "0", 10)
    const h = parseInt($(el).attr("height") ?? "0", 10)
    if ((w > 0 && w < 100) || (h > 0 && h < 100)) return
    if (/logo|icon|avatar|badge|sprite/i.test(src)) return
    if (!seenImgs.has(src)) { seenImgs.add(src); images.push(src) }
  })

  const description = metaDesc || blocks.filter((b) => b.length > 80).slice(0, 2).join(" ") || null

  return {
    title: siteTitle || metaTitle || null,
    price: sitePrice ?? parsePrice(haystack),
    bedrooms: parseBedrooms(haystack),
    bathrooms: parseBathrooms(haystack),
    square_feet: parseSqFt(haystack),
    address: siteAddress || null,
    available_date: parseDate(haystack),
    pets_allowed: parsePets(haystack),
    amenities: parseAmenities(haystack),
    images: images.slice(0, 10),
    description,
  }
}

// ---------------------------------------------------------------------------
// Step 2 — parseAndValidateProperty()  (Pillar 3 + 4)
// ---------------------------------------------------------------------------

/**
 * **Step 2 of the two-step pipeline.**
 *
 * Accepts a RawFetchResult snapshot (from Step 1) and returns a fully
 * validated, Zod-coerced RawProperty — or a structured error payload.
 *
 * Extraction strategies are tried in priority order; results are merged
 * so that lower-priority strategies fill gaps left by higher ones.
 */
export function parseAndValidateProperty(fetchResult: RawFetchResult): PipelineResult {
  const { url, html, nextDataJson, ldJsonBlocks, interceptedApiPayloads } = fetchResult

  const source_id = deriveSourceId(url)
  const source_host = (() => { try { return new URL(url).hostname.replace(/^www\./, "") } catch { return url } })()

  // Merge partial results: higher-priority sources override lower ones
  let merged: Partial<RawPropertyInput> = {}

  // Strategy 4 (lowest priority): raw HTML / cheerio
  const fromHtml = extractFromHtml(url, html)
  merged = { ...fromHtml }

  // Strategy 3: ld+json
  const fromLd = extractFromLdJson(ldJsonBlocks)
  if (fromLd) {
    merged = mergePartials(merged, fromLd)
  }

  // Strategy 2: __NEXT_DATA__
  if (nextDataJson) {
    const fromNext = extractFromNextData(nextDataJson)
    if (fromNext) {
      merged = mergePartials(merged, fromNext)
    }
  }

  // Strategy 1 (highest priority): intercepted API payloads
  const fromApi = extractFromApiPayloads(interceptedApiPayloads)
  if (fromApi) {
    merged = mergePartials(merged, fromApi)
  }

  // Determine extraction method label
  let extraction_method: RawPropertyInput["extraction_method"] = "regex"
  if (fromApi) extraction_method = "api_intercept"
  else if (nextDataJson && extractFromNextData(nextDataJson)) extraction_method = "next_data"
  else if (fromLd) extraction_method = "json_ld"
  else if (fromApi || nextDataJson) extraction_method = "hybrid"

  // Confidence heuristic
  const filledFields = Object.values(merged).filter((v) => v !== null && v !== undefined && v !== "").length
  const confidence = Math.min(1, filledFields / 10)

  // Normalize address before validation
  const normalizedAddress = normalizeAddress(merged.address ?? null)

  // Build the full input object
  const input: RawPropertyInput = {
    source_id,
    source_url: url,
    source_host,
    extraction_method,
    confidence,
    scraped_at: fetchResult.fetchedAt,
    raw_payload: interceptedApiPayloads[0] ?? nextDataJson ?? null,
    ...merged,
    address: normalizedAddress,
  }

  // Validate with Zod  (Pillar 3)
  const parsed = RawPropertySchema.safeParse(input)

  if (!parsed.success) {
    const validationErrors = parsed.error.issues.map(
      (i) => `${i.path.join(".")}: ${i.message}`
    )
    return { success: false, listing: null, validationErrors, source_id, source_url: url, cached: false }
  }

  return { success: true, listing: parsed.data, validationErrors: [], source_id, source_url: url, cached: false }
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/** Merge two partial objects, with `b` overriding `a` only for non-null values */
function mergePartials(
  a: Partial<RawPropertyInput>,
  b: Partial<RawPropertyInput>
): Partial<RawPropertyInput> {
  const result = { ...a }
  for (const [k, v] of Object.entries(b) as [keyof RawPropertyInput, unknown][]) {
    if (v !== null && v !== undefined && v !== "") {
      ;(result as Record<string, unknown>)[k] = v
    }
  }
  return result
}
