"use client"

import type React from "react"

import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import type { Property } from "@/types/property"
import { Button } from "@/components/ui/button"
import { ZoomIn, ZoomOut, RotateCcw, Layers } from "lucide-react"

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

// Butte County bounds (approximate)
const BOUNDS = {
  minLat: 39.3,
  maxLat: 40.05,
  minLng: -122.05,
  maxLng: -121.15,
}

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

export function ButteCountyMap({ properties, selectedProperty, onPropertySelect, filters }: ButteCountyMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
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

  // Convert lat/lng to SVG coordinates
  const latLngToXY = useCallback(
    (lat: number, lng: number) => {
      const x = ((lng - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng)) * dimensions.width
      const y = ((BOUNDS.maxLat - lat) / (BOUNDS.maxLat - BOUNDS.minLat)) * dimensions.height
      return { x, y }
    },
    [dimensions],
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
    if (property.is_section_8) return "#8B5CF6" // Purple
    if (property.is_post_fire_rebuild) return "#F97316" // Orange
    if (property.is_student_housing) return "#3B82F6" // Blue
    if (property.is_available) return "#22C55E" // Green
    return "#6B7280" // Gray
  }

  // Mouse handlers for panning
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true)
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setZoom((z) => Math.max(0.5, Math.min(5, z + delta)))
  }

  const resetView = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-100" ref={containerRef}>
      {/* Map Controls */}
      <div className="absolute left-4 top-4 z-10 flex flex-col gap-2">
        <Button
          variant="secondary"
          size="icon"
          onClick={() => setZoom((z) => Math.min(5, z + 0.25))}
          className="h-8 w-8 bg-white shadow-md"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
          className="h-8 w-8 bg-white shadow-md"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button variant="secondary" size="icon" onClick={resetView} className="h-8 w-8 bg-white shadow-md">
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button
          variant={showLabels ? "default" : "secondary"}
          size="icon"
          onClick={() => setShowLabels(!showLabels)}
          className="h-8 w-8 shadow-md"
        >
          <Layers className="h-4 w-4" />
        </Button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-10 rounded-lg bg-white p-3 shadow-md">
        <div className="mb-2 text-xs font-semibold text-gray-700">Legend</div>
        <div className="flex flex-col gap-1.5 text-xs">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-green-500" />
            <span>Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-gray-500" />
            <span>Occupied</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-orange-500" />
            <span>Post-Fire Rebuild</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-blue-500" />
            <span>Student Housing</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-purple-500" />
            <span>Section 8</span>
          </div>
        </div>
      </div>

      {/* Property Count */}
      <div className="absolute right-4 top-4 z-10 rounded-lg bg-white px-3 py-2 shadow-md">
        <span className="text-sm font-medium">{filteredProperties.length} properties</span>
      </div>

      {/* Hover Tooltip */}
      {hoveredProperty && (
        <div
          className="pointer-events-none absolute z-20 max-w-xs rounded-lg bg-white p-3 shadow-lg"
          style={{
            left: latLngToXY(hoveredProperty.latitude!, hoveredProperty.longitude!).x * zoom + pan.x + 20,
            top: latLngToXY(hoveredProperty.latitude!, hoveredProperty.longitude!).y * zoom + pan.y - 10,
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
        </div>
      )}

      {/* SVG Map */}
      <svg
        width={dimensions.width}
        height={dimensions.height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        className="cursor-grab active:cursor-grabbing"
        style={{ touchAction: "none" }}
      >
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Background county shape (simplified polygon) */}
          <path
            d={`M ${dimensions.width * 0.1},${dimensions.height * 0.1} 
                L ${dimensions.width * 0.9},${dimensions.height * 0.05} 
                L ${dimensions.width * 0.95},${dimensions.height * 0.5} 
                L ${dimensions.width * 0.85},${dimensions.height * 0.95} 
                L ${dimensions.width * 0.15},${dimensions.height * 0.9} 
                L ${dimensions.width * 0.05},${dimensions.height * 0.4} Z`}
            fill="#E5E7EB"
            stroke="#9CA3AF"
            strokeWidth={1 / zoom}
          />

          {/* Grid lines */}
          {Array.from({ length: 10 }).map((_, i) => (
            <g key={`grid-${i}`}>
              <line
                x1={0}
                y1={(i / 10) * dimensions.height}
                x2={dimensions.width}
                y2={(i / 10) * dimensions.height}
                stroke="#D1D5DB"
                strokeWidth={0.5 / zoom}
                strokeDasharray={`${4 / zoom} ${4 / zoom}`}
              />
              <line
                x1={(i / 10) * dimensions.width}
                y1={0}
                x2={(i / 10) * dimensions.width}
                y2={dimensions.height}
                stroke="#D1D5DB"
                strokeWidth={0.5 / zoom}
                strokeDasharray={`${4 / zoom} ${4 / zoom}`}
              />
            </g>
          ))}

          {/* City labels */}
          {showLabels &&
            CITIES.map((city) => {
              const { x, y } = latLngToXY(city.lat, city.lng)
              return (
                <g key={city.name}>
                  <circle cx={x} cy={y} r={8 / zoom} fill="rgba(0,0,0,0.1)" stroke="#374151" strokeWidth={1 / zoom} />
                  <text
                    x={x}
                    y={y - 12 / zoom}
                    textAnchor="middle"
                    fontSize={12 / zoom}
                    fontWeight="600"
                    fill="#374151"
                    className="pointer-events-none select-none"
                  >
                    {city.name}
                  </text>
                </g>
              )
            })}

          {/* Property pins */}
          {filteredProperties.map((property) => {
            const { x, y } = latLngToXY(property.latitude!, property.longitude!)
            const isSelected = selectedProperty?.id === property.id
            const isHovered = hoveredProperty?.id === property.id
            const color = getPropertyColor(property)
            const size = isSelected || isHovered ? 10 : 6

            return (
              <g key={property.id}>
                {/* Pulse effect for selected */}
                {isSelected && (
                  <circle
                    cx={x}
                    cy={y}
                    r={16 / zoom}
                    fill="none"
                    stroke={color}
                    strokeWidth={2 / zoom}
                    opacity={0.4}
                    className="animate-ping"
                  />
                )}
                {/* Pin shadow */}
                <circle cx={x + 1 / zoom} cy={y + 1 / zoom} r={size / zoom} fill="rgba(0,0,0,0.2)" />
                {/* Pin */}
                <circle
                  cx={x}
                  cy={y}
                  r={size / zoom}
                  fill={color}
                  stroke={isSelected ? "#fff" : "rgba(255,255,255,0.8)"}
                  strokeWidth={(isSelected ? 3 : 1.5) / zoom}
                  className="cursor-pointer transition-all duration-150"
                  onMouseEnter={() => setHoveredProperty(property)}
                  onMouseLeave={() => setHoveredProperty(null)}
                  onClick={(e) => {
                    e.stopPropagation()
                    onPropertySelect(property)
                  }}
                />
              </g>
            )
          })}
        </g>
      </svg>
    </div>
  )
}
