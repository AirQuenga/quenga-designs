"use server"

import { createClient } from "@/lib/supabase/server"
import {
  validateProperty,
  findDuplicates,
  type PropertyRecord,
  type AuditIssue,
} from "@/lib/property-validator"
import { revalidatePath } from "next/cache"

// ---------- Types ----------

export interface AuditRow {
  id: string
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  price: number | null
  bedrooms: number | null
  bathrooms: number | null
  square_feet: number | null
  latitude: number | null
  longitude: number | null
  property_type: string | null
  status: string | null
  description: string | null
  images: unknown
  source_url: string | null
  integrity_score: number | null
  audit_status: string
  last_audited_at: string | null
  audit_issues: AuditIssue[]
  duplicate_of: string | null
}

export interface AuditSummary {
  total: number
  audited: number
  passed: number
  flagged: number
  needsReview: number
  approved: number
  duplicates: number
  averageScore: number
}

const PAGE_FIELDS =
  "id,address,city,state,zip_code,price,bedrooms,bathrooms,square_feet,latitude,longitude,property_type,status,description,images,source_url,integrity_score,audit_status,last_audited_at,audit_issues,duplicate_of"

// ---------- Geocode helper (self-heal coordinates) ----------

async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  const token = process.env.MAPBOX_TOKEN
  if (!token) return null
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
      address,
    )}.json?access_token=${token}&limit=1&country=US`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = (await res.json()) as { features?: Array<{ center?: [number, number] }> }
    const center = data.features?.[0]?.center
    if (!center) return null
    return { lat: center[1], lng: center[0] }
  } catch {
    return null
  }
}

// ---------- Activity log ----------

async function logAction(
  supabase: Awaited<ReturnType<typeof createClient>>,
  entry: {
    property_id: string | null
    action: string
    detail?: string
    integrity_before?: number | null
    integrity_after?: number | null
    issues?: AuditIssue[]
    actor?: string
  },
) {
  await supabase.from("audit_log").insert({
    property_id: entry.property_id,
    action: entry.action,
    detail: entry.detail ?? null,
    integrity_before: entry.integrity_before ?? null,
    integrity_after: entry.integrity_after ?? null,
    issues: entry.issues ?? [],
    actor: entry.actor ?? "system",
  })
}

// ---------- Core: run the tri-factor audit over the whole table ----------

export interface RunAuditResult {
  success: boolean
  scanned: number
  flagged: number
  duplicates: number
  error?: string
}

export async function runFullAudit(): Promise<RunAuditResult> {
  const supabase = await createClient()

  const { data, error } = await supabase.from("properties").select(PAGE_FIELDS)
  if (error) return { success: false, scanned: 0, flagged: 0, duplicates: 0, error: error.message }

  const rows = (data ?? []) as PropertyRecord[]

  // Factor 3: duplicate detection across the full set
  const dupGroups = findDuplicates(rows)
  const duplicateIds = new Map<string, string>() // id -> keptId
  for (const g of dupGroups) {
    const [keep, ...rest] = g.ids
    for (const dupId of rest) duplicateIds.set(dupId, keep)
  }

  let flagged = 0
  const now = new Date().toISOString()

  // Factor 1 (completeness) + Factor 2 (consistency/validity) per row
  for (const row of rows) {
    if (!row.id) continue
    const isDup = duplicateIds.has(row.id)
    const result = validateProperty(row)

    const auditStatus = isDup ? "duplicate" : result.status
    if (auditStatus === "flagged" || auditStatus === "needs_review" || auditStatus === "duplicate") flagged++

    await supabase
      .from("properties")
      .update({
        integrity_score: result.integrityScore,
        audit_status: auditStatus,
        audit_issues: result.issues,
        last_audited_at: now,
        duplicate_of: isDup ? duplicateIds.get(row.id) : null,
      })
      .eq("id", row.id)
  }

  await logAction(supabase, {
    property_id: null,
    action: "full_audit",
    detail: `Scanned ${rows.length} properties, flagged ${flagged}, ${dupGroups.length} duplicate groups.`,
  })

  revalidatePath("/admin/audit")
  return { success: true, scanned: rows.length, flagged, duplicates: dupGroups.length }
}

// ---------- Self-heal a single property ----------

export interface HealResult {
  success: boolean
  scoreBefore: number | null
  scoreAfter: number | null
  applied: string[]
  error?: string
}

export async function selfHealProperty(propertyId: string): Promise<HealResult> {
  const supabase = await createClient()

  const { data, error } = await supabase.from("properties").select(PAGE_FIELDS).eq("id", propertyId).single()
  if (error || !data) return { success: false, scoreBefore: null, scoreAfter: null, applied: [], error: error?.message }

  const row = data as PropertyRecord
  const before = validateProperty(row)
  const updates: Record<string, unknown> = { ...before.fixes }
  const applied: string[] = Object.keys(before.fixes)

  // Geocode backfill when coordinates are missing
  const hasCoords = row.latitude != null && row.longitude != null
  if (!hasCoords && row.address) {
    const full = [row.address, row.city, row.state, row.zip_code].filter(Boolean).join(", ")
    const coords = await geocode(full)
    if (coords) {
      updates.latitude = coords.lat
      updates.longitude = coords.lng
      applied.push("latitude", "longitude")
    }
  }

  if (Object.keys(updates).length === 0) {
    return { success: true, scoreBefore: before.integrityScore, scoreAfter: before.integrityScore, applied: [] }
  }

  // Re-validate against the healed record
  const healed = validateProperty({ ...row, ...updates })
  const now = new Date().toISOString()

  const { error: updErr } = await supabase
    .from("properties")
    .update({
      ...updates,
      integrity_score: healed.integrityScore,
      audit_status: healed.status,
      audit_issues: healed.issues,
      last_audited_at: now,
    })
    .eq("id", propertyId)

  if (updErr) return { success: false, scoreBefore: before.integrityScore, scoreAfter: null, applied: [], error: updErr.message }

  await logAction(supabase, {
    property_id: propertyId,
    action: "self_heal",
    detail: `Auto-fixed: ${applied.join(", ") || "none"}.`,
    integrity_before: before.integrityScore,
    integrity_after: healed.integrityScore,
    issues: healed.issues,
  })

  revalidatePath("/admin/audit")
  return { success: true, scoreBefore: before.integrityScore, scoreAfter: healed.integrityScore, applied }
}

// ---------- Approve / dismiss ----------

export async function approveProperty(propertyId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data } = await supabase.from("properties").select("integrity_score").eq("id", propertyId).single()
  const { error } = await supabase
    .from("properties")
    .update({ audit_status: "approved", last_audited_at: new Date().toISOString() })
    .eq("id", propertyId)
  if (error) return { success: false, error: error.message }
  await logAction(supabase, {
    property_id: propertyId,
    action: "approve",
    detail: "Manually approved by reviewer.",
    integrity_after: (data as { integrity_score: number | null } | null)?.integrity_score ?? null,
    actor: "reviewer",
  })
  revalidatePath("/admin/audit")
  return { success: true }
}

export async function markDuplicate(
  propertyId: string,
  canonicalId: string | null,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("properties")
    .update({ audit_status: "duplicate", duplicate_of: canonicalId, last_audited_at: new Date().toISOString() })
    .eq("id", propertyId)
  if (error) return { success: false, error: error.message }
  await logAction(supabase, {
    property_id: propertyId,
    action: "mark_duplicate",
    detail: canonicalId ? `Marked as duplicate of ${canonicalId}.` : "Marked as duplicate.",
    actor: "reviewer",
  })
  revalidatePath("/admin/audit")
  return { success: true }
}

// ---------- Bulk operations ----------

export async function bulkSelfHeal(ids: string[]): Promise<{ healed: number; errors: number }> {
  let healed = 0
  let errors = 0
  for (const id of ids) {
    const r = await selfHealProperty(id)
    if (r.success) healed++
    else errors++
  }
  return { healed, errors }
}

export async function bulkApprove(ids: string[]): Promise<{ approved: number; errors: number }> {
  let approved = 0
  let errors = 0
  for (const id of ids) {
    const r = await approveProperty(id)
    if (r.success) approved++
    else errors++
  }
  return { approved, errors }
}

// ---------- Paginated fetch for the dashboard ----------

export interface FetchAuditParams {
  tab: "all" | "passed" | "flagged" | "needs_review" | "approved" | "duplicate"
  page: number
  pageSize: number
  search?: string
}

export interface FetchAuditResult {
  rows: AuditRow[]
  total: number
  summary: AuditSummary
}

export async function fetchAuditPage(params: FetchAuditParams): Promise<FetchAuditResult> {
  const supabase = await createClient()
  const { tab, page, pageSize, search } = params

  // Summary counts (lightweight aggregate)
  const { data: allScores } = await supabase.from("properties").select("integrity_score,audit_status")
  const scores = (allScores ?? []) as Array<{ integrity_score: number | null; audit_status: string }>
  const audited = scores.filter((s) => s.audit_status !== "unaudited")
  const summary: AuditSummary = {
    total: scores.length,
    audited: audited.length,
    passed: scores.filter((s) => s.audit_status === "passed").length,
    flagged: scores.filter((s) => s.audit_status === "flagged").length,
    needsReview: scores.filter((s) => s.audit_status === "needs_review").length,
    approved: scores.filter((s) => s.audit_status === "approved").length,
    duplicates: scores.filter((s) => s.audit_status === "duplicate").length,
    averageScore: audited.length
      ? Math.round(audited.reduce((sum, s) => sum + (s.integrity_score ?? 0), 0) / audited.length)
      : 0,
  }

  // Page query
  let query = supabase.from("properties").select(PAGE_FIELDS, { count: "exact" })
  if (tab !== "all") query = query.eq("audit_status", tab)
  if (search && search.trim()) {
    const term = `%${search.trim()}%`
    query = query.or(`address.ilike.${term},city.ilike.${term},zip_code.ilike.${term}`)
  }

  const from = page * pageSize
  query = query.order("integrity_score", { ascending: true, nullsFirst: true }).range(from, from + pageSize - 1)

  const { data, count } = await query
  return {
    rows: (data ?? []) as AuditRow[],
    total: count ?? 0,
    summary,
  }
}

// ---------- Activity log fetch ----------

export interface ActivityEntry {
  id: string
  property_id: string | null
  action: string
  detail: string | null
  integrity_before: number | null
  integrity_after: number | null
  actor: string
  created_at: string
}

export async function fetchActivityLog(limit = 50): Promise<ActivityEntry[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("audit_log")
    .select("id,property_id,action,detail,integrity_before,integrity_after,actor,created_at")
    .order("created_at", { ascending: false })
    .limit(limit)
  return (data ?? []) as ActivityEntry[]
}

// ---------- CSV export ----------

function csvEscape(value: unknown): string {
  const s = value == null ? "" : String(value)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export async function exportAuditCsv(
  tab: FetchAuditParams["tab"] = "all",
): Promise<{ filename: string; csv: string }> {
  const supabase = await createClient()
  let query = supabase.from("properties").select(PAGE_FIELDS)
  if (tab !== "all") query = query.eq("audit_status", tab)
  const { data } = await query.order("integrity_score", { ascending: true, nullsFirst: true })
  const rows = (data ?? []) as AuditRow[]

  const headers = [
    "id",
    "address",
    "city",
    "state",
    "zip_code",
    "price",
    "bedrooms",
    "bathrooms",
    "integrity_score",
    "audit_status",
    "issue_count",
    "last_audited_at",
    "source_url",
  ]
  const lines = [headers.join(",")]
  for (const r of rows) {
    lines.push(
      [
        r.id,
        r.address,
        r.city,
        r.state,
        r.zip_code,
        r.price,
        r.bedrooms,
        r.bathrooms,
        r.integrity_score,
        r.audit_status,
        Array.isArray(r.audit_issues) ? r.audit_issues.length : 0,
        r.last_audited_at,
        r.source_url,
      ]
        .map(csvEscape)
        .join(","),
    )
  }
  return { filename: `audit-${tab}-${new Date().toISOString().slice(0, 10)}.csv`, csv: lines.join("\n") }
}
