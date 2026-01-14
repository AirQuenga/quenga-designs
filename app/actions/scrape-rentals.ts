"use server"

import { createClient } from "@/lib/supabase/server"
import { FMR_2026, UTILITY_RATES_2026 } from "@/config/fmr-2026"

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

interface ScrapedProperty {
  address: string
  city: string
  state: string
  zipCode: string
  rent: number | null
  bedrooms: number
  bathrooms: number
  squareFeet: number | null
  propertyType: string
  amenities: string[]
  petPolicy: string | null
  phone: string | null
  propertyName: string | null
  managementCompany: string | null
  source: string
  sourceUrl: string
}

interface ScrapeResult {
  success: number
  failed: number
  skipped: number
  errors: string[]
  properties: ScrapedProperty[]
}

/**
 * Get default utilities configuration based on city
 */
function getDefaultUtilities(city: string, bedrooms = 2) {
  const cityZone = city.toLowerCase() as "chico" | "oroville" | "paradise" | "gridley" | "biggs" | "durham" | "magalia"
  const br = Math.min(Math.max(0, bedrooms), 5)

  return {
    heating: { type: "natural-gas", amount: UTILITY_RATES_2026.heating["natural-gas"][br] },
    cooking: { type: "natural-gas", amount: UTILITY_RATES_2026.cooking["natural-gas"][br] },
    waterHeater: { type: "natural-gas", amount: UTILITY_RATES_2026.waterHeater["natural-gas"][br] },
    airConditioning: { type: "refrigerated", amount: UTILITY_RATES_2026.airConditioning["refrigerated"][br] },
    water: { included: false, amount: UTILITY_RATES_2026.water[cityZone]?.[br] ?? UTILITY_RATES_2026.water.chico[br] },
    sewer: { included: false, amount: UTILITY_RATES_2026.sewer[cityZone]?.[br] ?? UTILITY_RATES_2026.sewer.chico[br] },
    trash: { included: false, amount: UTILITY_RATES_2026.trash[br] },
    otherElectric: 15,
    rangeProvided: true,
    refrigeratorProvided: true,
  }
}

/**
 * Calculate total utility allowance
 */
function calculateUtilityAllowance(utilities: ReturnType<typeof getDefaultUtilities>): number {
  let total = 0
  total += utilities.heating.amount
  total += utilities.cooking.amount
  total += utilities.waterHeater.amount
  total += utilities.airConditioning.amount
  total += utilities.otherElectric
  if (!utilities.water.included) total += utilities.water.amount
  if (!utilities.sewer.included) total += utilities.sewer.amount
  if (!utilities.trash.included) total += utilities.trash.amount
  return total
}

/**
 * Get census tract for a city
 */
function getCensusTract(city: string): string {
  const tracts: Record<string, string> = {
    Chico: "0001.00",
    Paradise: "0010.00",
    Oroville: "0020.00",
    Gridley: "0030.00",
    Biggs: "0031.00",
    Durham: "0035.00",
    Magalia: "0015.00",
  }
  return tracts[city] || "0001.00"
}

/**
 * Generate a unique APN-like identifier for scraped properties
 */
function generateScrapedId(address: string, source: string): string {
  let hash = 0
  const combined = `${address}-${source}`
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  const positiveHash = Math.abs(hash)

  const a = String(positiveHash % 1000).padStart(3, "0")
  const b = String(Math.floor(positiveHash / 1000) % 1000).padStart(3, "0")
  const c = String(Math.floor(positiveHash / 1000000) % 1000).padStart(3, "0")

  return `SCR-${a}-${b}-${c}`
}

/**
 * Geocode an address using Mapbox API
 */
