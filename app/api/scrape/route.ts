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
  Referer: "https://www.google.com/",
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
  city: string | null
  state: string | null
  zip_code: string | null
  description: string | null
  property_type: string | null
  amenities: string[]
  pets_allowed: boolean | null
  images: string[]
  matched_property_id: string | null
  matched_property_address: string | null
  confidence: number
}

/* ============================================================
 *  PARSING HELPERS
 * ============================================================ */

function parsePrice(text: string): number | null {
  if (!text) return null
  // Remove common noise
  const cleaned = text.replace(/deposit|fee|application/gi, "")
  // Matches "$1,250", "$1250", "1,250 / mo", "$1,500/month" etc.
  const matches = cleaned.match(/\$?\s?(\d{1,3}(?:,\d{3})*|\d{3,5})(?:\s?(?:\/\s?(?:mo|month|per\s*month))?)?/gi)
  if (!matches) return null
  const numbers = matches
    .map((m) => Number(m.replace(/[^\d]/g, "")))
    .filter((n) => n >= 400 && n <= 15000) // Reasonable rent range
  if (numbers.length === 0) return null
  // Usually the first reasonable number is the rent
  return numbers[0]
}

function parseBedrooms(text: string): number | null {
  if (!text) return null
  if (/\bstudio\b/i.test(text)) return 0
  // Match "3 bed", "3 BR", "3 bedroom", "3-bedroom", "3bd"
  const m = text.match(/(\d+(?:\.\d)?)\s*[-]?\s*(?:br|bed|bedroom|bd)\b/i)
  if (m) return Math.round(Number(m[1]))
  // Try "3/2" format (beds/baths)
  const slashMatch = text.match(/\b(\d)\s*\/\s*\d/)
  if (slashMatch) return Number(slashMatch[1])
  return null
}

function parseBathrooms(text: string): number | null {
  if (!text) return null
  // Match "2 bath", "2 BA", "2 bathroom", "1.5 bath", "2ba"
  const m = text.match(/(\d+(?:\.\d)?)\s*[-]?\s*(?:ba|bath|bathroom)\b/i)
  if (m) return Number(m[1])
  // Try "3/2" format (beds/baths)
  const slashMatch = text.match(/\b\d\s*\/\s*(\d(?:\.\d)?)/)
  if (slashMatch) return Number(slashMatch[1])
  return null
}

function parseSquareFeet(text: string): number | null {
  if (!text) return null
  // Match "1,200 sq ft", "1200 sqft", "1200 square feet", "1,200SF"
  const m = text.match(/(\d{1,3}(?:,\d{3})?|\d{3,5})\s*(?:sq\.?\s*ft|sqft|square\s*feet|sf)\b/i)
  if (!m) return null
  const num = Number(m[1].replace(/,/g, ""))
  // Sanity check: reasonable square footage range
  return num >= 200 && num <= 10000 ? num : null
}

