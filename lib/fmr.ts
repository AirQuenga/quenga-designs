/**
 * Fair Market Rent (FMR) Calculation System
 *
 * This module handles:
 * - Base FMR values by bedroom count
 * - Utility allowance calculations
 * - Final adjusted FMR computation
 * - Manual override support
 *
 * IMPORTANT: All functions include defensive guards to prevent crashes
 * when configuration is missing or incomplete.
 */

import type { HeatingType, CookingType, ACType, WaterHeaterType, UtilityInclusion } from "@/config/enums"

// ===========================================
// FMR BASE VALUES (HUD 2025 - Butte County)
// ===========================================
export const FMR_BASE_VALUES: Record<number, number> = {
  0: 1043, // Studio
  1: 1096, // 1 BR
  2: 1389, // 2 BR
  3: 1989, // 3 BR
  4: 2285, // 4 BR
  5: 2628, // 5+ BR
}

export const FMR_2025 = FMR_BASE_VALUES

// ===========================================
// UTILITY ALLOWANCE TABLES
// Monthly allowances by bedroom count and utility type
// ===========================================

export interface UtilityAllowanceTable {
  [bedroomCount: number]: number
}

// Heating allowances by fuel type
export const HEATING_ALLOWANCES: Record<HeatingType, UtilityAllowanceTable> = {
  "natural-gas": { 0: 28, 1: 33, 2: 38, 3: 43, 4: 48, 5: 53 },
  "bottled-gas": { 0: 68, 1: 80, 2: 92, 3: 104, 4: 116, 5: 128 },
  electric: { 0: 22, 1: 26, 2: 30, 3: 34, 4: 38, 5: 42 },
  "electric-heat-pump": { 0: 18, 1: 21, 2: 24, 3: 27, 4: 30, 5: 33 },
  "fuel-oil": { 0: 58, 1: 68, 2: 78, 3: 88, 4: 98, 5: 108 },
  other: { 0: 30, 1: 35, 2: 40, 3: 45, 4: 50, 5: 55 },
}

// Cooking allowances by fuel type
export const COOKING_ALLOWANCES: Record<CookingType, UtilityAllowanceTable> = {
  "natural-gas": { 0: 5, 1: 6, 2: 8, 3: 10, 4: 12, 5: 14 },
  "bottled-gas": { 0: 12, 1: 14, 2: 19, 3: 24, 4: 29, 5: 34 },
  electric: { 0: 8, 1: 9, 2: 12, 3: 15, 4: 18, 5: 21 },
}

// Air conditioning allowances
export const AC_ALLOWANCES: Record<ACType, UtilityAllowanceTable> = {
  refrigerated: { 0: 24, 1: 28, 2: 41, 3: 54, 4: 67, 5: 80 },
  evaporative: { 0: 8, 1: 9, 2: 14, 3: 18, 4: 22, 5: 27 },
  none: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
}

// Water heater allowances
export const WATER_HEATER_ALLOWANCES: Record<WaterHeaterType, UtilityAllowanceTable> = {
  "natural-gas": { 0: 15, 1: 18, 2: 22, 3: 26, 4: 30, 5: 34 },
  "bottled-gas": { 0: 36, 1: 42, 2: 53, 3: 63, 4: 74, 5: 84 },
  electric: { 0: 14, 1: 17, 2: 22, 3: 26, 4: 31, 5: 35 },
  "electric-heat-pump": { 0: 8, 1: 9, 2: 12, 3: 14, 4: 17, 5: 19 },
  "fuel-oil": { 0: 30, 1: 35, 2: 44, 3: 53, 4: 62, 5: 70 },
}

// Water/Sewer allowances (when tenant pays)
export const WATER_SEWER_ALLOWANCES: UtilityAllowanceTable = {
  0: 28,
  1: 30,
  2: 42,
  3: 54,
  4: 66,
  5: 78,
}

// Trash allowances (when tenant pays)
export const TRASH_ALLOWANCES: UtilityAllowanceTable = {
  0: 20,
  1: 20,
  2: 20,
  3: 20,
  4: 20,
  5: 20,
}

// Refrigerator allowance (when tenant provides)
export const REFRIGERATOR_ALLOWANCE: UtilityAllowanceTable = {
  0: 9,
  1: 9,
  2: 9,
  3: 9,
  4: 9,
  5: 9,
}

// Range/Microwave allowance (when tenant provides)
export const RANGE_ALLOWANCE: UtilityAllowanceTable = {
  0: 7,
  1: 7,
  2: 7,
  3: 7,
  4: 7,
  5: 7,
}

// ===========================================
// UTILITY CONFIGURATION INTERFACE
// ===========================================
export interface UtilityConfiguration {
  heating: {
    type: HeatingType
    tenantPays: boolean
  }
  cooking: {
    type: CookingType
    tenantPays: boolean
  }
  airConditioning: {
    type: ACType
    tenantPays: boolean
  }
  waterHeater: {
    type: WaterHeaterType
    tenantPays: boolean
  }
  waterSewer: UtilityInclusion
  trash: UtilityInclusion
  refrigeratorProvided: boolean
  rangeProvided: boolean
}

// ===========================================
// FMR CALCULATION RESULT
// ===========================================
export interface FMRCalculation {
  baseFMR: number
  utilityAllowance: number
  utilityBreakdown: {
    heating: number
    cooking: number
    airConditioning: number
    waterHeater: number
    waterSewer: number
    trash: number
    refrigerator: number
    range: number
  }
  adjustedFMR: number
  maxAllowableRent: number
  overrideApplied: boolean
}

