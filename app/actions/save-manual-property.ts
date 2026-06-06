"use server"

import { createClient } from "@/lib/supabase/server"

interface ManualPropertyData {
  census_tract: string
  complex_name: string
  address: string
  city: string
  phone_number: string
  bedrooms: number
  bathrooms: number
  rent_amount: string
  available_date: string
  office_hours: string
  management_company: string
  amenities: string[]
  pets_allowed: boolean
  pet_restrictions: string
  ada_accessible: boolean
  property_type: string
  heating: string
  cooking: string
  other_electric: string
  air_conditioning: string
  water_heater: string
  water_included: boolean
  sewer_included: boolean
  trash_included: boolean
  range_microwave: string
  refrigerator: string
  extra_fees: string
  utility_allowance_fees: string
  notes: string
  data_recorder: string
}

// City coordinates for geocoding fallback
const CITY_COORDS: Record<string, { lat: number; lng: number; zip: string }> = {
  Chico: { lat: 39.7285, lng: -121.8375, zip: "95926" },
  Paradise: { lat: 39.7596, lng: -121.6219, zip: "95969" },
  Oroville: { lat: 39.5138, lng: -121.5564, zip: "95965" },
  Gridley: { lat: 39.3638, lng: -121.6936, zip: "95948" },
  Biggs: { lat: 39.4124, lng: -121.7129, zip: "95917" },
  Durham: { lat: 39.6463, lng: -121.7997, zip: "95938" },
  Magalia: { lat: 39.8118, lng: -121.5783, zip: "95954" },
  Palermo: { lat: 39.4333, lng: -121.5333, zip: "95968" },
  Thermalito: { lat: 39.5069, lng: -121.5877, zip: "95965" },
}

export async function saveManualProperty(
  data: ManualPropertyData,
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    // Generate a unique APN for manually entered properties
    const timestamp = Date.now()
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0")
    const apn = `MAN-${timestamp}-${random}`

    // Get city coordinates
    const cityData = CITY_COORDS[data.city] || CITY_COORDS["Chico"]

    // Add small random offset to prevent overlapping pins
    const latOffset = (Math.random() - 0.5) * 0.02
    const lngOffset = (Math.random() - 0.5) * 0.02

    // Parse rent amount (remove $ and commas)
    const rentAmount = data.rent_amount ? Number.parseFloat(data.rent_amount.replace(/[$,]/g, "")) || null : null

    // Build utilities config
    const utilities = {
      heating: { type: data.heating, tenant_pays: data.heating !== "none" },
      cooking: { type: data.cooking, tenant_pays: data.cooking !== "none" },
      air_conditioning: { type: data.air_conditioning, tenant_pays: data.air_conditioning !== "none" },
      water_heater: { type: data.water_heater, tenant_pays: data.water_heater !== "none" },
      water_sewer: data.water_included ? "included" : "not-included",
      trash: data.trash_included ? "included" : "not-included",
      refrigerator_provided: data.refrigerator === "provided",
      range_provided: data.range_microwave === "provided",
    }

    // Build special features array
    const specialFeatures: string[] = []
    if (data.ada_accessible) specialFeatures.push("ada-accessible")

    // Insert property
    const { data: insertedData, error } = await supabase
      .from("properties")
      .insert({
        apn,
        address: data.address,
        city: data.city,
        county: "Butte",
        state: "CA",
        zip_code: cityData.zip,
        census_tract: data.census_tract || null,
        latitude: cityData.lat + latOffset,
        longitude: cityData.lng + lngOffset,
        property_type: data.property_type,
        property_name: data.complex_name || null,
        bedrooms: data.bedrooms,
        bathrooms: data.bathrooms,
        is_available: !!data.available_date || !!rentAmount,
        current_rent: rentAmount,
        last_listed_date: data.available_date || null,
        phone_number: data.phone_number || null,
        office_hours: data.office_hours || null,
        management_type: data.management_company === "private" ? "private" : "professional",
        management_company: data.management_company === "private" ? null : data.management_company || null,
        utilities,
        amenities: data.amenities,
        pets_allowed: data.pets_allowed,
        pet_restrictions: data.pet_restrictions || null,
        special_features: specialFeatures,
        enrichment_status: "complete",
      })
      .select("id")
      .single()

    if (error) {
      console.error("Failed to insert property:", error)
      return { success: false, error: error.message }
    }

    return { success: true, id: insertedData.id }
  } catch (error) {
    console.error("Error saving manual property:", error)
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}
