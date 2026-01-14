"use client"

import { useState, useMemo } from "react"
import { ButteCountyMap } from "@/components/map/butte-county-map"
import { FilterSidebar } from "@/components/filters/filter-sidebar"
import { PropertyList } from "@/components/property/property-list"
import { PropertyDetailPanel } from "@/components/property/property-detail-panel"
import { ErrorBoundary, PropertyDetailFallback } from "@/components/error-boundary"
import type { Property, PropertyFilters } from "@/types/property"
import { Button } from "@/components/ui/button"
import { Map, List, Menu, Download, ExternalLink, Settings, Home } from "lucide-react"
import Link from "next/link"

const EXCEL_FILE_URL = "/comps-sheet.xlsx"

interface RentalAtlasProps {
  initialProperties: Property[]
}

export function RentalAtlas({ initialProperties }: RentalAtlasProps) {
  const [properties] = useState<Property[]>(initialProperties)
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(false)
  const [filters, setFilters] = useState<PropertyFilters>({})
  const [viewMode, setViewMode] = useState<"map" | "list">("map")
  const [showFilters, setShowFilters] = useState(true)

  const [mapFilters, setMapFilters] = useState({
    showAvailable: true,
    showOccupied: true,
    showPostFire: true,
    showStudentHousing: true,
    showSection8: true,
  })

  // Get unique cities and management companies for filters
  const cities = useMemo(() => [...new Set(properties.map((p) => p.city))].sort(), [properties])

  const managementCompanies = useMemo(
    () => [...new Set(properties.filter((p) => p.management_company).map((p) => p.management_company!))].sort(),
    [properties],
  )

  // Apply filters
  const filteredProperties = useMemo(() => {
    return properties.filter((property) => {
      if (filters.city && property.city !== filters.city) return false
      if (filters.propertyType && property.property_type !== filters.propertyType) return false
      if (filters.minBedrooms && (property.bedrooms ?? 0) < filters.minBedrooms) return false
      if (filters.maxRent && property.is_available && (property.current_rent ?? 0) > filters.maxRent) return false
      if (filters.managementType && property.management_type !== filters.managementType) return false
      if (filters.managementCompany && property.management_company !== filters.managementCompany) return false
      if (filters.isAvailable && !property.is_available) return false
      if (filters.isPostFireRebuild && !property.is_post_fire_rebuild) return false
      if (filters.isStudentHousing && !property.is_student_housing) return false
      if (filters.isSection8 && !property.is_section_8) return false
      return true
    })
  }, [properties, filters])

  const handlePropertySelect = (property: Property | null) => {
    setSelectedProperty(property)
    if (property) {
      setIsDetailPanelOpen(true)
    }
  }

  const handleCloseDetailPanel = () => {
    setIsDetailPanelOpen(false)
    setSelectedProperty(null)
  }

  const handleWatch = (property: Property) => {
    handlePropertySelect(property)
  }

  const handleExport = () => {
    const headers = [
      "APN",
      "Address",
      "City",
      "Zip",
      "Type",
      "Beds",
      "Baths",
      "SqFt",
      "Rent",
      "Available",
      "Management",
      "Post-Fire",
      "Student",
      "Section 8",
    ]
    const rows = filteredProperties.map((p) => [
      p.apn,
      p.address,
      p.city,
      p.zip_code || "",
      p.property_type,
      p.bedrooms || "",
      p.bathrooms || "",
      p.square_feet || "",
      p.current_rent || "",
      p.is_available ? "Yes" : "No",
      p.management_company || p.management_type || "",
      p.is_post_fire_rebuild ? "Yes" : "No",
      p.is_student_housing ? "Yes" : "No",
      p.is_section_8 ? "Yes" : "No",
    ])

    const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n")
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `butte-county-rentals-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleOpenExcelSheet = () => {
    window.open(EXCEL_FILE_URL, "_blank", "noopener,noreferrer")
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setShowFilters(!showFilters)} className="lg:hidden">
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Map className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-card-foreground">
                Butte County Rental Map - Made by Marcel L. Quenga
              </h1>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild className="h-8 bg-transparent">
            <Link href="/">
              <Home className="mr-1 h-4 w-4" />
              Home
            </Link>
          </Button>

          <Button variant="outline" size="sm" asChild className="h-8 bg-transparent">
            <Link href="/admin/import">
              <Settings className="mr-1 h-4 w-4" />
              Admin Import
            </Link>
          </Button>

          <Button variant="outline" size="sm" onClick={handleOpenExcelSheet} className="h-8 bg-transparent">
            <ExternalLink className="mr-1 h-4 w-4" />
            Excel Sheet
          </Button>

          <Button variant="outline" size="sm" onClick={handleExport} className="h-8 bg-transparent">
            <Download className="mr-1 h-4 w-4" />
            Export CSV
          </Button>

          {/* View Mode Toggle */}
          <div className="flex rounded-lg border border-border bg-muted p-1">
            <Button
              variant={viewMode === "map" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("map")}
              className="h-7"
            >
              <Map className="mr-1 h-4 w-4" />
              Map
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="h-7"
            >
              <List className="mr-1 h-4 w-4" />
              List
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Filter Sidebar */}
        {showFilters && (
          <FilterSidebar
            filters={filters}
            onFiltersChange={setFilters}
            cities={cities}
            managementCompanies={managementCompanies}
            mapFilters={mapFilters}
            onMapFiltersChange={setMapFilters}
          />
        )}

        {/* Map or List View */}
        <div className="flex flex-1 overflow-hidden">
          {viewMode === "map" ? (
            <div className="flex-1">
              <ButteCountyMap
                properties={filteredProperties}
                selectedProperty={selectedProperty}
                onPropertySelect={handlePropertySelect}
                filters={mapFilters}
              />
            </div>
          ) : (
            <div className="flex-1">
              <PropertyList
                properties={filteredProperties}
                selectedProperty={selectedProperty}
                onPropertySelect={handlePropertySelect}
                onWatch={handleWatch}
              />
            </div>
          )}

          {/* Property Detail Panel */}
          {isDetailPanelOpen && selectedProperty && (
            <ErrorBoundary
              fallback={<PropertyDetailFallback />}
              onError={(error) => console.error("[RentalAtlas] PropertyDetailPanel error:", error)}
            >
              <PropertyDetailPanel property={selectedProperty} onClose={handleCloseDetailPanel} />
            </ErrorBoundary>
          )}
        </div>
      </div>
    </div>
  )
}
