"use server"

import * as cheerio from "cheerio"
import { streamObject } from "ai"
import { z } from "zod"
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
  confidence: number
}

export interface ScrapeDirectoryResult {
  success: boolean
  resources: ScrapedResource[]
  logs: ResourceLogLine[]
  error?: string
  extractionMethod: "cheerio" | "ai" | "hybrid"
}

export interface AuditResourceBatchResult {
  scanned: number
  fixed: number
  failed: number
  logs: ResourceLogLine[]
  nextOffset: number | null
}

/* -------------------------------------------------------------------------- */
/*  Constants                                                                 */
/* -------------------------------------------------------------------------- */

const BROWSER_HEADERS: HeadersInit = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
}

const MAX_RETRIES = 2

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function extractPhoneNumbers(text: string): string[] {
  const pattern = /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g
  return Array.from(text.matchAll(pattern))
    .map((m) => m[0].replace(/[^\d]/g, ""))
    .filter((d) => d.length === 10 || (d.length === 11 && d.startsWith("1")))
}

function extractUrls(text: string, baseUrl?: string): string[] {
  const pattern = /https?:\/\/[^\s"'<>)\]]+/gi
  const urls = Array.from(text.matchAll(pattern)).map((m) => m[0])

  // Also look for href attributes
  const hrefPattern = /href=["']([^"']+)["']/gi
  const hrefs = Array.from(text.matchAll(hrefPattern))
    .map((m) => m[1])
    .filter((h) => h.startsWith("http") || h.startsWith("/"))
    .map((h) => {
      if (h.startsWith("/") && baseUrl) {
        try {
          return new URL(h, baseUrl).href
        } catch {
          return null
        }
      }
      return h
    })
    .filter((h): h is string => h !== null)

  return [...new Set([...urls, ...hrefs])]
}

function extractAddresses(text: string): string[] {
  // Enhanced US address pattern
  const patterns = [
    // Full address with suite/apt
    /\d{1,5}\s+[\w\s]{1,40}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Place|Pl|Circle|Cir|Parkway|Pkwy|Highway|Hwy)\.?(?:\s*,?\s*(?:Suite|Ste|Apt|Unit|#)\s*[\w\d-]+)?(?:\s*,?\s*[\w\s]+,?\s*[A-Z]{2}\s*\d{5}(?:-\d{4})?)?/gi,
    // Simpler street address
    /\d{1,5}\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:St|Ave|Rd|Blvd|Dr|Ln|Way|Ct|Pl)\.?/gi,
  ]

  const addresses: string[] = []
  for (const pattern of patterns) {
    const matches = Array.from(text.matchAll(pattern))
    for (const m of matches) {
      const addr = m[0].trim()
      if (addr.length > 10 && !addresses.includes(addr)) {
        addresses.push(addr)
      }
    }
  }
  return addresses
}

function cleanText(text: string | null | undefined): string {
  if (!text) return ""
  return text.replace(/\s+/g, " ").trim()
}

function formatPhone(digits: string): string {
  const clean = digits.replace(/[^\d]/g, "")
  if (clean.length === 10) {
    return `(${clean.slice(0, 3)}) ${clean.slice(3, 6)}-${clean.slice(6)}`
  }
  if (clean.length === 11 && clean.startsWith("1")) {
    return `(${clean.slice(1, 4)}) ${clean.slice(4, 7)}-${clean.slice(7)}`
  }
  return clean
}

function extractHours(text: string): string | null {
  const patterns = [
    // "Monday - Friday: 9am - 5pm"
    /(?:mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\s*[-–to]+\s*(?:mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)[:\s]*\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*[-–to]+\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?/gi,
    // "Hours: 8:00 AM - 5:00 PM"
    /hours?[:\s]+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*[-–to]+\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?/gi,
    // "Open 24 hours" or "24/7"
    /(?:open\s+)?24\s*(?:hours|\/\s*7)/gi,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      return cleanText(match[0])
    }
  }
  return null
}

function detectCategory(name: string, context: string): string {
  const combined = (name + " " + context).toLowerCase()

  const categoryMap: [RegExp, string][] = [
    [/food|pantry|meal|hunger|nutrition|snap|wic|feeding/i, "Food Assistance"],
    [/shelter|homeless|housing|rent|eviction|hud|section\s*8/i, "Housing"],
    [/mental|counseling|therapy|crisis|suicide|psychiatric|behavioral/i, "Mental Health"],
    [/medical|health|clinic|doctor|nurse|hospital|dental|vision/i, "Healthcare"],
    [/legal|lawyer|attorney|court|law|advocate/i, "Legal Aid"],
    [/job|employment|career|workforce|resume|training/i, "Employment"],
    [/child|family|parent|youth|teen|foster|adoption/i, "Family Services"],
    [/senior|elder|aging|medicare|retirement/i, "Senior Services"],
    [/veteran|va\s|military|armed\s*forces/i, "Veteran Services"],
    [/substance|addiction|recovery|sober|aa\s|na\s|detox/i, "Substance Abuse"],
    [/disability|disabled|ada|accessibility|deaf|blind/i, "Disability Services"],
    [/utility|energy|electric|gas|water|liheap/i, "Utility Assistance"],
    [/education|school|ged|literacy|college|scholarship/i, "Education"],
    [/transport|bus|ride|transit|mobility/i, "Transportation"],
    [/clothing|thrift|donation|furniture/i, "Material Goods"],
    [/domestic|violence|abuse|assault|survivor/i, "Domestic Violence"],
    [/immigrant|refugee|immigration|citizenship/i, "Immigration Services"],
  ]

  for (const [pattern, category] of categoryMap) {
    if (pattern.test(combined)) return category
  }

  return "General Resources"
}

/* -------------------------------------------------------------------------- */
/*  Cheerio-Based Directory Parser                                            */
/* -------------------------------------------------------------------------- */

function parseDirectoryWithCheerio(
  html: string,
  sourceUrl: string
): Omit<ScrapedResource, "status" | "existingId">[] {
  const $ = cheerio.load(html)
  const results: Omit<ScrapedResource, "status" | "existingId">[] = []
  const seen = new Set<string>()

  // Strategy 1: Look for structured data (vCard, schema.org)
  $('[itemtype*="Organization"], [itemtype*="LocalBusiness"], .vcard, .hcard').each((_, el) => {
    const $el = $(el)
    const name =
      $el.find('[itemprop="name"], .fn, .org').first().text().trim() ||
      $el.find("h2, h3, h4").first().text().trim()
    if (!name || name.length < 3) return

    const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, "")
    if (seen.has(normalized)) return
    seen.add(normalized)

    const context = $el.text()
    const phones = extractPhoneNumbers(context)
    const urls = extractUrls($el.html() || "", sourceUrl).filter((u) => !u.includes(new URL(sourceUrl).hostname))
    const addresses = extractAddresses(context)

    results.push({
      resource_name: name,
      category: detectCategory(name, context),
      sub_category: null,
      address: addresses[0] || $el.find('[itemprop="streetAddress"], .street-address, .adr').text().trim() || null,
      phone_number: phones[0] ? formatPhone(phones[0]) : null,
      website: urls[0] || null,
      hours: extractHours(context),
      notes: null,
      confidence: 85,
    })
  })

  // Strategy 2: Look for heading + content blocks
  $("article, section, .card, .listing, .resource, .organization, .service, [class*='item']").each((_, el) => {
    const $el = $(el)
    const heading = $el.find("h2, h3, h4, h5, .title, .name").first()
    const name = heading.text().trim()
    if (!name || name.length < 3 || name.length > 200) return

    const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, "")
    if (seen.has(normalized)) return
    seen.add(normalized)

    const context = $el.text()
    const phones = extractPhoneNumbers(context)
    const urls = extractUrls($el.html() || "", sourceUrl).filter((u) => !u.includes(new URL(sourceUrl).hostname))
    const addresses = extractAddresses(context)

    // Skip if no contact info
    if (!phones.length && !addresses.length && !urls.length) return

    results.push({
      resource_name: name,
      category: detectCategory(name, context),
      sub_category: null,
      address: addresses[0] || null,
      phone_number: phones[0] ? formatPhone(phones[0]) : null,
      website: urls[0] || null,
      hours: extractHours(context),
      notes: null,
      confidence: 70,
    })
  })

  // Strategy 3: Look for definition lists (common in resource directories)
  $("dl").each((_, dl) => {
    const $dl = $(dl)
    $dl.find("dt").each((_, dt) => {
      const $dt = $(dt)
      const name = $dt.text().trim()
      if (!name || name.length < 3) return

      const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, "")
      if (seen.has(normalized)) return
      seen.add(normalized)

      const $dd = $dt.next("dd")
      const context = $dd.text()
      const phones = extractPhoneNumbers(context)
      const urls = extractUrls($dd.html() || "", sourceUrl)
      const addresses = extractAddresses(context)

      if (!phones.length && !addresses.length && !urls.length) return

      results.push({
        resource_name: name,
        category: detectCategory(name, context),
        sub_category: null,
        address: addresses[0] || null,
        phone_number: phones[0] ? formatPhone(phones[0]) : null,
        website: urls[0] || null,
        hours: extractHours(context),
        notes: null,
        confidence: 65,
      })
    })
  })

  // Strategy 4: Tables (common for resource listings)
  $("table").each((_, table) => {
    const $table = $(table)
    const headers = $table
      .find("th")
      .map((_, th) => $(th).text().toLowerCase().trim())
      .get()

    // Try to identify column indices
    const nameIdx = headers.findIndex((h) => /name|organization|service|resource/i.test(h))
    const phoneIdx = headers.findIndex((h) => /phone|tel|contact/i.test(h))
    const addressIdx = headers.findIndex((h) => /address|location/i.test(h))
    const websiteIdx = headers.findIndex((h) => /website|url|link/i.test(h))

    if (nameIdx === -1) return // Can't identify name column

    $table.find("tbody tr, tr").each((_, tr) => {
      const $tr = $(tr)
      const cells = $tr.find("td")
      if (cells.length === 0) return

      const name = $(cells[nameIdx]).text().trim()
      if (!name || name.length < 3) return

      const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, "")
      if (seen.has(normalized)) return
      seen.add(normalized)

      const phone = phoneIdx >= 0 ? extractPhoneNumbers($(cells[phoneIdx]).text())[0] : null
      const address = addressIdx >= 0 ? $(cells[addressIdx]).text().trim() : null
      const website =
        websiteIdx >= 0 ? extractUrls($(cells[websiteIdx]).html() || "", sourceUrl)[0] : null

      if (!phone && !address && !website) return

      const context = $tr.text()
      results.push({
        resource_name: name,
        category: detectCategory(name, context),
        sub_category: null,
        address: address || null,
        phone_number: phone ? formatPhone(phone) : null,
        website: website || null,
        hours: extractHours(context),
        notes: null,
        confidence: 75,
      })
    })
  })

  // Strategy 5: Fallback to heading + paragraph pattern
  $("h2, h3, h4").each((_, heading) => {
    const $heading = $(heading)
    const name = $heading.text().trim()
    if (!name || name.length < 3 || name.length > 150) return

    // Skip navigation headings
    if (/^(menu|nav|home|about|contact|services|programs|links)$/i.test(name)) return

    const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, "")
    if (seen.has(normalized)) return

    // Get siblings until next heading
    let context = ""
    let $next = $heading.next()
    for (let i = 0; i < 5 && $next.length; i++) {
      if ($next.is("h1, h2, h3, h4")) break
      context += " " + $next.text()
      $next = $next.next()
    }

    const phones = extractPhoneNumbers(context)
    const urls = extractUrls(context, sourceUrl).filter((u) => {
      try {
        return !u.includes(new URL(sourceUrl).hostname)
      } catch {
        return true
      }
    })
    const addresses = extractAddresses(context)

    if (!phones.length && !addresses.length && !urls.length) return

    seen.add(normalized)
    results.push({
      resource_name: name,
      category: detectCategory(name, context),
      sub_category: null,
      address: addresses[0] || null,
      phone_number: phones[0] ? formatPhone(phones[0]) : null,
      website: urls[0] || null,
      hours: extractHours(context),
      notes: null,
      confidence: 55,
    })
  })

  return results
}

