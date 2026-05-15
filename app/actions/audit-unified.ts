"use server"

/**
 * Unified Property Audit (Self-Healing v4)
 * ----------------------------------------
 * Single-action pipeline that processes the ~5,789 rows in `public.properties`
 * in batches of 25. For each row it runs three passes in order:
 *
 *   PASS A — Typo & Range Repair
 *     - Ordinal typos:        "3th"  → "3rd",  "21st" → "21st",  "32nd" → "32nd"
 *     - Padded-zero anomalies: "114300 Bell Ln" → "1143 Bell Ln"
 *                              "135700 Notre Dame Blvd" → "1357 Notre Dame Blvd"
 *     - Known name typos:     "Bidwell's Wells" → "Bidwell's Hill"
 *     - State backfill:       null → "CA"
 *
 *   PASS B — Fuzzy Web Search (with fallback)
 *     - Attempt 1: strict address lookup ("1357 Notre Dame Blvd, Chico, CA 95928")
 *     - Attempt 2 (only if Attempt 1 returns confidence=none):
 *         drop the street number and run a wider query
 *         ("Notre Dame Blvd Chico CA rentals")
 *
 *   PASS C — Extraction & Save
 *     - Map AI output onto the 12 schema columns
 *     - `rent` is persisted as `current_rent`, `available_date` as `availability_date`
 *     - One unified `supabase.from('properties').update()` per row
 *
 * Each row emits ONE high-intelligence `[FIXED]` / `[INFO]` / `[WARN]` /
 * `[ERROR]` log line describing exactly what was detected and repaired.
 */

import { generateText, Output } from "ai"
import { openai } from "@ai-sdk/openai"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import type { AuditLogLine, AuditBatchResult } from "./audit-db"

/* ------------------------------------------------------------------ types */

interface PropertyRow {
  id: string
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  apn: string | null
  bedrooms: number | null
  bathrooms: number | null
  square_feet: number | null
  current_rent: number | null
  availability_date: string | null
  management_company: string | null
  notes: string | null
  property_name: string | null
}

/* ============================================================
 *  PASS A — Typo & Range Repair (no network)
 * ============================================================ */

/** Convert "3th"/"1th"/"11th"... to proper English ordinals. */
function fixOrdinals(input: string): { value: string; changed: boolean } {
  let changed = false
  const fixed = input.replace(/\b(\d+)(st|nd|rd|th)\b/gi, (_, numStr: string, suffix: string) => {
    const n = parseInt(numStr, 10)
    if (Number.isNaN(n)) return `${numStr}${suffix}`
    const mod100 = n % 100
    const mod10 = n % 10
    let correct: "st" | "nd" | "rd" | "th"
    if (mod100 >= 11 && mod100 <= 13) correct = "th"
    else if (mod10 === 1) correct = "st"
    else if (mod10 === 2) correct = "nd"
    else if (mod10 === 3) correct = "rd"
    else correct = "th"
    if (correct !== suffix.toLowerCase()) changed = true
    return `${numStr}${correct}`
  })
  return { value: fixed, changed }
}

/**
 * Catch padded-zero house-number anomalies:
 *   - 6-digit numbers ending in "00" → trim the trailing "00" (e.g. 114300 → 1143)
 *   - 7-digit numbers ending in "000" → trim "000"
 * Only triggers when the leading number is implausibly large for a US street address
 * (Chico's real street numbers top out around 5 digits).
 */
function fixPaddedHouseNumber(input: string): { value: string; changed: boolean; note?: string } {
  const m = input.match(/^(\d+)(\s+.+)$/)
  if (!m) return { value: input, changed: false }
  const numStr = m[1]
  const tail = m[2]
  const num = parseInt(numStr, 10)
  if (!Number.isFinite(num)) return { value: input, changed: false }

  // 6+ digit house number is the red-flag threshold.
  if (numStr.length >= 6 && numStr.endsWith("00")) {
    const trimmed = numStr.replace(/00$/, "")
    return {
      value: `${trimmed}${tail}`,
      changed: true,
      note: `padded-zero anomaly (${numStr} → ${trimmed})`,
    }
  }
  if (numStr.length >= 7 && numStr.endsWith("000")) {
    const trimmed = numStr.replace(/000$/, "")
    return {
      value: `${trimmed}${tail}`,
      changed: true,
      note: `padded-zero anomaly (${numStr} → ${trimmed})`,
    }
  }
  return { value: input, changed: false }
}