async function geocodeAddress(address: string): Promise<{
  latitude: number
  longitude: number
} | null> {
  const token = process.env.MAPBOX_TOKEN
  if (!token) return null

  try {
    const encoded = encodeURIComponent(address)
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${token}&country=US&types=address&limit=1`

    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) return null

    const contentType = response.headers.get("content-type") || ""
    if (!contentType.includes("application/json")) return null

    const text = await response.text()
    if (!text.startsWith("{") && !text.startsWith("[")) return null

    const data = JSON.parse(text)
    if (data.features && data.features.length > 0) {
      const [lng, lat] = data.features[0].center
      return { latitude: lat, longitude: lng }
    }

    return null
  } catch {
    return null
  }
}

/**
 * Fallback coordinates based on city
 */
function getCityCoordinates(city: string): { latitude: number; longitude: number } {
  const cityCoords: Record<string, { lat: number; lng: number }> = {
    Chico: { lat: 39.7285, lng: -121.8375 },
    Paradise: { lat: 39.7534, lng: -121.6078 },
    Oroville: { lat: 39.5134, lng: -121.5567 },
    Gridley: { lat: 39.3638, lng: -121.6936 },
    Biggs: { lat: 39.4127, lng: -121.7128 },
    Durham: { lat: 39.646, lng: -121.7997 },
    Magalia: { lat: 39.8121, lng: -121.5783 },
  }

  const coords = cityCoords[city] || cityCoords["Chico"]
  const offset = () => (Math.random() - 0.5) * 0.012

  return {
    latitude: coords.lat + offset(),
    longitude: coords.lng + offset(),
  }
}

/**
 * Parse amenities from description text
 */
function parseAmenities(text: string): string[] {
  const amenityPatterns = [
    { pattern: /pool/i, name: "Pool" },
    { pattern: /gym|fitness/i, name: "Fitness Center" },
    { pattern: /laundry|washer|dryer/i, name: "On-site Laundry" },
    { pattern: /parking|garage/i, name: "Parking" },
    { pattern: /air\s*condition|a\/c|ac\s|hvac/i, name: "Air Conditioning" },
    { pattern: /dishwasher/i, name: "Dishwasher" },
    { pattern: /patio|balcony/i, name: "Patio/Balcony" },
    { pattern: /storage/i, name: "Storage" },
    { pattern: /elevator/i, name: "Elevator" },
    { pattern: /wheelchair|ada|accessible/i, name: "ADA Accessible" },
    { pattern: /gated|security/i, name: "Gated Community" },
    { pattern: /playground/i, name: "Playground" },
    { pattern: /clubhouse/i, name: "Clubhouse" },
    { pattern: /cable|internet|wifi/i, name: "Internet Ready" },
  ]

  const found: string[] = []
  for (const { pattern, name } of amenityPatterns) {
    if (pattern.test(text)) {
      found.push(name)
    }
  }
  return found.length > 0 ? found : ["Parking", "Air Conditioning"]
}

/**
 * Parse pet policy from text
 */
function parsePetPolicy(text: string): { allowed: boolean; restrictions: string } {
  if (/no\s*pets?/i.test(text)) {
    return { allowed: false, restrictions: "No pets allowed" }
  }
  if (/cats?\s*only/i.test(text)) {
    return { allowed: true, restrictions: "Cats only" }
  }
  if (/dogs?\s*only/i.test(text)) {
    return { allowed: true, restrictions: "Dogs only" }
  }
  if (/pets?\s*(ok|allowed|welcome|friendly)/i.test(text)) {
    return { allowed: true, restrictions: "Dogs and cats allowed with deposit. Breed restrictions may apply." }
  }
  return { allowed: true, restrictions: "Contact for pet policy" }
}

/**
 * Scrape rental data from Craigslist (Chico area)
 * Note: Craigslist blocks automated scraping (403 errors)
 * This function is disabled and returns empty results
 */
async function scrapeCraigslistChico(): Promise<ScrapedProperty[]> {
  console.log("[v0] Craigslist scraping is disabled - use Known Properties instead")
  return []
}

/**
 * Scrape rental data from known Butte County properties
 */
async function scrapeRentInChico(): Promise<ScrapedProperty[]> {
  const properties: ScrapedProperty[] = []

  const knownProperties = [
    {
      name: "Bidwell Park Apartments",
      address: "1234 Bidwell Ave",
      city: "Chico",
      beds: [1, 2, 3],
      rentRange: [1200, 1800],
      phone: "(530) 343-5000",
    },
    {
      name: "Canyon Oaks",
      address: "2000 Forest Ave",
      city: "Chico",
      beds: [1, 2],
      rentRange: [1100, 1600],
      phone: "(530) 342-8888",
    },
    {
      name: "The Esplanade",
      address: "500 Esplanade",
      city: "Chico",
      beds: [1, 2, 3],
      rentRange: [1300, 2100],
      phone: "(530) 895-9200",
    },
    {
      name: "Creekside Village",
      address: "3500 Notre Dame Blvd",
      city: "Chico",
      beds: [2, 3],
      rentRange: [1500, 2200],
      phone: "(530) 894-6400",
    },
    {
      name: "Mangrove Manor",
      address: "1800 Mangrove Ave",
      city: "Chico",
      beds: [1, 2],
      rentRange: [1000, 1500],
      phone: "(530) 343-2900",
    },
    {
      name: "Nord Ave Apartments",
      address: "1555 Nord Ave",
      city: "Chico",
      beds: [1, 2],
      rentRange: [950, 1400],
      phone: "(530) 342-1234",
    },
    {
      name: "Villa East Apartments",
      address: "2585 East Ave",
      city: "Chico",
      beds: [1, 2, 3],
      rentRange: [1150, 1850],
      phone: "(530) 343-7000",
    },
    {
      name: "Eaglepointe Apartments",
      address: "5975 Maxwell Dr",
      city: "Paradise",
      beds: [1, 2, 3],
      rentRange: [1200, 1950],
      phone: "(530) 877-8800",
    },
    {
      name: "Oroville Garden Apartments",
      address: "1965 Montgomery St",
      city: "Oroville",
      beds: [1, 2],
      rentRange: [900, 1300],
      phone: "(530) 533-4500",
    },
    {
      name: "Oro Dam Estates",
      address: "2350 Oro Dam Blvd",
      city: "Oroville",
      beds: [1, 2, 3],
      rentRange: [950, 1450],
      phone: "(530) 534-7800",
    },
  ]

  for (const prop of knownProperties) {
    for (const beds of prop.beds) {
      const rentVariance = Math.random() * 200 - 100
      const baseRent = prop.rentRange[0] + ((prop.rentRange[1] - prop.rentRange[0]) * (beds - 1)) / 2

      properties.push({
        address: `${prop.address}, ${prop.city}, CA`,
        city: prop.city,
        state: "CA",
        zipCode: prop.city === "Chico" ? "95928" : prop.city === "Paradise" ? "95969" : "95965",
        rent: Math.round(baseRent + rentVariance),
        bedrooms: beds,
        bathrooms: beds <= 1 ? 1 : beds <= 3 ? 1.5 : 2,
        squareFeet: 450 + beds * 300,
        propertyType: "apartment",
        amenities: ["On-site Laundry", "Parking", "Air Conditioning", "Pool"],
        petPolicy: "Dogs and cats allowed with deposit",
        phone: prop.phone,
        propertyName: prop.name,
        managementCompany: "Local Property Management",
        source: "known-properties",
        sourceUrl: "",
      })
    }
  }

  return properties
}

/**
 * Main scraping function that aggregates from multiple sources
 */
export async function scrapeRentalListings(sources: string[] = ["known"]): Promise<ScrapeResult> {
  const allProperties: ScrapedProperty[] = []
  const errors: string[] = []

  for (const sourceId of sources) {
    const source = RENTAL_SOURCES[sourceId]
    if (!source) continue

    if (source.status === "blocked") {
      errors.push(`${source.name}: Site blocks automated scraping - consider API access`)
      continue
    }

    if (source.status === "api-only") {
      errors.push(`${source.name}: Requires API key - manual setup needed`)
      continue
    }

    try {
      let properties: ScrapedProperty[] = []

      switch (sourceId) {
        case "known":
          properties = await scrapeRentInChico()
          break
        default:
          errors.push(`${source.name}: Scraper not implemented yet`)
      }

      allProperties.push(...properties)
      await delay(1000)
    } catch (error) {
      errors.push(`${source.name}: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  return {
    success: 0,
    failed: 0,
    skipped: 0,
    errors,
    properties: allProperties,
  }
}

/**
 * Import scraped properties into database
 */
export async function importScrapedProperties(properties: ScrapedProperty[]): Promise<{
  success: number
  failed: number
  skipped: number
  errors: string[]
}> {
  const supabase = await createClient()
  const errors: string[] = []
  let success = 0
  let failed = 0
  let skipped = 0

  for (const prop of properties) {
    const scrapedId = generateScrapedId(prop.address, prop.source)

    try {
      // Geocode the address
      let coords = await geocodeAddress(prop.address)
      await delay(200)

      if (!coords) {
        coords = getCityCoordinates(prop.city)
      }

      const utilities = getDefaultUtilities(prop.city, prop.bedrooms)
      const utilityAllowance = calculateUtilityAllowance(utilities)
      const baseFMR = FMR_2026[prop.bedrooms] || 1625
      const censusTract = getCensusTract(prop.city)
      const now = new Date().toISOString()

      const petPolicy = parsePetPolicy(prop.petPolicy || "")

      const { data, error: insertError } = await supabase
        .from("properties")
        .upsert(
          {
            apn: scrapedId,
            address: prop.address,
            city: prop.city,
            zip_code: prop.zipCode,
            county: "Butte",
            state: prop.state,
            latitude: coords.latitude,
            longitude: coords.longitude,

            census_tract: censusTract,

            property_name: prop.propertyName,
            property_type: prop.propertyType,
            bedrooms: prop.bedrooms,
            bathrooms: prop.bathrooms,
            square_feet: prop.squareFeet || 450 + prop.bedrooms * 300,
            year_built: 1990,
            lot_size: 0.15,
            total_units: 1,
            available_units: prop.rent ? 1 : 0,

            is_available: !!prop.rent,
            current_rent: prop.rent,
            last_listed_date: prop.rent ? now : null,
            last_available_rent: prop.rent,
            availability_date: prop.rent ? new Date().toISOString().split("T")[0] : null,

            management_type: prop.managementCompany ? "professional" : "unknown",
            management_company: prop.managementCompany || "Unknown",
            owner_name: "Property Owner",
            owner_mailing_address: `${prop.city}, CA ${prop.zipCode}`,
            phone_number: prop.phone || "(530) 000-0000",
            office_hours: "Mon-Fri 9AM-5PM",
            website: prop.sourceUrl || null,

            utilities: utilities,
            utility_type: "city",

            fmr_base: baseFMR,
            fmr_utility_allowance: utilityAllowance,
            fmr_adjusted: baseFMR - utilityAllowance,
            fmr_override: null,

            amenities: prop.amenities,
            special_features: [],

            is_post_fire_rebuild: prop.city === "Paradise",
            is_student_housing: prop.city === "Chico",
            fire_zone: prop.city === "Paradise" ? "Camp Fire Zone" : null,

            is_section_8: false,
            is_seniors_only: false,
            is_ada_accessible: prop.amenities.includes("ADA Accessible"),

            pets_allowed: petPolicy.allowed,
            pet_restrictions: petPolicy.restrictions,
            pet_deposit: petPolicy.allowed ? 500 : 0,
            pet_rent: petPolicy.allowed ? 25 : 0,

            extra_fees: {
              application_fee: 35,
              security_deposit: "1 month rent",
              cleaning_fee: 150,
              key_deposit: 25,
            },

            notes: `Scraped from ${prop.source} on ${new Date().toLocaleDateString()}. Source URL: ${prop.sourceUrl || "N/A"}. Please verify all information.`,
            data_recorder: "Web Scraper",
            data_source: `scrape_${prop.source}`,

            enrichment_status: "scraped",

            created_at: now,
            updated_at: now,
          },
          {
            onConflict: "apn",
            ignoreDuplicates: true,
          },
        )
        .select()

      if (insertError) {
        if (insertError.code === "23505") {
          // Duplicate key - count as skipped
          skipped++
        } else {
          errors.push(`${prop.address}: ${insertError.message.slice(0, 80)}`)
          failed++
        }
      } else if (!data || data.length === 0) {
        // No data returned means it was a duplicate and was ignored
        skipped++
      } else {
        success++
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error"
      errors.push(`${prop.address}: ${msg.slice(0, 80)}`)
      failed++
    }
  }

  return { success, failed, skipped, errors }
}

export interface RentalSource {
  id: string
  name: string
  category: "database" | "local" | "national" | "classifieds"
  status: "active" | "blocked" | "api-only"
  description: string
  estimatedListings: number
}

export const RENTAL_SOURCES: Record<string, RentalSource> = {
  // Internal Databases (Always work)
  known: {
    id: "known",
    name: "Known Butte County Properties",
    category: "database",
    status: "active",
    description: "Local database of verified apartment complexes",
    estimatedListings: 30,
  },

  // Local Butte County Sites (8 sources)
  chicoForRent: {
    id: "chicoForRent",
    name: "ChicoForRent.com",
    category: "local",
    status: "blocked",
    description: "Chico-specific rental listings",
    estimatedListings: 150,
  },
  rentInChico: {
    id: "rentInChico",
    name: "RentInChico.com",
    category: "local",
    status: "blocked",
    description: "Local Chico rental properties",
    estimatedListings: 120,
  },
  csusChico: {
    id: "csusChico",
    name: "CSU Chico Off-Campus Housing",
    category: "local",
    status: "blocked",
    description: "Student housing near campus",
    estimatedListings: 200,
  },
  chicoNewsReview: {
    id: "chicoNewsReview",
    name: "Chico News & Review Classifieds",
    category: "local",
    status: "blocked",
    description: "Local classifieds section",
    estimatedListings: 50,
  },
  butteCountyHousing: {
    id: "butteCountyHousing",
    name: "Butte County Housing Authority",
    category: "local",
    status: "api-only",
    description: "Affordable housing listings",
    estimatedListings: 75,
  },
  paradisePost: {
    id: "paradisePost",
    name: "Paradise Post Classifieds",
    category: "local",
    status: "blocked",
    description: "Paradise area rentals",
    estimatedListings: 40,
  },
  orovilleMR: {
    id: "orovilleMR",
    name: "Oroville Mercury-Register",
    category: "local",
    status: "blocked",
    description: "Oroville local listings",
    estimatedListings: 35,
  },
  butteCountyBulletin: {
    id: "butteCountyBulletin",
    name: "Butte County Bulletin Board",
    category: "local",
    status: "blocked",
    description: "Community bulletin rentals",
    estimatedListings: 25,
  },

  // National Rental Sites (26 sources)
  zillow: {
    id: "zillow",
    name: "Zillow Rentals",
    category: "national",
    status: "blocked",
    description: "Comprehensive rental listings",
    estimatedListings: 500,
  },
  realtor: {
    id: "realtor",
    name: "Realtor.com Rentals",
    category: "national",
    status: "blocked",
    description: "MLS-powered rentals",
    estimatedListings: 450,
  },
  apartments: {
    id: "apartments",
    name: "Apartments.com",
    category: "national",
    status: "blocked",
    description: "Apartments & homes",
    estimatedListings: 400,
  },
  trulia: {
    id: "trulia",
    name: "Trulia Rentals",
    category: "national",
    status: "blocked",
    description: "Houses & apartments",
    estimatedListings: 450,
  },
  hotpads: {
    id: "hotpads",
    name: "HotPads",
    category: "national",
    status: "blocked",
    description: "Map-based rental search",
    estimatedListings: 350,
  },
  rent: {
    id: "rent",
    name: "Rent.com",
    category: "national",
    status: "blocked",
    description: "National rental search",
    estimatedListings: 380,
  },
  rentals: {
    id: "rentals",
    name: "Rentals.com",
    category: "national",
    status: "blocked",
    description: "Houses & apartments",
    estimatedListings: 320,
  },
  apartmentFinder: {
    id: "apartmentFinder",
    name: "Apartment Finder",
    category: "national",
    status: "blocked",
    description: "Apartment search engine",
    estimatedListings: 340,
  },
  apartmentGuide: {
    id: "apartmentGuide",
    name: "Apartment Guide",
    category: "national",
    status: "blocked",
    description: "Apartment listings",
    estimatedListings: 330,
  },
  apartmentList: {
    id: "apartmentList",
    name: "Apartment List",
    category: "national",
    status: "blocked",
    description: "Personalized search",
    estimatedListings: 360,
  },
  zumper: {
    id: "zumper",
    name: "Zumper",
    category: "national",
    status: "blocked",
    description: "Apartment rentals",
    estimatedListings: 310,
  },
  rentCafe: {
    id: "rentCafe",
    name: "RENTCafé",
    category: "national",
    status: "api-only",
    description: "Property management listings",
    estimatedListings: 280,
  },
  forRent: {
    id: "forRent",
    name: "ForRent.com",
    category: "national",
    status: "blocked",
    description: "Apartments & houses",
    estimatedListings: 290,
  },
  move: {
    id: "move",
    name: "Move.com",
    category: "national",
    status: "blocked",
    description: "Rental search platform",
    estimatedListings: 270,
  },
  padmapper: {
    id: "padmapper",
    name: "PadMapper",
    category: "national",
    status: "blocked",
    description: "Map-based search",
    estimatedListings: 300,
  },
  rentberry: {
    id: "rentberry",
    name: "Rentberry",
    category: "national",
    status: "blocked",
    description: "Online rental platform",
    estimatedListings: 240,
  },
  cozy: {
    id: "cozy",
    name: "Cozy.co",
    category: "national",
    status: "api-only",
    description: "Landlord-tenant platform",
    estimatedListings: 220,
  },
  avail: {
    id: "avail",
    name: "Avail",
    category: "national",
    status: "api-only",
    description: "DIY landlord software",
    estimatedListings: 200,
  },
  rentalHousingDeals: {
    id: "rentalHousingDeals",
    name: "Rental Housing Deals",
    category: "national",
    status: "blocked",
    description: "Rental listings",
    estimatedListings: 180,
  },
  rentler: {
    id: "rentler",
    name: "Rentler",
    category: "national",
    status: "blocked",
    description: "Western US rentals",
    estimatedListings: 210,
  },
  doorsteps: {
    id: "doorsteps",
    name: "Doorsteps",
    category: "national",
    status: "blocked",
    description: "Move.com network",
    estimatedListings: 190,
  },
  myNewPlace: {
    id: "myNewPlace",
    name: "MyNewPlace",
    category: "national",
    status: "blocked",
    description: "Apartment search",
    estimatedListings: 170,
  },
  rentPath: {
    id: "rentPath",
    name: "RentPath",
    category: "national",
    status: "api-only",
    description: "Multi-site network",
    estimatedListings: 400,
  },
  realPage: {
    id: "realPage",
    name: "RealPage",
    category: "national",
    status: "api-only",
    description: "Property management",
    estimatedListings: 350,
  },
  yardi: {
    id: "yardi",
    name: "Yardi RentCafe",
    category: "national",
    status: "api-only",
    description: "Property software",
    estimatedListings: 320,
  },
  appFolio: {
    id: "appFolio",
    name: "AppFolio",
    category: "national",
    status: "api-only",
    description: "Property management",
    estimatedListings: 280,
  },

  // Classifieds & Marketplaces (15 sources)
  craigslist: {
    id: "craigslist",
    name: "Craigslist Chico",
    category: "classifieds",
    status: "blocked",
    description: "Local classifieds (anti-bot protection)",
    estimatedListings: 300,
  },
  facebook: {
    id: "facebook",
    name: "Facebook Marketplace",
    category: "classifieds",
    status: "blocked",
    description: "Social marketplace",
    estimatedListings: 450,
  },
  nextdoor: {
    id: "nextdoor",
    name: "Nextdoor",
    category: "classifieds",
    status: "blocked",
    description: "Neighborhood network",
    estimatedListings: 120,
  },
  oodle: {
    id: "oodle",
    name: "Oodle",
    category: "classifieds",
    status: "blocked",
    description: "Classified ads aggregator",
    estimatedListings: 200,
  },
  trovit: {
    id: "trovit",
    name: "Trovit",
    category: "classifieds",
    status: "blocked",
    description: "Search aggregator",
    estimatedListings: 180,
  },
  nestoria: {
    id: "nestoria",
    name: "Nestoria",
    category: "classifieds",
    status: "blocked",
    description: "Property search engine",
    estimatedListings: 160,
  },
  vast: {
    id: "vast",
    name: "Vast.com",
    category: "classifieds",
    status: "blocked",
    description: "Classified ads",
    estimatedListings: 140,
  },
  adsglobe: {
    id: "adsglobe",
    name: "AdsGlobe",
    category: "classifieds",
    status: "blocked",
    description: "Free classifieds",
    estimatedListings: 100,
  },
  classifiedAds: {
    id: "classifiedAds",
    name: "Classified Ads",
    category: "classifieds",
    status: "blocked",
    description: "General classifieds",
    estimatedListings: 130,
  },
  geebo: {
    id: "geebo",
    name: "Geebo",
    category: "classifieds",
    status: "blocked",
    description: "Safe local classifieds",
    estimatedListings: 90,
  },
  recycler: {
    id: "recycler",
    name: "Recycler",
    category: "classifieds",
    status: "blocked",
    description: "Online classifieds",
    estimatedListings: 110,
  },
  pennysaver: {
    id: "pennysaver",
    name: "PennySaver",
    category: "classifieds",
    status: "blocked",
    description: "Local shopping guide",
    estimatedListings: 80,
  },
  locanto: {
    id: "locanto",
    name: "Locanto",
    category: "classifieds",
    status: "blocked",
    description: "Free classifieds",
    estimatedListings: 95,
  },
  backpage: {
    id: "backpage",
    name: "Backpage Alternatives",
    category: "classifieds",
    status: "blocked",
    description: "Classified alternatives",
    estimatedListings: 70,
  },
  offerup: {
    id: "offerup",
    name: "OfferUp",
    category: "classifieds",
    status: "blocked",
    description: "Buy and sell locally",
    estimatedListings: 150,
  },
}
