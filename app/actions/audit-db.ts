"use server"

/**
 * Automated Property Audit (Self-Healing Data) — v2
 *
 * Processes the ~5,789 properties in `public.properties` in small batches
 * so the server action never exceeds the platform timeout.
 *
 * Per-row checks (each emits its own `[SUCCESS]` / `[ERROR]` log line):
 *   1. Known-name typo repair          (e.g. "Bidwell's Wells" → "Bidwell's Hill")
 *   2. Geocoding when lat/lng missing  (Mapbox forward geocode)
 *   3. Missing city / zip fill         (from Mapbox context array)
 *   4. Address standardization         ("[Number] [St], [City], CA [Zip]")
 *   5. State backfill                  ("CA" when null)
 *
 * Each fix is persisted to Supabase **immediately** via
 * `supabase.from('properties').update().eq('id', ...)`. A single row
 * failure NEVER aborts the batch — the error is caught, logged, and
 * the loop continues with the next row.
 */

import { createClient } from "@/lib/supabase/server"

/* ------------------------------------------------------------------ types */

export interface AuditLogLine {
  level: "FIXED" | "SUCCESS" | "ERROR" | "WARN" | "INFO"
  message: string
}

export interface AuditBatchResult {
  scanned: number
  fixed: number
  failed: number
  nextOffset: number | null
  total: number
  logs: AuditLogLine[]
}

interface PropertyRow {
  id: string
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  latitude: number | null
  longitude: number | null
  property_name: string | null
}

/* ----------------------------------------------------- name typo repairs */

