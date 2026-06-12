import { z } from "zod"
import { normalizeAddress } from "@/lib/scraper/schema"

/**
 * PropertyValidator
 * ------------------
 * Pure, dependency-light validation + integrity scoring for property rows.
 * Used by the audit engine to produce an integrity score (0-100), a list of
 * structured issues, and duplicate / cross-reference detection.
 *
 * Scoring philosophy: every property starts at 100 and loses points for each
 * problem found. Issues are weighted by severity so a single critical problem
 * (e.g. missing address) hurts far more than a soft warning (e.g. no photos).
 */

export type IssueSeverity = "critical" | "warning" | "info"

export interface AuditIssue {
  code: string
  severity: IssueSeverity
  field: string | null
  message: string
  /** Points deducted from the integrity score for this issue. */
  penalty: number
}

/** Minimal shape the validator needs. Extra fields are ignored. */
export interface PropertyRecord {
  id?: string
  address?: string | null
  city?: string | null
  state?: string | null
  zip_code?: string | null
  price?: number | string | null
  bedrooms?: number | string | null
  bathrooms?: number | string | null
  square_feet?: number | string | null
  latitude?: number | string | null
  longitude?: number | string | null
  property_type?: string | null
  status?: string | null
  description?: string | null
  images?: unknown
  source_url?: string | null
  available_date?: string | null
  [key: string]: unknown
}

export interface ValidationResult {
  integrityScore: number
  status: "passed" | "flagged" | "needs_review"
  issues: AuditIssue[]
  /** Field-level suggestions the self-healer can apply automatically. */
  fixes: Record<string, unknown>
}

// ---------- Zod contract for a "complete & trustworthy" listing ----------

const numeric = z.preprocess((v) => {
  if (v === null || v === undefined || v === "") return undefined
  const n = typeof v === "string" ? Number(v.replace(/[^0-9.]/g, "")) : Number(v)
  return Number.isFinite(n) ? n : undefined
}, z.number().optional())

export const propertyContract = z.object({
  address: z.string().trim().min(4).optional(),
  city: z.string().trim().min(2).optional(),
  state: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/u, "State should be a 2-letter code")
    .optional(),
  zip_code: z
    .string()
    .trim()
    .regex(/^\d{5}(-\d{4})?$/u, "ZIP should be 5 (or 9) digits")
    .optional(),
  price: numeric.refine((n) => n === undefined || (n > 0 && n < 100_000), "Price out of expected range"),
  bedrooms: numeric.refine((n) => n === undefined || (n >= 0 && n <= 20), "Bedrooms out of range"),
  bathrooms: numeric.refine((n) => n === undefined || (n >= 0 && n <= 20), "Bathrooms out of range"),
  square_feet: numeric.refine((n) => n === undefined || (n > 50 && n < 100_000), "Square footage out of range"),
  latitude: numeric.refine((n) => n === undefined || (n >= -90 && n <= 90), "Latitude out of range"),
  longitude: numeric.refine((n) => n === undefined || (n >= -180 && n <= 180), "Longitude out of range"),
})

// ---------- Helpers ----------

function toNumber(v: unknown): number | undefined {
  if (v === null || v === undefined || v === "") return undefined
  const n = typeof v === "string" ? Number(v.replace(/[^0-9.-]/g, "")) : Number(v)
  return Number.isFinite(n) ? n : undefined
}

function imageCount(images: unknown): number {
  if (Array.isArray(images)) return images.length
  if (typeof images === "string") {
    try {
      const parsed = JSON.parse(images)
      return Array.isArray(parsed) ? parsed.length : images.trim() ? 1 : 0
    } catch {
      return images.trim() ? 1 : 0
    }
  }
  return 0
}

// ---------- Core validation ----------

/**
 * Validate a single property record and compute its integrity score.
 */
