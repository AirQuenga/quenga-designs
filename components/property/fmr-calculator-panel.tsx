"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Thermometer, ChefHat, Droplets, Wind, Flame, Download, MapPin, Calculator } from "lucide-react"
import {
  BUTTE_CITIES,
  calculateFMR2026,
  type CityZone,
  type HeatingType,
  type CookingType,
  type WaterHeaterType,
  type ACType,
  type CalculatorConfig,
  type CalculationResult,
} from "@/config/fmr-2026"

interface FMRCalculatorPanelProps {
  bedrooms: number
  city?: string
  currentRent?: number | null
}

// Mini SVG map of Butte County
function MiniButteMap({
  selectedCity,
  onCityClick,
}: {
  selectedCity: CityZone
  onCityClick: (city: CityZone) => void
}) {
  const cities: Array<{ id: CityZone; name: string; x: number; y: number }> = [
    { id: "chico", name: "Chico", x: 45, y: 45 },
    { id: "paradise", name: "Paradise", x: 75, y: 40 },
    { id: "magalia", name: "Magalia", x: 80, y: 25 },
    { id: "oroville", name: "Oroville", x: 70, y: 70 },
    { id: "gridley", name: "Gridley", x: 35, y: 85 },
    { id: "biggs", name: "Biggs", x: 30, y: 75 },
    { id: "durham", name: "Durham", x: 40, y: 60 },
  ]

  return (
    <svg viewBox="0 0 100 100" className="h-32 w-full rounded-lg bg-slate-100">
      {/* County outline */}
      <path d="M10,10 L90,10 L95,50 L85,90 L15,90 L5,50 Z" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />

      {/* Highway 99 */}
      <path d="M35,10 L38,90" stroke="#fbbf24" strokeWidth="2" strokeDasharray="4,2" />
      <text x="32" y="50" fontSize="4" fill="#92400e">
        99
      </text>

      {/* Highway 70 */}
      <path d="M50,45 L90,75" stroke="#fbbf24" strokeWidth="2" strokeDasharray="4,2" />
      <text x="70" y="58" fontSize="4" fill="#92400e">
        70
      </text>

      {/* Cities */}
      {cities.map((city) => (
        <g key={city.id} onClick={() => onCityClick(city.id)} className="cursor-pointer">
          <circle
            cx={city.x}
            cy={city.y}
            r={selectedCity === city.id ? 5 : 3}
            fill={selectedCity === city.id ? "#16a34a" : "#64748b"}
            stroke={selectedCity === city.id ? "#15803d" : "#475569"}
            strokeWidth="1"
            className="transition-all hover:r-4"
          />
          <text
            x={city.x}
            y={city.y - 6}
            fontSize="4"
            textAnchor="middle"
            fill={selectedCity === city.id ? "#15803d" : "#475569"}
            fontWeight={selectedCity === city.id ? "bold" : "normal"}
          >
            {city.name}
          </text>
        </g>
      ))}
    </svg>
  )
}

