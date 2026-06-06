/**
 * Enterprise Property Scraper — Schema Layer
 *
 * Pillar 3: Data Normalization & Validation
 * - Strict Zod schema with graceful coercion of messy real-world strings.
 * - TypeScript interfaces derived from the schema via z.infer.
 * - Address normalization utility.
 */

import { z } from "zod"

// ---------------------------------------------------------------------------
// Coercion helpers
// ---------------------------------------------------------------------------

/**
 * Parse a price string like "$1,200/mo", "Contact Us", "POA", or a bare
 * number into a safe integer (monthly rent in dollars) or null.
 */
function coercePrice(val: unknown): number | null {
  if (val === null || val === undefined) return null
  if (typeof val === "number") return isFinite(val) && val > 0 ? Math.round(val) : null
  const s = String(val).trim()
  if (!s || /contact|call|poa|tbd|inquire|n\/a/i.test(s)) return null
  // Strip currency symbols, commas, and per-month suffixes
  const cleaned = s.replace(/[^0-9.]/g, "")
  const n = parseFloat(cleaned)
  return isFinite(n) && n >= 200 && n <= 50000 ? Math.round(n) : null
}

/**
 * Parse a bedroom string like "2 bd", "Studio", "3-bedroom", or a bare
 * number into an integer (0 = studio) or null.
 */
function coerceBedrooms(val: unknown): number | null {
  if (val === null || val === undefined) return null
  if (typeof val === "number") return Number.isInteger(val) && val >= 0 && val <= 20 ? val : null
  const s = String(val).trim()
  if (/studio|efficiency|bachelor/i.test(s)) return 0
  const m = s.match(/(\d+(?:\.\d)?)/)
  if (!m) return null
  const n = Math.round(parseFloat(m[1]))
  return n >= 0 && n <= 20 ? n : null
}

/**
 * Parse a bathroom string like "1.5 ba", "2 bath", or a number.
 */
function coerceBathrooms(val: unknown): number | null {
  if (val === null || val === undefined) return null
  if (typeof val === "number") return isFinite(val) && val >= 0 && val <= 20 ? val : null
  const s = String(val).trim()
  const m = s.match(/(\d+(?:\.\d)?)/)
  if (!m) return null
  const n = parseFloat(m[1])
  return isFinite(n) && n >= 0 && n <= 20 ? n : null
}

/**
 * Parse a date string into ISO YYYY-MM-DD or null.
 * Accepts "now", "immediate", ISO dates, and US-format dates.
 */
function coerceDate(val: unknown): string | null {
  if (val === null || val === undefined) return null
  const s = String(val).trim()
  if (!s) return null
  if (/\b(now|immediate|asap|today|available\s*now)\b/i.test(s)) {
    return new Date().toISOString().slice(0, 10)
  }
  const iso = s.match(/\b(20\d{2}-\d{2}-\d{2})\b/)
  if (iso) return iso[1]
  const d = new Date(s)
  return !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : null
}

// ---------------------------------------------------------------------------
// Zod schema — the strict data contract
// ---------------------------------------------------------------------------

/**
 * Property listing status values aligned with the DB enum.
 */
export const PropertyStatusEnum = z.enum(["active", "inactive", "pending", "unknown"])

export const RawPropertySchema = z.object({
  /** Unique identifier from the source site (URL slug, listing ID, etc.) */
  source_id: z.string().min(1),

  /** Canonical URL of the listing page */
  source_url: z.string().url(),

  /** Hostname of the scrape origin */
  source_host: z.string().min(1),

  /** Listing title / property name */
  title: z.string().nullable().default(null),

  /** Monthly rent in dollars — messy strings are coerced or nulled */
  price: z
    .union([z.number(), z.string(), z.null(), z.undefined()])
    .transform(coercePrice)
    .pipe(z.number().nullable()),

  /** Bedroom count — 0 = studio */
  bedrooms: z
    .union([z.number(), z.string(), z.null(), z.undefined()])
    .transform(coerceBedrooms)
    .pipe(z.number().nullable()),

  bathrooms: z
    .union([z.number(), z.string(), z.null(), z.undefined()])
    .transform(coerceBathrooms)
    .pipe(z.number().nullable()),

  square_feet: z
    .union([z.number(), z.string(), z.null(), z.undefined()])
    .transform((v) => {
      if (v === null || v === undefined) return null
      const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^0-9.]/g, ""))
      return isFinite(n) && n >= 100 && n <= 20000 ? Math.round(n) : null
    })
    .pipe(z.number().nullable()),

  /** Street-level address — will be normalized before insertion */
  address: z.string().nullable().default(null),
  city: z.string().nullable().default(null),
  state: z.string().max(2).nullable().default(null),
  zip_code: z.string().regex(/^\d{5}(-\d{4})?$/).nullable().default(null),

  available_date: z
    .union([z.string(), z.null(), z.undefined()])
    .transform(coerceDate)
    .pipe(z.string().nullable()),

  property_type: z
    .string()
    .nullable()
    .default(null)
    .transform((v) => {
      if (!v) return null
      const lower = v.toLowerCase()
      if (/studio|efficiency/.test(lower)) return "studio"
      if (/apartment|apt|unit/.test(lower)) return "apartment"
      if (/condo/.test(lower)) return "condo"
      if (/townhouse|townhome/.test(lower)) return "townhouse"
      if (/duplex|triplex|fourplex|multi/.test(lower)) return "multi-family"
      if (/house|home|sfh|single.?family/.test(lower)) return "house"
      if (/room|shared/.test(lower)) return "room"
      if (/mobile|manufactured/.test(lower)) return "mobile home"
      return v
    }),

  status: PropertyStatusEnum.default("active"),

  description: z.string().nullable().default(null),
  amenities: z.array(z.string()).default([]),
  pets_allowed: z.boolean().nullable().default(null),
  images: z.array(z.string().url()).default([]),

  /** Raw JSON payload cached from the network layer — for audit trails */
  raw_payload: z.record(z.unknown()).nullable().default(null),

  /** How was this data extracted */
  extraction_method: z.enum(["next_data", "json_ld", "api_intercept", "regex", "ai", "hybrid"]).default("regex"),

  /** Confidence score 0–1 */
  confidence: z.number().min(0).max(1).default(0.5),

  scraped_at: z.string().default(() => new Date().toISOString()),
})

