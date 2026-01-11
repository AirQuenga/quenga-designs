"use client"

import type React from "react"

import { useState, useRef, useCallback, useEffect } from "react"
import { motion } from "framer-motion"
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BUTTE_CITIES, type CityZone } from "@/config/fmr-2026"

interface ButteCountySVGMapProps {
  selectedCity: CityZone
  onCitySelect: (city: CityZone) => void
}

// Butte County geographic bounds
const BOUNDS = {
  minLat: 39.25,
  maxLat: 40.0,
  minLng: -122.0,
  maxLng: -121.1,
}

// Road data (simplified major roads)
const ROADS = {
  highways: [
    // Highway 99 (north-south through west side)
    {
      id: "hwy99",
      points: [
        [39.3, -121.75],
        [39.5, -121.72],
        [39.65, -121.8],
        [39.75, -121.84],
        [39.9, -121.82],
      ],
    },
    // Highway 70 (through Oroville)
    {
      id: "hwy70",
      points: [
        [39.4, -121.3],
        [39.5, -121.55],
        [39.55, -121.7],
        [39.65, -121.78],
      ],
    },
    // Highway 32 (Chico to Forest Ranch)
    {
      id: "hwy32",
      points: [
        [39.73, -121.84],
        [39.78, -121.7],
        [39.85, -121.55],
      ],
    },
    // Skyway (Chico to Paradise to Magalia)
    {
      id: "skyway",
      points: [
        [39.73, -121.82],
        [39.76, -121.62],
        [39.81, -121.58],
      ],
    },
  ],
  localRoads: [
    // Esplanade/99 in Chico
    {
      id: "esplanade",
      points: [
        [39.7, -121.84],
        [39.77, -121.84],
      ],
    },
    // Oro Dam Blvd
    {
      id: "orodam",
      points: [
        [39.5, -121.58],
        [39.52, -121.48],
      ],
    },
  ],
}

// Parks/green spaces
const PARKS = [
  { name: "Bidwell Park", lat: 39.76, lng: -121.78, size: "large" },
  { name: "Lake Oroville", lat: 39.55, lng: -121.45, size: "large" },
  { name: "Upper Park", lat: 39.8, lng: -121.72, size: "medium" },
]

