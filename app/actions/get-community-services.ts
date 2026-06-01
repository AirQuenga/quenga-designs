"use server"

import { createClient } from "@/lib/supabase/server"

export interface CommunityService {
  id: string
  category: string
  sub_category: string | null
  /** Multiple subcategory tags under the main category. */
  sub_categories: string[]
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

export type CommunityServiceSortField = "resource_name" | "category" | "created_at" | "updated_at"
export type SortDirection = "asc" | "desc"

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
    subCategory?: string
    searchTerm?: string
    sortField?: CommunityServiceSortField
    sortDir?: SortDirection
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

  if (filters?.subCategory) {
    // Match either the new array column (contains) or the legacy single column.
    query = query.or(
      `sub_categories.cs.{"${filters.subCategory}"},sub_category.ilike.%${filters.subCategory}%`,
    )
  }

  if (filters?.searchTerm) {
    const term = `%${filters.searchTerm}%`
    query = query.or(
      `resource_name.ilike.${term},notes.ilike.${term},address.ilike.${term},sub_category.ilike.${term}`,
    )
  }

  const sortField = filters?.sortField ?? "resource_name"
  const ascending = (filters?.sortDir ?? "asc") === "asc"

  if (sortField === "resource_name") {
    query = query.order("resource_name", { ascending })
  } else if (sortField === "category") {
    query = query.order("category", { ascending }).order("resource_name", { ascending: true })
  } else {
    // created_at / updated_at
    query = query.order(sortField, { ascending, nullsFirst: false })
  }

  const { data, error, count } = await query.range(offset, offset + pageSize - 1)

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
 * Get the distinct set of subcategories, optionally scoped to a single main
 * category. Merges the legacy single `sub_category` column with the new
 * `sub_categories` array so the taxonomy is complete.
 */
export async function getCommunityServiceSubcategories(category?: string): Promise<string[]> {
  const supabase = await createClient()
  let query = supabase.from("community_services").select("sub_category, sub_categories")
  if (category) query = query.ilike("category", `%${category}%`)

  const { data, error } = await query
  if (error || !data) return []

  const set = new Set<string>()
  for (const row of data as { sub_category: string | null; sub_categories: string[] | null }[]) {
    if (row.sub_category && row.sub_category.trim()) set.add(row.sub_category.trim())
    for (const sc of row.sub_categories ?? []) {
      if (sc && sc.trim()) set.add(sc.trim())
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b))
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
