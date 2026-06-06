"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import type { Property } from "@/types/property"
import { getMapboxToken } from "@/app/actions/get-mapbox-token"

// Butte County center coordinates
const BUTTE_COUNTY_CENTER: [number, number] = [-121.6, 39.65]
const DEFAULT_ZOOM = 10

interface MapboxMapProps {
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

export function MapboxMap({ properties, selectedProperty, onPropertySelect, filters }: MapboxMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapToken, setMapToken] = useState<string | null>(null)
  const [tokenError, setTokenError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [mapboxgl, setMapboxgl] = useState<any>(null)

  // Fetch token from server and load mapbox-gl dynamically
  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        const token = await getMapboxToken()

        if (cancelled) return

        if (!token || typeof token !== "string" || !token.trim().startsWith("pk.")) {
          setTokenError(true)
          setIsLoading(false)
          return
        }

        const trimmedToken = token.trim()
        setMapToken(trimmedToken)

        const mapboxModule = await import("mapbox-gl")
        await import("mapbox-gl/dist/mapbox-gl.css")

        if (cancelled) return

        // Set access token on the module before storing reference
        mapboxModule.default.accessToken = trimmedToken
        setMapboxgl(mapboxModule.default)
        setIsLoading(false)
      } catch (err) {
        if (!cancelled) {
          console.error("[v0] Mapbox init error:", err)
          setTokenError(true)
          setIsLoading(false)
        }
      }
    }

    init()

    return () => {
      cancelled = true
    }
  }, [])

  // Filter properties based on current filters
  const filteredProperties = properties.filter((p) => {
    if (p.is_available && !filters.showAvailable) return false
    if (!p.is_available && !filters.showOccupied) return false
    if (p.is_post_fire_rebuild && !filters.showPostFire) return false
    if (p.is_student_housing && !filters.showStudentHousing) return false
    if (p.is_section_8 && !filters.showSection8) return false
    return true
  })

  const getPropertyColor = useCallback((property: Property): string => {
    if (property.is_post_fire_rebuild) return "#f97316" // Orange
    if (property.is_section_8) return "#8b5cf6" // Purple
    if (property.is_student_housing) return "#3b82f6" // Blue
    if (property.is_available) return "#22c55e" // Green
    return "#6b7280" // Gray for occupied
  }, [])

  const getPropertyDisplayName = useCallback((property: Property): string => {
    if (property.property_name) return property.property_name
    const match = property.address.match(/$$([^)]+)$$/)
    if (match) return match[1]
    return property.address.split("(")[0].trim()
  }, [])

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current || !mapboxgl || !mapToken) return

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/light-v11",
        center: BUTTE_COUNTY_CENTER,
        zoom: DEFAULT_ZOOM,
        maxBounds: [
          [-123.0, 38.5],
          [-120.0, 41.0],
        ],
        trackResize: true,
        fadeDuration: 0,
      })

      map.current.addControl(new mapboxgl.NavigationControl(), "top-right")

      map.current.on("load", () => {
        setMapLoaded(true)
      })
    } catch (err) {
      console.error("[v0] Error creating map:", err)
      setTokenError(true)
    }

    return () => {
      markersRef.current.forEach((marker) => marker.remove())
      markersRef.current = []
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [mapboxgl, mapToken])

  // Add markers
  useEffect(() => {
    if (!map.current || !mapLoaded || !mapboxgl) return

    // Remove existing markers
    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current = []

    // Add individual markers for each property
    filteredProperties.forEach((property) => {
      const color = getPropertyColor(property)
      const displayName = getPropertyDisplayName(property)

      const el = document.createElement("div")
      el.className = "property-marker"
      el.style.cssText = `
        width: 24px;
        height: 24px;
        background-color: ${color};
        border: 3px solid white;
        border-radius: 50%;
        cursor: pointer;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        transition: transform 0.15s ease;
      `

      if (selectedProperty?.id === property.id) {
        el.style.transform = "scale(1.3)"
        el.style.zIndex = "10"
      }

      el.addEventListener("mouseenter", () => {
        el.style.transform = "scale(1.2)"
      })
      el.addEventListener("mouseleave", () => {
        if (selectedProperty?.id !== property.id) {
          el.style.transform = "scale(1)"
        }
      })

      const popup = new mapboxgl.Popup({
        offset: 25,
        closeButton: false,
        closeOnClick: false,
      }).setHTML(`
        <div style="padding: 8px; min-width: 150px;">
          <div style="font-weight: 600; font-size: 13px; margin-bottom: 4px;">${displayName}</div>
          <div style="font-size: 12px; color: #666;">${property.city}, CA ${property.zip_code || ""}</div>
          ${property.bedrooms !== null ? `<div style="font-size: 12px; color: #666;">${property.bedrooms} bed${property.bedrooms !== 1 ? "s" : ""} • ${property.property_type}</div>` : ""}
          ${property.current_rent ? `<div style="font-size: 13px; font-weight: 600; color: #22c55e; margin-top: 4px;">$${property.current_rent.toLocaleString()}/mo</div>` : `<div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Not currently listed</div>`}
        </div>
      `)

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([Number(property.longitude), Number(property.latitude)])
        .setPopup(popup)
        .addTo(map.current!)

      el.addEventListener("mouseenter", () => marker.togglePopup())
      el.addEventListener("mouseleave", () => marker.togglePopup())
      el.addEventListener("click", () => onPropertySelect(property))

      markersRef.current.push(marker)
    })
  }, [
    mapLoaded,
    filteredProperties,
    selectedProperty,
    onPropertySelect,
    mapboxgl,
    getPropertyColor,
    getPropertyDisplayName,
  ])

  // Fly to selected property
  useEffect(() => {
    if (!map.current || !selectedProperty) return

    map.current.flyTo({
      center: [Number(selectedProperty.longitude), Number(selectedProperty.latitude)],
      zoom: 15,
      duration: 1000,
    })
  }, [selectedProperty])

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted/30">
        <div className="text-sm text-muted-foreground">Loading map...</div>
      </div>
    )
  }

  if (tokenError || !mapToken) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted/30">
        <div className="max-w-md rounded-lg border bg-card p-6 text-center shadow-sm">
          <h3 className="mb-2 text-lg font-semibold text-card-foreground">Mapbox Token Required</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            To display the interactive map, please add your Mapbox public access token as an environment variable.
          </p>
          <div className="rounded bg-muted p-3 text-left">
            <code className="text-xs">MAPBOX_TOKEN=pk.your_token_here</code>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Get a free token at{" "}
            <a href="https://mapbox.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">
              mapbox.com
            </a>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-full w-full">
      <div ref={mapContainer} className="h-full w-full" />

      {/* Map Legend */}
      <div className="absolute bottom-4 left-4 rounded-lg bg-background/95 p-3 shadow-lg backdrop-blur-sm">
        <h4 className="mb-2 text-xs font-semibold text-foreground">Legend</h4>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#22c55e]" />
            <span className="text-muted-foreground">Available</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#6b7280]" />
            <span className="text-muted-foreground">Occupied</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#f97316]" />
            <span className="text-muted-foreground">Post-Fire Rebuild</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#8b5cf6]" />
            <span className="text-muted-foreground">Section 8</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#3b82f6]" />
            <span className="text-muted-foreground">Student Housing</span>
          </div>
        </div>
      </div>

      {/* Property count */}
      <div className="absolute right-4 top-4 rounded-lg bg-background/95 px-3 py-2 shadow-lg backdrop-blur-sm">
        <span className="text-sm font-medium text-foreground">{filteredProperties.length} properties</span>
      </div>
    </div>
  )
}
