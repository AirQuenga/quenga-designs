/**
 * 2026 Butte County FMR and Utility Allowance Data
 * Updated rates from HUD and local housing authority
 */

// FMR Base Values for 2026 (Butte County)
export const FMR_2026: Record<number, number> = {
  0: 1155, // Studio
  1: 1270, // 1 BR
  2: 1625, // 2 BR
  3: 2260, // 3 BR
  4: 2726, // 4 BR
  5: 3135, // 5+ BR (estimated)
}

// Utility types
export type HeatingType = "natural-gas" | "bottled-gas" | "electric" | "heat-pump" | "fuel-oil" | "none"
export type CookingType = "natural-gas" | "bottled-gas" | "electric" | "none"
export type WaterHeaterType = "natural-gas" | "bottled-gas" | "electric" | "none"
export type ACType = "refrigerated" | "evaporative" | "none"

// City zones for utility rates (some cities have different rates)
export type CityZone = "chico" | "paradise" | "oroville" | "gridley" | "biggs" | "durham" | "magalia"

// Utility allowance tables by bedroom count [0BR, 1BR, 2BR, 3BR, 4BR, 5BR]
export const UTILITY_RATES_2026 = {
  heating: {
    "natural-gas": [11, 17, 18, 22, 26, 30],
    "bottled-gas": [27, 41, 44, 53, 62, 71],
    electric: [14, 22, 23, 28, 33, 38],
    "heat-pump": [9, 14, 15, 18, 21, 24],
    "fuel-oil": [23, 35, 37, 45, 53, 61],
    none: [0, 0, 0, 0, 0, 0],
  },
  cooking: {
    "natural-gas": [5, 6, 6, 7, 8, 9],
    "bottled-gas": [12, 14, 15, 17, 19, 21],
    electric: [6, 7, 8, 9, 10, 11],
    none: [0, 0, 0, 0, 0, 0],
  },
  waterHeater: {
    "natural-gas": [10, 12, 15, 18, 21, 24],
    "bottled-gas": [24, 29, 36, 43, 50, 57],
    electric: [12, 15, 19, 22, 26, 29],
    none: [0, 0, 0, 0, 0, 0],
  },
  airConditioning: {
    refrigerated: [15, 18, 26, 35, 43, 51],
    evaporative: [5, 6, 9, 12, 14, 17],
    none: [0, 0, 0, 0, 0, 0],
  },
  // Water rates vary by city
  water: {
    chico: [28, 30, 42, 54, 66, 78],
    paradise: [45, 48, 58, 68, 78, 88],
    oroville: [32, 35, 46, 57, 68, 79],
    gridley: [30, 33, 44, 55, 66, 77],
    biggs: [30, 33, 44, 55, 66, 77],
    durham: [35, 38, 50, 62, 74, 86],
    magalia: [42, 45, 55, 65, 75, 85],
  },
  sewer: {
    chico: [24, 26, 32, 38, 44, 50],
    paradise: [28, 30, 36, 42, 48, 54],
    oroville: [22, 24, 30, 36, 42, 48],
    gridley: [20, 22, 28, 34, 40, 46],
    biggs: [20, 22, 28, 34, 40, 46],
    durham: [18, 20, 26, 32, 38, 44],
    magalia: [26, 28, 34, 40, 46, 52],
  },
  trash: [20, 20, 20, 20, 20, 20],
  appliances: {
    range: 8,
    refrigerator: 12,
  },
}

// City data with coordinates
export const BUTTE_CITIES: Array<{
  id: CityZone
  name: string
  lat: number
  lng: number
  population: number
}> = [
  { id: "chico", name: "Chico", lat: 39.7285, lng: -121.8375, population: 101475 },
  { id: "paradise", name: "Paradise", lat: 39.7596, lng: -121.6219, population: 4764 },
  { id: "oroville", name: "Oroville", lat: 39.5138, lng: -121.5564, population: 20042 },
  { id: "gridley", name: "Gridley", lat: 39.3638, lng: -121.6936, population: 7108 },
  { id: "biggs", name: "Biggs", lat: 39.4124, lng: -121.7129, population: 1880 },
  { id: "durham", name: "Durham", lat: 39.6463, lng: -121.7997, population: 5518 },
  { id: "magalia", name: "Magalia", lat: 39.8118, lng: -121.5783, population: 11310 },
]

export interface CalculatorConfig {
  city: CityZone
  bedrooms: number
  heating: HeatingType
  cooking: CookingType
  waterHeater: WaterHeaterType
  airConditioning: ACType
  waterIncluded: boolean
  sewerIncluded: boolean
  trashIncluded: boolean
  tenantProvidesRange: boolean
  tenantProvidesRefrigerator: boolean
}

export interface CalculationResult {
  baseFMR: number
  breakdown: {
    heating: number
    cooking: number
    waterHeater: number
    airConditioning: number
    water: number
    sewer: number
    trash: number
    range: number
    refrigerator: number
  }
  totalUtilityAllowance: number
  netRent: number
}

export function calculateFMR2026(config: CalculatorConfig): CalculationResult {
  const br = Math.min(Math.max(0, config.bedrooms), 5)
  const baseFMR = FMR_2026[br] ?? FMR_2026[2]

  const breakdown = {
    heating: UTILITY_RATES_2026.heating[config.heating]?.[br] ?? 0,
    cooking: UTILITY_RATES_2026.cooking[config.cooking]?.[br] ?? 0,
    waterHeater: UTILITY_RATES_2026.waterHeater[config.waterHeater]?.[br] ?? 0,
    airConditioning: UTILITY_RATES_2026.airConditioning[config.airConditioning]?.[br] ?? 0,
    water: config.waterIncluded ? 0 : (UTILITY_RATES_2026.water[config.city]?.[br] ?? 0),
    sewer: config.sewerIncluded ? 0 : (UTILITY_RATES_2026.sewer[config.city]?.[br] ?? 0),
    trash: config.trashIncluded ? 0 : UTILITY_RATES_2026.trash[br],
    range: config.tenantProvidesRange ? UTILITY_RATES_2026.appliances.range : 0,
    refrigerator: config.tenantProvidesRefrigerator ? UTILITY_RATES_2026.appliances.refrigerator : 0,
  }

  const totalUtilityAllowance = Object.values(breakdown).reduce((sum, val) => sum + val, 0)
  const netRent = baseFMR - totalUtilityAllowance

  return {
    baseFMR,
    breakdown,
    totalUtilityAllowance,
    netRent,
  }
}