export function FMRCalculatorPanel({ bedrooms, city, currentRent }: FMRCalculatorPanelProps) {
  // Detect city zone from property city
  const detectCity = (cityName?: string): CityZone => {
    if (!cityName) return "chico"
    const lower = cityName.toLowerCase()
    if (lower.includes("paradise")) return "paradise"
    if (lower.includes("oroville")) return "oroville"
    if (lower.includes("gridley")) return "gridley"
    if (lower.includes("biggs")) return "biggs"
    if (lower.includes("durham")) return "durham"
    if (lower.includes("magalia")) return "magalia"
    return "chico"
  }

  const [config, setConfig] = useState<CalculatorConfig>({
    city: detectCity(city),
    bedrooms: Math.min(Math.max(0, bedrooms || 2), 5),
    heating: "natural-gas",
    cooking: "electric",
    waterHeater: "natural-gas",
    airConditioning: "refrigerated",
    waterIncluded: false,
    sewerIncluded: false,
    trashIncluded: true,
    tenantProvidesRange: false,
    tenantProvidesRefrigerator: false,
  })

  const [result, setResult] = useState<CalculationResult | null>(null)

  // Calculate on config change
  useEffect(() => {
    setResult(calculateFMR2026(config))
  }, [config])

  const updateConfig = <K extends keyof CalculatorConfig>(key: K, value: CalculatorConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  // Check if any gas utilities are selected
  const hasGas =
    config.heating === "natural-gas" || config.cooking === "natural-gas" || config.waterHeater === "natural-gas"

  // Check if any electric utilities are selected (most properties have electric)
  const hasElectric =
    config.heating === "electric" ||
    config.cooking === "electric" ||
    config.waterHeater === "electric" ||
    config.airConditioning === "refrigerated"

  const handleDownload = () => {
    if (!result) return

    const summary = `
BUTTE COUNTY UTILITY ALLOWANCE SUMMARY
=======================================
Date: ${new Date().toLocaleDateString()}
Locality: ${BUTTE_CITIES.find((c) => c.id === config.city)?.name || config.city}
Bedrooms: ${config.bedrooms}

BASE FMR (2026): $${result.baseFMR}

UTILITY ALLOWANCES:
- Heating (${config.heating}): $${result.breakdown.heating}
- Cooking (${config.cooking}): $${result.breakdown.cooking}
- Water Heater (${config.waterHeater}): $${result.breakdown.waterHeater}
- Air Conditioning (${config.airConditioning}): $${result.breakdown.airConditioning}
- Water: $${result.breakdown.water}
- Sewer: $${result.breakdown.sewer}
- Trash: $${result.breakdown.trash}
- Range (tenant-owned): $${result.breakdown.range}
- Refrigerator (tenant-owned): $${result.breakdown.refrigerator}

TOTAL UTILITY ALLOWANCE: $${result.totalUtilityAllowance}
NET RENT LIMIT: $${result.netRent}
${currentRent ? `\nCURRENT RENT: $${currentRent}\nDIFFERENCE: $${result.netRent - currentRent}` : ""}
    `.trim()

    const blob = new Blob([summary], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `fmr-summary-${config.bedrooms}br-${config.city}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!result) return null

  return (
    <div className="space-y-4">
      {/* Mini Map */}
      <div>
        <Label className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" />
          Click map to change locality
        </Label>
        <MiniButteMap selectedCity={config.city} onCityClick={(city) => updateConfig("city", city)} />
      </div>

      {/* Locality & Bedrooms */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Locality</Label>
          <Select value={config.city} onValueChange={(v) => updateConfig("city", v as CityZone)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BUTTE_CITIES.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Bedrooms</Label>
          <Select
            value={config.bedrooms.toString()}
            onValueChange={(v) => updateConfig("bedrooms", Number.parseInt(v))}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Studio</SelectItem>
              <SelectItem value="1">1 BR</SelectItem>
              <SelectItem value="2">2 BR</SelectItem>
              <SelectItem value="3">3 BR</SelectItem>
              <SelectItem value="4">4 BR</SelectItem>
              <SelectItem value="5">5+ BR</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      {/* Utilities */}
      <div className="space-y-3">
        <Label className="flex items-center gap-1 text-xs font-semibold">
          <Flame className="h-3 w-3 text-orange-500" />
          Utility Types
        </Label>

        {/* Heating */}
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 text-xs">
            <Thermometer className="h-3 w-3 text-red-500" />
            Heating
          </span>
          <Select value={config.heating} onValueChange={(v) => updateConfig("heating", v as HeatingType)}>
            <SelectTrigger className="h-7 w-28 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="natural-gas">Natural Gas</SelectItem>
              <SelectItem value="electric">Electric</SelectItem>
              <SelectItem value="heat-pump">Heat Pump</SelectItem>
              <SelectItem value="bottled-gas">Bottled Gas</SelectItem>
              <SelectItem value="none">None</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Cooking */}
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 text-xs">
            <ChefHat className="h-3 w-3 text-blue-500" />
            Cooking
          </span>
          <Select value={config.cooking} onValueChange={(v) => updateConfig("cooking", v as CookingType)}>
            <SelectTrigger className="h-7 w-28 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="natural-gas">Natural Gas</SelectItem>
              <SelectItem value="electric">Electric</SelectItem>
              <SelectItem value="bottled-gas">Bottled Gas</SelectItem>
              <SelectItem value="none">None</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Water Heater */}
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 text-xs">
            <Droplets className="h-3 w-3 text-cyan-500" />
            Water Heater
          </span>
          <Select value={config.waterHeater} onValueChange={(v) => updateConfig("waterHeater", v as WaterHeaterType)}>
            <SelectTrigger className="h-7 w-28 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="natural-gas">Natural Gas</SelectItem>
              <SelectItem value="electric">Electric</SelectItem>
              <SelectItem value="bottled-gas">Bottled Gas</SelectItem>
              <SelectItem value="none">None</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Air Conditioning */}
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 text-xs">
            <Wind className="h-3 w-3 text-sky-500" />
            Air Conditioning
          </span>
          <Select value={config.airConditioning} onValueChange={(v) => updateConfig("airConditioning", v as ACType)}>
            <SelectTrigger className="h-7 w-28 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="refrigerated">Refrigerated</SelectItem>
              <SelectItem value="evaporative">Evaporative</SelectItem>
              <SelectItem value="none">None</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      {/* Included Utilities */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold">Landlord Pays (Included)</Label>
        <div className="grid grid-cols-3 gap-2">
          <div className="flex items-center gap-1">
            <Switch
              id="water"
              checked={config.waterIncluded}
              onCheckedChange={(v) => updateConfig("waterIncluded", v)}
              className="scale-75"
            />
            <Label htmlFor="water" className="text-xs">
              Water
            </Label>
          </div>
          <div className="flex items-center gap-1">
            <Switch
              id="sewer"
              checked={config.sewerIncluded}
              onCheckedChange={(v) => updateConfig("sewerIncluded", v)}
              className="scale-75"
            />
            <Label htmlFor="sewer" className="text-xs">
              Sewer
            </Label>
          </div>
          <div className="flex items-center gap-1">
            <Switch
              id="trash"
              checked={config.trashIncluded}
              onCheckedChange={(v) => updateConfig("trashIncluded", v)}
              className="scale-75"
            />
            <Label htmlFor="trash" className="text-xs">
              Trash
            </Label>
          </div>
        </div>
      </div>

      {/* Tenant-Owned Appliances */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold">Tenant Provides</Label>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-1">
            <Switch
              id="range"
              checked={config.tenantProvidesRange}
              onCheckedChange={(v) => updateConfig("tenantProvidesRange", v)}
              className="scale-75"
            />
            <Label htmlFor="range" className="text-xs">
              Range (+$8)
            </Label>
          </div>
          <div className="flex items-center gap-1">
            <Switch
              id="fridge"
              checked={config.tenantProvidesRefrigerator}
              onCheckedChange={(v) => updateConfig("tenantProvidesRefrigerator", v)}
              className="scale-75"
            />
            <Label htmlFor="fridge" className="text-xs">
              Refrigerator (+$12)
            </Label>
          </div>
        </div>
      </div>

      {/* Customer Charges Notice */}
      {(hasGas || hasElectric) && (
        <div className="rounded-md bg-amber-50 p-2 text-xs text-amber-800">
          <strong>Note:</strong> Add customer charges:
          {hasGas && <span className="ml-1">Gas $4</span>}
          {hasGas && hasElectric && <span>,</span>}
          {hasElectric && <span className="ml-1">Electric $12</span>}
        </div>
      )}

      <Separator />

      {/* Results */}
      <Card className="border-green-200 bg-green-50 p-3">
        <div className="mb-2 flex items-center gap-1 text-xs font-semibold text-green-800">
          <Calculator className="h-3 w-3" />
          2026 FMR CALCULATION
        </div>

        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-600">Base FMR ({config.bedrooms} BR)</span>
            <span className="font-semibold">${result.baseFMR.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-red-600">
            <span>Utility Allowance</span>
            <span>-${result.totalUtilityAllowance}</span>
          </div>
          <Separator className="my-1" />
          <div className="flex justify-between text-sm font-bold text-green-700">
            <span>Net Rent Limit</span>
            <span>${result.netRent.toLocaleString()}</span>
          </div>

          {currentRent && (
            <>
              <Separator className="my-1" />
              <div className="flex justify-between">
                <span className="text-slate-600">Current Rent</span>
                <span className="font-semibold">${currentRent.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Difference</span>
                <Badge className={currentRent <= result.netRent ? "bg-green-500 text-white" : "bg-red-500 text-white"}>
                  {currentRent <= result.netRent
                    ? `$${(result.netRent - currentRent).toLocaleString()} under`
                    : `$${(currentRent - result.netRent).toLocaleString()} over`}
                </Badge>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Breakdown */}
      <div>
        <Label className="mb-2 block text-xs font-semibold">Utility Breakdown</Label>
        <div className="grid grid-cols-2 gap-1 text-xs">
          {Object.entries(result.breakdown)
            .filter(([, v]) => v > 0)
            .map(([key, value]) => (
              <div key={key} className="flex justify-between rounded bg-slate-100 px-2 py-1">
                <span className="capitalize text-slate-600">{key.replace(/([A-Z])/g, " $1")}</span>
                <span className="font-medium">${value}</span>
              </div>
            ))}
        </div>
      </div>

      {/* Download Button */}
      <Button variant="outline" size="sm" className="w-full text-xs bg-transparent" onClick={handleDownload}>
        <Download className="mr-1 h-3 w-3" />
        Download Summary
      </Button>
    </div>
  )
}