export function validateProperty(record: PropertyRecord): ValidationResult {
  const issues: AuditIssue[] = []
  const fixes: Record<string, unknown> = {}

  // --- Completeness checks (presence of core fields) ---
  if (!record.address || String(record.address).trim().length < 4) {
    issues.push({ code: "missing_address", severity: "critical", field: "address", message: "Street address is missing or too short.", penalty: 30 })
  }
  if (!record.city || String(record.city).trim().length < 2) {
    issues.push({ code: "missing_city", severity: "critical", field: "city", message: "City is missing.", penalty: 15 })
  }
  if (!record.state) {
    issues.push({ code: "missing_state", severity: "warning", field: "state", message: "State is missing.", penalty: 8 })
  }
  if (!record.zip_code) {
    issues.push({ code: "missing_zip", severity: "warning", field: "zip_code", message: "ZIP code is missing.", penalty: 6 })
  }

  const price = toNumber(record.price)
  if (price === undefined) {
    issues.push({ code: "missing_price", severity: "critical", field: "price", message: "Price is missing or unparseable.", penalty: 20 })
  } else if (price <= 0 || price >= 100_000) {
    issues.push({ code: "price_out_of_range", severity: "warning", field: "price", message: `Price ($${price}) is outside the expected monthly-rent range.`, penalty: 10 })
  }

  const beds = toNumber(record.bedrooms)
  if (beds === undefined) {
    issues.push({ code: "missing_bedrooms", severity: "warning", field: "bedrooms", message: "Bedroom count is missing.", penalty: 6 })
  } else if (beds < 0 || beds > 20) {
    issues.push({ code: "bedrooms_out_of_range", severity: "warning", field: "bedrooms", message: `Bedroom count (${beds}) looks invalid.`, penalty: 6 })
  }

  const baths = toNumber(record.bathrooms)
  if (baths === undefined) {
    issues.push({ code: "missing_bathrooms", severity: "info", field: "bathrooms", message: "Bathroom count is missing.", penalty: 4 })
  } else if (baths < 0 || baths > 20) {
    issues.push({ code: "bathrooms_out_of_range", severity: "warning", field: "bathrooms", message: `Bathroom count (${baths}) looks invalid.`, penalty: 4 })
  }

  // --- Geocoding / coordinate checks ---
  const lat = toNumber(record.latitude)
  const lng = toNumber(record.longitude)
  if (lat === undefined || lng === undefined) {
    issues.push({ code: "missing_coordinates", severity: "warning", field: "latitude", message: "Map coordinates are missing (property won't appear on the map).", penalty: 10 })
  } else if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    issues.push({ code: "invalid_coordinates", severity: "critical", field: "latitude", message: "Coordinates are outside valid bounds.", penalty: 15 })
  }

  // --- Media / content quality ---
  const photos = imageCount(record.images)
  if (photos === 0) {
    issues.push({ code: "no_photos", severity: "info", field: "images", message: "No photos attached.", penalty: 5 })
  }
  if (!record.description || String(record.description).trim().length < 20) {
    issues.push({ code: "thin_description", severity: "info", field: "description", message: "Description is missing or very short.", penalty: 3 })
  }
  if (!record.property_type) {
    issues.push({ code: "missing_property_type", severity: "info", field: "property_type", message: "Property type is unset.", penalty: 3 })
  }

  // --- Self-heal suggestions: normalize address formatting ---
  if (record.address) {
    const normalized = normalizeAddress(String(record.address))
    if (normalized && normalized !== record.address) {
      fixes.address = normalized
      issues.push({ code: "address_unnormalized", severity: "info", field: "address", message: `Address can be normalized to "${normalized}".`, penalty: 2 })
    }
  }
  // Uppercase a lowercase state code in place
  if (record.state && /^[a-z]{2}$/u.test(String(record.state))) {
    fixes.state = String(record.state).toUpperCase()
  }

  // --- Score ---
  const totalPenalty = issues.reduce((sum, i) => sum + i.penalty, 0)
  const integrityScore = Math.max(0, Math.min(100, 100 - totalPenalty))

  const hasCritical = issues.some((i) => i.severity === "critical")
  let status: ValidationResult["status"]
  if (hasCritical || integrityScore < 50) status = "needs_review"
  else if (integrityScore < 85) status = "flagged"
  else status = "passed"

  return { integrityScore, status, issues, fixes }
}

// ---------- Duplicate detection ----------

/** Build a stable fingerprint for a property used in duplicate grouping. */
export function propertyFingerprint(record: PropertyRecord): string {
  const addr = record.address ? (normalizeAddress(String(record.address)) ?? "").toLowerCase() : ""
  const city = (record.city ?? "").toString().trim().toLowerCase()
  const zip = (record.zip_code ?? "").toString().trim()
  return `${addr}|${city}|${zip}`.replace(/\s+/g, " ").trim()
}

export interface DuplicateGroup {
  fingerprint: string
  ids: string[]
}

/**
 * Group records that share a fingerprint. Returns only groups with >1 member.
 */
export function findDuplicates(records: PropertyRecord[]): DuplicateGroup[] {
  const map = new Map<string, string[]>()
  for (const r of records) {
    if (!r.id) continue
    const fp = propertyFingerprint(r)
    if (!fp || fp === "||") continue
    const arr = map.get(fp) ?? []
    arr.push(r.id)
    map.set(fp, arr)
  }
  const groups: DuplicateGroup[] = []
  for (const [fingerprint, ids] of map) {
    if (ids.length > 1) groups.push({ fingerprint, ids })
  }
  return groups
}

/**
 * Cross-reference a scraped/staging record against existing live records to
 * detect whether it already exists in the database.
 */
export function crossReference(
  candidate: PropertyRecord,
  existing: PropertyRecord[],
): { isDuplicate: boolean; matchId: string | null } {
  const fp = propertyFingerprint(candidate)
  if (!fp || fp === "||") return { isDuplicate: false, matchId: null }
  const match = existing.find((e) => e.id !== candidate.id && propertyFingerprint(e) === fp)
  return { isDuplicate: Boolean(match), matchId: match?.id ?? null }
}
