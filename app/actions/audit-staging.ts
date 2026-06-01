"use server"

/**
 * Audit Staging Actions
 * ---------------------
 * Returns pending fixes WITHOUT writing to the database.
 * The UI holds these in a "Pending Fixes" table for manual review.
 * Only when the user clicks "Approve" do we execute the actual write.
 */

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

      // PASS B: Flag every missing critical field as a warning (like the
      // Resource Hub). Web search is used only to PRE-FILL a suggested value;
      // when it finds nothing, the field still surfaces as a manual-entry warning.
      const missingFieldDefs: { field: string; missing: boolean }[] = [
        { field: "current_rent", missing: !row.current_rent },
        { field: "bedrooms", missing: !row.bedrooms },
        { field: "bathrooms", missing: !row.bathrooms },
        { field: "square_feet", missing: !row.square_feet },
        { field: "zip_code", missing: !row.zip_code },
      ]
      const missingFields = missingFieldDefs.filter((d) => d.missing).map((d) => d.field)

      if (missingFields.length > 0) {
        // Surface each missing field as a warning immediately (no blocking web
        // search). The user fills/edits values in the repair console, and the
        // per-field "Search" button there opens an on-demand web lookup.
        for (const field of missingFields) {
          pendingFixes.push({
            id: `fix-${++fixCounter}`,
            propertyId: row.id,
            field,
            originalValue: null,
            proposedValue: null,
            confidence: "low",
            source: "backfill",
            address: label,
          })
        }

        logs.push({
          level: "WARN",
          message: `${label} needs review (${missingFields.length} field${missingFields.length === 1 ? "" : "s"}): ${missingFields.join(", ")}`,
        })
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

/* ============================================================
 *  UNIFIED REPAIR CONSOLE SUPPORT (per-record, multi-field)
 *  Mirrors applyResourceRepair / bulkApplyResourceRepairs so the
 *  Property Data Hub can use the same <UnifiedRepairConsole/>.
 * ============================================================ */

export type PropertyFieldName =
  | "address"
  | "city"
  | "state"
  | "zip_code"
  | "apn"
  | "bedrooms"
  | "bathrooms"
  | "square_feet"
  | "current_rent"
  | "availability_date"
  | "management_company"
  | "notes"
  | "property_name"

const NUMERIC_PROPERTY_FIELDS: PropertyFieldName[] = [
  "bedrooms",
  "bathrooms",
  "square_feet",
  "current_rent",
]

/**
 * Apply one or more edited/added field values to a single property.
 * Numeric fields are coerced; empty strings are skipped (treated as "leave as-is").
 */
export async function applyPropertyRepair(
  propertyId: string,
  values: Partial<Record<PropertyFieldName, string>>,
): Promise<{ success: boolean; message: string }> {
  const supabase = await createClient()

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const [key, raw] of Object.entries(values) as [PropertyFieldName, string | undefined][]) {
    if (raw == null || String(raw).trim() === "") continue
    if (NUMERIC_PROPERTY_FIELDS.includes(key)) {
      const n = Number(String(raw).replace(/[^0-9.\-]/g, ""))
      patch[key] = Number.isFinite(n) ? n : null
    } else if (key === "zip_code") {
      patch[key] = String(raw).trim().slice(0, 10)
    } else {
      patch[key] = String(raw).trim()
    }
  }

  const fieldKeys = Object.keys(patch).filter((k) => k !== "updated_at")
  if (fieldKeys.length === 0) {
    return { success: false, message: "No values to update" }
  }

  const { error } = await supabase.from("properties").update(patch).eq("id", propertyId)
  if (error) return { success: false, message: error.message }
  return { success: true, message: `Updated ${fieldKeys.join(", ")}` }
}

export interface BulkPropertyRepairItem {
  propertyId: string
  values: Partial<Record<PropertyFieldName, string>>
}

export interface BulkPropertyRepairResult {
  succeeded: string[]
  failed: { propertyId: string; message: string }[]
}

export async function bulkApplyPropertyRepairs(
  items: BulkPropertyRepairItem[],
): Promise<BulkPropertyRepairResult> {
  const succeeded: string[] = []
  const failed: BulkPropertyRepairResult["failed"] = []
  for (const item of items) {
    const result = await applyPropertyRepair(item.propertyId, item.values)
    if (result.success) succeeded.push(item.propertyId)
    else failed.push({ propertyId: item.propertyId, message: result.message })
  }
  return { succeeded, failed }
}
