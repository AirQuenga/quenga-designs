"use client"

import type React from "react"
import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import type { Property } from "@/types/property"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Plus, Minus, Home, Layers, ChevronDown, ChevronUp } from "lucide-react"

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

// Clustering grid size in pixels — properties within this radius are merged
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

// --- Clustering helpers ---
interface Cluster {
  id: string
  x: number
  y: number
  count: number
  properties: Property[]
  /** Representative color based on the most "important" property in the cluster */
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
  // Only cluster when there are many points
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
    // Find existing cluster within radius
    const existing = placed.find((c) => Math.hypot(c.x - pos.x, c.y - pos.y) <= radius)
    if (existing) {
      existing.properties.push(p)
      existing.count++
      // Recalculate centroid
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

// Layer config for the collapsible menu
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

  const getTiles = useMemo(() => {
    const tiles: { x: number; y: number; z: number }[] = []
    const tileSize = 256
    const scale = Math.pow(2, zoom)
    const centerTileX = Math.floor(((center.lng + 180) / 360) * scale)
    const centerTileY = Math.floor(
      ((1 - Math.log(Math.tan((center.lat * Math.PI) / 180) + 1 / Math.cos((center.lat * Math.PI) / 180)) / Math.PI) / 2) * scale,
    )
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

  // Apply map-layer filters client-side (these are fast boolean checks on already-fetched data)
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

  // Cluster the visible properties
  const clusters = useMemo(
    () => clusterProperties(filteredProperties, latLngToPixel, CLUSTER_RADIUS),
    [filteredProperties, latLngToPixel],
  )

  const handleZoomIn = useCallback(() => setZoom((z) => Math.min(18, z + 1)), [])
  const handleZoomOut = useCallback(() => setZoom((z) => Math.max(8, z - 1)), [])
  const resetView = useCallback(() => { setZoom(DEFAULT_ZOOM); setCenter(DEFAULT_CENTER) }, [])

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) setIsDragging(true), setDragStart({ x: e.clientX, y: e.clientY, lat: center.lat, lng: center.lng })
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
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    setZoom((z) => Math.max(8, Math.min(18, z + (e.deltaY > 0 ? -1 : 1))))
  }, [])

  // Select/deselect all layers
  const allSelected = Object.values(filters).every(Boolean)
  const noneSelected = Object.values(filters).every((v) => !v)

  const handleSelectAll = () => {
    if (!onFiltersChange) return
    onFiltersChange({ showAvailable: true, showOccupied: true, showPostFire: true, showStudentHousing: true, showSection8: true })
  }
  const handleDeselectAll = () => {
    if (!onFiltersChange) return
    onFiltersChange({ showAvailable: false, showOccupied: false, showPostFire: false, showStudentHousing: false, showSection8: false })
  }

  const handleClusterClick = (cluster: Cluster) => {
    if (cluster.count === 1) {
      onPropertySelect(cluster.properties[0])
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

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-100" ref={containerRef}>
      {/* Map Controls */}
      <div className="absolute left-4 top-4 z-10 flex flex-col gap-2">
        <Button variant="secondary" size="icon" onClick={handleZoomIn} className="h-8 w-8 bg-white shadow-md hover:bg-gray-100" title="Zoom In">
          <Plus className="h-4 w-4 text-gray-700" />
        </Button>
        <Button variant="secondary" size="icon" onClick={handleZoomOut} className="h-8 w-8 bg-white shadow-md hover:bg-gray-100" title="Zoom Out">
          <Minus className="h-4 w-4 text-gray-700" />
        </Button>
        <Button variant="secondary" size="icon" onClick={resetView} className="h-8 w-8 bg-white shadow-md hover:bg-gray-100" title="Reset View">
          <Home className="h-4 w-4 text-gray-700" />
        </Button>

        {/* Collapsible Layers Menu */}
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
              {/* Select / Deselect All */}
              <div className="flex gap-2 border-b border-gray-100 px-3 py-2">
                <button
                  onClick={handleSelectAll}
                  disabled={allSelected}
                  className="flex-1 rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground disabled:opacity-40"
                >
                  Select All
                </button>
                <button
                  onClick={handleDeselectAll}
                  disabled={noneSelected}
                  className="flex-1 rounded border border-gray-200 px-2 py-1 text-xs font-medium text-gray-700 disabled:opacity-40"
                >
                  Deselect All
                </button>
              </div>
              {/* Individual layer checkboxes */}
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
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-10 rounded-lg bg-white p-3 shadow-md">
        <div className="mb-2 text-xs font-semibold text-gray-800">Legend</div>
        <div className="flex flex-col gap-1.5 text-xs">
          {LAYER_CONFIG.map((layer) => (
            <div key={layer.key} className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: layer.color }} />
              <span className="text-gray-700">{layer.label}</span>
            </div>
          ))}
          <div className="mt-1 flex items-center gap-2 border-t border-gray-100 pt-1">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-400 text-[9px] font-bold text-white">N</div>
            <span className="text-gray-500">Cluster (click to zoom)</span>
          </div>
        </div>
      </div>

      {/* Property Count */}
      <div className="absolute right-4 top-4 z-10 flex flex-col gap-2">
        <div className="rounded-lg bg-white px-3 py-2 shadow-md">
          <span className="text-sm font-medium text-gray-800">
            {filteredProperties.length.toLocaleString()} properties
          </span>
        </div>
        <div className="rounded-lg bg-white px-3 py-1 shadow-md">
          <span className="text-xs text-gray-600">Zoom: {zoom}</span>
        </div>
      </div>

      {/* Hover Tooltip */}
      {hoveredCluster && hoveredCluster.count === 1 && (() => {
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

      {hoveredCluster && hoveredCluster.count > 1 && (
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
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{ touchAction: "none" }}
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
              <div className="rounded bg-white/90 px-2 py-0.5 text-xs font-semibold text-gray-800 shadow-sm">{city.name}</div>
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
          const size = isSingle ? (isSelected ? 16 : 12) : Math.min(40, 20 + Math.log2(count) * 4)

          if (isSingle) {
            return (
              <div
                key={id}
                className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-transform hover:scale-125"
                style={{ left: x, top: y, zIndex: isSelected ? 100 : 10 }}
                onMouseEnter={() => setHoveredCluster(cluster)}
                onMouseLeave={() => setHoveredCluster(null)}
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
              onMouseEnter={() => setHoveredCluster(cluster)}
              onMouseLeave={() => setHoveredCluster(null)}
              onClick={(e) => { e.stopPropagation(); handleClusterClick(cluster) }}
            >
              {/* Outer ring */}
              <div
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full opacity-20"
                style={{ width: size + 12, height: size + 12, backgroundColor: color, left: size / 2, top: size / 2 }}
              />
              <div
                className="flex items-center justify-center rounded-full font-bold text-white shadow-lg"
                style={{
                  width: size,
                  height: size,
                  backgroundColor: color,
                  fontSize: size < 28 ? 9 : 11,
                  border: "2px solid rgba(255,255,255,0.9)",
                }}
              >
                {count > 999 ? `${(count / 1000).toFixed(1)}k` : count}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
