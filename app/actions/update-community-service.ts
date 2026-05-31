"use server"

import { createClient } from "@/lib/supabase/server"

export interface UpdateCommunityServiceInput {
  address?: string | null
  phone_number?: string | null
  website?: string | null
  hours?: string | null
  notes?: string | null
  other_contact_info?: string | null
}

export interface UpdateCommunityServiceResult {
  success: boolean
  message: string
}

export async function updateCommunityService(
  serviceId: string,
  updates: UpdateCommunityServiceInput,
): Promise<UpdateCommunityServiceResult> {
  try {
    const supabase = await createClient()

    // Sanitize inputs: trim whitespace, convert empty to null
    const sanitized: Record<string, string | null> = {}
    for (const [key, value] of Object.entries(updates)) {
      if (typeof value === "string") {
        const trimmed = value.trim()
        sanitized[key] = trimmed.length > 0 ? trimmed : null
      } else {
        sanitized[key] = value ?? null
      }
    }

    // Validate phone format if provided
    if (sanitized.phone_number) {
      const digits = sanitized.phone_number.replace(/[^\d]/g, "")
      if (digits.length !== 10 && digits.length !== 11) {
        return {
          success: false,
          message: "Phone number must be 10 digits (or 11 with country code)",
        }
      }
    }

    // Validate website format if provided
    if (sanitized.website) {
      if (!sanitized.website.startsWith("http://") && !sanitized.website.startsWith("https://")) {
        return {
          success: false,
          message: "Website must start with http:// or https://",
        }
      }
    }

    // Update the service
    const { error } = await supabase
      .from("community_services")
      .update({
        ...sanitized,
        updated_at: new Date().toISOString(),
      })
      .eq("id", serviceId)

    if (error) {
      console.error("[updateCommunityService] Supabase error:", error)
      return {
        success: false,
        message: "Failed to update service. Please try again.",
      }
    }

    return {
      success: true,
      message: "Service updated successfully",
    }
  } catch (err) {
    console.error("[updateCommunityService] Error:", err)
    return {
      success: false,
      message: err instanceof Error ? err.message : "An unexpected error occurred",
    }
  }
}
