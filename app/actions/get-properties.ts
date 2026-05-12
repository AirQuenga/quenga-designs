"use server"

import { createClient } from "@/lib/supabase/server"
import type { PropertyFilters } from "@/types/property"

const PAGE_SIZE = 100

export interface PropertyPage {
  data: any[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

/**
 * Fetch properties from Supabase with server-side filtering and pagination.
 * This replaces the previous "fetch all 1,000 rows" pattern and supports 5,800+ records.
 */
export async function getProperties(
  filters: PropertyFilters = {},
  page = 0,
  pageSize = PAGE_SIZE,
): Promise<PropertyPage> {
  const supabase = await createClient()

  let query = supabase
    .from("properties")
    .select("*", { count: "exact" })
    .order("is_available", { ascending: false })
    .order("city", { ascending: true })
    .range(page * pageSize, page * pageSize + pageSize - 1)

  // --- Server-side filter application ---
  if (filters.city) {
    query = query.eq("city", filters.city)
  }
  if (filters.cities && filters.cities.length > 0) {
    query = query.in("city", filters.cities)
  }
  if (filters.propertyType) {
    query = query.eq("property_type", filters.propertyType)
  }
  if (filters.minBedrooms) {
    query = query.gte("bedrooms", filters.minBedrooms)
  }
  if (filters.maxBedrooms) {
    query = query.lte("bedrooms", filters.maxBedrooms)
  }
  if (filters.minRent) {
    query = query.gte("current_rent", filters.minRent)
  }
  if (filters.maxRent) {
    query = query.lte("current_rent", filters.maxRent)
  }
  if (filters.isAvailable) {
    query = query.eq("is_available", true)
  }
  if (filters.managementType) {
    query = query.eq("management_type", filters.managementType)
  }
  if (filters.managementCompany) {
    query = query.eq("management_company", filters.managementCompany)
  }
  if (filters.isPostFireRebuild) {
    query = query.eq("is_post_fire_rebuild", true)
  }
  if (filters.isStudentHousing) {
    query = query.eq("is_student_housing", true)
  }
  if (filters.isSection8) {
    query = query.eq("is_section_8", true)
  }
  if (filters.isSeniorsOnly) {
    query = query.eq("is_seniors_only", true)
  }
  if (filters.searchQuery) {
    query = query.or(
      `address.ilike.%${filters.searchQuery}%,apn.ilike.%${filters.searchQuery}%,city.ilike.%${filters.searchQuery}%`,
    )
  }

  const { data, error, count } = await query

  if (error) throw new Error(error.message)

  const total = count ?? 0
  return {
    data: data ?? [],
    total,
    page,
    pageSize,
    hasMore: page * pageSize + pageSize < total,
  }
}

/**
 * Fetch a lightweight list of all property lat/lng + key fields for the map.
 * Returns up to 6,000 records (no pagination needed — just coordinates).
 * Filters are applied server-side so the map only receives relevant pins.
 */
export async function getMapProperties(
  filters: PropertyFilters = {},
  mapFilters: {
    showAvailable: boolean
    showOccupied: boolean
    showPostFire: boolean
    showStudentHousing: boolean
    showSection8: boolean
  } = {
    showAvailable: true,
    showOccupied: true,
    showPostFire: true,
    showStudentHousing: true,
    showSection8: true,
  },
): Promise<any[]> {
  const supabase = await createClient()

  let query = supabase
    .from("properties")
    .select(
      "id,apn,address,city,zip_code,latitude,longitude,is_available,is_post_fire_rebuild,is_student_housing,is_section_8,current_rent,bedrooms,bathrooms,property_name,property_type",
    )
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .order("is_available", { ascending: false })

  // Apply property filters
  if (filters.city) query = query.eq("city", filters.city)
  if (filters.propertyType) query = query.eq("property_type", filters.propertyType)
  if (filters.minBedrooms) query = query.gte("bedrooms", filters.minBedrooms)
  if (filters.maxRent) query = query.lte("current_rent", filters.maxRent)
  if (filters.managementType) query = query.eq("management_type", filters.managementType)
  if (filters.isPostFireRebuild) query = query.eq("is_post_fire_rebuild", true)
  if (filters.isStudentHousing) query = query.eq("is_student_housing", true)
  if (filters.isSection8) query = query.eq("is_section_8", true)
  if (filters.searchQuery) {
    query = query.or(`address.ilike.%${filters.searchQuery}%,apn.ilike.%${filters.searchQuery}%`)
  }

  // Apply map layer filters
  if (!mapFilters.showAvailable && !mapFilters.showOccupied) {
    // Nothing to show — return empty immediately
    return []
  }
  if (!mapFilters.showAvailable) {
    query = query.eq("is_available", false)
  } else if (!mapFilters.showOccupied) {
    query = query.eq("is_available", true)
  }
  if (!mapFilters.showPostFire) {
    query = query.eq("is_post_fire_rebuild", false)
  }
  if (!mapFilters.showStudentHousing) {
    query = query.eq("is_student_housing", false)
  }
  if (!mapFilters.showSection8) {
    query = query.eq("is_section_8", false)
  }

  const { data, error } = await query

  if (error) throw new Error(error.message)
  return data ?? []
}

/**
 * Get distinct city and management company values for filter dropdowns.
 * Cached at the RSC level — only fetches once per page load.
 */
export async function getFilterOptions(): Promise<{
  cities: string[]
  managementCompanies: string[]
}> {
  const supabase = await createClient()

  const [citiesResult, companiesResult] = await Promise.all([
    supabase.from("properties").select("city").not("city", "is", null).order("city"),
    supabase
      .from("properties")
      .select("management_company")
      .not("management_company", "is", null)
      .order("management_company"),
  ])

  const cities = [...new Set((citiesResult.data ?? []).map((r: any) => r.city))].filter(Boolean) as string[]
  const managementCompanies = [
    ...new Set((companiesResult.data ?? []).map((r: any) => r.management_company)),
  ].filter(Boolean) as string[]

  return { cities, managementCompanies }
}
