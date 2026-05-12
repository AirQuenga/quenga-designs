"use server"

import { createClient } from "@/lib/supabase/server"

export interface CommunityService {
  id: string
  name: string
  category: string
  description: string | null
  address: string | null
  phone_number: string | null
  website: string | null
  email: string | null
  service_area: string | null
  hours: string | null
  is_accessible: boolean
  accepts_walk_ins: boolean
  requires_appointment: boolean
  languages: string[] | null
  tags: string[] | null
  contact_person: string | null
  cost_per_service: string | null
  notes: string | null
  data_source: string | null
  created_at: string
  updated_at: string
}

export interface GetCommunityServicesResult {
  services: CommunityService[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

const SERVICE_CATEGORIES = [
  "mental_health",
  "food_bank",
  "legal_aid",
  "job_training",
  "housing_support",
  "healthcare",
  "financial_assistance",
  "education",
  "domestic_violence",
  "substance_abuse",
]

const SERVICE_AREAS = ["Chico", "Paradise", "Magalia", "Durham", "Butte County"]

/**
 * Fetch community services with optional filtering and pagination.
 *
 * @param filters Optional filter criteria (category, serviceArea, searchTerm, tags)
 * @param page Page number (1-indexed)
 * @param pageSize Number of results per page
 */
export async function getCommunityServices(
  filters?: {
    category?: string
    serviceArea?: string
    searchTerm?: string
    tags?: string[]
  },
  page = 1,
  pageSize = 20,
): Promise<GetCommunityServicesResult> {
  const supabase = await createClient()
  const offset = (page - 1) * pageSize

  let query = supabase.from("community_services").select("*", { count: "exact" })

  // Apply filters
  if (filters?.category) {
    query = query.eq("category", filters.category)
  }

  if (filters?.serviceArea) {
    query = query.eq("service_area", filters.serviceArea)
  }

  if (filters?.searchTerm) {
    const term = `%${filters.searchTerm}%`
    query = query.or(`name.ilike.${term},description.ilike.${term}`)
  }

  if (filters?.tags?.length) {
    // Use GIN index: filter where tags array contains ANY of the provided tags
    query = query.overlaps("tags", filters.tags)
  }

  // Get total count before pagination
  const { count } = await query
  const total = count || 0
  const totalPages = Math.ceil(total / pageSize)

  // Fetch paginated results
  const { data, error } = await query.order("name", { ascending: true }).range(offset, offset + pageSize - 1)

  if (error) {
    console.error("Error fetching community services:", error)
    return { services: [], total: 0, page, pageSize, totalPages: 0 }
  }

  return {
    services: (data || []) as CommunityService[],
    total,
    page,
    pageSize,
    totalPages,
  }
}

/**
 * Get all available categories for the filter dropdown
 */
export async function getCommunityServiceCategories(): Promise<string[]> {
  return SERVICE_CATEGORIES
}

/**
 * Get all available service areas for the filter dropdown
 */
export async function getCommunityServiceAreas(): Promise<string[]> {
  return SERVICE_AREAS
}

/**
 * Create or upsert a community service (admin only)
 */
export async function upsertCommunityService(
  service: Partial<CommunityService> & Pick<CommunityService, "name" | "category">,
): Promise<{ success: boolean; service?: CommunityService; error?: string }> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("community_services")
    .upsert(
      {
        ...service,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, service: data as CommunityService }
}
