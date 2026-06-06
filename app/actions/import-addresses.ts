"use server"

import { createClient } from "@/lib/supabase/server"
import { parseAddresses, getAddressStats as getAddressStatsFromData, type ParsedAddress } from "@/data/addresses"
import { FMR_2026, UTILITY_RATES_2026 } from "@/config/fmr-2026"

export async function getAddressStats() {
  return getAddressStatsFromData()
}

export async function importAddresses(): Promise<{
  success: number
  failed: number
  skipped: number
  errors: string[]
}> {
  const addresses = parseAddresses()
  return importAddressesToDatabase(addresses)
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

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
 * Fallback coordinates based on ZIP code
 */
function getZipCodeCoordinates(zipCode: string): { latitude: number; longitude: number } {
  const zipCoords: Record<string, { lat: number; lng: number }> = {
    "95926": { lat: 39.7285, lng: -121.8375 },
    "95928": { lat: 39.7156, lng: -121.8089 },
    "95973": { lat: 39.7567, lng: -121.8234 },
    "95969": { lat: 39.7534, lng: -121.6078 },
    "95965": { lat: 39.5134, lng: -121.5567 },
    "95966": { lat: 39.5078, lng: -121.5423 },
    "95948": { lat: 39.3638, lng: -121.6936 },
    "95917": { lat: 39.4127, lng: -121.7128 },
    "95938": { lat: 39.646, lng: -121.7997 },
    "95954": { lat: 39.8121, lng: -121.5783 },
  }

  const coords = zipCoords[zipCode] || zipCoords["95928"]
  const offset = () => (Math.random() - 0.5) * 0.008

  return {
    latitude: coords.lat + offset(),
    longitude: coords.lng + offset(),
  }
}

/**
 * Generate a unique APN-like identifier for addresses
 */
function generateAddressId(address: string): string {
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

  return `ADR-${a}-${b}-${c}`
}

/**
 * Extract bedrooms from address if present (e.g., "123 Main St #2BR")
 */
function extractBedroomsFromAddress(address: string): number {
  const match = address.match(/(\d)\s*(?:BR|bd|bed|bedroom)/i)
  return match ? Number.parseInt(match[1]) : 2 // Default to 2BR
}

/**
 * Import addresses with full field population
 */
async function importAddressesToDatabase(addresses: ParsedAddress[]): Promise<{
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

  for (const addr of addresses) {
    const addressId = generateAddressId(addr.fullAddress)

    try {
      // Check if address already exists
      const { data: existing } = await supabase
        .from("properties")
        .select("id")
        .eq("address", addr.fullAddress)
        .maybeSingle()

      if (existing) {
        skipped++
        continue
      }

      const { data: existingByApn } = await supabase.from("properties").select("id").eq("apn", addressId).maybeSingle()

      if (existingByApn) {
        skipped++
        continue
      }

      // Geocode the address
      let coords = await geocodeAddress(addr.fullAddress)
      await delay(200)

      if (!coords) {
        coords = getZipCodeCoordinates(addr.zipCode)
      }

      const city = addr.city || "Chico"
      const bedrooms = extractBedroomsFromAddress(addr.fullAddress)
      const utilities = getDefaultUtilities(city, bedrooms)
      const utilityAllowance = calculateUtilityAllowance(utilities)
      const baseFMR = FMR_2026[bedrooms] || 1625
      const censusTract = getCensusTract(city)
      const squareFeet =
        bedrooms === 0 ? 450 : bedrooms === 1 ? 650 : bedrooms === 2 ? 850 : bedrooms === 3 ? 1100 : 1400
      const now = new Date().toISOString()

      const { error: insertError } = await supabase.from("properties").insert({
        // Core identifiers
        apn: addressId,
        address: addr.fullAddress,
        city: city,
        zip_code: addr.zipCode,
        county: "Butte",
        state: addr.state || "CA",
        latitude: coords.latitude,
        longitude: coords.longitude,

        // Legal/Census
        census_tract: censusTract,

        // Property details
        property_name: null,
        property_type: "apartment",
        bedrooms: bedrooms,
        bathrooms: bedrooms === 0 ? 1.0 : bedrooms === 1 ? 1.0 : bedrooms === 2 ? 1.0 : bedrooms === 3 ? 2.0 : 2.5,
        square_feet: squareFeet,
        year_built: 1985,
        lot_size: 0.15,
        total_units: 1,
        available_units: 0,

        // Availability
        is_available: false,
        current_rent: null,
        last_listed_date: null,
        last_available_rent: null,
        availability_date: null,

        // Management
        management_type: "unknown",
        management_company: "Unknown",
        owner_name: "Property Owner",
        owner_mailing_address: `${city}, CA ${addr.zipCode}`,
        phone_number: "(530) 000-0000",
        office_hours: "Mon-Fri 9AM-5PM",
        website: null,

        // Utilities
        utilities: utilities,
        utility_type: "city",

        // FMR calculations
        fmr_base: baseFMR,
        fmr_utility_allowance: utilityAllowance,
        fmr_adjusted: baseFMR - utilityAllowance,
        fmr_override: null,

        // Features
        amenities: ["On-site Laundry", "Parking", "Air Conditioning"],
        special_features: [],

        // Butte County specific
        is_post_fire_rebuild: false,
        is_student_housing: city === "Chico",
        fire_zone: null,

        // Section 8 / Accessibility
        is_section_8: false,
        is_seniors_only: false,
        is_ada_accessible: false,

        // Pets
        pets_allowed: true,
        pet_restrictions: "Dogs and cats allowed with deposit. Breed restrictions may apply.",
        pet_deposit: 500,
        pet_rent: 25,

        // Extra fees
        extra_fees: {
          application_fee: 35,
          security_deposit: "1 month rent",
          cleaning_fee: 150,
          key_deposit: 25,
        },

        // Notes and tracking
        notes: `Imported via address lookup on ${new Date().toLocaleDateString()}. Please verify all information and update with actual property details.`,
        data_recorder: "System Import",
        data_source: "address_import",

        // Status
        enrichment_status: "address-import",

        // Timestamps
        created_at: now,
        updated_at: now,
      })

      if (insertError) {
        errors.push(`${addr.street}: ${insertError.message.slice(0, 80)}`)
        failed++
      } else {
        success++
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error"
      errors.push(`${addr.street}: ${msg.slice(0, 80)}`)
      failed++
    }
  }

  return { success, failed, skipped, errors }
}
