import { NextResponse } from "next/server"
import * as cheerio from "cheerio"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const BROWSER_HEADERS: HeadersInit = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "Upgrade-Insecure-Requests": "1",
}

export interface ScrapedListing {
  source_url: string
  source_host: string
  title: string | null
  price: number | null
  available_date: string | null
  bedrooms: number | null
  bathrooms: number | null
  square_feet: number | null
  address: string | null
  description: string | null
  matched_property_id: string | null
  matched_property_address: string | null
}

/** ----------- Parsing helpers ----------- */

function parsePrice(text: string): number | null {
  if (!text) return null
  // Matches "$1,250", "$1250", "1,250 / mo", etc. — picks the largest plausible value
  const matches = text.match(/\$?\s?(\d{1,3}(?:,\d{3})+|\d{3,5})(?:\s?\/\s?mo)?/gi)
  if (!matches) return null
  const numbers = matches
    .map((m) => Number(m.replace(/[^\d]/g, "")))
    .filter((n) => n >= 300 && n <= 20000)
  if (numbers.length === 0) return null
  return Math.max(...numbers)
}

function parseBedrooms(text: string): number | null {
  if (!text) return null
  if (/\bstudio\b/i.test(text)) return 0
  const m = text.match(/(\d+(?:\.\d)?)\s*(?:br|bed|bedroom)/i)
  return m ? Math.round(Number(m[1])) : null
}

function parseBathrooms(text: string): number | null {
  if (!text) return null
  const m = text.match(/(\d+(?:\.\d)?)\s*(?:ba|bath|bathroom)/i)
  return m ? Number(m[1]) : null
}

function parseSquareFeet(text: string): number | null {
  if (!text) return null
  const m = text.match(/(\d{3,5})\s*(?:sq\.?\s*ft|sqft|square\s*feet)/i)
  return m ? Number(m[1]) : null
}

function parseDate(text: string): string | null {
  if (!text) return null
  // ISO date
  const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/)
  if (iso) return iso[1]
  // "Available December 1, 2026" / "Available 12/01/2026"
  const m =
    text.match(/(?:available[^a-z0-9]*)((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s*\d{4})/i) ||
    text.match(/(?:available[^0-9]*)(\d{1,2}\/\d{1,2}\/\d{2,4})/i)
  if (!m) return null
  const d = new Date(m[1])
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

const STREET_SUFFIXES =
  "(?:st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|ln|lane|way|ct|court|cir|circle|pl|place|pkwy|parkway|ter|terrace|hwy|highway)"

function parseAddress(text: string): string | null {
  if (!text) return null
  const re = new RegExp(
    `\\b(\\d{1,6}\\s+[A-Z][A-Za-z0-9'\\-\\.\\s]{2,40}\\s+${STREET_SUFFIXES}\\.?(?:\\s*,?\\s*[A-Z][A-Za-z\\s]{2,30})?(?:\\s*,?\\s*CA)?(?:\\s+\\d{5})?)\\b`,
    "i",
  )
  const m = text.match(re)
  return m ? m[1].replace(/\s+/g, " ").trim() : null
}

/** ----------- Generic page parser ----------- */

function parseHtml(url: string, html: string): Omit<ScrapedListing, "matched_property_id" | "matched_property_address"> {
  const $ = cheerio.load(html)
  const host = new URL(url).hostname.replace(/^www\./, "")

  // 1) JSON-LD structured data
  let jsonLdPrice: number | null = null
  let jsonLdAddress: string | null = null
  let jsonLdBeds: number | null = null
  let jsonLdBaths: number | null = null
  let jsonLdSqft: number | null = null
  let jsonLdDate: string | null = null
  let jsonLdDescription: string | null = null
  let jsonLdTitle: string | null = null

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const raw = $(el).contents().text()
      const parsed = JSON.parse(raw)
      const items = Array.isArray(parsed) ? parsed : [parsed]
      for (const item of items) {
        if (!item) continue
        if (!jsonLdTitle && typeof item.name === "string") jsonLdTitle = item.name
        if (!jsonLdDescription && typeof item.description === "string") jsonLdDescription = item.description
        if (item.address) {
          const a = item.address
          const parts = [a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode].filter(Boolean)
          if (parts.length) jsonLdAddress ??= parts.join(", ")
        }
        if (item.offers?.price && !jsonLdPrice) jsonLdPrice = Number(item.offers.price) || null
        if (item.numberOfBedrooms && !jsonLdBeds) jsonLdBeds = Number(item.numberOfBedrooms) || null
        if (item.numberOfBathroomsTotal && !jsonLdBaths) jsonLdBaths = Number(item.numberOfBathroomsTotal) || null
        if (item.floorSize?.value && !jsonLdSqft) jsonLdSqft = Number(item.floorSize.value) || null
        if (item.datePosted && !jsonLdDate) jsonLdDate = parseDate(String(item.datePosted))
      }
    } catch {
      /* ignore malformed JSON-LD */
    }
  })

  // 2) Fallback: scrape meta + body text
  const metaDescription =
    $('meta[name="description"]').attr("content") ||
    $('meta[property="og:description"]').attr("content") ||
    ""
  const title =
    jsonLdTitle ||
    $('meta[property="og:title"]').attr("content") ||
    $("h1").first().text().trim() ||
    $("title").text().trim() ||
    null

  // Build a haystack of likely content blocks
  const blocks: string[] = []
  $("h1, h2, h3, p, li, .price, [class*='price'], [class*='Price'], [class*='rent'], .description, [itemprop]").each(
    (_, el) => {
      const t = $(el).text().replace(/\s+/g, " ").trim()
      if (t && t.length < 500) blocks.push(t)
    },
  )
  const bodyText = blocks.join(" \u2022 ")
  const haystack = `${metaDescription} \u2022 ${bodyText}`

  const description =
    jsonLdDescription ||
    metaDescription ||
    blocks
      .filter((b) => b.length > 80 && b.length < 400)
      .slice(0, 2)
      .join(" ") ||
    null

  return {
    source_url: url,
    source_host: host,
    title,
    price: jsonLdPrice ?? parsePrice(haystack),
    available_date: jsonLdDate ?? parseDate(haystack),
    bedrooms: jsonLdBeds ?? parseBedrooms(haystack),
    bathrooms: jsonLdBaths ?? parseBathrooms(haystack),
    square_feet: jsonLdSqft ?? parseSquareFeet(haystack),
    address: jsonLdAddress ?? parseAddress(haystack),
    description,
  }
}

