"use server"

import { createClient } from "@/lib/supabase/server"
import { enrichProperty } from "@/lib/enrichProperty"

export interface RefreshResult {
  total: number
  updated: number
  failed: number
  errors: string[]
}

export async function refreshAllProperties(): Promise<RefreshResult> {
  const supabase = await createClient()
  const result: RefreshResult = { total: 0, updated: 0, failed: 0, errors: [] }

  // Fetch all properties
  const { data: properties, error } = await supabase
    .from("properties")
    .select("id, apn, address, city, zip_code")
    .order("created_at", { ascending: false })

  if (error || !properties) {
    return { ...result, errors: [error?.message || "Failed to fetch properties"] }
  }

  result.total = properties.length

  // Process in batches of 10
  const batchSize = 10
  for (let i = 0; i < properties.length; i += batchSize) {
    const batch = properties.slice(i, i + batchSize)

    await Promise.all(
      batch.map(async (prop) => {
        try {
          // Re-enrich the property
          const enriched = await enrichProperty(prop.apn)

          if (enriched && enriched.data.latitude && enriched.data.longitude) {
            const { error: updateError } = await supabase
              .from("properties")
              .update({
                latitude: enriched.data.latitude,
                longitude: enriched.data.longitude,
                address: enriched.data.address || prop.address,
                city: enriched.data.city || prop.city,
                zip_code: enriched.data.zipCode || prop.zip_code,
                census_tract: enriched.data.censusTract,
                updated_at: new Date().toISOString(),
                enrichment_status: "refreshed",
              })
              .eq("id", prop.id)

            if (updateError) {
              result.failed++
              result.errors.push(`${prop.apn}: ${updateError.message}`)
            } else {
              result.updated++
            }
          } else {
            result.failed++
          }
        } catch (err) {
          result.failed++
          result.errors.push(`${prop.apn}: ${err instanceof Error ? err.message : "Unknown error"}`)
        }
      }),
    )

    // Small delay between batches
    if (i + batchSize < properties.length) {
      await new Promise((r) => setTimeout(r, 200))
    }
  }

  return result
}

export async function refreshSingleProperty(propertyId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: property, error: fetchError } = await supabase
    .from("properties")
    .select("*")
    .eq("id", propertyId)
    .single()

  if (fetchError || !property) {
    return { success: false, error: fetchError?.message || "Property not found" }
  }

  try {
    const enriched = await enrichProperty(property.apn)

    if (enriched && enriched.data.latitude && enriched.data.longitude) {
      const { error: updateError } = await supabase
        .from("properties")
        .update({
          latitude: enriched.data.latitude,
          longitude: enriched.data.longitude,
          address: enriched.data.address || property.address,
          city: enriched.data.city || property.city,
          zip_code: enriched.data.zipCode || property.zip_code,
          census_tract: enriched.data.censusTract,
          updated_at: new Date().toISOString(),
          enrichment_status: "refreshed",
        })
        .eq("id", propertyId)

      if (updateError) {
        return { success: false, error: updateError.message }
      }
      return { success: true }
    }
    return { success: false, error: "No enrichment data available" }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" }
  }
}
