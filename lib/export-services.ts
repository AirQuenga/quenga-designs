"use client"

import * as XLSX from "xlsx"
import type { CommunityService } from "@/app/actions/get-community-services"

/**
 * Export a list of community services to an Excel file (.xlsx).
 * Uses clean headers: Name, Category, Subcategories, Address, Phone, Website.
 */
export function exportServicesToExcel(
  services: CommunityService[],
  filename = "community-services-export"
) {
  // Build the data rows with clean headers
  const rows = services.map((s) => ({
    Name: s.resource_name || "",
    Category: s.category || "",
    Subcategories: (s.sub_categories ?? []).join(", ") || s.sub_category || "",
    Address: s.address || "",
    Phone: s.phone_number || "",
    Website: s.website || "",
  }))

  // Create worksheet from the rows
  const worksheet = XLSX.utils.json_to_sheet(rows)

  // Set column widths for readability
  worksheet["!cols"] = [
    { wch: 40 }, // Name
    { wch: 15 }, // Category
    { wch: 30 }, // Subcategories
    { wch: 40 }, // Address
    { wch: 15 }, // Phone
    { wch: 35 }, // Website
  ]

  // Create workbook and add the worksheet
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Resources")

  // Generate the file and trigger download
  const timestamp = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(workbook, `${filename}-${timestamp}.xlsx`)
}