export function ButteCountySVGMap({ selectedCity, onCitySelect }: ButteCountySVGMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 800 })
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [hoveredCity, setHoveredCity] = useState<CityZone | null>(null)

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

  const latLngToXY = useCallback(
    (lat: number, lng: number) => {
      const x = ((lng - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng)) * dimensions.width
      const y = ((BOUNDS.maxLat - lat) / (BOUNDS.maxLat - BOUNDS.minLat)) * dimensions.height
      return { x, y }
    },
    [dimensions],
  )

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true)
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
    }
  }

  const handleMouseUp = () => setIsDragging(false)

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.15 : 0.15
    setZoom((z) => Math.max(0.5, Math.min(4, z + delta)))
  }

  const resetView = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  const roadToPath = (points: number[][]) => {
    return points
      .map((p, i) => {
        const { x, y } = latLngToXY(p[0], p[1])
        return `${i === 0 ? "M" : "L"} ${x} ${y}`
      })
      .join(" ")
  }

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden">
      {/* Controls */}
      <div className="absolute left-4 top-4 z-10 flex flex-col gap-2">
        <Button
          variant="secondary"
          size="icon"
          onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
          className="h-9 w-9 bg-white shadow-md hover:bg-slate-50"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
          className="h-9 w-9 bg-white shadow-md hover:bg-slate-50"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          onClick={resetView}
          className="h-9 w-9 bg-white shadow-md hover:bg-slate-50"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      {/* Map Title */}
      <div className="absolute right-4 top-4 z-10 rounded-lg bg-white/90 px-4 py-2 shadow-md backdrop-blur-sm">
        <h2 className="text-sm font-semibold text-slate-700">Butte County, CA</h2>
        <p className="text-xs text-slate-500">Click a city to select</p>
      </div>

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
        <defs>
          {/* Gradient for water */}
          <linearGradient id="waterGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#93C5FD" />
            <stop offset="100%" stopColor="#60A5FA" />
          </linearGradient>
          {/* Pattern for parks */}
          <pattern id="parkPattern" width="8" height="8" patternUnits="userSpaceOnUse">
            <rect width="8" height="8" fill="#86EFAC" />
            <circle cx="2" cy="2" r="1" fill="#4ADE80" />
            <circle cx="6" cy="6" r="1" fill="#4ADE80" />
          </pattern>
          {/* Shadow filter */}
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="1" dy="1" stdDeviation="2" floodOpacity="0.2" />
          </filter>
        </defs>

        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* County background */}
          <rect width={dimensions.width} height={dimensions.height} fill="#F1F5F9" />

          {/* County border (simplified shape) */}
          <path
            d={`M ${dimensions.width * 0.05},${dimensions.height * 0.15}
                L ${dimensions.width * 0.35},${dimensions.height * 0.02}
                L ${dimensions.width * 0.95},${dimensions.height * 0.1}
                L ${dimensions.width * 0.98},${dimensions.height * 0.6}
                L ${dimensions.width * 0.85},${dimensions.height * 0.98}
                L ${dimensions.width * 0.1},${dimensions.height * 0.95}
                L ${dimensions.width * 0.02},${dimensions.height * 0.5}
                Z`}
            fill="#E2E8F0"
            stroke="#94A3B8"
            strokeWidth={2 / zoom}
          />

          {/* Parks/Green spaces */}
          {PARKS.map((park) => {
            const { x, y } = latLngToXY(park.lat, park.lng)
            const size = park.size === "large" ? 35 : 20
            return (
              <g key={park.name}>
                <ellipse
                  cx={x}
                  cy={y}
                  rx={size / zoom}
                  ry={(size * 0.7) / zoom}
                  fill="url(#parkPattern)"
                  opacity={0.7}
                />
                {zoom > 1.2 && (
                  <text
                    x={x}
                    y={y + (size + 10) / zoom}
                    textAnchor="middle"
                    fontSize={9 / zoom}
                    fill="#166534"
                    className="pointer-events-none"
                  >
                    {park.name}
                  </text>
                )}
              </g>
            )
          })}

          {/* Lake Oroville (water body) */}
          {(() => {
            const { x, y } = latLngToXY(39.52, -121.42)
            return <ellipse cx={x} cy={y} rx={40 / zoom} ry={25 / zoom} fill="url(#waterGradient)" opacity={0.8} />
          })()}

          {/* Highways */}
          {ROADS.highways.map((road) => (
            <path
              key={road.id}
              d={roadToPath(road.points)}
              fill="none"
              stroke="#FCD34D"
              strokeWidth={4 / zoom}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {/* Local roads */}
          {ROADS.localRoads.map((road) => (
            <path
              key={road.id}
              d={roadToPath(road.points)}
              fill="none"
              stroke="#D1D5DB"
              strokeWidth={2 / zoom}
              strokeLinecap="round"
            />
          ))}

          {/* Grid overlay (subtle) */}
          {Array.from({ length: 8 }).map((_, i) => (
            <g key={`grid-${i}`} opacity={0.15}>
              <line
                x1={0}
                y1={((i + 1) / 9) * dimensions.height}
                x2={dimensions.width}
                y2={((i + 1) / 9) * dimensions.height}
                stroke="#94A3B8"
                strokeWidth={0.5 / zoom}
              />
              <line
                x1={((i + 1) / 9) * dimensions.width}
                y1={0}
                x2={((i + 1) / 9) * dimensions.width}
                y2={dimensions.height}
                stroke="#94A3B8"
                strokeWidth={0.5 / zoom}
              />
            </g>
          ))}

          {/* City markers */}
          {BUTTE_CITIES.map((city) => {
            const { x, y } = latLngToXY(city.lat, city.lng)
            const isSelected = selectedCity === city.id
            const isHovered = hoveredCity === city.id

            // City zone size based on population
            const zoneSize = Math.max(15, Math.min(40, city.population / 3000))

            return (
              <g key={city.id}>
                {/* City zone (clickable area) */}
                <motion.ellipse
                  cx={x}
                  cy={y}
                  rx={zoneSize / zoom}
                  ry={(zoneSize * 0.8) / zoom}
                  fill={isSelected ? "#10B981" : isHovered ? "#34D399" : "#D1D5DB"}
                  fillOpacity={isSelected ? 0.4 : isHovered ? 0.3 : 0.2}
                  stroke={isSelected ? "#059669" : isHovered ? "#10B981" : "#9CA3AF"}
                  strokeWidth={(isSelected ? 3 : 2) / zoom}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredCity(city.id)}
                  onMouseLeave={() => setHoveredCity(null)}
                  onClick={() => onCitySelect(city.id)}
                  animate={{
                    scale: isSelected ? 1.1 : 1,
                  }}
                  transition={{ duration: 0.2 }}
                />

                {/* City center dot */}
                <circle
                  cx={x}
                  cy={y}
                  r={4 / zoom}
                  fill={isSelected ? "#059669" : "#6B7280"}
                  className="pointer-events-none"
                />

                {/* City label */}
                <text
                  x={x}
                  y={y - (zoneSize + 8) / zoom}
                  textAnchor="middle"
                  fontSize={12 / zoom}
                  fontWeight={isSelected ? "700" : "600"}
                  fill={isSelected ? "#059669" : "#374151"}
                  className="pointer-events-none select-none"
                >
                  {city.name}
                </text>

                {/* Population label (on hover/select) */}
                {(isSelected || isHovered) && (
                  <text
                    x={x}
                    y={y + (zoneSize + 14) / zoom}
                    textAnchor="middle"
                    fontSize={9 / zoom}
                    fill="#6B7280"
                    className="pointer-events-none select-none"
                  >
                    Pop: {city.population.toLocaleString()}
                  </text>
                )}
              </g>
            )
          })}

          {/* Highway labels */}
          {zoom > 0.8 && (
            <>
              <g transform={`translate(${latLngToXY(39.6, -121.76).x}, ${latLngToXY(39.6, -121.76).y})`}>
                <rect x={-12 / zoom} y={-8 / zoom} width={24 / zoom} height={16 / zoom} fill="#FBBF24" rx={2 / zoom} />
                <text
                  x={0}
                  y={4 / zoom}
                  textAnchor="middle"
                  fontSize={10 / zoom}
                  fontWeight="700"
                  fill="#78350F"
                  className="pointer-events-none"
                >
                  99
                </text>
              </g>
              <g transform={`translate(${latLngToXY(39.52, -121.5).x}, ${latLngToXY(39.52, -121.5).y})`}>
                <rect x={-12 / zoom} y={-8 / zoom} width={24 / zoom} height={16 / zoom} fill="#FBBF24" rx={2 / zoom} />
                <text
                  x={0}
                  y={4 / zoom}
                  textAnchor="middle"
                  fontSize={10 / zoom}
                  fontWeight="700"
                  fill="#78350F"
                  className="pointer-events-none"
                >
                  70
                </text>
              </g>
            </>
          )}
        </g>
      </svg>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-10 rounded-lg bg-white/95 p-3 shadow-md backdrop-blur-sm">
        <h3 className="mb-2 text-xs font-semibold text-slate-600">Map Legend</h3>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center gap-2">
            <div className="h-3 w-5 rounded-sm bg-yellow-400" />
            <span className="text-slate-600">Highways</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-5 rounded-sm bg-green-300" />
            <span className="text-slate-600">Parks</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-5 rounded-sm bg-blue-400" />
            <span className="text-slate-600">Water</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full border-2 border-emerald-500 bg-emerald-100" />
            <span className="text-slate-600">Selected City</span>
          </div>
        </div>
      </div>
    </div>
  )
}
