"use client"

import type React from "react"
import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import type { Property } from "@/types/property"
import { Button } from "@/components/ui/button"
import { Plus, Minus, Home, Layers } from "lucide-react"

interface ButteCountyMapProps {
  properties: Property[]
  selectedProperty: Property | null
  onPropertySelect: (property: Property | null) => void
  filters: {
    showAvailable: boolean
    showOccupied: boolean
    showPostFire: boolean
    showStudentHousing: boolean
    showSection8: boolean
  }
}

// Butte County bounds
const BOUNDS = {
  minLat: 39.3,
  maxLat: 40.05,
  minLng: -122.05,
  maxLng: -121.15,
}

const DEFAULT_CENTER = { lat: 39.7285, lng: -121.8375 }
const DEFAULT_ZOOM = 11

// City centers for reference labels
const CITIES = [
  { name: "Chico", lat: 39.7285, lng: -121.8375 },
  { name: "Paradise", lat: 39.7596, lng: -121.6219 },
  { name: "Oroville", lat: 39.5138, lng: -121.5564 },
  { name: "Gridley", lat: 39.3638, lng: -121.6936 },
  { name: "Biggs", lat: 39.4124, lng: -121.7129 },
  { name: "Durham", lat: 39.6463, lng: -121.7997 },
  { name: "Magalia", lat: 39.8118, lng: -121.5783 },
]

const ESRI_BASEMAP_URL = "https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile"

