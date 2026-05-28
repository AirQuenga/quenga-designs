"use client"

import type React from "react"
import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import type { Property } from "@/types/property"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Plus, Minus, Home, Layers, ChevronDown, ChevronUp, X, MapPin, Phone, DollarSign } from "lucide-react"

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
  onFiltersChange?: (filters: ButteCountyMapProps["filters"]) => void
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

// Clustering grid size in pixels
const CLUSTER_RADIUS = 40

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

interface Cluster {
  id: string
  x: number
  y: number
  count: number
  properties: Property[]
  color: string
}

function getPropertyColor(property: Property) {
  if (property.is_section_8) return "#8B5CF6"
  if (property.is_post_fire_rebuild) return "#F97316"
  if (property.is_student_housing) return "#3B82F6"
  if (property.is_available) return "#22C55E"
  return "#6B7280"
}

function clusterProperties(
  properties: Property[],
  latLngToPixel: (lat: number, lng: number) => { x: number; y: number },
  radius: number,
): Cluster[] {
  if (properties.length < 200) {
    return properties
      .filter((p) => p.latitude && p.longitude)
      .map((p) => {
        const pos = latLngToPixel(p.latitude!, p.longitude!)
        return { id: p.id, x: pos.x, y: pos.y, count: 1, properties: [p], color: getPropertyColor(p) }
      })
  }

  const placed: Cluster[] = []
  const used = new Set<string>()

  for (const p of properties) {
    if (!p.latitude || !p.longitude || used.has(p.id)) continue
    const pos = latLngToPixel(p.latitude, p.longitude)
    const existing = placed.find((c) => Math.hypot(c.x - pos.x, c.y - pos.y) <= radius)
    if (existing) {
      existing.properties.push(p)
      existing.count++
      existing.x = existing.properties.reduce((s, pp) => s + latLngToPixel(pp.latitude!, pp.longitude!).x, 0) / existing.count
      existing.y = existing.properties.reduce((s, pp) => s + latLngToPixel(pp.latitude!, pp.longitude!).y, 0) / existing.count
      existing.color = getPropertyColor(existing.properties.find((pp) => pp.is_available) ?? existing.properties[0])
      used.add(p.id)
    } else {
      placed.push({ id: p.id, x: pos.x, y: pos.y, count: 1, properties: [p], color: getPropertyColor(p) })
      used.add(p.id)
    }
  }
  return placed
}

const LAYER_CONFIG = [
  { key: "showAvailable" as const, label: "Available", color: "#22C55E" },
  { key: "showOccupied" as const, label: "Occupied", color: "#6B7280" },
  { key: "showPostFire" as const, label: "Post-Fire Housing", color: "#F97316" },
  { key: "showStudentHousing" as const, label: "Student Housing", color: "#3B82F6" },
  { key: "showSection8" as const, label: "Section 8", color: "#8B5CF6" },
]

