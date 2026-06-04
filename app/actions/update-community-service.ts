"use server"

import { createClient } from "@/lib/supabase/server"

export interface UpdateCommunityServiceInput {
  resource_name?: string | null
  address?: string | null
  phone_number?: string | null
  website?: string | null
  hours?: string | null
  notes?: string | null
  other_contact_info?: string | null
  back_door_contacts?: string | null
  category?: string | null
  sub_category?: string | null
  /** Full replacement of the multi-subcategory tag list. */
  sub_categories?: string[]
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

    // Sanitize inputs: trim whitespace, convert empty to null. The
    // sub_categories array is handled separately (deduped + trimmed).
    const sanitized: Record<string, string | string[] | null> = {}
    for (const [key, value] of Object.entries(updates)) {
      if (key === "sub_categories") {
        const arr = Array.isArray(value) ? (value as string[]) : []
        const cleaned = Array.from(
          new Set(arr.map((s) => (typeof s === "string" ? s.trim() : "")).filter(Boolean)),
        )
        sanitized.sub_categories = cleaned
        // Keep the legacy single column in sync with the first tag.
        if (!("sub_category" in updates)) {
          sanitized.sub_category = cleaned[0] ?? null
        }
      } else if (typeof value === "string") {
        const trimmed = value.trim()
        sanitized[key] = trimmed.length > 0 ? trimmed : null
      } else {
        sanitized[key] = (value as string | null) ?? null
      }
    }

    // Category cannot be cleared to null (it's required).
    if ("category" in sanitized && sanitized.category == null) {
      delete sanitized.category
    }

    // Validate phone format if provided
    if (typeof sanitized.phone_number === "string") {
      const digits = sanitized.phone_number.replace(/[^\d]/g, "")
      if (digits.length !== 10 && digits.length !== 11) {
        return {
          success: false,
          message: "Phone number must be 10 digits (or 11 with country code)",
        }
      }
    }

    // Validate website format if provided
    if (typeof sanitized.website === "string") {
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
