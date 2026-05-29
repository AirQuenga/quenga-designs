"use server"

import { createClient } from "@/lib/supabase/server"

export interface CommunityService {
  id: string
  category: string
  sub_category: string | null
  resource_name: string
  hours: string | null
  address: string | null
  phone_number: string | null
  other_contact_info: string | null
  website: string | null
  notes: string | null
  back_door_contacts: string | null
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

/**
 * Fetch community services with optional filtering and pagination.
 */
export async function getCommunityServices(
  filters?: {
    category?: string
    searchTerm?: string
  },
  page = 1,
  pageSize = 50,
): Promise<GetCommunityServicesResult> {
  const supabase = await createClient()
  const offset = (page - 1) * pageSize

  let query = supabase.from("community_services").select("*", { count: "exact" })

  if (filters?.category) {
    // Forgiving substring match so short UI labels (e.g. "Food") match
    // longer DB categories (e.g. "Food Assistance").
    query = query.ilike("category", `%${filters.category}%`)
  }

  if (filters?.searchTerm) {
    const term = `%${filters.searchTerm}%`
    query = query.or(
      `resource_name.ilike.${term},notes.ilike.${term},address.ilike.${term},sub_category.ilike.${term}`,
    )
  }

  const { data, error, count } = await query
    .order("category", { ascending: true })
    .order("resource_name", { ascending: true })
    .range(offset, offset + pageSize - 1)

  if (error) {
    console.error("[v0] Error fetching community services:", error)
    return { services: [], total: 0, page, pageSize, totalPages: 0 }
  }

  const total = count || 0
  return {
    services: (data || []) as CommunityService[],
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

/**
 * Get distinct categories from the table for the filter dropdown.
 */
export async function getCommunityServiceCategories(): Promise<string[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("community_services")
    .select("category")
    .order("category", { ascending: true })

  if (error || !data) return []

  const unique = Array.from(new Set(data.map((r) => r.category).filter(Boolean))) as string[]
  return unique
}

/**
 * Create or upsert a community service (admin only)
 */
export async function upsertCommunityService(
  service: Partial<CommunityService> & Pick<CommunityService, "category" | "resource_name">,
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