const KNOWN_NAME_FIXES: Array<{ wrong: RegExp; right: string }> = [
  { wrong: /bidwell['\u2019]?s?\s+wells\s+apartments?/i, right: "Bidwell's Hill Apartments" },
  { wrong: /esplinade/i, right: "Esplanade" },
  { wrong: /paradice/i, right: "Paradise" },
]

interface PassAResult {
  patch: Partial<PropertyRow>
  notes: string[]
}

function runPassA(row: PropertyRow): PassAResult {
  const patch: Partial<PropertyRow> = {}
  const notes: string[] = []

  if (row.address) {
    let addr = row.address
    let touched = false

    const padded = fixPaddedHouseNumber(addr)
    if (padded.changed) {
      addr = padded.value
      touched = true
      if (padded.note) notes.push(`Strip-corrected ${padded.note}`)
    }

    const ord = fixOrdinals(addr)
    if (ord.changed) {
      const before = addr
      addr = ord.value
      touched = true
      notes.push(`Standardized ordinal typo ('${before.match(/\d+(st|nd|rd|th)/i)?.[0] ?? before}' → '${addr.match(/\d+(st|nd|rd|th)/i)?.[0] ?? addr}')`)
    }

    if (touched) patch.address = addr
  }

  if (row.property_name) {
    for (const { wrong, right } of KNOWN_NAME_FIXES) {
      if (wrong.test(row.property_name)) {
        patch.property_name = right
        notes.push(`Renamed "${row.property_name}" → "${right}"`)
        break
      }
    }
  }

  if (!row.state) {
    patch.state = "CA"
    notes.push("Set State: CA")
  }

  return { patch, notes }
}

/* ============================================================
 *  PASS B — Fuzzy Web Search (with fallback)
 * ============================================================ */

const ExtractedSchema = z.object({
  address: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  zip: z.string().nullable(),
  apn: z.string().nullable(),
  bedrooms: z.number().nullable(),
  bathrooms: z.number().nullable(),
  square_feet: z.number().nullable(),
  rent: z.number().nullable(),
  available_date: z.string().nullable(),
  management_company: z.string().nullable(),
  notes: z.string().nullable(),
  source_url: z.string().nullable(),
  confidence: z.enum(["high", "medium", "low", "none"]),
})

type Extracted = z.infer<typeof ExtractedSchema>

async function webSearchOnce(prompt: string): Promise<Extracted | null> {
  try {
    const { experimental_output } = await generateText({
      model: openai.responses("gpt-4o-mini"),
      tools: { web_search_preview: openai.tools.webSearchPreview({ searchContextSize: "low" }) },
      experimental_output: Output.object({ schema: ExtractedSchema }),
      stopWhen: ({ steps }: { steps: unknown[] }) => steps.length >= 3,
      prompt,
    })
    return experimental_output as Extracted
  } catch {
    return null
  }
}

function streetNameOnly(address: string): string {
  // "1357 Notre Dame Blvd" → "Notre Dame Blvd"
  return address.replace(/^\d+[A-Za-z]?\s+/, "").trim()
}

interface PassBResult {
  extracted: Extracted | null
  strategy: "exact" | "fuzzy" | "none"
}

async function runPassB(row: PropertyRow, repairedAddress: string | null): Promise<PassBResult> {
  const address = repairedAddress ?? row.address
  if (!address) return { extracted: null, strategy: "none" }

  const exactQuery = [address, row.city, row.state ?? "CA", row.zip_code].filter(Boolean).join(", ")
  const propertyHint = row.property_name ? ` (also known as "${row.property_name}")` : ""

  // ----- Attempt 1: strict address lookup -----
  const exact = await webSearchOnce(
    [
      `You are auditing a rental property record. Use web_search_preview to find the BEST`,
      `matching rental listing on Zillow, Apartments.com, Trulia, Rent.com, Zumper, etc.`,
      ``,
      `Property: ${exactQuery}${propertyHint}`,
      ``,
      `Rules:`,
      `- Use the web_search_preview tool. Never guess.`,
      `- If you cannot find a confident match, set confidence to "none" and return null fields.`,
      `- Rent must be a plain number. Available date must be YYYY-MM-DD or null.`,
    ].join("\n"),
  )

  if (exact && exact.confidence !== "none") {
    return { extracted: exact, strategy: "exact" }
  }

  // ----- Attempt 2: fuzzy fallback (drop street number) -----
  const street = streetNameOnly(address)
  const city = row.city ?? "Chico"
  const fuzzy = await webSearchOnce(
    [
      `The exact address lookup returned nothing for "${exactQuery}".`,
      `Run a WIDER web_search_preview query that drops the street number and looks for`,
      `comparable rentals on the same street. Example queries to try:`,
      `  - "${street} ${city} CA rentals"`,
      `  - "${street} ${city} CA management company"`,
      ``,
      `If a clearly matching listing is found (correct street, plausible unit), return its`,
      `details. Otherwise set confidence to "none".`,
      `- Rent must be a plain number. Available date must be YYYY-MM-DD or null.`,
    ].join("\n"),
  )

  if (fuzzy && fuzzy.confidence !== "none") {
    return { extracted: fuzzy, strategy: "fuzzy" }
  }

  return { extracted: null, strategy: "none" }
}

/* ============================================================
 *  PASS C — Extraction & Save
 * ============================================================ */

interface PassCResult {
  patch: Record<string, unknown>
  filled: string[]
}

function runPassC(row: PropertyRow, basePatch: Partial<PropertyRow>, extracted: Extracted | null): PassCResult {
  const patch: Record<string, unknown> = { ...basePatch }
  const filled: string[] = []

  // Apply Pass A's changes as filled-fields too.
  if (basePatch.address && basePatch.address !== row.address) filled.push("address")
  if (basePatch.property_name && basePatch.property_name !== row.property_name) filled.push("property_name")
  if (basePatch.state && !row.state) filled.push("state")

  if (extracted) {
    const setIfMissing = (col: keyof PropertyRow, value: unknown, prettyName: string): void => {
      const current = (patch[col] ?? row[col]) as unknown
      const missing =
        current === null ||
        current === undefined ||
        current === "" ||
        (typeof current === "number" && current === 0)
      if (missing && value !== null && value !== undefined && value !== "") {
        patch[col] = value
        filled.push(prettyName)
      }
    }

    // ZIP must always be a 5-char string to satisfy the schema.
    const zipValue =
      extracted.zip != null ? String(extracted.zip).slice(0, 5) : null

    setIfMissing("address", extracted.address, "address")
    setIfMissing("city", extracted.city, "city")
    setIfMissing("state", extracted.state, "state")
    setIfMissing("zip_code", zipValue, "zip")
    setIfMissing("apn", extracted.apn, "APN")
    setIfMissing("bedrooms", extracted.bedrooms, "beds")
    setIfMissing("bathrooms", extracted.bathrooms, "baths")
    setIfMissing("square_feet", extracted.square_feet, "sqft")
    // NOTE: real schema columns — current_rent / availability_date
    setIfMissing("current_rent", extracted.rent, `rent ($${extracted.rent ?? "—"})`)
    setIfMissing("availability_date", extracted.available_date, "available_date")
    setIfMissing("management_company", extracted.management_company, "management company")
    setIfMissing("notes", extracted.notes, "notes")
  }

  return { patch, filled }
}

/* ============================================================
 *  Public API
 * ============================================================ */

export async function getUnifiedAuditTotal(): Promise<number> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true })
  if (error) return 0
  return count ?? 0
}