function parseDate(text: string): string | null {
  if (!text) return null
  // "Now", "Immediately", "ASAP"
  if (/\b(now|immediate|asap|today)\b/i.test(text)) {
    return new Date().toISOString().slice(0, 10)
  }
  // ISO date: 2026-05-20
  const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/)
  if (iso) return iso[1]
  // "December 1, 2026" / "Dec 1 2026" / "12/01/2026" / "12-01-2026"
  const patterns = [
    /(?:available[:\s]*)?(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
    /(?:available[:\s]*)?((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{4})/i,
    /(?:available[:\s]*)?(\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s*\d{4})/i,
  ]
  for (const re of patterns) {
    const m = text.match(re)
    if (m) {
      const d = new Date(m[1].replace(/(\d+)(st|nd|rd|th)/i, "$1"))
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
    }
  }
  return null
}

const STREET_SUFFIXES =
  "st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|ln|lane|way|ct|court|cir|circle|pl|place|pkwy|parkway|ter|terrace|hwy|highway|esplanade|esp"

interface ParsedAddress {
  full: string
  street: string | null
  city: string | null
  state: string | null
  zip: string | null
}

function parseAddress(text: string): ParsedAddress | null {
  if (!text) return null
  // Clean up the text
  const cleaned = text.replace(/\s+/g, " ").trim()
  
  // Try to match full address pattern: "123 Main St, Chico, CA 95928"
  const fullRe = new RegExp(
    `(\\d{1,6}\\s+[A-Z][A-Za-z0-9'\\-\\.\\s]{2,40}\\s+(?:${STREET_SUFFIXES})\\.?)` +
    `(?:[,\\s]+([A-Za-z\\s]{2,30}))` +
    `(?:[,\\s]+([A-Z]{2}))` +
    `(?:[,\\s]+(\\d{5}(?:-\\d{4})?))?`,
    "i"
  )
  const fullMatch = cleaned.match(fullRe)
  if (fullMatch) {
    return {
      full: fullMatch[0].trim(),
      street: fullMatch[1]?.trim() || null,
      city: fullMatch[2]?.trim() || null,
      state: fullMatch[3]?.toUpperCase() || null,
      zip: fullMatch[4] || null,
    }
  }

  // Try simpler street-only pattern
  const streetRe = new RegExp(
    `\\b(\\d{1,6}\\s+[A-Z][A-Za-z0-9'\\-\\.\\s]{2,40}\\s+(?:${STREET_SUFFIXES})\\.?)\\b`,
    "i"
  )
  const streetMatch = cleaned.match(streetRe)
  if (streetMatch) {
    // Try to find city/state/zip after the street
    const afterStreet = cleaned.slice(cleaned.indexOf(streetMatch[0]) + streetMatch[0].length)
    const cityStateZip = afterStreet.match(/[,\s]+([A-Za-z\s]{2,30})[,\s]+([A-Z]{2})[,\s]*(\d{5})?/i)
    
    return {
      full: streetMatch[0] + (cityStateZip ? cityStateZip[0] : ""),
      street: streetMatch[1]?.trim() || null,
      city: cityStateZip?.[1]?.trim() || null,
      state: cityStateZip?.[2]?.toUpperCase() || null,
      zip: cityStateZip?.[3] || null,
    }
  }

  return null
}

function parsePropertyType(text: string): string | null {
  if (!text) return null
  const lower = text.toLowerCase()
  if (/\b(studio|efficiency)\b/.test(lower)) return "studio"
  if (/\b(apartment|apt|unit)\b/.test(lower)) return "apartment"
  if (/\b(condo|condominium)\b/.test(lower)) return "condo"
  if (/\b(townhouse|townhome|town\s*home)\b/.test(lower)) return "townhouse"
  if (/\b(duplex|triplex|fourplex)\b/.test(lower)) return "multi-family"
  if (/\b(house|home|single\s*family|sfh)\b/.test(lower)) return "house"
  if (/\b(room|shared)\b/.test(lower)) return "room"
  if (/\b(mobile|manufactured)\b/.test(lower)) return "mobile home"
  return null
}

function parseAmenities(text: string): string[] {
  if (!text) return []
  const lower = text.toLowerCase()
  const amenities: string[] = []
  
  const amenityPatterns: [RegExp, string][] = [
    [/\b(washer\s*[\/&]?\s*dryer|w\/d|laundry)\b/i, "Washer/Dryer"],
    [/\b(in[\s-]?unit\s+laundry)\b/i, "In-Unit Laundry"],
    [/\b(dishwasher)\b/i, "Dishwasher"],
    [/\b(garage|parking|carport)\b/i, "Parking"],
    [/\b(pool|swimming)\b/i, "Pool"],
    [/\b(gym|fitness|workout)\b/i, "Gym"],
    [/\b(a\/?c|air\s*condition|central\s*air|hvac)\b/i, "A/C"],
    [/\b(heat|heating|furnace)\b/i, "Heating"],
    [/\b(balcony|patio|deck)\b/i, "Balcony/Patio"],
    [/\b(hardwood|wood\s*floor)\b/i, "Hardwood Floors"],
    [/\b(fireplace)\b/i, "Fireplace"],
    [/\b(yard|garden|backyard)\b/i, "Yard"],
    [/\b(storage)\b/i, "Storage"],
    [/\b(elevator)\b/i, "Elevator"],
    [/\b(doorman|concierge)\b/i, "Doorman"],
    [/\b(furnished)\b/i, "Furnished"],
    [/\b(utilities?\s*included|all\s*bills?\s*paid)\b/i, "Utilities Included"],
    [/\b(ev\s*charging|electric\s*vehicle)\b/i, "EV Charging"],
  ]
  
  for (const [pattern, name] of amenityPatterns) {
    if (pattern.test(lower)) amenities.push(name)
  }
  
  return [...new Set(amenities)]
}

function parsePetsAllowed(text: string): boolean | null {
  if (!text) return null
  const lower = text.toLowerCase()
  if (/\b(no\s*pets?|pets?\s*not\s*allowed|pet[\s-]?free)\b/.test(lower)) return false
  if (/\b(pets?\s*(ok|allowed|welcome|friendly)|cats?\s*ok|dogs?\s*ok)\b/.test(lower)) return true
  return null
}

function extractImages($: cheerio.CheerioAPI, url: string): string[] {
  const images: string[] = []
  const seen = new Set<string>()
  
  // Common image selectors for rental sites
  const selectors = [
    'img[src*="photo"]',
    'img[src*="image"]',
    'img[data-src]',
    '[class*="photo"] img',
    '[class*="gallery"] img',
    '[class*="carousel"] img',
    'meta[property="og:image"]',
  ]
  
  for (const sel of selectors) {
    $(sel).each((_, el) => {
      let src = $(el).attr("src") || $(el).attr("data-src") || $(el).attr("content")
      if (!src) return
      
      // Make absolute URL
      try {
        src = new URL(src, url).href
      } catch {
        return
      }
      
      // Skip tiny images (icons, logos)
      const width = parseInt($(el).attr("width") || "0", 10)
      const height = parseInt($(el).attr("height") || "0", 10)
      if ((width > 0 && width < 100) || (height > 0 && height < 100)) return
      
      // Skip common non-photo patterns
      if (/logo|icon|avatar|badge|sprite/i.test(src)) return
      
      if (!seen.has(src)) {
        seen.add(src)
        images.push(src)
      }
    })
  }
  
  return images.slice(0, 10) // Limit to 10 images
}

/* ============================================================
 *  SITE-SPECIFIC PARSERS
 * ============================================================ */

interface SiteParser {
  match: (host: string) => boolean
  parse: ($: cheerio.CheerioAPI, url: string) => Partial<ScrapedListing>
}

const siteParsers: SiteParser[] = [
  // Zillow
  {
    match: (host) => /zillow\.com/i.test(host),
    parse: ($, url) => {
      const data: Partial<ScrapedListing> = {}
      // Zillow puts data in __NEXT_DATA__ script
      const nextData = $('script#__NEXT_DATA__').text()
      if (nextData) {
        try {
          const json = JSON.parse(nextData)
          const property = json?.props?.pageProps?.property || json?.props?.pageProps?.gdpClientCache
          if (property) {
            data.price = property.price || property.rentZestimate
            data.bedrooms = property.bedrooms
            data.bathrooms = property.bathrooms
            data.square_feet = property.livingArea
            data.address = property.streetAddress
            data.city = property.city
            data.state = property.state
            data.zip_code = property.zipcode
          }
        } catch { /* ignore */ }
      }
      return data
    },
  },
  // Apartments.com
  {
    match: (host) => /apartments\.com/i.test(host),
    parse: ($) => {
      const data: Partial<ScrapedListing> = {}
      data.title = $('h1[class*="propertyName"]').text().trim() || null
      data.address = $('[class*="propertyAddress"]').text().trim() || null
      const priceText = $('[class*="pricingColumn"], [class*="rentLabel"]').first().text()
      data.price = parsePrice(priceText)
      return data
    },
  },
  // Craigslist
  {
    match: (host) => /craigslist\.(org|com)/i.test(host),
    parse: ($) => {
      const data: Partial<ScrapedListing> = {}
      data.title = $('#titletextonly').text().trim() || null
      data.price = parsePrice($('.price').first().text())
      // Craigslist puts bed/bath in housing attribute
      const housing = $('.housing').text()
      data.bedrooms = parseBedrooms(housing)
      data.bathrooms = parseBathrooms(housing)
      data.square_feet = parseSquareFeet(housing)
      // Map link often has address
      const mapAddress = $('[data-latitude]').attr('data-address')
      if (mapAddress) data.address = mapAddress
      return data
    },
  },
  // Trulia
  {
    match: (host) => /trulia\.com/i.test(host),
    parse: ($) => {
      const data: Partial<ScrapedListing> = {}
      data.title = $('h1').first().text().trim() || null
      data.price = parsePrice($('[data-testid="home-details-price"]').text())
      return data
    },
  },
  // Redfin
  {
    match: (host) => /redfin\.com/i.test(host),
    parse: ($) => {
      const data: Partial<ScrapedListing> = {}
      data.title = $('h1').first().text().trim() || null
      data.price = parsePrice($('[class*="price"]').first().text())
      const statsText = $('[class*="stats"], [class*="keyDetails"]').text()
      data.bedrooms = parseBedrooms(statsText)
      data.bathrooms = parseBathrooms(statsText)
      data.square_feet = parseSquareFeet(statsText)
      return data
    },
  },
  // HotPads
  {
    match: (host) => /hotpads\.com/i.test(host),
    parse: ($) => {
      const data: Partial<ScrapedListing> = {}
      data.title = $('h1').first().text().trim() || null
      data.address = $('[class*="address"]').first().text().trim() || null
      return data
    },
  },
  // Facebook Marketplace (limited, often blocked)
  {
    match: (host) => /facebook\.com/i.test(host),
    parse: ($) => {
      const data: Partial<ScrapedListing> = {}
      data.title = $('h1, [role="heading"]').first().text().trim() || null
      return data
    },
  },
]

/* ============================================================
 *  GENERIC PAGE PARSER
 * ============================================================ */

function parseHtml(url: string, html: string): Omit<ScrapedListing, "matched_property_id" | "matched_property_address" | "confidence"> {
  const $ = cheerio.load(html)
  const host = new URL(url).hostname.replace(/^www\./, "")

  // Start with site-specific parsing
  let siteData: Partial<ScrapedListing> = {}
  for (const parser of siteParsers) {
    if (parser.match(host)) {
      siteData = parser.parse($, url)
      break
    }
  }

  // 1) JSON-LD structured data
  let jsonLd: Partial<ScrapedListing> = {}
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const raw = $(el).contents().text()
      const parsed = JSON.parse(raw)
      const items = Array.isArray(parsed) ? parsed : [parsed]
      for (const item of items) {
        if (!item) continue
        if (!jsonLd.title && typeof item.name === "string") jsonLd.title = item.name
        if (!jsonLd.description && typeof item.description === "string") jsonLd.description = item.description
        if (item.address) {
          const a = item.address
          if (a.streetAddress) jsonLd.address ??= a.streetAddress
          if (a.addressLocality) jsonLd.city ??= a.addressLocality
          if (a.addressRegion) jsonLd.state ??= a.addressRegion
          if (a.postalCode) jsonLd.zip_code ??= a.postalCode
        }
        if (item.offers?.price && !jsonLd.price) jsonLd.price = Number(item.offers.price) || null
        if (item.numberOfBedrooms && !jsonLd.bedrooms) jsonLd.bedrooms = Number(item.numberOfBedrooms) || null
        if (item.numberOfBathroomsTotal && !jsonLd.bathrooms) jsonLd.bathrooms = Number(item.numberOfBathroomsTotal) || null
        if (item.floorSize?.value && !jsonLd.square_feet) jsonLd.square_feet = Number(item.floorSize.value) || null
        if (item.datePosted && !jsonLd.available_date) jsonLd.available_date = parseDate(String(item.datePosted))
        if (item.image) {
          const imgs = Array.isArray(item.image) ? item.image : [item.image]
          jsonLd.images = imgs.filter((i: unknown) => typeof i === "string").slice(0, 5)
        }
      }
    } catch { /* ignore malformed JSON-LD */ }
  })

  // 2) Meta tags
  const metaDescription =
    $('meta[name="description"]').attr("content") ||
    $('meta[property="og:description"]').attr("content") ||
    ""
  const metaTitle =
    $('meta[property="og:title"]').attr("content") ||
    $("h1").first().text().trim() ||
    $("title").text().trim()

  // 3) Build haystack from page content
  const blocks: string[] = []
  $(
    "h1, h2, h3, p, li, span, div, " +
    ".price, [class*='price'], [class*='Price'], [class*='rent'], [class*='Rent'], " +
    ".description, [class*='detail'], [class*='feature'], [class*='amenity'], " +
    "[itemprop], [data-testid]"
  ).each((_, el) => {
    const t = $(el).text().replace(/\s+/g, " ").trim()
    if (t && t.length > 3 && t.length < 1000) blocks.push(t)
  })
  const bodyText = blocks.join(" | ")
  const haystack = `${metaDescription} | ${bodyText}`

  // Parse address from haystack
  const parsedAddr = parseAddress(haystack)

  // Extract images
  const images = extractImages($, url)

  // Build description
  const description =
    jsonLd.description ||
    metaDescription ||
    blocks.filter((b) => b.length > 80 && b.length < 500).slice(0, 2).join(" ") ||
    null

  // Merge all sources: site-specific > JSON-LD > regex parsing
  return {
    source_url: url,
    source_host: host,
    title: siteData.title || jsonLd.title || metaTitle || null,
    price: siteData.price ?? jsonLd.price ?? parsePrice(haystack),
    available_date: siteData.available_date ?? jsonLd.available_date ?? parseDate(haystack),
    bedrooms: siteData.bedrooms ?? jsonLd.bedrooms ?? parseBedrooms(haystack),
    bathrooms: siteData.bathrooms ?? jsonLd.bathrooms ?? parseBathrooms(haystack),
    square_feet: siteData.square_feet ?? jsonLd.square_feet ?? parseSquareFeet(haystack),
    address: siteData.address || jsonLd.address || parsedAddr?.street || parsedAddr?.full || null,
    city: siteData.city || jsonLd.city || parsedAddr?.city || null,
    state: siteData.state || jsonLd.state || parsedAddr?.state || null,
    zip_code: siteData.zip_code || jsonLd.zip_code || parsedAddr?.zip || null,
    description,
    property_type: siteData.property_type || parsePropertyType(haystack),
    amenities: parseAmenities(haystack),
    pets_allowed: parsePetsAllowed(haystack),
    images: siteData.images?.length ? siteData.images : jsonLd.images?.length ? jsonLd.images : images,
  }
}

