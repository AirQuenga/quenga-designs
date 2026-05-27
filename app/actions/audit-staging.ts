"use server"

/**
 * Audit Staging Actions
 * ---------------------
 * Returns pending fixes WITHOUT writing to the database.
 * The UI holds these in a "Pending Fixes" table for manual review.
 * Only when the user clicks "Approve" do we execute the actual write.
 */

import { generateText, Output } from "ai"
import { openai } from "@ai-sdk/openai"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import type { AuditLogLine } from "./audit-db"

/* ------------------------------------------------------------------ types */

export interface PendingFix {
  id: string
  propertyId: string
  field: string
  originalValue: string | number | null
  proposedValue: string | number | null
  confidence: "high" | "medium" | "low"
  source: "typo-repair" | "web-search" | "backfill"
  address: string
}

export interface StagingBatchResult {
  scanned: number
  pendingFixes: PendingFix[]
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

function fixPaddedHouseNumber(input: string): { value: string; changed: boolean; note?: string } {
  const m = input.match(/^(\d+)(\s+.+)$/)
  if (!m) return { value: input, changed: false }
  const numStr = m[1]
  const tail = m[2]
  const num = parseInt(numStr, 10)
  if (!Number.isFinite(num)) return { value: input, changed: false }

  if (numStr.length >= 6 && numStr.endsWith("00")) {
    const trimmed = numStr.replace(/00$/, "")
    return { value: `${trimmed}${tail}`, changed: true, note: `padded-zero (${numStr} -> ${trimmed})` }
  }
  if (numStr.length >= 7 && numStr.endsWith("000")) {
    const trimmed = numStr.replace(/000$/, "")
    return { value: `${trimmed}${tail}`, changed: true, note: `padded-zero (${numStr} -> ${trimmed})` }
  }
  return { value: input, changed: false }
}

/* ============================================================
 *  PASS B — Web Search Schema
 * ============================================================ */

const numLike = z
  .union([z.number(), z.string(), z.null()])
  .transform((v) => {
    if (v === null || v === "") return null
    const n = typeof v === "number" ? v : Number(String(v).replace(/[^0-9.\-]/g, ""))
    return Number.isFinite(n) ? n : null
  })
  .nullable()

const strLike = z
  .union([z.string(), z.number(), z.null()])
  .transform((v) => (v === null || v === "" ? null : String(v)))
  .nullable()

const ExtractedSchema = z.object({
  address: strLike,
  city: strLike,
  state: strLike,
  zip: strLike,
  apn: strLike,
  bedrooms: numLike,
  bathrooms: numLike,
  square_feet: numLike,
  rent: numLike,
  available_date: strLike,
  management_company: strLike,
  notes: strLike,
  source_url: strLike,
  confidence: z.enum(["high", "medium", "low", "none"]).catch("none"),
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

/* ============================================================
 *  STAGING BATCH (no writes)
 * ============================================================ */

export async function getAuditStagingTotal(): Promise<number> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true })
  if (error) return 0
  return count ?? 0
}

