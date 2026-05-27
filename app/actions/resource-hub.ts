"use server"

import { createClient } from "@/lib/supabase/server"
import type { CommunityService } from "./get-community-services"

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

export interface ResourceLogLine {
  level: "INFO" | "SUCCESS" | "FIXED" | "WARN" | "ERROR"
  message: string
}

export interface ScrapedResource {
  resource_name: string
  category: string | null
  sub_category: string | null
  address: string | null
  phone_number: string | null
  website: string | null
  hours: string | null
  notes: string | null
  status: "new" | "existing"
  existingId?: string
}

export interface ScrapeDirectoryResult {
  success: boolean
  resources: ScrapedResource[]
  logs: ResourceLogLine[]
  error?: string
}

export interface AuditResourceBatchResult {
  scanned: number
  fixed: number
  failed: number
  logs: ResourceLogLine[]
  nextOffset: number | null
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function extractPhoneNumbers(text: string): string[] {
  const pattern = /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g
  return Array.from(text.matchAll(pattern)).map((m) => m[0].replace(/[^\d]/g, ""))
}

function extractUrls(text: string): string[] {
  const pattern = /https?:\/\/[^\s"'<>)]+/gi
  return Array.from(text.matchAll(pattern)).map((m) => m[0])
}

function extractAddresses(text: string): string[] {
  // Basic US address pattern
  const pattern = /\d{1,5}\s+[\w\s]{1,40}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Place|Pl)\.?(?:\s*,?\s*(?:Suite|Ste|Apt|Unit|#)\s*\d+)?/gi
  return Array.from(text.matchAll(pattern)).map((m) => m[0].trim())
}

function cleanText(text: string | null | undefined): string {
  if (!text) return ""
  return text.replace(/\s+/g, " ").trim()
}

/* -------------------------------------------------------------------------- */
/*  Scrape Directory — parses multiple resources from a URL                   */
/* -------------------------------------------------------------------------- */

export async function scrapeResourceDirectory(url: string): Promise<ScrapeDirectoryResult> {
  const logs: ResourceLogLine[] = []
  const resources: ScrapedResource[] = []

  logs.push({ level: "INFO", message: `Fetching directory: ${url}` })

  try {
    // Fetch page
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      return {
        success: false,
        resources: [],
        logs: [...logs, { level: "ERROR", message: `HTTP ${res.status}: ${res.statusText}` }],
        error: `HTTP ${res.status}`,
      }
    }

    const html = await res.text()
    logs.push({ level: "INFO", message: `Received ${(html.length / 1024).toFixed(1)} KB of HTML` })

    // Parse HTML for resources
    const parsed = parseDirectoryHtml(html, url)
    logs.push({ level: "INFO", message: `Found ${parsed.length} potential resources in page` })

    // Check each against existing database
    const supabase = await createClient()
    const { data: existing } = await supabase
      .from("community_services")
      .select("id, resource_name, phone_number, address")

    const existingMap = new Map(
      (existing || []).map((e) => [
        normalizeForMatch(e.resource_name),
        { id: e.id, phone: e.phone_number, address: e.address },
      ]),
    )

    for (const item of parsed) {
      const normalized = normalizeForMatch(item.resource_name)
      const match = existingMap.get(normalized)

      if (match) {
        resources.push({
          ...item,
          status: "existing",
          existingId: match.id,
        })
        logs.push({ level: "INFO", message: `Matched existing: "${item.resource_name}"` })
      } else {
        resources.push({ ...item, status: "new" })
        logs.push({ level: "SUCCESS", message: `New resource found: "${item.resource_name}"` })
      }
    }

    logs.push({
      level: "SUCCESS",
      message: `Discovery complete — ${resources.filter((r) => r.status === "new").length} new, ${resources.filter((r) => r.status === "existing").length} existing`,
    })

    return { success: true, resources, logs }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error"
    return {
      success: false,
      resources: [],
      logs: [...logs, { level: "ERROR", message: `Scrape failed: ${msg}` }],
      error: msg,
    }
  }
}

function normalizeForMatch(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "")
}

function parseDirectoryHtml(html: string, sourceUrl: string): Omit<ScrapedResource, "status" | "existingId">[] {
  const results: Omit<ScrapedResource, "status" | "existingId">[] = []

  // Try to detect resource blocks - look for common patterns
  // Pattern 1: <h2>/<h3>/<h4> followed by contact info
  const headingPattern = /<h[2-4][^>]*>(.*?)<\/h[2-4]>/gi
  const headings = Array.from(html.matchAll(headingPattern))

  for (const match of headings) {
    const name = cleanText(match[1].replace(/<[^>]+>/g, ""))
    if (!name || name.length < 3 || name.length > 200) continue

    // Get surrounding context (next 2000 chars)
    const startIdx = match.index || 0
    const context = html.slice(startIdx, startIdx + 2000)

    // Extract contact info from context
    const phones = extractPhoneNumbers(context)
    const urls = extractUrls(context).filter((u) => !u.includes(sourceUrl))
    const addresses = extractAddresses(context)

    // Skip if this looks like a navigation heading
    if (name.match(/^(menu|navigation|contact|about|home|services|programs)$/i)) continue

    results.push({
      resource_name: name,
      category: detectCategory(name, context),
      sub_category: null,
      address: addresses[0] || null,
      phone_number: phones[0] ? formatPhone(phones[0]) : null,
      website: urls[0] || null,
      hours: extractHours(context),
      notes: null,
    })
  }

  // Pattern 2: List items with org names
  const listPattern = /<li[^>]*>(.*?)<\/li>/gis
  const listItems = Array.from(html.matchAll(listPattern))

  for (const match of listItems) {
    const content = match[1]
    const textContent = cleanText(content.replace(/<[^>]+>/g, ""))

    // Skip if already found or too short/long
    if (!textContent || textContent.length < 10 || textContent.length > 500) continue
    if (results.some((r) => normalizeForMatch(r.resource_name) === normalizeForMatch(textContent.slice(0, 100))))
      continue

    // Look for a name at the start
    const nameMatch = textContent.match(/^([^,\-\|]+)/)
    if (!nameMatch) continue

    const name = nameMatch[1].trim()
    if (name.length < 3 || name.length > 150) continue

    const phones = extractPhoneNumbers(content)
    const urls = extractUrls(content)
    const addresses = extractAddresses(content)

    // Only add if we have at least a phone or address
    if (!phones.length && !addresses.length && !urls.length) continue

    results.push({
      resource_name: name,
      category: detectCategory(name, content),
      sub_category: null,
      address: addresses[0] || null,
      phone_number: phones[0] ? formatPhone(phones[0]) : null,
      website: urls[0] || null,
      hours: extractHours(content),
      notes: null,
    })
  }

  // Dedupe by normalized name
  const seen = new Set<string>()
  return results.filter((r) => {
    const key = normalizeForMatch(r.resource_name)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function formatPhone(digits: string): string {
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  return digits
}

function extractHours(text: string): string | null {
  const hoursPattern =
    /(?:hours|open|mon|tue|wed|thu|fri|sat|sun)[:\s]*[\d:apm\-\s,]+(?:am|pm)?/gi
  const matches = Array.from(text.matchAll(hoursPattern))
  if (matches.length > 0) {
    return cleanText(matches[0][0])
  }
  return null
}

function detectCategory(name: string, context: string): string {
  const lowerName = name.toLowerCase()
  const lowerContext = context.toLowerCase()
  const combined = lowerName + " " + lowerContext

  if (combined.match(/food|pantry|meal|hunger|nutrition|snap/)) return "Food Assistance"
  if (combined.match(/shelter|homeless|housing|rent|eviction/)) return "Housing"
  if (combined.match(/mental|counseling|therapy|crisis|suicide/)) return "Mental Health"
  if (combined.match(/medical|health|clinic|doctor|nurse/)) return "Healthcare"
  if (combined.match(/legal|lawyer|attorney|court|law/)) return "Legal Aid"
  if (combined.match(/job|employment|career|workforce|resume/)) return "Employment"
  if (combined.match(/child|family|parent|youth|teen/)) return "Family Services"
  if (combined.match(/senior|elder|aging|medicare/)) return "Senior Services"
  if (combined.match(/veteran|va |military/)) return "Veteran Services"
  if (combined.match(/substance|addiction|recovery|sober|aa|na/)) return "Substance Abuse"
  if (combined.match(/disability|disabled|ada|accessibility/)) return "Disability Services"
  if (combined.match(/utility|energy|electric|gas|water/)) return "Utility Assistance"
  if (combined.match(/education|school|ged|literacy/)) return "Education"
  if (combined.match(/transport|bus|ride|transit/)) return "Transportation"

  return "General Resources"
}

/* -------------------------------------------------------------------------- */
/*  Add Resources to Database                                                 */
/* -------------------------------------------------------------------------- */

export async function addDiscoveredResources(
  resources: ScrapedResource[],
): Promise<{ added: number; skipped: number; logs: ResourceLogLine[] }> {
  const logs: ResourceLogLine[] = []
  const supabase = await createClient()

  const toInsert = resources.filter((r) => r.status === "new")
  logs.push({ level: "INFO", message: `Adding ${toInsert.length} new resources to database` })

  let added = 0
  let skipped = 0

  for (const resource of toInsert) {
    const { error } = await supabase.from("community_services").insert({
      resource_name: resource.resource_name,
      category: resource.category || "General Resources",
      sub_category: resource.sub_category,
      address: resource.address,
      phone_number: resource.phone_number,
      website: resource.website,
      hours: resource.hours,
      notes: resource.notes,
    })

    if (error) {
      logs.push({ level: "ERROR", message: `Failed to add "${resource.resource_name}": ${error.message}` })
      skipped++
    } else {
      logs.push({ level: "SUCCESS", message: `Added: "${resource.resource_name}"` })
      added++
    }
  }

  logs.push({
    level: added > 0 ? "SUCCESS" : "WARN",
    message: `Batch complete — ${added} added, ${skipped} failed`,
  })

  return { added, skipped, logs }
}

/* -------------------------------------------------------------------------- */
/*  Manual Entry                                                              */
/* -------------------------------------------------------------------------- */

export async function createResource(
  data: Partial<CommunityService> & { category: string; resource_name: string },
): Promise<{ success: boolean; error?: string; logs: ResourceLogLine[] }> {
  const logs: ResourceLogLine[] = []
  logs.push({ level: "INFO", message: `Creating resource: "${data.resource_name}"` })

  const supabase = await createClient()
  const { error } = await supabase.from("community_services").insert({
    resource_name: data.resource_name,
    category: data.category,
    sub_category: data.sub_category || null,
    address: data.address || null,
    phone_number: data.phone_number || null,
    website: data.website || null,
    hours: data.hours || null,
    notes: data.notes || null,
    other_contact_info: data.other_contact_info || null,
  })

  if (error) {
    logs.push({ level: "ERROR", message: `Failed: ${error.message}` })
    return { success: false, error: error.message, logs }
  }

  logs.push({ level: "SUCCESS", message: `Created: "${data.resource_name}" in ${data.category}` })
  return { success: true, logs }
}

/* -------------------------------------------------------------------------- */
/*  Resource Audit                                                            */
/* -------------------------------------------------------------------------- */

export async function getResourceAuditTotal(): Promise<number> {
  const supabase = await createClient()
  const { count } = await supabase
    .from("community_services")
    .select("*", { count: "exact", head: true })

  return count || 0
}

export async function auditResourceBatch(
  offset = 0,
  batchSize = 25,
): Promise<AuditResourceBatchResult> {
  const logs: ResourceLogLine[] = []
  const supabase = await createClient()

  const { data: rows, error } = await supabase
    .from("community_services")
    .select("*")
    .order("created_at", { ascending: true })
    .range(offset, offset + batchSize - 1)

  if (error) {
    logs.push({ level: "ERROR", message: `Fetch failed: ${error.message}` })
    return { scanned: 0, fixed: 0, failed: 1, logs, nextOffset: null }
  }

  if (!rows || rows.length === 0) {
    return { scanned: 0, fixed: 0, failed: 0, logs, nextOffset: null }
  }

  let fixed = 0
  let failed = 0

  for (const row of rows) {
    const updates: Record<string, unknown> = {}
    const fixes: string[] = []

    // Check website validity
    if (row.website) {
      try {
        const check = await fetch(row.website, {
          method: "HEAD",
          signal: AbortSignal.timeout(5000),
        })
        if (!check.ok) {
          logs.push({
            level: "WARN",
            message: `"${row.resource_name}" website returned ${check.status} - marking for review`,
          })
        }
      } catch {
        logs.push({
          level: "WARN",
          message: `"${row.resource_name}" website unreachable - may be inactive`,
        })
      }
    }

    // Standardize phone format
    if (row.phone_number) {
      const digits = row.phone_number.replace(/[^\d]/g, "")
      if (digits.length === 10) {
        const formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
        if (formatted !== row.phone_number) {
          updates.phone_number = formatted
          fixes.push("phone format")
        }
      }
    }

    // Trim whitespace from text fields
    const textFields = ["resource_name", "address", "hours", "notes"] as const
    for (const field of textFields) {
      const val = row[field]
      if (typeof val === "string") {
        const trimmed = val.replace(/\s+/g, " ").trim()
        if (trimmed !== val) {
          updates[field] = trimmed
          fixes.push(`${field} whitespace`)
        }
      }
    }

    // Apply updates
    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString()
      const { error: updateError } = await supabase
        .from("community_services")
        .update(updates)
        .eq("id", row.id)

      if (updateError) {
        logs.push({ level: "ERROR", message: `Failed to update "${row.resource_name}": ${updateError.message}` })
        failed++
      } else {
        logs.push({ level: "FIXED", message: `Fixed "${row.resource_name}": ${fixes.join(", ")}` })
        fixed++
      }
    }
  }

  const nextOffset = rows.length === batchSize ? offset + batchSize : null

  if (fixed === 0 && failed === 0) {
    logs.push({ level: "INFO", message: `Scanned ${rows.length} resources — all valid` })
  }

  return {
    scanned: rows.length,
    fixed,
    failed,
    logs,
    nextOffset,
  }
}
