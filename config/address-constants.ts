/**
 * Address-related constants for the Butte County Rental Map.
 * Kept in a plain config module (NOT a "use server" file) so they can be
 * imported by both client and server code without violating the
 * "use server" rule that only allows async function exports.
 */

/** Geographic center of Chico, CA — used to bias Places autocomplete results. */
export const BUTTE_COUNTY_CENTER = {
  lat: 39.7285,
  lng: -121.8375,
} as const

/** Approximate radius (meters) that covers all of Butte County. */
export const BUTTE_COUNTY_RADIUS_M = 50_000

/** Default city/state/county applied when geocoding returns no context. */
export const BUTTE_COUNTY_DEFAULTS = {
  city: "Chico",
  state: "CA",
  county: "Butte",
  zip: "95928",
} as const

export interface ParsedAddress {
  street_number: string
  route: string
  city: string
  state: string
  zip: string
  formatted_address: string
  lat?: number
  lng?: number
}

/**
 * Rental-source metadata used in the admin import page.
 * Previously mis-placed in a "use server" action file, causing a build error.
 */
export interface RentalSource {
  id: string
  name: string
  category: "database" | "local" | "national" | "classifieds"
  status: "active" | "blocked" | "api-only"
  description: string
  estimatedListings: number
}

export const RENTAL_SOURCES: Record<string, RentalSource> = {
  known: {
    id: "known",
    name: "Known Properties Database",
    category: "database",
    status: "active",
    description: "Butte County apartment complexes - WORKS AUTOMATICALLY",
    estimatedListings: 25,
  },
  hignell: {
    id: "hignell",
    name: "Hignell Companies",
    category: "local",
    status: "blocked",
    description: "Local property management",
    estimatedListings: 50,
  },
  blueoak: {
    id: "blueoak",
    name: "Blue Oak Property Management",
    category: "local",
    status: "blocked",
    description: "Chico rentals",
    estimatedListings: 30,
  },
  craigslist: {
    id: "craigslist",
    name: "Craigslist Chico",
    category: "classifieds",
    status: "blocked",
    description: "Chico classified listings",
    estimatedListings: 200,
  },
}