/* ============================================================
 *  ATLAS MATCHING
 * ============================================================ */

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
    .replace(/\besplanade\b/g, "esp")
    .replace(/[.,#\-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

async function matchToAtlas(
  address: string | null,
  city: string | null,
): Promise<{ id: string; address: string; score: number } | null> {
  if (!address) return null
  const supabase = await createClient()
  const normalized = normalizeStreet(address)
  
  // Extract street number for more precise matching
  const streetNum = normalized.match(/^(\d+)/)?.[1]
  const streetOnly = normalized.split(",")[0].trim()

  // Build query with optional city filter
  let query = supabase
    .from("properties")
    .select("id, address, city")
    .limit(10)

  // If we have a street number, use it for better matching
  if (streetNum) {
    query = query.ilike("address", `${streetNum}%`)
  } else {
    query = query.ilike("address", `%${streetOnly.slice(0, 20)}%`)
  }

  const { data } = await query

  if (!data || data.length === 0) return null

  // Score matches
  const scored = data.map((row) => {
    const rowNorm = normalizeStreet(row.address || "")
    let score = 0
    
    // Exact street match
    if (rowNorm === streetOnly) score += 100
    // Starts with same street
    else if (rowNorm.startsWith(streetOnly) || streetOnly.startsWith(rowNorm)) score += 50
    // Contains the street
    else if (rowNorm.includes(streetOnly) || streetOnly.includes(rowNorm)) score += 25
    
    // City match bonus
    if (city && row.city?.toLowerCase() === city.toLowerCase()) score += 20
    
    // Street number match bonus
    if (streetNum && rowNorm.startsWith(streetNum)) score += 30
    
    return { id: row.id as string, address: row.address as string, score }
  })

  // Return best match if score is reasonable
  scored.sort((a, b) => b.score - a.score)
  return scored[0].score >= 25 ? scored[0] : null
}

/* ============================================================
 *  CONFIDENCE SCORING
 * ============================================================ */

function calculateConfidence(listing: Omit<ScrapedListing, "matched_property_id" | "matched_property_address" | "confidence">): number {
  let score = 0
  let maxScore = 0

  const fields: Array<{ key: keyof typeof listing; weight: number }> = [
    { key: "title", weight: 5 },
    { key: "price", weight: 20 },
    { key: "address", weight: 25 },
    { key: "city", weight: 10 },
    { key: "state", weight: 5 },
    { key: "zip_code", weight: 10 },
    { key: "bedrooms", weight: 15 },
    { key: "bathrooms", weight: 10 },
  ]

  for (const { key, weight } of fields) {
    maxScore += weight
    const val = listing[key]
    if (val !== null && val !== undefined && val !== "") {
      score += weight
    }
  }

  return Math.round((score / maxScore) * 100)
}

/* ============================================================
 *  ROUTE HANDLER
 * ============================================================ */

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

  // ----- Easy-Paste fallback -----
  if (!url && pastedHtml) {
    if (typeof pastedHtml !== "string" || pastedHtml.trim().length < 10) {
      return NextResponse.json({ error: "Pasted content is too short to parse" }, { status: 400 })
    }
    const sourceUrl = "paste://local"
    const parsed = parseHtml(sourceUrl, pastedHtml)
    const match = await matchToAtlas(parsed.address, parsed.city)
    const confidence = calculateConfidence(parsed)
    const listing: ScrapedListing = {
      ...parsed,
      source_host: "Easy Paste",
      matched_property_id: match?.id ?? null,
      matched_property_address: match?.address ?? null,
      confidence,
    }
    return NextResponse.json({ listing })
  }

  // ----- URL fetch -----
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
      signal: AbortSignal.timeout(20000),
      redirect: "follow",
    })
    if (!res.ok) {
      return NextResponse.json(
        {
          error: `Upstream returned ${res.status} ${res.statusText}`,
          hint: "This site is blocking the scraper. Use the Easy Paste fallback to paste the listing HTML or text directly.",
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
        hint: "This site is blocking the scraper. Use the Easy Paste fallback to paste the listing HTML or text directly.",
      },
      { status: 502 },
    )
  }

  const parsed = parseHtml(url, html)
  const match = await matchToAtlas(parsed.address, parsed.city)
  const confidence = calculateConfidence(parsed)

  const listing: ScrapedListing = {
    ...parsed,
    matched_property_id: match?.id ?? null,
    matched_property_address: match?.address ?? null,
    confidence,
  }

  return NextResponse.json({ listing })
}
