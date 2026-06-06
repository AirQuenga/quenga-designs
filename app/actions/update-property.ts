"use server"

import { createClient } from "@/lib/supabase/server"

export interface PropertyUpdate {
  id: string
  property_name?: string
  address?: string
  city?: string
  zip_code?: string
  bedrooms?: number
  bathrooms?: number
  square_feet?: number
  year_built?: number
  current_rent?: number
  management_company?: string
  phone_number?: string
  office_hours?: string
  website?: string
  pets_allowed?: boolean
  pet_deposit?: number
  pet_rent?: number
  pet_restrictions?: string
  is_available?: boolean
  is_section_8?: boolean
  is_ada_accessible?: boolean
  notes?: string
  census_tract?: string
}

export async function updateProperty(update: PropertyUpdate): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { id, ...fields } = update

  // Filter out undefined values
  const updateData: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {
      updateData[key] = value
    }
  }

  updateData.updated_at = new Date().toISOString()

  const { error } = await supabase.from("properties").update(updateData).eq("id", id)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

export async function deleteProperty(propertyId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase.from("properties").delete().eq("id", propertyId)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}
