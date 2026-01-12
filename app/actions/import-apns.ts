"use server"

import { createClient } from "@/lib/supabase/server"
import { enrichProperty } from "@/lib/enrichProperty"

export async function importAPNsToDatabase(apns: string[]): Promise<{
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

  for (const apn of apns) {
    try {
      const { data: existing, error: fetchError } = await supabase
        .from("properties")
        .select("id")
        .eq("apn", apn)
        .maybeSingle()

      if (fetchError) {
        errors.push(`${apn}: Database check failed - ${fetchError.message}`)
        failed++
        continue
      }

      if (existing) {
        skipped++
        continue
      }

      // Enrich property data from GIS
      const enriched = await enrichProperty(apn)

      if (!enriched.data.latitude || !enriched.data.longitude) {
        failed++
        errors.push(`${apn}: No coordinates found from GIS lookup`)
        continue
      }

      // Insert property
      const { error: insertError } = await supabase.from("properties").insert({
        apn: enriched.apn,
        address: enriched.data.address || `Property ${apn}`,
        city: enriched.data.city || "Unknown",
        zip_code: enriched.data.zipCode || "00000",
        county: enriched.data.county || "Butte",
        state: enriched.data.state || "CA",
        latitude: enriched.data.latitude,
        longitude: enriched.data.longitude,
        census_tract: enriched.data.censusTract,
        enrichment_status: enriched.status,
        property_type: "unknown",
        is_available: false,
        management_type: "unknown",
      })

      if (insertError) {
        failed++
        errors.push(`${apn}: Insert failed - ${insertError.message}`)
      } else {
        success++
      }
    } catch (error) {
      failed++
      errors.push(`${apn}: Unexpected error - ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  return { success, failed, skipped, errors }
}
