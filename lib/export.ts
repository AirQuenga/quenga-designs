import type { Property } from "@/types/property"
import type { UtilityConfiguration } from "@/lib/fmr"
import { calculateFMR, getDefaultUtilityConfig } from "@/lib/fmr"

export type ExportFormat = "csv" | "xlsx" | "json"

interface ExportOptions {
  format: ExportFormat
  includeUnits?: boolean
  includeFMR?: boolean
  includeAmenities?: boolean
}

/**
 * Export properties to CSV format
 */
export function exportToCSV(properties: Property[], options: ExportOptions = { format: "csv" }): string {
  const headers = [
    "APN",
    "Address",
    "City",
    "Zip",
    "Type",
    "Beds",
    "Baths",
    "SqFt",
    "Year Built",
    "Current Rent",
    "Available",
    "Management Type",
    "Management Company",
    "Post-Fire Rebuild",
    "Student Housing",
    "Section 8",
    "Seniors Only",
    "Pets Allowed",
    "Latitude",
    "Longitude",
  ]

  if (options.includeFMR) {
    headers.push("FMR Base", "FMR Utility Allowance", "FMR Adjusted", "Within FMR")
  }

  const rows = properties.map((p) => {
    const row = [
      p.apn,
      `"${p.address}"`,
      p.city,
      p.zip_code || "",
      p.property_type,
      p.bedrooms || "",
      p.bathrooms || "",
      p.square_feet || "",
      p.year_built || "",
      p.current_rent || "",
      p.is_available ? "Yes" : "No",
      p.management_type || "",
      p.management_company || "",
      p.is_post_fire_rebuild ? "Yes" : "No",
      p.is_student_housing ? "Yes" : "No",
      p.is_section_8 ? "Yes" : "No",
      p.is_seniors_only ? "Yes" : "No",
      p.pets_allowed ? "Yes" : "No",
      p.latitude,
      p.longitude,
    ]

    if (options.includeFMR) {
      const utilities = p.utilities ? p.utilities : getDefaultUtilityConfig()
      const fmr = calculateFMR(p.bedrooms || 1, utilities as UtilityConfiguration)
      row.push(
        String(fmr.baseFMR),
        String(fmr.utilityAllowance),
        String(fmr.adjustedFMR),
        p.current_rent ? (p.current_rent <= fmr.adjustedFMR ? "Yes" : "No") : "N/A",
      )
    }

    return row
  })

  return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n")
}

/**
 * Export properties to JSON format
 */
export function exportToJSON(properties: Property[], options: ExportOptions = { format: "json" }): string {
  const data = properties.map((p) => {
    const base: Record<string, unknown> = {
      apn: p.apn,
      address: p.address,
      city: p.city,
      zip_code: p.zip_code,
      property_type: p.property_type,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      square_feet: p.square_feet,
      year_built: p.year_built,
      current_rent: p.current_rent,
      is_available: p.is_available,
      management_type: p.management_type,
      management_company: p.management_company,
      is_post_fire_rebuild: p.is_post_fire_rebuild,
      is_student_housing: p.is_student_housing,
      is_section_8: p.is_section_8,
      is_seniors_only: p.is_seniors_only,
      pets_allowed: p.pets_allowed,
      coordinates: {
        latitude: p.latitude,
        longitude: p.longitude,
      },
    }

    if (options.includeFMR) {
      const utilities = p.utilities ? p.utilities : getDefaultUtilityConfig()
      const fmr = calculateFMR(p.bedrooms || 1, utilities as UtilityConfiguration)
      base.fmr = {
        base: fmr.baseFMR,
        utility_allowance: fmr.utilityAllowance,
        adjusted: fmr.adjustedFMR,
        within_limit: p.current_rent ? p.current_rent <= fmr.adjustedFMR : null,
      }
    }

    if (options.includeAmenities && p.amenities) {
      base.amenities = p.amenities
    }

    return base
  })

  return JSON.stringify(data, null, 2)
}

/**
 * Download data as a file
 */
export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Export properties with automatic format detection
 */
export function exportProperties(properties: Property[], options: ExportOptions) {
  const timestamp = new Date().toISOString().split("T")[0]
  const baseFilename = `butte-county-rentals-${timestamp}`

  switch (options.format) {
    case "csv": {
      const csv = exportToCSV(properties, options)
      downloadFile(csv, `${baseFilename}.csv`, "text/csv")
      break
    }
    case "json": {
      const json = exportToJSON(properties, options)
      downloadFile(json, `${baseFilename}.json`, "application/json")
      break
    }
    default:
      throw new Error(`Unsupported export format: ${options.format}`)
  }
}