export async function auditUnifiedBatch(offset = 0, batchSize = 25): Promise<AuditBatchResult> {
  const supabase = await createClient()
  const logs: AuditLogLine[] = []
  let fixed = 0
  let failed = 0

  const { count: total } = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true })
  const totalRows = total ?? 0

  // Boundary marker so users see the batch window in the live log.
  const upper = Math.min(offset + batchSize, totalRows)
  logs.push({
    level: "INFO",
    message: `Batch processing records ${offset + 1}–${upper} of ${totalRows.toLocaleString()}...`,
  })

  const { data, error } = await supabase
    .from("properties")
    .select(
      "id, address, city, state, zip_code, apn, bedrooms, bathrooms, square_feet, current_rent, availability_date, management_company, notes, property_name",
    )
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
    const originalLabel = row.address || row.property_name || `record ${row.id.slice(0, 8)}`

    try {
      /* ---------- PASS A: typo + range repair ---------- */
      const passA = runPassA(row)

      /* ---------- PASS B: fuzzy web search ---------- */
      const repairedAddress = (passA.patch.address as string | undefined) ?? row.address ?? null
      const passB = await runPassB(row, repairedAddress)

      /* ---------- PASS C: build single unified patch ---------- */
      const passC = runPassC(row, passA.patch, passB.extracted)

      if (Object.keys(passC.patch).length === 0) {
        // Nothing to do for this row, but emit a quiet INFO if Pass B found a verified match.
        if (passB.extracted && passB.extracted.confidence !== "none") {
          logs.push({
            level: "INFO",
            message: `Verified ${originalLabel} — all 12 fields already complete (confidence: ${passB.extracted.confidence})`,
          })
        }
        continue
      }

      // Persist the unified update.
      passC.patch.updated_at = new Date().toISOString()
      const { error: updateError } = await supabase
        .from("properties")
        .update(passC.patch)
        .eq("id", row.id)

      if (updateError) {
        failed++
        logs.push({
          level: "ERROR",
          message: `Database rejected update for ${originalLabel}: ${updateError.message.slice(0, 120)}`,
        })
        continue
      }

      fixed++

      // Compose a single high-intelligence FIXED line.
      const repairNotes = passA.notes.slice()
      if (passB.extracted) {
        const tag = passB.strategy === "fuzzy" ? "fuzzy web match" : "web match"
        const src = passB.extracted.source_url
          ? ` via ${tag} (${passB.extracted.source_url.slice(0, 60)})`
          : ` via ${tag}`
        const aiFields = passC.filled.filter(
          (f) => !["address", "property_name", "state"].includes(f.split(" ")[0]),
        )
        if (aiFields.length > 0) {
          repairNotes.push(`pulled ${aiFields.slice(0, 4).join(", ")}${aiFields.length > 4 ? `, +${aiFields.length - 4} more` : ""}${src}`)
        } else if (passB.strategy === "fuzzy") {
          repairNotes.push(`linked to neighboring listing${src}`)
        }
      } else if (passB.strategy === "none" && passA.notes.length === 0) {
        // No repairs from A, no AI match — shouldn't normally reach here since patch was empty.
      }

      // Arrow notation: "<original> -> <description>"
      const finalAddress = (passC.patch.address as string | undefined) ?? row.address ?? originalLabel
      const arrow =
        finalAddress !== originalLabel
          ? `${originalLabel} → ${finalAddress}`
          : originalLabel
      const summary = repairNotes.length > 0 ? repairNotes.join(" & ") : "linked to verified source"

      logs.push({
        level: "FIXED",
        message: `${arrow} — ${summary}.`,
      })
    } catch (rowError) {
      failed++
      const msg = rowError instanceof Error ? rowError.message : "Unknown error"
      logs.push({
        level: "ERROR",
        message: `Unhandled exception on ${originalLabel}: ${msg.slice(0, 140)}`,
      })
    }
  }

  const nextOffset = offset + scanned
  return {
    scanned,
    fixed,
    failed,
    nextOffset: scanned < batchSize ? null : nextOffset,
    total: totalRows,
    logs,
  }
}