/** Fully validated, normalized property listing */
export type RawProperty = z.infer<typeof RawPropertySchema>

/** Input before validation (loose types from the network layer) */
export type RawPropertyInput = z.input<typeof RawPropertySchema>

/** Subset written to the Supabase `scraped_listings` table */
export interface ScrapedListingRow {
  source_id: string
  source_url: string
  source_host: string
  title: string | null
  price: number | null
  bedrooms: number | null
  bathrooms: number | null
  square_feet: number | null
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  available_date: string | null
  property_type: string | null
  status: "active" | "inactive" | "pending" | "unknown"
  description: string | null
  amenities: string[]
  pets_allowed: boolean | null
  images: string[]
  raw_payload: Record<string, unknown> | null
  extraction_method: string
  confidence: number
  scraped_at: string
  matched_property_id: string | null
  updated_at: string
}

/** Result returned by the full pipeline for a single URL */
export interface PipelineResult {
  success: boolean
  listing: RawProperty | null
  validationErrors: string[]
  source_id: string
  source_url: string
  cached: boolean
}

/** Result of the sweep operation */
export interface SweepResult {
  swept: number
  errors: string[]
}

// ---------------------------------------------------------------------------
// Address normalization
// ---------------------------------------------------------------------------

const STREET_ABBREVIATIONS: Array<[RegExp, string]> = [
  [/\bStreet\b/gi, "St"],
  [/\bAvenue\b/gi, "Ave"],
  [/\bBoulevard\b/gi, "Blvd"],
  [/\bDrive\b/gi, "Dr"],
  [/\bRoad\b/gi, "Rd"],
  [/\bLane\b/gi, "Ln"],
  [/\bCourt\b/gi, "Ct"],
  [/\bCircle\b/gi, "Cir"],
  [/\bPlace\b/gi, "Pl"],
  [/\bParkway\b/gi, "Pkwy"],
  [/\bHighway\b/gi, "Hwy"],
  [/\bTerrace\b/gi, "Ter"],
  [/\bWay\b/gi, "Way"], // keep as-is; no abbreviation
  [/\bNorth\b(?!\s*(?:ern|ward))/gi, "N"],
  [/\bSouth\b(?!\s*(?:ern|ward))/gi, "S"],
  [/\bEast\b(?!\s*(?:ern|ward))/gi, "E"],
  [/\bWest\b(?!\s*(?:ern|ward))/gi, "W"],
  [/\bApartment\b/gi, "Apt"],
  [/\bSuite\b/gi, "Ste"],
  [/\bUnit\b/gi, "Unit"], // keep
  [/\b#\s*(\d)/g, "Apt $1"], // #4 → Apt 4
]

const DIRECTION_EXPAND: Array<[RegExp, string]> = [
  [/\bN\.\s+/gi, "N "],
  [/\bS\.\s+/gi, "S "],
  [/\bE\.\s+/gi, "E "],
  [/\bW\.\s+/gi, "W "],
]

/**
 * Normalizes a raw address string into a consistent format suitable for
 * deduplication and database insertion.
 *
 * Rules applied (in order):
 * 1. Collapse whitespace and trim.
 * 2. Expand dot-separated directional prefixes (e.g. "N." → "N").
 * 3. Title-case the result.
 * 4. Abbreviate spelled-out suffix words (Street → St, etc.).
 *
 * Returns null if the input is falsy.
 */
export function normalizeAddress(raw: string | null | undefined): string | null {
  if (!raw) return null

  let s = raw.replace(/\s+/g, " ").trim()

  // Expand directional abbreviation dots
  for (const [re, repl] of DIRECTION_EXPAND) {
    s = s.replace(re, repl)
  }

  // Title-case
  s = s
    .toLowerCase()
    .replace(/(?:^|\s)\S/g, (c) => c.toUpperCase())

  // Apply abbreviations
  for (const [re, repl] of STREET_ABBREVIATIONS) {
    s = s.replace(re, repl)
  }

  // Remove duplicate spaces introduced by replacements
  s = s.replace(/\s{2,}/g, " ").trim()

  return s || null
}

/**
 * Derives a deterministic source_id from a URL.
 * Falls back to a hash of the full URL if no listing ID is found in the path.
 */
export function deriveSourceId(url: string): string {
  try {
    const u = new URL(url)
    // Most listing sites embed a numeric or slug ID in the path
    const segments = u.pathname.split("/").filter(Boolean)
    const last = segments[segments.length - 1]
    if (last && /[\w\-]{4,}/.test(last)) return `${u.hostname.replace(/^www\./, "")}::${last}`
    // Fall back to a simple hash
    let hash = 0
    for (let i = 0; i < url.length; i++) {
      hash = (hash << 5) - hash + url.charCodeAt(i)
      hash |= 0
    }
    return `hash::${Math.abs(hash).toString(36)}`
  } catch {
    return `raw::${url.slice(0, 80)}`
  }
}