export function ButteCountyMap({ properties, selectedProperty, onPropertySelect, filters }: ButteCountyMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const [zoom, setZoom] = useState(DEFAULT_ZOOM)
  const [center, setCenter] = useState(DEFAULT_CENTER)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, lat: 0, lng: 0 })
  const [hoveredProperty, setHoveredProperty] = useState<Property | null>(null)
  const [showLabels, setShowLabels] = useState(true)

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        })
      }
    }
    updateDimensions()
    window.addEventListener("resize", updateDimensions)
    return () => window.removeEventListener("resize", updateDimensions)
  }, [])

  // Convert lat/lng to pixel coordinates
  const latLngToPixel = useCallback(
    (lat: number, lng: number) => {
      const scale = Math.pow(2, zoom) * 256
      const worldX = ((lng + 180) / 360) * scale
      const worldY =
        ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * scale

      const centerX = ((center.lng + 180) / 360) * scale
      const centerY =
        ((1 - Math.log(Math.tan((center.lat * Math.PI) / 180) + 1 / Math.cos((center.lat * Math.PI) / 180)) / Math.PI) /
          2) *
        scale

      return {
        x: worldX - centerX + dimensions.width / 2,
        y: worldY - centerY + dimensions.height / 2,
      }
    },
    [zoom, center, dimensions],
  )

  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(18, z + 1))
  }, [])

  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(8, z - 1))
  }, [])

  // Get tile coordinates for current view
  const getTiles = useMemo(() => {
    const tiles: { x: number; y: number; z: number }[] = []
    const tileSize = 256
    const scale = Math.pow(2, zoom)

    // Calculate tile range
    const centerTileX = Math.floor(((center.lng + 180) / 360) * scale)
    const centerTileY = Math.floor(
      ((1 - Math.log(Math.tan((center.lat * Math.PI) / 180) + 1 / Math.cos((center.lat * Math.PI) / 180)) / Math.PI) /
        2) *
        scale,
    )

    const tilesX = Math.ceil(dimensions.width / tileSize) + 2
    const tilesY = Math.ceil(dimensions.height / tileSize) + 2

    for (let dx = -Math.floor(tilesX / 2); dx <= Math.ceil(tilesX / 2); dx++) {
      for (let dy = -Math.floor(tilesY / 2); dy <= Math.ceil(tilesY / 2); dy++) {
        const x = centerTileX + dx
        const y = centerTileY + dy
        if (x >= 0 && x < scale && y >= 0 && y < scale) {
          tiles.push({ x, y, z: zoom })
        }
      }
    }

    return tiles
  }, [zoom, center, dimensions])

  // Calculate tile position
  const getTilePosition = useCallback(
    (tileX: number, tileY: number) => {
      const scale = Math.pow(2, zoom) * 256
      const centerX = ((center.lng + 180) / 360) * scale
      const centerY =
        ((1 - Math.log(Math.tan((center.lat * Math.PI) / 180) + 1 / Math.cos((center.lat * Math.PI) / 180)) / Math.PI) /
          2) *
        scale

      return {
        x: tileX * 256 - centerX + dimensions.width / 2,
        y: tileY * 256 - centerY + dimensions.height / 2,
      }
    },
    [zoom, center, dimensions],
  )

  // Filter properties based on map filters
  const filteredProperties = useMemo(() => {
    return properties.filter((p) => {
      if (!p.latitude || !p.longitude) return false
      if (p.is_available && !filters.showAvailable) return false
      if (!p.is_available && !filters.showOccupied) return false
      if (p.is_post_fire_rebuild && !filters.showPostFire) return false
      if (p.is_student_housing && !filters.showStudentHousing) return false
      if (p.is_section_8 && !filters.showSection8) return false
      return true
    })
  }, [properties, filters])

  // Get color for property pin
  const getPropertyColor = (property: Property) => {
    if (property.is_section_8) return "#8B5CF6"
    if (property.is_post_fire_rebuild) return "#F97316"
    if (property.is_student_housing) return "#3B82F6"
    if (property.is_available) return "#22C55E"
    return "#6B7280"
  }

  // Mouse handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true)
      setDragStart({ x: e.clientX, y: e.clientY, lat: center.lat, lng: center.lng })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      const dx = e.clientX - dragStart.x
      const dy = e.clientY - dragStart.y

      const scale = Math.pow(2, zoom) * 256
      const dLng = (-dx / scale) * 360
      const dLat = (dy / scale) * 180

      setCenter({
        lat: Math.max(-85, Math.min(85, dragStart.lat + dLat)),
        lng: dragStart.lng + dLng,
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -1 : 1
    setZoom((z) => Math.max(8, Math.min(18, z + delta)))
  }, [])

  const resetView = useCallback(() => {
    setZoom(DEFAULT_ZOOM)
    setCenter(DEFAULT_CENTER)
  }, [])

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-100" ref={containerRef}>
      {/* Map Controls */}
      <div className="absolute left-4 top-4 z-10 flex flex-col gap-2">
        <Button
          variant="secondary"
          size="icon"
          onClick={handleZoomIn}
          className="h-8 w-8 bg-white shadow-md hover:bg-gray-100"
          title="Zoom In"
        >
          <Plus className="h-4 w-4 text-gray-700" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          onClick={handleZoomOut}
          className="h-8 w-8 bg-white shadow-md hover:bg-gray-100"
          title="Zoom Out"
        >
          <Minus className="h-4 w-4 text-gray-700" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          onClick={resetView}
          className="h-8 w-8 bg-white shadow-md hover:bg-gray-100"
          title="Reset View to Chico"
        >
          <Home className="h-4 w-4 text-gray-700" />
        </Button>
        <Button
          variant={showLabels ? "default" : "secondary"}
          size="icon"
          onClick={() => setShowLabels(!showLabels)}
          className="h-8 w-8 shadow-md"
          title="Toggle City Labels"
        >
          <Layers className="h-4 w-4" />
        </Button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-10 rounded-lg bg-white p-3 shadow-md">
        <div className="mb-2 text-xs font-semibold text-gray-800">Legend</div>
        <div className="flex flex-col gap-1.5 text-xs">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-green-500" />
            <span className="text-gray-700">Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-gray-500" />
            <span className="text-gray-700">Occupied</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-orange-500" />
            <span className="text-gray-700">Post-Fire Rebuild</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-blue-500" />
            <span className="text-gray-700">Student Housing</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-purple-500" />
            <span className="text-gray-700">Section 8</span>
          </div>
        </div>
      </div>

      {/* Property Count & Zoom Level */}
      <div className="absolute right-4 top-4 z-10 flex flex-col gap-2">
        <div className="rounded-lg bg-white px-3 py-2 shadow-md">
          <span className="text-sm font-medium text-gray-800">{filteredProperties.length} properties</span>
        </div>
        <div className="rounded-lg bg-white px-3 py-1 shadow-md">
          <span className="text-xs text-gray-600">Zoom: {zoom}</span>
        </div>
      </div>

      {/* Hover Tooltip */}
      {hoveredProperty && (
        <div
          className="pointer-events-none absolute z-20 max-w-xs rounded-lg bg-white p-3 shadow-lg"
          style={{
            left: Math.min(
              latLngToPixel(hoveredProperty.latitude!, hoveredProperty.longitude!).x + 20,
              dimensions.width - 220,
            ),
            top: Math.min(
              latLngToPixel(hoveredProperty.latitude!, hoveredProperty.longitude!).y - 10,
              dimensions.height - 120,
            ),
          }}
        >
          <div className="font-semibold text-gray-900">{hoveredProperty.property_name || hoveredProperty.address}</div>
          <div className="text-sm text-gray-600">{hoveredProperty.address}</div>
          <div className="text-sm text-gray-600">
            {hoveredProperty.city}, CA {hoveredProperty.zip_code}
          </div>
          {hoveredProperty.current_rent && (
            <div className="mt-1 font-medium text-green-600">${hoveredProperty.current_rent.toLocaleString()}/mo</div>
          )}
          {hoveredProperty.bedrooms && (
            <div className="text-sm text-gray-500">
              {hoveredProperty.bedrooms} bed, {hoveredProperty.bathrooms} bath
            </div>
          )}
          <div className="mt-1 text-xs text-blue-500">Click to view details</div>
        </div>
      )}

      {/* Map Container */}
      <div
        className="relative h-full w-full cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{ touchAction: "none" }}
      >
        {getTiles.map((tile) => {
          const pos = getTilePosition(tile.x, tile.y)
          const key = `${tile.z}-${tile.x}-${tile.y}`
          const tileUrl = `${ESRI_BASEMAP_URL}/${tile.z}/${tile.y}/${tile.x}`

          return (
            <img
              key={key}
              src={tileUrl || "/placeholder.svg"}
              alt=""
              className="absolute"
              style={{
                left: pos.x,
                top: pos.y,
                width: 256,
                height: 256,
                pointerEvents: "none",
              }}
              draggable={false}
              onError={(e) => {
                // Hide broken tiles
                ;(e.target as HTMLImageElement).style.display = "none"
              }}
            />
          )
        })}

        {/* City labels */}
        {showLabels &&
          CITIES.map((city) => {
            const pos = latLngToPixel(city.lat, city.lng)
            if (pos.x < -50 || pos.x > dimensions.width + 50 || pos.y < -50 || pos.y > dimensions.height + 50) {
              return null
            }
            return (
              <div
                key={city.name}
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-full"
                style={{ left: pos.x, top: pos.y - 12 }}
              >
                <div className="rounded bg-white/90 px-2 py-0.5 text-xs font-semibold text-gray-800 shadow-sm">
                  {city.name}
                </div>
              </div>
            )
          })}

        {/* Property pins */}
        {filteredProperties.map((property) => {
          const pos = latLngToPixel(property.latitude!, property.longitude!)
          if (pos.x < -20 || pos.x > dimensions.width + 20 || pos.y < -20 || pos.y > dimensions.height + 20) {
            return null
          }
          const isSelected = selectedProperty?.id === property.id
          const isHovered = hoveredProperty?.id === property.id
          const color = getPropertyColor(property)
          const size = isSelected || isHovered ? 16 : 12

          return (
            <div
              key={property.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-transform hover:scale-125"
              style={{ left: pos.x, top: pos.y, zIndex: isSelected || isHovered ? 100 : 10 }}
              onMouseEnter={() => setHoveredProperty(property)}
              onMouseLeave={() => setHoveredProperty(null)}
              onClick={(e) => {
                e.stopPropagation()
                onPropertySelect(property)
              }}
            >
              {/* Pulse effect for selected */}
              {isSelected && (
                <div
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full opacity-40"
                  style={{ width: size * 2, height: size * 2, backgroundColor: color }}
                />
              )}
              {/* Pin */}
              <div
                className="rounded-full shadow-lg"
                style={{
                  width: size,
                  height: size,
                  backgroundColor: color,
                  border: isSelected ? "3px solid white" : "2px solid rgba(255,255,255,0.8)",
                  boxShadow: isSelected ? `0 0 0 2px ${color}` : undefined,
                }}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