const EMPTY_BREAKDOWN: FMRCalculation["utilityBreakdown"] = {
  heating: 0,
  cooking: 0,
  airConditioning: 0,
  waterHeater: 0,
  waterSewer: 0,
  trash: 0,
  refrigerator: 0,
  range: 0,
}

/**
 * Get default utility configuration (common scenario)
 * Used as fallback when property config is missing
 */
export function getDefaultUtilityConfig(): UtilityConfiguration {
  return {
    heating: { type: "natural-gas", tenantPays: true },
    cooking: { type: "electric", tenantPays: true },
    airConditioning: { type: "refrigerated", tenantPays: true },
    waterHeater: { type: "natural-gas", tenantPays: true },
    waterSewer: "not-included",
    trash: "included",
    refrigeratorProvided: true,
    rangeProvided: true,
  }
}

/**
 * Safely get allowance from a table with fallback to 0
 * Prevents crashes when utility type or bedroom count is undefined
 */
function safeGetAllowance(
  table: Record<string, UtilityAllowanceTable> | UtilityAllowanceTable | undefined,
  key: string | undefined,
  bedrooms: number,
): number {
  if (!table) return 0

  // If table is a direct UtilityAllowanceTable (like WATER_SEWER_ALLOWANCES)
  if (typeof (table as Record<number, unknown>)[bedrooms] === "number") {
    return ((table as unknown) as UtilityAllowanceTable)[bedrooms] ?? 0
  }

  // If table is keyed by utility type (like HEATING_ALLOWANCES)
  if (!key) return 0
  const typeTable = ((table as unknown) as Record<string, UtilityAllowanceTable>)[key]
  if (!typeTable) {
    console.warn(`[FMR] Unknown utility type: ${key}, returning 0 allowance`)
    return 0
  }

  return typeTable[bedrooms] ?? 0
}

/**
 * Calculate utility allowance for a property
 *
 * @param bedrooms - Number of bedrooms (capped at 5)
 * @param config - Utility configuration (optional, uses defaults if missing)
 * @returns Total allowance and breakdown by category
 *
 * IMPORTANT: This function NEVER throws. If config is missing or invalid,
 * it returns 0 allowance instead of crashing.
 */
export function calculateUtilityAllowance(
  bedrooms: number,
  config?: UtilityConfiguration | null,
): { total: number; breakdown: FMRCalculation["utilityBreakdown"] } {
  if (!config) {
    return { total: 0, breakdown: { ...EMPTY_BREAKDOWN } }
  }

  // Cap bedrooms at 5 for table lookup
  const br = Math.min(Math.max(0, bedrooms || 0), 5)

  const breakdown: FMRCalculation["utilityBreakdown"] = {
    heating: config.heating?.tenantPays ? safeGetAllowance(HEATING_ALLOWANCES, config.heating?.type, br) : 0,
    cooking: config.cooking?.tenantPays ? safeGetAllowance(COOKING_ALLOWANCES, config.cooking?.type, br) : 0,
    airConditioning: config.airConditioning?.tenantPays
      ? safeGetAllowance(AC_ALLOWANCES, config.airConditioning?.type, br)
      : 0,
    waterHeater: config.waterHeater?.tenantPays
      ? safeGetAllowance(WATER_HEATER_ALLOWANCES, config.waterHeater?.type, br)
      : 0,
    waterSewer: config.waterSewer === "not-included" ? (WATER_SEWER_ALLOWANCES[br] ?? 0) : 0,
    trash: config.trash === "not-included" ? (TRASH_ALLOWANCES[br] ?? 0) : 0,
    refrigerator: config.refrigeratorProvided === false ? (REFRIGERATOR_ALLOWANCE[br] ?? 0) : 0,
    range: config.rangeProvided === false ? (RANGE_ALLOWANCE[br] ?? 0) : 0,
  }

  const total = Object.values(breakdown).reduce((sum, val) => sum + (val || 0), 0)

  return { total, breakdown }
}

/**
 * Calculate full FMR with utility allowance
 *
 * @param bedrooms - Number of bedrooms
 * @param config - Utility configuration (optional)
 * @param manualOverride - Manual FMR override value (optional)
 * @returns Complete FMR calculation result
 *
 * IMPORTANT: This function NEVER throws. Missing data degrades gracefully.
 */
export function calculateFMR(
  bedrooms: number,
  config?: UtilityConfiguration | null,
  manualOverride?: number,
): FMRCalculation {
  const safeBedrooms = Math.min(Math.max(0, bedrooms || 0), 5)
  const baseFMR = FMR_BASE_VALUES[safeBedrooms] ?? FMR_BASE_VALUES[1] ?? 1096

  const { total: utilityAllowance, breakdown: utilityBreakdown } = calculateUtilityAllowance(safeBedrooms, config)

  // Adjusted FMR = Base FMR - Utility Allowance (what tenant pays for rent)
  const adjustedFMR = baseFMR - utilityAllowance

  // Max allowable rent is the adjusted FMR (or manual override)
  const maxAllowableRent = manualOverride ?? adjustedFMR

  return {
    baseFMR,
    utilityAllowance,
    utilityBreakdown,
    adjustedFMR,
    maxAllowableRent,
    overrideApplied: manualOverride !== undefined,
  }
}
