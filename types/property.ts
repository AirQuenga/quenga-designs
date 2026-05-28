/**
 * Property Types - Enhanced for full feature support
 */

import type {
  PropertyType,
  ManagementType,
  UnitStatus,
  SpecialFeature,
  HeatingType,
  CookingType,
  ACType,
  WaterHeaterType,
  UtilityInclusion,
} from "@/config/enums"

// ===========================================
// CORE PROPERTY INTERFACE
// ===========================================
export interface Property {
  id: string
  apn: string

  // Location
  address: string
  city: string
  county: string
  state: string
  zip_code: string | null
  census_tract: string | null
  latitude: number
  longitude: number

  // Property details
  property_type: PropertyType
  property_name: string | null // For apartment complexes
  bedrooms: number | null
  bathrooms: number | null
  square_feet: number | null
  year_built: number | null
  lot_size: number | null

  // Availability
  is_available: boolean
  current_rent: number | null
  last_listed_date: string | null
  last_available_rent: number | null
  total_units: number | null
  available_units: number | null

  // Contact
  phone_number: string | null
  office_hours: string | null
  website: string | null

  // Management
  owner_name: string | null
  owner_mailing_address: string | null
  management_type: ManagementType
  management_company: string | null

  // Utilities configuration
  utilities: UtilityConfiguration | null

  // FMR
  fmr_base: number | null
  fmr_utility_allowance: number | null
  fmr_adjusted: number | null
  fmr_override: number | null

  // Special features
  special_features: SpecialFeature[]
  is_post_fire_rebuild: boolean
  is_student_housing: boolean
  is_section_8: boolean
  is_seniors_only: boolean

  // Amenities (array of amenity IDs)
  amenities: string[]

  // Pets
  pets_allowed: boolean
  pet_restrictions: string | null
  pet_deposit: number | null
  pet_rent: number | null

  // Notes and accessibility
  notes: string | null
  is_ada_accessible: boolean

  // Enrichment status
  enrichment_status: "complete" | "partial" | "missing_data" | "pending"

  // Metadata
  created_at: string
  updated_at: string
}

// ===========================================
// UNIT INTERFACE (for multi-unit properties)
// ===========================================
export interface PropertyUnit {
  id: string
  property_id: string
  unit_number: string
  floor: number | null
  bedrooms: number
  bathrooms: number
  square_feet: number | null
  rent: number | null
  status: UnitStatus
  available_date: string | null
  features: string[]
  created_at: string
  updated_at: string
}

// ===========================================
// UTILITY CONFIGURATION
// ===========================================
export interface UtilityConfiguration {
  heating: {
    type: HeatingType
    tenant_pays: boolean
  }
  cooking: {
    type: CookingType
    tenant_pays: boolean
  }
  air_conditioning: {
    type: ACType
    tenant_pays: boolean
  }
  water_heater: {
    type: WaterHeaterType
    tenant_pays: boolean
  }
  water_sewer: UtilityInclusion
  trash: UtilityInclusion
  refrigerator_provided: boolean
  range_provided: boolean
}

// ===========================================
// PROPERTY FEE
// ===========================================
export interface PropertyFee {
  id: string
  property_id: string
  fee_type_id: string
  amount: number
  description: string | null
  is_required: boolean
  created_at: string
}

// ===========================================
// PROPERTY PHOTO
// ===========================================
export interface PropertyPhoto {
  id: string
  property_id: string
  url: string
  caption: string | null
  is_primary: boolean
  sort_order: number
  created_at: string
}

// ===========================================
// FILTERS INTERFACE
// ===========================================
export interface PropertyFilters {
  // Location
  city?: string
  cities?: string[] // Multi-select
  census_tract?: string

  // Property
  propertyType?: PropertyType
  propertyTypes?: PropertyType[] // Multi-select
  minBedrooms?: number
  maxBedrooms?: number

  // Rent
  minRent?: number
  maxRent?: number

  // Availability
  isAvailable?: boolean

  // Management
  managementType?: ManagementType
  managementCompany?: string

  // Special features
  isPostFireRebuild?: boolean
  isStudentHousing?: boolean
  isSection8?: boolean
  isSeniorsOnly?: boolean
  petsAllowed?: boolean

  // FMR
  minFMR?: number
  maxFMR?: number

  // Utilities
  utilitiesIncluded?: boolean

  // Search
  searchQuery?: string
}

// ===========================================
// EXPORT DATA INTERFACE
// ===========================================
export interface ExportOptions {
  format: "xlsx" | "csv" | "pdf"
  properties: "all" | "filtered" | "selected"
  selectedIds?: string[]
  includeUnits?: boolean
  includePhotos?: boolean
  includeFMR?: boolean
}
