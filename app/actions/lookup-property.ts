"use server"

import { createClient } from "@/lib/supabase/server"
import { FMR_2026, UTILITY_RATES_2026 } from "@/config/fmr-2026"

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

/**
 * Geocode an address using Mapbox API
 */
async function geocodeAddress(address: string): Promise<{
  latitude: number
  longitude: number
  city: string
  state: string
  zipCode: string
  formattedAddress: string
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
      const feature = data.features[0]
      const [lng, lat] = feature.center
      
      // Extract city, state, zip from context
      let city = "Chico"
      let state = "CA"
      let zipCode = "95928"
      
      for (const ctx of feature.context || []) {
        if (ctx.id.startsWith("place.")) city = ctx.text
        if (ctx.id.startsWith("region.")) state = ctx.short_code?.replace("US-", "") || ctx.text
        if (ctx.id.startsWith("postcode.")) zipCode = ctx.text
      }

      return {
        latitude: lat,
        longitude: lng,
        city,
        state,
        zipCode,
        formattedAddress: feature.place_name,
      }
    }

    return null
  } catch {
    return null
  }
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
 * Lookup an address and fetch/create property data
 */
export async function lookupAddress(address: string): Promise<LookupResult> {
  if (!address || address.trim().length < 5) {
    return { success: false, property: null, message: "Please enter a valid address", source: "validation" }
  }

  const supabase = await createClient()
  const cleanAddress = address.trim()

  // First, check if this address already exists in the database
  const { data: existingByAddress } = await supabase
    .from("properties")
    .select("*")
    .ilike("address", `%${cleanAddress.split(",")[0]}%`)
    .limit(1)
    .single()

  if (existingByAddress) {
    return {
      success: true,
      property: existingByAddress,
      message: "Found existing property in database",
      source: "database",
    }
  }

  // Geocode the address to get coordinates and normalized data
  const geocoded = await geocodeAddress(cleanAddress)
  
  if (!geocoded) {
    return {
      success: false,
      property: null,
      message: "Could not geocode address. Please check the address format.",
      source: "geocoding",
    }
  }

  // Create a new property record with default values
  const apn = generateLookupId(geocoded.formattedAddress)
  const bedrooms = 2 // Default
  const utilities = getDefaultUtilities(geocoded.city, bedrooms)
  const utilityAllowance = calculateUtilityAllowance(utilities)
  const baseFMR = FMR_2026[bedrooms] || 1625
  const censusTract = getCensusTract(geocoded.city)
  const now = new Date().toISOString()

  const propertyData = {
    apn,
    address: geocoded.formattedAddress,
    city: geocoded.city,
    zip_code: geocoded.zipCode,
    county: "Butte",
    state: geocoded.state,
    latitude: geocoded.latitude,
    longitude: geocoded.longitude,
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
    owner_mailing_address: `${geocoded.city}, ${geocoded.state} ${geocoded.zipCode}`,
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

  // Insert into database
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
    .single()

  if (existingByAPN) {
    return {
      success: true,
      property: existingByAPN,
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
    .single()

  if (partialMatch) {
    return {
      success: true,
      property: partialMatch,
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