const KNOWN_NAME_FIXES: Array<{ wrong: RegExp; right: string }> = [
  { wrong: /bidwell['\u2019]?s?\s+wells\s+apartments?/i, right: "Bidwell's Hill Apartments" },
  { wrong: /esplinade/i, right: "Esplanade" },
  { wrong: /paradice/i, right: "Paradise" },
]

/* --------------------------------------------------- formatting helpers */

const STREET_TYPE_MAP: Record<string, string> = {
  street: "St", st: "St",
  avenue: "Ave", ave: "Ave",
  boulevard: "Blvd", blvd: "Blvd",
  road: "Rd", rd: "Rd",
  drive: "Dr", dr: "Dr",
  lane: "Ln", ln: "Ln",
  court: "Ct", ct: "Ct",
  circle: "Cir", cir: "Cir",
  place: "Pl", pl: "Pl",
  parkway: "Pkwy", pkwy: "Pkwy",
  highway: "Hwy", hwy: "Hwy",
  terrace: "Ter", ter: "Ter",
  way: "Way",
}

function titleCase(input: string): string {
  return input
    .toLowerCase()
    .split(/\s+/)
    .map((word) => {
      if (!word) return word
      const lower = word.toLowerCase()
      if (STREET_TYPE_MAP[lower]) return STREET_TYPE_MAP[lower]
      if (["n", "s", "e", "w", "ne", "nw", "se", "sw"].includes(lower)) return lower.toUpperCase()
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(" ")
}

function standardizeAddress(
  raw: string,
  fallback: { city?: string | null; zip?: string | null },
): string | null {
  if (!raw) return null
  let cleaned = raw.replace(/\s+/g, " ").trim().replace(/,+/g, ",")

  let zip = fallback.zip ?? null
  const zipMatch = cleaned.match(/\b(\d{5})(?:-\d{4})?\b/)
  if (zipMatch) {
    zip = zipMatch[1]
    cleaned = cleaned.replace(zipMatch[0], "").trim()
  }

  cleaned = cleaned.replace(/,?\s*CA\b\.?,?/i, "").replace(/,?\s*California\b\.?,?/i, "")
  cleaned = cleaned.replace(/,\s*,/g, ",").replace(/,\s*$/, "").trim()

  const parts = cleaned.split(",").map((p) => p.trim()).filter(Boolean)
  if (parts.length === 0) return null

  const street = titleCase(parts[0])
  if (!/^\d/.test(street)) return null

  const city = titleCase(parts[1] || fallback.city || "")
  if (!city) return null
  if (!zip) return null

  return `${street}, ${city}, CA ${zip}`
}

/* ------------------------------------------------------------ geocoding */

interface GeocodeResult {
  latitude: number
  longitude: number
  city: string | null
  zip: string | null
}

async function forwardGeocode(query: string): Promise<GeocodeResult | null> {
  const token = process.env.MAPBOX_TOKEN
  if (!token) return null
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
      query,
    )}.json?access_token=${token}&country=US&types=address&limit=1`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const data = await res.json()
    const feature = data?.features?.[0]
    if (!feature) return null
    const [lng, lat] = feature.center as [number, number]
    let city: string | null = null
    let zip: string | null = null
    for (const ctx of feature.context || []) {
      if (typeof ctx.id !== "string") continue
      if (ctx.id.startsWith("place.")) city = ctx.text || null
      if (ctx.id.startsWith("postcode.")) zip = ctx.text || null
    }
    return { latitude: lat, longitude: lng, city, zip }
  } catch {
    return null
  }
}

/* ------------------------------------------------------------ public API */

export async function getAuditTotal(): Promise<number> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true })
  if (error) return 0
  return count ?? 0
}

/**
 * Audit a single batch starting at `offset`. Default batch size is 25 to
 * keep each server-action invocation comfortably under timeout limits
 * even when every row needs a geocode call.
 */
export async function auditBatch(offset = 0, batchSize = 25): Promise<AuditBatchResult> {
  const supabase = await createClient()
  const logs: AuditLogLine[] = []
  let fixed = 0
  let failed = 0

  // Total row count for the progress bar
  const { count: total } = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true })
  const totalRows = total ?? 0

  const { data, error } = await supabase
    .from("properties")
    .select("id, address, city, state, zip_code, latitude, longitude, property_name")
    .order("id", { ascending: true })
    .range(offset, offset + batchSize - 1)

  if (error) {
    return {
      scanned: 0,
      fixed: 0,
      failed: 0,
      nextOffset: null,
      total: totalRows,
      logs: [{ level: "ERROR", message: `Batch query failed at offset ${offset}: ${error.message}` }],
    }
  }

  const rows = (data ?? []) as PropertyRow[]
  const scanned = rows.length

  for (const row of rows) {
    try {
      const label = row.address || row.property_name || `record ${row.id.slice(0, 8)}`
      const updates: Record<string, unknown> = {}
      const reasons: string[] = []

      /* ---------- 1) Name typo repair ---------- */
      if (row.property_name) {
        for (const { wrong, right } of KNOWN_NAME_FIXES) {
          if (wrong.test(row.property_name)) {
            updates.property_name = right
            reasons.push(`Renamed "${row.property_name}" → "${right}"`)
            break
          }
        }
      }

      /* ---------- 2) Geocoding (lat/lng missing or invalid) ---------- */
      const needsCoords =
        row.latitude === null ||
        row.longitude === null ||
        row.latitude === 0 ||
        row.longitude === 0 ||
        Math.abs(Number(row.latitude)) < 0.0001

      if (needsCoords && row.address) {
        const query = [row.address, row.city, "CA", row.zip_code].filter(Boolean).join(", ")
        const geo = await forwardGeocode(query)
        if (geo) {
          updates.latitude = geo.latitude
          updates.longitude = geo.longitude
          reasons.push(`Geocoded (Lat: ${geo.latitude.toFixed(4)}, Lng: ${geo.longitude.toFixed(4)})`)
          if (!row.city && geo.city) {
            updates.city = geo.city
            reasons.push(`Added Missing City: ${geo.city}`)
          }
          if (!row.zip_code && geo.zip) {
            updates.zip_code = geo.zip
            reasons.push(`Added Missing Zip: ${geo.zip}`)
          }
        } else {
          logs.push({
            level: "WARN",
            message: `Failed to Geocode: ${label} (Address not found)`,
          })
        }
      }

      /* ---------- 3) Fill missing city/zip when coords already exist ---------- */
      if ((!row.city || !row.zip_code) && row.address && updates.latitude === undefined) {
        const geo = await forwardGeocode(row.address)
        if (geo) {
          if (!row.city && geo.city) {
            updates.city = geo.city
            reasons.push(`Added Missing City: ${geo.city}`)
          }
          if (!row.zip_code && geo.zip) {
            updates.zip_code = geo.zip
            reasons.push(`Added Missing Zip: ${geo.zip}`)
          }
        }
      }

      /* ---------- 4) Address standardization ---------- */
      const targetCity = (updates.city as string | undefined) ?? row.city
      const targetZip = (updates.zip_code as string | undefined) ?? row.zip_code
      if (row.address) {
        const standardized = standardizeAddress(row.address, { city: targetCity, zip: targetZip })
        if (standardized && standardized !== row.address) {
          updates.address = standardized
          reasons.push(`Standardized Address → ${standardized}`)
        }
      }

      /* ---------- 5) State backfill ---------- */
      if (!row.state) {
        updates.state = "CA"
        reasons.push(`Set State: CA`)
      }

      if (Object.keys(updates).length === 0) continue

      /* ---------- Persist immediately ---------- */
      updates.updated_at = new Date().toISOString()
      const { error: updateError } = await supabase
        .from("properties")
        .update(updates)
        .eq("id", row.id)

      if (updateError) {
        failed++
        logs.push({
          level: "ERROR",
          message: `Database rejected update for ${label}: ${updateError.message.slice(0, 120)}`,
        })
      } else {
        fixed++
        logs.push({
          level: "FIXED",
          message: `Database Updated — ${label} (${reasons.join("; ")})`,
        })
      }
    } catch (rowError) {
      failed++
      const msg = rowError instanceof Error ? rowError.message : "Unknown error"
      logs.push({
        level: "ERROR",
        message: `Unhandled exception on row ${row.id.slice(0, 8)}: ${msg.slice(0, 120)}`,
      })
      // Continue with the next row — never abort the batch.
    }
  }

  const nextOffset = offset + scanned
  return {
    scanned,
    fixed,
    failed,
    // Stop when the batch was short (last page) OR returned nothing at all
    nextOffset: scanned < batchSize ? null : nextOffset,
    total: totalRows,
    logs,
  }
}