export function ButteCountyMap({ properties, selectedProperty, onPropertySelect, filters, onFiltersChange }: ButteCountyMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const [zoom, setZoom] = useState(DEFAULT_ZOOM)
  const [center, setCenter] = useState(DEFAULT_CENTER)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, lat: 0, lng: 0 })
  const [hoveredCluster, setHoveredCluster] = useState<Cluster | null>(null)
  const [showLayers, setShowLayers] = useState(false)
  
  // Mobile-specific state
  const [isMobile, setIsMobile] = useState(false)
  const [showTwoFingerHint, setShowTwoFingerHint] = useState(false)
  const [bottomSheetOpen, setBottomSheetOpen] = useState(false)
  const [bottomSheetProperty, setBottomSheetProperty] = useState<Property | null>(null)
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null)
  const lastTouchDistanceRef = useRef<number | null>(null)

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

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

  const latLngToPixel = useCallback(
    (lat: number, lng: number) => {
      const scale = Math.pow(2, zoom) * 256
      const worldX = ((lng + 180) / 360) * scale
      const worldY = ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * scale
      const centerX = ((center.lng + 180) / 360) * scale
      const centerY = ((1 - Math.log(Math.tan((center.lat * Math.PI) / 180) + 1 / Math.cos((center.lat * Math.PI) / 180)) / Math.PI) / 2) * scale
      return {
        x: worldX - centerX + dimensions.width / 2,
        y: worldY - centerY + dimensions.height / 2,
      }
    },
    [zoom, center, dimensions],
  )

  // Only render tiles for current viewport
  const getTiles = useMemo(() => {
    const tiles: { x: number; y: number; z: number }[] = []
    const tileSize = 256
    const scale = Math.pow(2, zoom)
    const centerTileX = Math.floor(((center.lng + 180) / 360) * scale)
    const centerTileY = Math.floor(((1 - Math.log(Math.tan((center.lat * Math.PI) / 180) + 1 / Math.cos((center.lat * Math.PI) / 180)) / Math.PI) / 2) * scale)
    const tilesX = Math.ceil(dimensions.width / tileSize) + 2
    const tilesY = Math.ceil(dimensions.height / tileSize) + 2
    for (let dx = -Math.floor(tilesX / 2); dx <= Math.ceil(tilesX / 2); dx++) {
      for (let dy = -Math.floor(tilesY / 2); dy <= Math.ceil(tilesY / 2); dy++) {
        const x = centerTileX + dx
        const y = centerTileY + dy
        if (x >= 0 && x < scale && y >= 0 && y < scale) tiles.push({ x, y, z: zoom })
      }
    }
    return tiles
  }, [zoom, center, dimensions])

  const getTilePosition = useCallback(
    (tileX: number, tileY: number) => {
      const scale = Math.pow(2, zoom) * 256
      const centerX = ((center.lng + 180) / 360) * scale
      const centerY = ((1 - Math.log(Math.tan((center.lat * Math.PI) / 180) + 1 / Math.cos((center.lat * Math.PI) / 180)) / Math.PI) / 2) * scale
      return {
        x: tileX * 256 - centerX + dimensions.width / 2,
        y: tileY * 256 - centerY + dimensions.height / 2,
      }
    },
    [zoom, center, dimensions],
  )

  // Viewport culling: only show properties in current view
  const viewportProperties = useMemo(() => {
    const padding = 50
    return properties.filter((p) => {
      if (!p.latitude || !p.longitude) return false
      const pos = latLngToPixel(p.latitude, p.longitude)
      return pos.x >= -padding && pos.x <= dimensions.width + padding && pos.y >= -padding && pos.y <= dimensions.height + padding
    })
  }, [properties, latLngToPixel, dimensions])

  const filteredProperties = useMemo(() => {
    return viewportProperties.filter((p) => {
      if (p.is_available && !filters.showAvailable) return false
      if (!p.is_available && !filters.showOccupied) return false
      if (p.is_post_fire_rebuild && !filters.showPostFire) return false
      if (p.is_student_housing && !filters.showStudentHousing) return false
      if (p.is_section_8 && !filters.showSection8) return false
      return true
    })
  }, [viewportProperties, filters])

  const clusters = useMemo(
    () => clusterProperties(filteredProperties, latLngToPixel, CLUSTER_RADIUS),
    [filteredProperties, latLngToPixel],
  )

  const handleZoomIn = useCallback(() => setZoom((z) => Math.min(18, z + 1)), [])
  const handleZoomOut = useCallback(() => setZoom((z) => Math.max(8, z - 1)), [])
  const resetView = useCallback(() => { setZoom(DEFAULT_ZOOM); setCenter(DEFAULT_CENTER) }, [])

  // Desktop mouse handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true)
      setDragStart({ x: e.clientX, y: e.clientY, lat: center.lat, lng: center.lng })
    }
  }
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    const dx = e.clientX - dragStart.x
    const dy = e.clientY - dragStart.y
    const scale = Math.pow(2, zoom) * 256
    setCenter({
      lat: Math.max(-85, Math.min(85, dragStart.lat + (dy / scale) * 180)),
      lng: dragStart.lng + (-dx / scale) * 360,
    })
  }
  const handleMouseUp = () => setIsDragging(false)

  // Mobile touch handlers - two-finger pan only
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      // Single finger - show hint, don't pan
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, time: Date.now() }
      setShowTwoFingerHint(true)
      setTimeout(() => setShowTwoFingerHint(false), 1500)
    } else if (e.touches.length === 2) {
      // Two fingers - start panning
      setShowTwoFingerHint(false)
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2
      setDragStart({ x: midX, y: midY, lat: center.lat, lng: center.lng })
      lastTouchDistanceRef.current = Math.hypot(
        e.touches[1].clientX - e.touches[0].clientX,
        e.touches[1].clientY - e.touches[0].clientY
      )
      setIsDragging(true)
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && isDragging) {
      e.preventDefault()
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2
      const dx = midX - dragStart.x
      const dy = midY - dragStart.y
      const scale = Math.pow(2, zoom) * 256
      setCenter({
        lat: Math.max(-85, Math.min(85, dragStart.lat + (dy / scale) * 180)),
        lng: dragStart.lng + (-dx / scale) * 360,
      })

      // Pinch to zoom
      const newDist = Math.hypot(
        e.touches[1].clientX - e.touches[0].clientX,
        e.touches[1].clientY - e.touches[0].clientY
      )
      if (lastTouchDistanceRef.current) {
        const delta = newDist - lastTouchDistanceRef.current
        if (Math.abs(delta) > 20) {
          setZoom((z) => Math.max(8, Math.min(18, z + (delta > 0 ? 0.5 : -0.5))))
          lastTouchDistanceRef.current = newDist
        }
      }
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      setIsDragging(false)
      lastTouchDistanceRef.current = null
    }
    // Check for tap on single finger
    if (e.changedTouches.length === 1 && touchStartRef.current) {
      const dx = e.changedTouches[0].clientX - touchStartRef.current.x
      const dy = e.changedTouches[0].clientY - touchStartRef.current.y
      const dt = Date.now() - touchStartRef.current.time
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && dt < 300) {
        // This was a tap - check if on a cluster
        const tapX = e.changedTouches[0].clientX - (containerRef.current?.getBoundingClientRect().left ?? 0)
        const tapY = e.changedTouches[0].clientY - (containerRef.current?.getBoundingClientRect().top ?? 0)
        const tapped = clusters.find((c) => Math.hypot(c.x - tapX, c.y - tapY) < 25)
        if (tapped) {
          handleClusterClick(tapped)
        }
      }
    }
    touchStartRef.current = null
  }

  // Disable scroll-zoom on mobile, enable on desktop
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (isMobile) return // No scroll zoom on mobile
    e.preventDefault()
    setZoom((z) => Math.max(8, Math.min(18, z + (e.deltaY > 0 ? -1 : 1))))
  }, [isMobile])

  const allSelected = Object.values(filters).every(Boolean)

  const handleToggleAll = () => {
    if (!onFiltersChange) return
    const nextValue = !allSelected
    onFiltersChange({
      showAvailable: nextValue,
      showOccupied: nextValue,
      showPostFire: nextValue,
      showStudentHousing: nextValue,
      showSection8: nextValue,
    })
  }

  const handleClusterClick = (cluster: Cluster) => {
    if (cluster.count === 1) {
      const prop = cluster.properties[0]
      if (isMobile) {
        // Show bottom sheet on mobile
        setBottomSheetProperty(prop)
        setBottomSheetOpen(true)
      } else {
        onPropertySelect(prop)
      }
    } else {
      // Zoom in to expand the cluster
      const avg = cluster.properties.reduce(
        (acc, p) => ({ lat: acc.lat + (p.latitude ?? 0), lng: acc.lng + (p.longitude ?? 0) }),
        { lat: 0, lng: 0 },
      )
      setCenter({ lat: avg.lat / cluster.count, lng: avg.lng / cluster.count })
      setZoom((z) => Math.min(18, z + 2))
    }
  }

  const handleBottomSheetSelect = () => {
    if (bottomSheetProperty) {
      onPropertySelect(bottomSheetProperty)
      setBottomSheetOpen(false)
    }
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-100" ref={containerRef}>
      {/* Two-finger pan hint overlay */}
      {showTwoFingerHint && isMobile && (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="rounded-lg bg-white px-4 py-3 shadow-lg">
            <p className="text-sm font-medium text-slate-900">Use two fingers to pan the map</p>
          </div>
        </div>
      )}

      {/* Map Controls */}
      <div className="absolute left-2 top-2 z-10 flex flex-col gap-1.5 sm:left-4 sm:top-4 sm:gap-2">
        <Button variant="secondary" size="icon" onClick={handleZoomIn} className="h-10 w-10 bg-white shadow-md hover:bg-gray-100 sm:h-8 sm:w-8" title="Zoom In">
          <Plus className="h-5 w-5 text-gray-700 sm:h-4 sm:w-4" />
        </Button>
        <Button variant="secondary" size="icon" onClick={handleZoomOut} className="h-10 w-10 bg-white shadow-md hover:bg-gray-100 sm:h-8 sm:w-8" title="Zoom Out">
          <Minus className="h-5 w-5 text-gray-700 sm:h-4 sm:w-4" />
        </Button>
        <Button variant="secondary" size="icon" onClick={resetView} className="h-10 w-10 bg-white shadow-md hover:bg-gray-100 sm:h-8 sm:w-8" title="Reset View">
          <Home className="h-5 w-5 text-gray-700 sm:h-4 sm:w-4" />
        </Button>

        {/* Layers menu - hidden on mobile, show in bottom area instead */}
        {!isMobile && (
          <div className="relative">
            <Button
              variant={showLayers ? "default" : "secondary"}
              size="icon"
              onClick={() => setShowLayers((v) => !v)}
              className="h-8 w-8 shadow-md"
              title="Toggle Map Layers"
            >
              <Layers className="h-4 w-4" />
            </Button>

            {showLayers && (
              <div className="absolute left-10 top-0 w-52 rounded-lg border border-gray-200 bg-white shadow-lg">
                <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
                  <span className="text-xs font-semibold text-gray-700">Map Layers</span>
                  <button onClick={() => setShowLayers(false)} className="text-gray-400 hover:text-gray-600">
                    <ChevronUp className="h-4 w-4" />
                  </button>
                </div>
                <div className="border-b border-gray-100 px-3 py-2">
                  <button
                    onClick={handleToggleAll}
                    className="w-full rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:opacity-90"
                  >
                    {allSelected ? "Hide All Layers" : "Toggle All Layers"}
                  </button>
                </div>
                <div className="space-y-1.5 px-3 py-2">
                  {LAYER_CONFIG.map((layer) => (
                    <div key={layer.key} className="flex items-center gap-2">
                      <Checkbox
                        id={`layer-${layer.key}`}
                        checked={filters[layer.key]}
                        onCheckedChange={(checked) => {
                          if (onFiltersChange) onFiltersChange({ ...filters, [layer.key]: !!checked })
                        }}
                      />
                      <Label htmlFor={`layer-${layer.key}`} className="flex cursor-pointer items-center gap-2 text-xs">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: layer.color }} />
                        {layer.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Legend - compact on mobile */}
      <div className={`absolute z-10 rounded-lg bg-white shadow-md ${isMobile ? "bottom-2 left-2 p-2" : "bottom-4 left-4 p-3"}`}>
        <div className={`font-semibold text-gray-800 ${isMobile ? "mb-1 text-[10px]" : "mb-2 text-xs"}`}>Legend</div>
        <div className={`flex flex-col text-xs ${isMobile ? "gap-0.5" : "gap-1.5"}`}>
          {LAYER_CONFIG.map((layer) => (
            <div key={layer.key} className="flex items-center gap-1.5">
              <div className={`rounded-full ${isMobile ? "h-2 w-2" : "h-3 w-3"}`} style={{ backgroundColor: layer.color }} />
              <span className={`text-gray-700 ${isMobile ? "text-[9px]" : ""}`}>{layer.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Property Count */}
      <div className="absolute right-2 top-2 z-10 flex flex-col gap-1.5 sm:right-4 sm:top-4 sm:gap-2">
        <div className="rounded-lg bg-white px-2 py-1.5 shadow-md sm:px-3 sm:py-2">
          <span className="text-xs font-medium text-gray-800 sm:text-sm">
            {filteredProperties.length.toLocaleString()} properties
          </span>
        </div>
      </div>

      {/* Hover Tooltip (desktop only) */}
      {!isMobile && hoveredCluster && hoveredCluster.count === 1 && (() => {
        const p = hoveredCluster.properties[0]
        const pos = { x: hoveredCluster.x, y: hoveredCluster.y }
        return (
          <div
            className="pointer-events-none absolute z-20 max-w-xs rounded-lg bg-white p-3 shadow-lg"
            style={{
              left: Math.min(pos.x + 20, dimensions.width - 220),
              top: Math.min(pos.y - 10, dimensions.height - 120),
            }}
          >
            <div className="font-semibold text-gray-900">{p.property_name || p.address}</div>
            <div className="text-sm text-gray-600">{p.address}</div>
            <div className="text-sm text-gray-600">{p.city}, CA {p.zip_code}</div>
            {p.current_rent && <div className="mt-1 font-medium text-green-600">${p.current_rent.toLocaleString()}/mo</div>}
            {p.bedrooms && <div className="text-sm text-gray-500">{p.bedrooms} bed, {p.bathrooms} bath</div>}
            <div className="mt-1 text-xs text-blue-500">Click to view details</div>
          </div>
        )
      })()}

      {!isMobile && hoveredCluster && hoveredCluster.count > 1 && (
        <div
          className="pointer-events-none absolute z-20 rounded-lg bg-white px-3 py-2 shadow-lg"
          style={{ left: hoveredCluster.x + 20, top: hoveredCluster.y - 10 }}
        >
          <div className="text-sm font-semibold text-gray-800">{hoveredCluster.count} properties</div>
          <div className="text-xs text-blue-500">Click to zoom in</div>
        </div>
      )}

      {/* Map Container */}
      <div
        className="relative h-full w-full cursor-grab active:cursor-grabbing"
        onMouseDown={!isMobile ? handleMouseDown : undefined}
        onMouseMove={!isMobile ? handleMouseMove : undefined}
        onMouseUp={!isMobile ? handleMouseUp : undefined}
        onMouseLeave={!isMobile ? handleMouseUp : undefined}
        onTouchStart={isMobile ? handleTouchStart : undefined}
        onTouchMove={isMobile ? handleTouchMove : undefined}
        onTouchEnd={isMobile ? handleTouchEnd : undefined}
        onWheel={handleWheel}
        style={{ touchAction: isMobile ? "none" : "auto" }}
      >
        {/* Tiles */}
        {getTiles.map((tile) => {
          const pos = getTilePosition(tile.x, tile.y)
          return (
            <img
              key={`${tile.z}-${tile.x}-${tile.y}`}
              src={`${ESRI_BASEMAP_URL}/${tile.z}/${tile.y}/${tile.x}`}
              alt=""
              className="absolute"
              style={{ left: pos.x, top: pos.y, width: 256, height: 256, pointerEvents: "none" }}
              draggable={false}
              loading="lazy"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
            />
          )
        })}

        {/* City labels */}
        {CITIES.map((city) => {
          const pos = latLngToPixel(city.lat, city.lng)
          if (pos.x < -50 || pos.x > dimensions.width + 50 || pos.y < -50 || pos.y > dimensions.height + 50) return null
          return (
            <div
              key={city.name}
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-full"
              style={{ left: pos.x, top: pos.y - 12 }}
            >
              <div className={`rounded bg-white/90 shadow-sm ${isMobile ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"} font-semibold text-gray-800`}>{city.name}</div>
            </div>
          )
        })}

        {/* Clusters + single pins */}
        {clusters.map((cluster) => {
          const { x, y, count, color, id } = cluster
          if (x < -30 || x > dimensions.width + 30 || y < -30 || y > dimensions.height + 30) return null

          const isSingle = count === 1
          const prop = isSingle ? cluster.properties[0] : null
          const isSelected = isSingle && selectedProperty?.id === prop?.id
          const size = isSingle ? (isSelected ? 16 : isMobile ? 14 : 12) : Math.min(40, 20 + Math.log2(count) * 4)

          if (isSingle) {
            return (
              <div
                key={id}
                className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-transform hover:scale-125"
                style={{ left: x, top: y, zIndex: isSelected ? 100 : 10 }}
                onMouseEnter={!isMobile ? () => setHoveredCluster(cluster) : undefined}
                onMouseLeave={!isMobile ? () => setHoveredCluster(null) : undefined}
                onClick={(e) => { e.stopPropagation(); handleClusterClick(cluster) }}
              >
                {isSelected && (
                  <div
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full opacity-40"
                    style={{ width: size * 2, height: size * 2, backgroundColor: color }}
                  />
                )}
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
          }

          // Cluster bubble
          return (
            <div
              key={`cluster-${id}`}
              className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer"
              style={{ left: x, top: y, zIndex: 20 }}
              onMouseEnter={!isMobile ? () => setHoveredCluster(cluster) : undefined}
              onMouseLeave={!isMobile ? () => setHoveredCluster(null) : undefined}
              onClick={(e) => { e.stopPropagation(); handleClusterClick(cluster) }}
            >
              <div
                className="flex items-center justify-center rounded-full border-2 border-white bg-slate-700 shadow-lg transition-transform hover:scale-110"
                style={{ width: size, height: size }}
              >
                <span className="text-[10px] font-bold text-white">{count > 99 ? "99+" : count}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Mobile Bottom Sheet */}
      {isMobile && bottomSheetOpen && bottomSheetProperty && (
        <div className="absolute inset-x-0 bottom-0 z-30 animate-in slide-in-from-bottom">
          <div className="rounded-t-2xl border-t border-slate-200 bg-white shadow-2xl">
            {/* Handle */}
            <div className="flex justify-center py-2">
              <div className="h-1 w-10 rounded-full bg-slate-300" />
            </div>

            {/* Content */}
            <div className="px-4 pb-6">
              <div className="mb-3 flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900">
                    {bottomSheetProperty.property_name || bottomSheetProperty.address}
                  </h3>
                  <div className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500">
                    <MapPin className="h-3.5 w-3.5" />
                    {bottomSheetProperty.city}, CA {bottomSheetProperty.zip_code}
                  </div>
                </div>
                <button
                  onClick={() => setBottomSheetOpen(false)}
                  className="rounded-full p-2 hover:bg-slate-100"
                >
                  <X className="h-5 w-5 text-slate-500" />
                </button>
              </div>

              {/* Stats */}
              <div className="mb-4 grid grid-cols-3 gap-2">
                {bottomSheetProperty.current_rent && (
                  <div className="rounded-lg bg-emerald-50 p-2.5 text-center">
                    <DollarSign className="mx-auto mb-1 h-4 w-4 text-emerald-600" />
                    <div className="text-sm font-semibold text-emerald-700">${bottomSheetProperty.current_rent.toLocaleString()}</div>
                    <div className="text-[10px] text-emerald-600">per month</div>
                  </div>
                )}
                {bottomSheetProperty.bedrooms !== null && (
                  <div className="rounded-lg bg-slate-50 p-2.5 text-center">
                    <div className="text-sm font-semibold text-slate-900">{bottomSheetProperty.bedrooms}</div>
                    <div className="text-[10px] text-slate-500">Bedrooms</div>
                  </div>
                )}
                {bottomSheetProperty.bathrooms !== null && (
                  <div className="rounded-lg bg-slate-50 p-2.5 text-center">
                    <div className="text-sm font-semibold text-slate-900">{bottomSheetProperty.bathrooms}</div>
                    <div className="text-[10px] text-slate-500">Bathrooms</div>
                  </div>
                )}
              </div>

              {/* Tags */}
              <div className="mb-4 flex flex-wrap gap-1.5">
                {bottomSheetProperty.is_available && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Available</span>
                )}
                {bottomSheetProperty.is_post_fire_rebuild && (
                  <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">Post-Fire</span>
                )}
                {bottomSheetProperty.is_section_8 && (
                  <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">Section 8</span>
                )}
                {bottomSheetProperty.is_student_housing && (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">Student</span>
                )}
              </div>

              {/* Action Button */}
              <Button onClick={handleBottomSheetSelect} className="w-full bg-slate-900 hover:bg-slate-800">
                View Full Details
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile bottom overlay for layers (tap to open) */}
      {isMobile && (
        <button
          onClick={() => setShowLayers(true)}
          className="absolute bottom-2 right-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md"
        >
          <Layers className="h-5 w-5 text-slate-700" />
        </button>
      )}

      {/* Mobile layers modal */}
      {isMobile && showLayers && (
        <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/30" onClick={() => setShowLayers(false)}>
          <div className="w-full rounded-t-2xl bg-white p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-900">Map Layers</span>
              <button onClick={() => setShowLayers(false)} className="text-slate-400">
                <X className="h-5 w-5" />
              </button>
            </div>
            <button
              onClick={handleToggleAll}
              className="mb-3 w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white"
            >
              {allSelected ? "Hide All" : "Show All"}
            </button>
            <div className="space-y-2">
              {LAYER_CONFIG.map((layer) => (
                <div key={layer.key} className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
                  <Checkbox
                    id={`mobile-layer-${layer.key}`}
                    checked={filters[layer.key]}
                    onCheckedChange={(checked) => {
                      if (onFiltersChange) onFiltersChange({ ...filters, [layer.key]: !!checked })
                    }}
                    className="h-5 w-5"
                  />
                  <Label htmlFor={`mobile-layer-${layer.key}`} className="flex flex-1 cursor-pointer items-center gap-2 text-sm">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: layer.color }} />
                    {layer.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
