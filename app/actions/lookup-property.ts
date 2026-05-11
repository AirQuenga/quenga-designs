"use server"

import { createClient } from "@/lib/supabase/server"
import { FMR_2026, UTILITY_RATES_2026 } from "@/config/fmr-2026"
import { BUTTE_COUNTY_DEFAULTS, type ParsedAddress } from "@/config/address-constants"

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

interface LookupResult {
  success: boolean
  property: Record<string, unknown> | null
  message: string
  source: string
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

/** Shape returned by our geocoding helpers */
interface GeoResult {
  latitude: number
  longitude: number
  city: string
  state: string
  zipCode: string
  formattedAddress: string
  streetNumber: string
  route: string
}

/**
 * Geocode a free-form address string using the Google Maps Geocoding API.
 * Falls back gracefully when the API key is absent.
 */
async function geocodeAddress(address: string): Promise<GeoResult | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) return null

  try {
    const encoded = encodeURIComponent(address)
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encoded}&key=${apiKey}&region=us&components=country:US`

    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) return null

    const data = await response.json()
    if (data.status !== "OK" || !data.results?.length) return null

    return extractGeoResult(data.results[0])
  } catch {
    return null
  }
}

/**
 * Reverse-geocode a lat/lng pair using the Google Maps Geocoding API
 * when the client already provides coordinates from the Places selection.
 */
async function geocodeLatLng(lat: number, lng: number): Promise<GeoResult | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) return null

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) return null

    const data = await response.json()
    if (data.status !== "OK" || !data.results?.length) return null

    return extractGeoResult(data.results[0])
  } catch {
    return null
  }
}

/** Parse a Google Geocoding API result object into our GeoResult shape */
function extractGeoResult(result: {
  formatted_address: string
  geometry: { location: { lat: number; lng: number } }
  address_components: Array<{ long_name: string; short_name: string; types: string[] }>
}): GeoResult {
  const comps = result.address_components

  const get = (type: string, short = false) => {
    const c = comps.find((a) => a.types.includes(type))
    return c ? (short ? c.short_name : c.long_name) : ""
  }

  return {
    streetNumber: get("street_number"),
    route: get("route"),
    city: get("locality") || get("sublocality") || get("administrative_area_level_2") || BUTTE_COUNTY_DEFAULTS.city,
    state: get("administrative_area_level_1", true) || BUTTE_COUNTY_DEFAULTS.state,
    zipCode: get("postal_code") || BUTTE_COUNTY_DEFAULTS.zip,
    latitude: result.geometry.location.lat,
    longitude: result.geometry.location.lng,
    formattedAddress: result.formatted_address,
  }
}

/**
 * Build the canonical display address string.
 * Format: [Number] [Street Name], [City], [State] [Zip]
 */
function buildFormattedAddress(
  streetNumber: string,
  route: string,
  city: string,
  state: string,
  zip: string,
): string {
  const street = [streetNumber, route].filter(Boolean).join(" ")
  return `${street}, ${city}, ${state} ${zip}`
}

/**
 * Generate a unique APN-like identifier for manual lookups
 */
function generateLookupId(address: string): string {
  let hash = 0
  for (let i = 0; i < address.length; i++) {
    const char = address.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  const positiveHash = Math.abs(hash)

  const a = String(positiveHash % 1000).padStart(3, "0")
  const b = String(Math.floor(positiveHash / 1000) % 1000).padStart(3, "0")
  const c = String(Math.floor(positiveHash / 1000000) % 1000).padStart(3, "0")

  return `LKP-${a}-${b}-${c}`
}

/**
 * Lookup an address and fetch/create a property record.
 *
 * Accepts either:
 *  - a `ParsedAddress` object from the client-side Google Places selection, or
 *  - a plain address string (legacy / fallback path).
 *
 * Logic:
 *  1. Resolve the canonical `formatted_address` string.
 *  2. Search the DB for an exact match on `formatted_address` (or street prefix).
 *  3. If found → return existing record.
 *  4. If not found → geocode to get lat/lng (if not already provided) → create record.
 */
export async function lookupAddress(input: ParsedAddress | string): Promise<LookupResult> {
  // ── 1. Normalise input ────────────────────────────────────────────────────
  let streetNumber = ""
  let route = ""
  let city = BUTTE_COUNTY_DEFAULTS.city
  let state = BUTTE_COUNTY_DEFAULTS.state
  let zip = BUTTE_COUNTY_DEFAULTS.zip
  let lat: number | undefined
  let lng: number | undefined
  let rawAddress: string

  if (typeof input === "string") {
    rawAddress = input.trim()
    if (!rawAddress || rawAddress.length < 5) {
      return { success: false, property: null, message: "Please enter a valid address", source: "validation" }
    }
  } else {
    streetNumber = input.street_number
    route = input.route
    city = input.city || city
    state = input.state || state
    zip = input.zip || zip
    lat = input.lat
    lng = input.lng
    rawAddress = input.formatted_address || buildFormattedAddress(streetNumber, route, city, state, zip)
  }

  const canonicalAddress = buildFormattedAddress(streetNumber, route, city, state, zip) || rawAddress
  const streetPrefix = (streetNumber + " " + route).trim() || rawAddress.split(",")[0].trim()

  // ── 2. DB lookup ─────────────────────────────────────────────────────────
  const supabase = await createClient()

  const { data: byFormatted } = await supabase
    .from("properties")
    .select("*")
    .ilike("address", `%${streetPrefix}%`)
    .limit(1)

  if (byFormatted && byFormatted.length > 0) {
    return {
      success: true,
      property: byFormatted[0],
      message: "Found existing property in database",
      source: "database",
    }
  }

  // ── 3. Geocode if lat/lng not provided ───────────────────────────────────
  let geo: GeoResult | null = null

  if (lat !== undefined && lng !== undefined) {
    // Client already supplied coordinates — reverse-geocode to normalise fields
    geo = await geocodeLatLng(lat, lng)
  }

  if (!geo) {
    geo = await geocodeAddress(canonicalAddress)
  }

  if (!geo) {
    // No API key or geocoding failed — still create the record with what we have
    if (!streetNumber && !route) {
      return {
        success: false,
        property: null,
        message: "Could not geocode address. Check the address format or add a GOOGLE_MAPS_API_KEY.",
        source: "geocoding",
      }
    }
    // We have enough structured data from Places — proceed without lat/lng
    geo = {
      streetNumber,
      route,
      city,
      state,
      zipCode: zip,
      latitude: lat ?? 0,
      longitude: lng ?? 0,
      formattedAddress: canonicalAddress,
    }
  }

  // ── 4. Build canonical formatted address ─────────────────────────────────
  const finalAddress = buildFormattedAddress(geo.streetNumber, geo.route, geo.city, geo.state, geo.zipCode)

  // ── 5. Create property record ─────────────────────────────────────────────
  const apn = generateLookupId(finalAddress)
  const bedrooms = 2
  const utilities = getDefaultUtilities(geo.city, bedrooms)
  const utilityAllowance = calculateUtilityAllowance(utilities)
  const baseFMR = FMR_2026[bedrooms] || 1625
  const censusTract = getCensusTract(geo.city)
  const now = new Date().toISOString()

  const propertyData = {
    apn,
    address: finalAddress,
    city: geo.city,
    zip_code: geo.zipCode,
    county: "Butte",
    state: geo.state,
    latitude: geo.latitude || null,
    longitude: geo.longitude || null,
    census_tract: censusTract,
    property_type: "apartment",
    bedrooms,
    bathrooms: 1,
    square_feet: 850,
    year_built: 1990,
    lot_size: 0.15,
    total_units: 1,
    available_units: 0,
    is_available: false,
    current_rent: null,
    management_type: "unknown",
    management_company: "Unknown",
    owner_name: "Property Owner",
    owner_mailing_address: `${geo.city}, ${geo.state} ${geo.zipCode}`,
    phone_number: "(530) 000-0000",
    office_hours: "Mon-Fri 9AM-5PM",
    utilities,
    utility_type: "city",
    fmr_base: baseFMR,
    fmr_utility_allowance: utilityAllowance,
    fmr_adjusted: baseFMR - utilityAllowance,
    amenities: ["Parking", "Air Conditioning"],
    pets_allowed: true,
    pet_restrictions: "Contact for pet policy",
    pet_deposit: 500,
    pet_rent: 25,
    extra_fees: {
      application_fee: 35,
      security_deposit: "1 month rent",
      cleaning_fee: 150,
      key_deposit: 25,
    },
    notes: `Lookup from address on ${new Date().toLocaleDateString()}. Data needs verification.`,
    data_recorder: "Address Lookup",
    data_source: "address_lookup",
    enrichment_status: "pending",
    created_at: now,
    updated_at: now,
  }

  const { data: inserted, error } = await supabase
    .from("properties")
    .upsert(propertyData, { onConflict: "apn", ignoreDuplicates: false })
    .select()
    .single()

  if (error) {
    return {
      success: false,
      property: propertyData,
      message: `Geocoded successfully but failed to save: ${error.message}`,
      source: "database_error",
    }
  }

  return {
    success: true,
    property: inserted || propertyData,
    message: "Address geocoded and property created successfully",
    source: "geocoding",
  }
}

/**
 * Lookup an APN and fetch property data
 */
export async function lookupAPN(apn: string): Promise<LookupResult> {
  if (!apn || apn.trim().length < 3) {
    return { success: false, property: null, message: "Please enter a valid APN", source: "validation" }
  }

  const supabase = await createClient()
  const cleanAPN = apn.trim().toUpperCase()

  // Check if this APN already exists in the database
  const { data: existingByAPN } = await supabase
    .from("properties")
    .select("*")
    .eq("apn", cleanAPN)
    .limit(1)

  if (existingByAPN && existingByAPN.length > 0) {
    return {
      success: true,
      property: existingByAPN[0],
      message: "Found existing property in database",
      source: "database",
    }
  }

  // Try to find by partial APN match
  const { data: partialMatch } = await supabase
    .from("properties")
    .select("*")
    .ilike("apn", `%${cleanAPN}%`)
    .limit(1)

  if (partialMatch && partialMatch.length > 0) {
    return {
      success: true,
      property: partialMatch[0],
      message: "Found property with similar APN",
      source: "database_partial",
    }
  }

  // APN not found - return error with suggestion
  return {
    success: false,
    property: null,
    message: `APN "${cleanAPN}" not found in database. Try importing APNs first or use the Address lookup to add new properties.`,
    source: "not_found",
  }
}