/* -------------------------------------------------------------------------- */
/*  AI-Powered Extraction (Fallback)                                          */
/* -------------------------------------------------------------------------- */

const AIResourceSchema = z.object({
  resources: z.array(
    z.object({
      resource_name: z.string(),
      category: z.string().nullable(),
      address: z.string().nullable(),
      phone_number: z.string().nullable(),
      website: z.string().nullable(),
      hours: z.string().nullable(),
    })
  ),
})

async function extractResourcesWithAI(
  htmlSnippet: string
): Promise<Omit<ScrapedResource, "status" | "existingId">[]> {
  try {
    const truncated = htmlSnippet.slice(0, 20000)

    const { object } = await streamObject({
      model: "openai/gpt-4o-mini",
      schema: AIResourceSchema,
      prompt: `Extract community resources/organizations from this HTML. Look for:
- Organization names
- Addresses
- Phone numbers
- Websites
- Hours of operation
- Categories (Food Assistance, Housing, Mental Health, Healthcare, Legal Aid, Employment, Family Services, Senior Services, Veteran Services, Substance Abuse, Disability Services, Utility Assistance, Education, Transportation, General Resources)

Return an array of resources found. Only include real organizations with at least a name and one contact method (phone, address, or website).

HTML:
${truncated}`,
    })

    const result = await object
    return result.resources.map((r) => ({
      resource_name: r.resource_name,
      category: r.category || "General Resources",
      sub_category: null,
      address: r.address,
      phone_number: r.phone_number ? formatPhone(r.phone_number) : null,
      website: r.website,
      hours: r.hours,
      notes: null,
      confidence: 60,
    }))
  } catch {
    return []
  }
}

