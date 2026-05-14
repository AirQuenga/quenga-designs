"use server"

/**
 * Automated Property Audit (Self-Healing Data)
 *
 * Processes the ~5,789 properties in `public.properties` in batches.
 * Each row is checked for:
 *   1. Geocoding (lat/lng missing or zero → Mapbox forward-geocode)
 *   2. Address standardization → "[Number] [Street], [City], CA [Zip]"
 *   3. Missing city/zip → filled from Mapbox reverse-geocode
 *   4. Known typo repair (e.g. "Bidwell's Wells" → "Bidwell's Hill")
 *
 * Called repeatedly from a client component so the UI can show
 * "Audited 1200/5789… 45 errors fixed." style progress.
 */

import { createClient } from "@/lib/supabase/server"

/* -------------------------------------------------- types */

export interface AuditBatchResult {
  scanned: number
  fixed: number
  failed: number
  nextOffset: number | null
  total: number
  notes: string[]
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

/* -------------------------------------------------- known data repairs */

const KNOWN_NAME_FIXES: Array<{ wrong: RegExp; right: string }> = [
  { wrong: /bidwell['']?s?\s+wells\s+apartments?/i, right: "Bidwell's Hill Apartments" },
  { wrong: /esplinade/i, right: "Esplanade" },
  { wrong: /paradice/i, right: "Paradise" },
]

/* -------------------------------------------------- formatting helpers */

const STREET_TYPE_MAP: Record<string, string> = {
  street: "St",
  st: "St",
  avenue: "Ave",
  ave: "Ave",
  boulevard: "Blvd",
  blvd: "Blvd",
  road: "Rd",
  rd: "Rd",
  drive: "Dr",
  dr: "Dr",
  lane: "Ln",
  ln: "Ln",
  court: "Ct",
  ct: "Ct",
  circle: "Cir",
  cir: "Cir",
  place: "Pl",
  pl: "Pl",
  parkway: "Pkwy",
  pkwy: "Pkwy",
  highway: "Hwy",
  hwy: "Hwy",
  terrace: "Ter",
  ter: "Ter",
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
      // Cardinal directions
      if (["n", "s", "e", "w", "ne", "nw", "se", "sw"].includes(lower)) return lower.toUpperCase()
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(" ")
}

/**
 * Standardize a free-form address into "[Number] [Street], [City], CA [Zip]".
 * Returns null if the input cannot be parsed into the expected shape.
 */
function standardizeAddress(raw: string, fallback: { city?: string | null; zip?: string | null }): string | null {
  if (!raw) return null
  let cleaned = raw.replace(/\s+/g, " ").trim().replace(/,+/g, ",")

  // Pull out an explicit ZIP if present
  let zip = fallback.zip ?? null
  const zipMatch = cleaned.match(/\b(\d{5})(?:-\d{4})?\b/)
  if (zipMatch) {
    zip = zipMatch[1]
    cleaned = cleaned.replace(zipMatch[0], "").trim()
  }

  // Strip trailing state markers
  cleaned = cleaned.replace(/,?\s*CA\b\.?,?/i, "").replace(/,?\s*California\b\.?,?/i, "")
  cleaned = cleaned.replace(/,\s*,/g, ",").replace(/,\s*$/, "").trim()

  // Split into street + city
  const parts = cleaned.split(",").map((p) => p.trim()).filter(Boolean)
  if (parts.length === 0) return null

  const street = titleCase(parts[0])
  if (!/^\d/.test(street)) return null // Must start with a number

  const city = titleCase(parts[1] || fallback.city || "")
  if (!city) return null
  if (!zip) return null

  return `${street}, ${city}, CA ${zip}`
}

/* -------------------------------------------------- geocoding */

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
    const [lng, lat] = feature.center
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

/* -------------------------------------------------- public API */

/**
 * Returns the total number of property rows so the UI can render
 * "Audited X / TOTAL" without re-counting on each batch.
 */
export async function getAuditTotal(): Promise<number> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true })
  if (error) return 0
  return count ?? 0
}

/**
 * Audit a single batch of properties starting at the given offset.
 * Default batch size is 50 to stay well below API timeouts.
 */
export async function auditBatch(offset = 0, batchSize = 50): Promise<AuditBatchResult> {
  const supabase = await createClient()
  const notes: string[] = []
  let fixed = 0
  let failed = 0

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
      notes: [`Query failed: ${error.message}`],
    }
  }

  const rows = (data ?? []) as PropertyRow[]
  const scanned = rows.length

  for (const row of rows) {
    const updates: Record<string, unknown> = {}

    // 1) Known typo repair on property_name
    if (row.property_name) {
      for (const { wrong, right } of KNOWN_NAME_FIXES) {
        if (wrong.test(row.property_name)) {
          updates.property_name = right
          notes.push(`#${row.id.slice(0, 8)}: name "${row.property_name}" → "${right}"`)
          break
        }
      }
    }

    // 2) Geocoding fill when lat/lng missing OR clearly invalid
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
        if (!row.city && geo.city) updates.city = geo.city
        if (!row.zip_code && geo.zip) updates.zip_code = geo.zip
        notes.push(`#${row.id.slice(0, 8)}: geocoded`)
      }
    }

    // 3) Fill missing city / zip from geocode (when we have coords already)
    if ((!row.city || !row.zip_code) && row.address && !updates.latitude) {
      const geo = await forwardGeocode(row.address)
      if (geo) {
        if (!row.city && geo.city) updates.city = geo.city
        if (!row.zip_code && geo.zip) updates.zip_code = geo.zip
      }
    }

    // 4) Address standardization (run last so we use any newly-filled city/zip)
    const targetCity = (updates.city as string | undefined) ?? row.city
    const targetZip = (updates.zip_code as string | undefined) ?? row.zip_code
    if (row.address) {
      const standardized = standardizeAddress(row.address, { city: targetCity, zip: targetZip })
      if (standardized && standardized !== row.address) {
        updates.address = standardized
      }
      if (!row.state) updates.state = "CA"
    }

    if (Object.keys(updates).length === 0) continue

    updates.updated_at = new Date().toISOString()
    const { error: updateError } = await supabase
      .from("properties")
      .update(updates)
      .eq("id", row.id)

    if (updateError) {
      failed++
      notes.push(`#${row.id.slice(0, 8)}: update failed — ${updateError.message.slice(0, 80)}`)
    } else {
      fixed++
    }
  }

  const nextOffset = offset + scanned
  return {
    scanned,
    fixed,
    failed,
    nextOffset: scanned < batchSize ? null : nextOffset,
    total: totalRows,
    notes,
  }
}