/** ----------- Match against Butte County Rental Atlas ----------- */

function normalizeStreet(addr: string): string {
  return addr
    .toLowerCase()
    .replace(/\bstreet\b/g, "st")
    .replace(/\bavenue\b/g, "ave")
    .replace(/\bboulevard\b/g, "blvd")
    .replace(/\broad\b/g, "rd")
    .replace(/\bdrive\b/g, "dr")
    .replace(/\blane\b/g, "ln")
    .replace(/\bcourt\b/g, "ct")
    .replace(/\bcircle\b/g, "cir")
    .replace(/\bparkway\b/g, "pkwy")
    .replace(/[.,#]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

async function matchToAtlas(
  address: string | null,
): Promise<{ id: string; address: string } | null> {
  if (!address) return null
  const supabase = await createClient()
  const normalized = normalizeStreet(address)
  // First chunk is the street portion before any comma
  const streetOnly = normalized.split(",")[0].trim()

  const { data } = await supabase
    .from("properties")
    .select("id, address")
    .ilike("address", `%${streetOnly}%`)
    .limit(5)

  if (!data || data.length === 0) return null
  // Pick the closest match by normalized prefix length
  const ranked = data
    .map((row) => ({
      id: row.id as string,
      address: row.address as string,
      score: normalizeStreet(row.address).startsWith(streetOnly) ? 2 : 1,
    }))
    .sort((a, b) => b.score - a.score)

  return { id: ranked[0].id, address: ranked[0].address }
}

/** ----------- Route handler ----------- */

export async function POST(req: Request) {
  let url: string | undefined
  let pastedHtml: string | undefined
  try {
    const body = (await req.json()) as { url?: string; html?: string }
    url = body.url
    pastedHtml = body.html
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  // ----- Easy-Paste fallback: parse raw HTML/text the user pasted in -----
  if (!url && pastedHtml) {
    if (typeof pastedHtml !== "string" || pastedHtml.trim().length < 10) {
      return NextResponse.json({ error: "Pasted content is too short to parse" }, { status: 400 })
    }
    const sourceUrl = "paste://local"
    const parsed = parseHtml(sourceUrl, pastedHtml)
    const match = await matchToAtlas(parsed.address)
    const listing: ScrapedListing = {
      ...parsed,
      source_host: "Easy Paste",
      matched_property_id: match?.id ?? null,
      matched_property_address: match?.address ?? null,
    }
    return NextResponse.json({ listing })
  }

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "Provide a 'url' or paste raw HTML/text as 'html'" }, { status: 400 })
  }
  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
  }
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return NextResponse.json({ error: "Only http(s) URLs are supported" }, { status: 400 })
  }

  let html: string
  try {
    const res = await fetch(url, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(15000),
      redirect: "follow",
    })
    if (!res.ok) {
      return NextResponse.json(
        {
          error: `Upstream returned ${res.status} ${res.statusText}`,
          hint: "This site is blocking the scraper. Use the Easy Paste fallback below to paste the listing HTML or text directly.",
        },
        { status: 502 },
      )
    }
    const contentType = res.headers.get("content-type") || ""
    if (!contentType.includes("html")) {
      return NextResponse.json({ error: `Unsupported content-type: ${contentType}` }, { status: 415 })
    }
    html = await res.text()
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch failed"
    return NextResponse.json(
      {
        error: `Fetch failed: ${msg}`,
        hint: "This site is blocking the scraper. Use the Easy Paste fallback below to paste the listing HTML or text directly.",
      },
      { status: 502 },
    )
  }

  const parsed = parseHtml(url, html)
  const match = await matchToAtlas(parsed.address)

  const listing: ScrapedListing = {
    ...parsed,
    matched_property_id: match?.id ?? null,
    matched_property_address: match?.address ?? null,
  }

  return NextResponse.json({ listing })
}