/* -------------------------------------------------------------------------- */
/*  Scrape Directory — parses multiple resources from a URL                   */
/* -------------------------------------------------------------------------- */

export async function scrapeResourceDirectory(
  url: string,
  useAiFallback = true
): Promise<ScrapeDirectoryResult> {
  const logs: ResourceLogLine[] = []

  logs.push({ level: "INFO", message: `Fetching directory: ${url}` })

  try {
    // Fetch with retry
    let res: Response | null = null
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        res = await fetch(url, {
          headers: BROWSER_HEADERS,
          signal: AbortSignal.timeout(20000),
        })
        if (res.ok) break
        logs.push({ level: "WARN", message: `Attempt ${attempt}: HTTP ${res.status}` })
      } catch (e) {
        logs.push({ level: "WARN", message: `Attempt ${attempt}: ${e instanceof Error ? e.message : "failed"}` })
      }
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 1000 * attempt))
      }
    }

    if (!res || !res.ok) {
      return {
        success: false,
        resources: [],
        logs: [...logs, { level: "ERROR", message: `Failed to fetch after ${MAX_RETRIES} attempts` }],
        error: `HTTP ${res?.status || "timeout"}`,
        extractionMethod: "cheerio",
      }
    }

    const html = await res.text()
    logs.push({ level: "INFO", message: `Received ${(html.length / 1024).toFixed(1)} KB of HTML` })

    // Parse with Cheerio first
    let parsed = parseDirectoryWithCheerio(html, url)
    let extractionMethod: "cheerio" | "ai" | "hybrid" = "cheerio"
    logs.push({ level: "INFO", message: `Cheerio found ${parsed.length} potential resources` })

    // If Cheerio found few results, try AI fallback
    if (useAiFallback && parsed.length < 3) {
      logs.push({ level: "INFO", message: "Trying AI extraction as fallback..." })
      const aiParsed = await extractResourcesWithAI(html)
      if (aiParsed.length > 0) {
        logs.push({ level: "INFO", message: `AI found ${aiParsed.length} additional resources` })
        // Merge, avoiding duplicates
        const existingNames = new Set(parsed.map((p) => p.resource_name.toLowerCase().replace(/[^a-z0-9]/g, "")))
        for (const r of aiParsed) {
          const normalized = r.resource_name.toLowerCase().replace(/[^a-z0-9]/g, "")
          if (!existingNames.has(normalized)) {
            parsed.push(r)
            existingNames.add(normalized)
          }
        }
        extractionMethod = parsed.length === aiParsed.length ? "ai" : "hybrid"
      }
    }

    // Check each against existing database
    const supabase = await createClient()
    const { data: existing } = await supabase
      .from("community_services")
      .select("id, resource_name, phone_number, address")

    const existingMap = new Map(
      (existing || []).map((e) => [
        e.resource_name.toLowerCase().replace(/[^a-z0-9]/g, ""),
        { id: e.id, phone: e.phone_number, address: e.address },
      ])
    )

    const resources: ScrapedResource[] = []
    for (const item of parsed) {
      const normalized = item.resource_name.toLowerCase().replace(/[^a-z0-9]/g, "")
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

    const newCount = resources.filter((r) => r.status === "new").length
    const existingCount = resources.filter((r) => r.status === "existing").length

    logs.push({
      level: "SUCCESS",
      message: `Discovery complete — ${newCount} new, ${existingCount} existing (via ${extractionMethod})`,
    })

    return { success: true, resources, logs, extractionMethod }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error"
    return {
      success: false,
      resources: [],
      logs: [...logs, { level: "ERROR", message: `Scrape failed: ${msg}` }],
      error: msg,
      extractionMethod: "cheerio",
    }
  }
}

/* -------------------------------------------------------------------------- */
/*  Add Resources to Database                                                 */
/* -------------------------------------------------------------------------- */

export async function addDiscoveredResources(
  resources: ScrapedResource[]
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
  data: Partial<CommunityService> & { category: string; resource_name: string }
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
  const { count } = await supabase.from("community_services").select("*", { count: "exact", head: true })

  return count || 0
}

export async function auditResourceBatch(offset = 0, batchSize = 25): Promise<AuditResourceBatchResult> {
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
      const { error: updateError } = await supabase.from("community_services").update(updates).eq("id", row.id)

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
