"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { ButteCountyMap } from "@/components/map/butte-county-map"
import { FilterSidebar } from "@/components/filters/filter-sidebar"
import { PropertyList } from "@/components/property/property-list"
import { PropertyDetailPanel } from "@/components/property/property-detail-panel"
import { ErrorBoundary, PropertyDetailFallback } from "@/components/error-boundary"
import type { Property, PropertyFilters } from "@/types/property"
import { getProperties, getMapProperties } from "@/app/actions/get-properties"
import { Button } from "@/components/ui/button"
import { Map, List, Download, ExternalLink, Settings, Home, Loader2, PanelLeftClose, PanelLeftOpen } from "lucide-react"
import Link from "next/link"

const EXCEL_FILE_URL = "/comps-sheet.xlsx"
const PAGE_SIZE = 100

interface RentalAtlasProps {
  cities: string[]
  managementCompanies: string[]
}

export function RentalAtlas({ cities, managementCompanies }: RentalAtlasProps) {
  // ── List-view state (paginated) ───────────────────────────────────────────
  const [listProperties, setListProperties] = useState<Property[]>([])
  const [listTotal, setListTotal] = useState(0)
  const [listPage, setListPage] = useState(0)
  const [isLoadingList, setIsLoadingList] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  // ── Map-view state (lightweight, no pagination) ───────────────────────────
  const [mapProperties, setMapProperties] = useState<Property[]>([])
  const [isLoadingMap, setIsLoadingMap] = useState(false)

  // ── UI state ──────────────────────────────────────────────────────────────
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

  // Debounce ref to avoid firing on every keystroke in search
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Data fetching ─────────────────────────────────────────────────────────

  const fetchMapData = useCallback(async (f: PropertyFilters, mf: typeof mapFilters) => {
    setIsLoadingMap(true)
    try {
      const data = await getMapProperties(f, mf)
      setMapProperties(data as Property[])
    } finally {
      setIsLoadingMap(false)
    }
  }, [])

  const fetchListPage = useCallback(async (f: PropertyFilters, page: number, append: boolean) => {
    if (page === 0) setIsLoadingList(true)
    else setIsLoadingMore(true)
    try {
      const result = await getProperties(f, page, PAGE_SIZE)
      setListTotal(result.total)
      setListProperties((prev) => append ? [...prev, ...(result.data as Property[])] : result.data as Property[])
      setListPage(page)
    } finally {
      setIsLoadingList(false)
      setIsLoadingMore(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    fetchMapData(filters, mapFilters)
    fetchListPage(filters, 0, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-fetch when filters change (debounced)
  const handleFiltersChange = useCallback(
    (newFilters: PropertyFilters) => {
      setFilters(newFilters)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        fetchMapData(newFilters, mapFilters)
        fetchListPage(newFilters, 0, false)
      }, 300)
    },
    [fetchMapData, fetchListPage, mapFilters],
  )

  const handleMapFiltersChange = useCallback(
    (newMapFilters: typeof mapFilters) => {
      setMapFilters(newMapFilters)
      fetchMapData(filters, newMapFilters)
    },
    [filters, fetchMapData],
  )

  const handleLoadMore = useCallback(() => {
    fetchListPage(filters, listPage + 1, true)
  }, [filters, listPage, fetchListPage])

  // ── Property selection ────────────────────────────────────────────────────
  const handlePropertySelect = (property: Property | null) => {
    setSelectedProperty(property)
    if (property) setIsDetailPanelOpen(true)
  }
  const handleCloseDetailPanel = () => {
    setIsDetailPanelOpen(false)
    setSelectedProperty(null)
  }

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExport = () => {
    const source = viewMode === "map" ? mapProperties : listProperties
    const headers = ["APN", "Address", "City", "Zip", "Type", "Beds", "Baths", "SqFt", "Rent", "Available", "Management", "Post-Fire", "Student", "Section 8"]
    const rows = source.map((p) => [
      p.apn, p.address, p.city, p.zip_code || "", p.property_type,
      p.bedrooms || "", p.bathrooms || "", p.square_feet || "", p.current_rent || "",
      p.is_available ? "Yes" : "No", p.management_company || p.management_type || "",
      p.is_post_fire_rebuild ? "Yes" : "No", p.is_student_housing ? "Yes" : "No", p.is_section_8 ? "Yes" : "No",
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

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="h-8 gap-1.5"
            title={showFilters ? "Hide Filters" : "Show Filters"}
          >
            {showFilters ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            <span className="hidden sm:inline">{showFilters ? "Hide Filters" : "Show Filters"}</span>
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Map className="h-4 w-4 text-primary-foreground" />
            </div>
            <h1 className="text-lg font-bold text-card-foreground">Butte County Rental Map</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild className="h-8 bg-transparent">
            <Link href="/projects"><Home className="mr-1 h-4 w-4" />Home</Link>
          </Button>
          <Button variant="outline" size="sm" asChild className="h-8 bg-transparent">
            <Link href="/admin/import"><Settings className="mr-1 h-4 w-4" />Admin Import</Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.open(EXCEL_FILE_URL, "_blank", "noopener,noreferrer")} className="h-8 bg-transparent">
            <ExternalLink className="mr-1 h-4 w-4" />Excel Sheet
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} className="h-8 bg-transparent">
            <Download className="mr-1 h-4 w-4" />Export CSV
          </Button>

          {/* View Mode Toggle */}
          <div className="flex rounded-lg border border-border bg-muted p-1">
            <Button variant={viewMode === "map" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("map")} className="h-7">
              <Map className="mr-1 h-4 w-4" />Map
            </Button>
            <Button variant={viewMode === "list" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("list")} className="h-7">
              <List className="mr-1 h-4 w-4" />List
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {showFilters && (
          <FilterSidebar
            filters={filters}
            onFiltersChange={handleFiltersChange}
            cities={cities}
            managementCompanies={managementCompanies}
            mapFilters={mapFilters}
            onMapFiltersChange={handleMapFiltersChange}
          />
        )}

        <div className="flex flex-1 overflow-hidden">
          {viewMode === "map" ? (
            <div className="relative flex-1">
              {isLoadingMap && (
                <div className="absolute right-4 top-16 z-20 flex items-center gap-2 rounded-lg bg-white px-3 py-2 shadow-md">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Updating map…</span>
                </div>
              )}
              <ButteCountyMap
                properties={mapProperties}
                selectedProperty={selectedProperty}
                onPropertySelect={handlePropertySelect}
                filters={mapFilters}
                onFiltersChange={handleMapFiltersChange}
              />
            </div>
          ) : (
            <div className="flex-1 overflow-hidden">
              {isLoadingList ? (
                <div className="flex h-full items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Loading properties…</span>
                </div>
              ) : (
                <PropertyList
                  properties={listProperties}
                  selectedProperty={selectedProperty}
                  onPropertySelect={handlePropertySelect}
                  onWatch={handlePropertySelect}
                  total={listTotal}
                  isLoadingMore={isLoadingMore}
                  onLoadMore={handleLoadMore}
                />
              )}
            </div>
          )}

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