export async function auditStagingBatch(offset = 0, batchSize = 25): Promise<StagingBatchResult> {
  const supabase = await createClient()
  const logs: AuditLogLine[] = []
  const pendingFixes: PendingFix[] = []
  let fixCounter = 0

  const { count: total } = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true })
  const totalRows = total ?? 0

  const upper = Math.min(offset + batchSize, totalRows)
  logs.push({
    level: "INFO",
    message: `Staging batch ${offset + 1}-${upper} of ${totalRows.toLocaleString()}...`,
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
      pendingFixes: [],
      nextOffset: null,
      total: totalRows,
      logs: [{ level: "ERROR", message: `Batch query failed: ${error.message}` }],
    }
  }

  const rows = (data ?? []) as PropertyRow[]
  const scanned = rows.length

  for (const row of rows) {
    const label = row.address || row.property_name || `record ${row.id.slice(0, 8)}`

    try {
      // PASS A: Typo repair
      if (row.address) {
        const padded = fixPaddedHouseNumber(row.address)
        if (padded.changed) {
          pendingFixes.push({
            id: `fix-${++fixCounter}`,
            propertyId: row.id,
            field: "address",
            originalValue: row.address,
            proposedValue: padded.value,
            confidence: "high",
            source: "typo-repair",
            address: label,
          })
          logs.push({ level: "INFO", message: `Found padded-zero fix for ${label}` })
        }

        const ord = fixOrdinals(row.address)
        if (ord.changed && !padded.changed) {
          pendingFixes.push({
            id: `fix-${++fixCounter}`,
            propertyId: row.id,
            field: "address",
            originalValue: row.address,
            proposedValue: ord.value,
            confidence: "high",
            source: "typo-repair",
            address: label,
          })
          logs.push({ level: "INFO", message: `Found ordinal typo fix for ${label}` })
        }
      }

      // State backfill
      if (!row.state) {
        pendingFixes.push({
          id: `fix-${++fixCounter}`,
          propertyId: row.id,
          field: "state",
          originalValue: null,
          proposedValue: "CA",
          confidence: "high",
          source: "backfill",
          address: label,
        })
      }

      // PASS B: Web search for missing critical fields
      const hasMissingFields =
        !row.current_rent ||
        !row.bedrooms ||
        !row.bathrooms ||
        !row.square_feet ||
        !row.zip_code

      if (hasMissingFields && row.address) {
        const query = [row.address, row.city, row.state ?? "CA", row.zip_code].filter(Boolean).join(", ")
        const extracted = await webSearchOnce(
          `You are auditing a rental property. Use web_search_preview to find: ${query}. Return rent, bedrooms, bathrooms, square_feet, zip. Set confidence to "none" if not found.`,
        )

        if (extracted && extracted.confidence !== "none") {
          const conf = extracted.confidence as "high" | "medium" | "low"

          if (!row.current_rent && extracted.rent) {
            pendingFixes.push({
              id: `fix-${++fixCounter}`,
              propertyId: row.id,
              field: "current_rent",
              originalValue: row.current_rent,
              proposedValue: extracted.rent,
              confidence: conf,
              source: "web-search",
              address: label,
            })
          }
          if (!row.bedrooms && extracted.bedrooms) {
            pendingFixes.push({
              id: `fix-${++fixCounter}`,
              propertyId: row.id,
              field: "bedrooms",
              originalValue: row.bedrooms,
              proposedValue: extracted.bedrooms,
              confidence: conf,
              source: "web-search",
              address: label,
            })
          }
          if (!row.bathrooms && extracted.bathrooms) {
            pendingFixes.push({
              id: `fix-${++fixCounter}`,
              propertyId: row.id,
              field: "bathrooms",
              originalValue: row.bathrooms,
              proposedValue: extracted.bathrooms,
              confidence: conf,
              source: "web-search",
              address: label,
            })
          }
          if (!row.square_feet && extracted.square_feet) {
            pendingFixes.push({
              id: `fix-${++fixCounter}`,
              propertyId: row.id,
              field: "square_feet",
              originalValue: row.square_feet,
              proposedValue: extracted.square_feet,
              confidence: conf,
              source: "web-search",
              address: label,
            })
          }
          if (!row.zip_code && extracted.zip) {
            pendingFixes.push({
              id: `fix-${++fixCounter}`,
              propertyId: row.id,
              field: "zip_code",
              originalValue: row.zip_code,
              proposedValue: String(extracted.zip).slice(0, 5),
              confidence: conf,
              source: "web-search",
              address: label,
            })
          }

          if (pendingFixes.length > 0) {
            logs.push({
              level: "INFO",
              message: `Web search found data for ${label} (${conf} confidence)`,
            })
          }
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error"
      logs.push({ level: "ERROR", message: `Error processing ${label}: ${msg.slice(0, 100)}` })
    }
  }

  if (pendingFixes.length > 0) {
    logs.push({
      level: "FIXED",
      message: `Batch complete: ${pendingFixes.length} pending fix(es) ready for review`,
    })
  } else {
    logs.push({
      level: "INFO",
      message: `Batch complete: No fixes needed for this batch`,
    })
  }

  const nextOffset = offset + scanned
  return {
    scanned,
    pendingFixes,
    nextOffset: scanned < batchSize ? null : nextOffset,
    total: totalRows,
    logs,
  }
}

/* ============================================================
 *  APPROVE / DENY / APPROVE ALL
 * ============================================================ */

export async function approveFix(fix: PendingFix): Promise<{ success: boolean; message: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from("properties")
    .update({ [fix.field]: fix.proposedValue, updated_at: new Date().toISOString() })
    .eq("id", fix.propertyId)

  if (error) {
    return { success: false, message: `Failed to apply fix: ${error.message}` }
  }

  return { success: true, message: `Applied: ${fix.field} = "${fix.proposedValue}"` }
}

export async function approveAllFixes(
  fixes: PendingFix[],
): Promise<{ success: number; failed: number; logs: AuditLogLine[] }> {
  const supabase = await createClient()
  const logs: AuditLogLine[] = []
  let success = 0
  let failed = 0

  // Group fixes by propertyId to batch updates
  const byProperty = new Map<string, PendingFix[]>()
  for (const fix of fixes) {
    const existing = byProperty.get(fix.propertyId) ?? []
    existing.push(fix)
    byProperty.set(fix.propertyId, existing)
  }

  for (const [propertyId, propertyFixes] of byProperty) {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const fix of propertyFixes) {
      patch[fix.field] = fix.proposedValue
    }

    const { error } = await supabase.from("properties").update(patch).eq("id", propertyId)

    if (error) {
      failed += propertyFixes.length
      logs.push({
        level: "ERROR",
        message: `Failed to update ${propertyFixes[0].address}: ${error.message}`,
      })
    } else {
      success += propertyFixes.length
      const fields = propertyFixes.map((f) => f.field).join(", ")
      logs.push({
        level: "FIXED",
        message: `Applied ${propertyFixes.length} fix(es) to ${propertyFixes[0].address}: ${fields}`,
      })
    }
  }

  return { success, failed, logs }
}

export async function approveFixWithEdit(
  fix: PendingFix,
  editedValue: string | number,
): Promise<{ success: boolean; message: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from("properties")
    .update({ [fix.field]: editedValue, updated_at: new Date().toISOString() })
    .eq("id", fix.propertyId)

  if (error) {
    return { success: false, message: `Failed to apply edited fix: ${error.message}` }
  }

  return { success: true, message: `Applied edited value: ${fix.field} = "${editedValue}"` }
}
