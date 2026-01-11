"use client"

import { useState, useEffect } from "react"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Download, 
  Bed,
  Flame, 
  ChefHat, 
  Droplets, 
  Trash2, 
  Wind,
  Refrigerator,
  MapPin,
  Building2,
  Hash
} from "lucide-react"
import {
  BUTTE_CITIES,
  FMR_2026,
  calculateFMR2026,
  type CityZone,
  type HeatingType,
  type CookingType,
  type CalculatorConfig,
  type CalculationResult,
} from "@/config/fmr-2026"

interface FMRCalculatorPanelProps {
  bedrooms: number
  city?: string
  currentRent?: number | null
  propertyType?: string
  censusTract?: string
}

export function FMRCalculatorPanel({ 
  bedrooms: initialBedrooms, 
  city, 
  currentRent, 
  propertyType,
  censusTract 
}: FMRCalculatorPanelProps) {
  // Utility to map the property's city string to the configuration CityZone
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

  // Locked city derived from property details
  const lockedCity = detectCity(city)
  const cityNameDisplay = BUTTE_CITIES.find(c => c.id === lockedCity)?.name || city || "Chico"

  const [config, setConfig] = useState<CalculatorConfig>({
    city: lockedCity,
    bedrooms: Math.min(Math.max(0, initialBedrooms || 2), 5),
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

  useEffect(() => {
    setResult(calculateFMR2026(config))
  }, [config])

  const updateConfig = <K extends keyof CalculatorConfig>(key: K, value: CalculatorConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  if (!result) return null

  const gasCustomerCharge = (config.heating === "natural-gas" || config.cooking === "natural-gas") ? 4 : 0
  const electricCustomerCharge = 12
  const totalWithFees = result.totalUtilityAllowance + gasCustomerCharge + electricCustomerCharge

  return (
    <div className="space-y-6">
      {/* 1. HUD 2026 FMR Reference */}
      <section>
        <h4 className="mb-3 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">HUD 2026 FMR Reference</h4>
        <div className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-muted/20 p-1">
          {Object.entries(FMR_2026).map(([br, amount]) => {
            const isSelected = config.bedrooms === Number(br)
            return (
              <button
                key={br}
                onClick={() => updateConfig("bedrooms", Number(br))}
                className={`flex flex-col items-center justify-center py-3 transition-all rounded-lg border ${
                  isSelected 
                    ? "bg-card shadow-sm border-border" 
                    : "bg-transparent border-transparent hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Bed className={`h-4 w-4 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                  <span className={`text-sm font-bold ${isSelected ? "text-card-foreground" : "text-muted-foreground"}`}>
                    {br === "0" ? "Studio" : `${br} BR`}
                  </span>
                </div>
                <div className={`text-[10px] font-bold uppercase tracking-tight ${isSelected ? "text-primary" : "text-muted-foreground/60"}`}>
                  ${amount.toLocaleString()}
                </div>
              </button>
            )
          })}
        </div>
      </section>

      {/* 2. Unit Details - 3 Column Grid (Locked City) */}
      <section>
        <h4 className="mb-3 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Unit Details</h4>
        <div className="grid grid-cols-3 gap-3 rounded-lg border border-border bg-muted/20 p-3">
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-muted-foreground">
              <MapPin className="h-3 w-3" />
              City
            </div>
            {/* Displayed as a read-only field to prevent changing locality */}
            <div className="flex h-8 items-center px-2 rounded-md border border-border bg-muted/30 text-[11px] font-semibold text-muted-foreground italic overflow-hidden whitespace-nowrap">
              {cityNameDisplay}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-muted-foreground">
              <Building2 className="h-3 w-3" />
              Unit Type
            </div>
            <div className="flex h-8 items-center px-2 rounded-md border border-border bg-card text-[11px] font-semibold capitalize overflow-hidden whitespace-nowrap">
              {propertyType || "Apartment"}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-muted-foreground">
              <Hash className="h-3 w-3" />
              Census Tract
            </div>
            <div className="flex h-8 items-center px-2 rounded-md border border-border bg-card text-[11px] font-semibold">
              {censusTract || "--"}
            </div>
          </div>
        </div>
      </section>

      {/* 3. Utility Allowances */}
      <section>
        <h4 className="mb-3 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Monthly Utility Breakdown</h4>
        <div className="space-y-2">
          {/* Heating Row */}
          <div className="flex items-center gap-3 rounded-lg bg-muted/40 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-500/10">
              <Flame className="h-5 w-5 text-orange-500" />
            </div>
            <div className="flex-1">
              <div className="text-[10px] font-bold uppercase text-muted-foreground tracking-wide">Heating Type</div>
              <Select value={config.heating} onValueChange={(v) => updateConfig("heating", v as HeatingType)}>
                <SelectTrigger className="h-6 border-none bg-transparent p-0 text-sm font-bold focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="natural-gas">Natural Gas</SelectItem>
                  <SelectItem value="electric">Electric</SelectItem>
                  <SelectItem value="heat-pump">Heat Pump</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="text-base font-bold text-card-foreground">${result.breakdown.heating}</div>
          </div>

          {/* Cooking Row */}
          <div className="flex items-center gap-3 rounded-lg bg-muted/40 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500/10">
              <ChefHat className="h-5 w-5 text-blue-500" />
            </div>
            <div className="flex-1">
              <div className="text-[10px] font-bold uppercase text-muted-foreground tracking-wide">Cooking</div>
              <Select value={config.cooking} onValueChange={(v) => updateConfig("cooking", v as CookingType)}>
                <SelectTrigger className="h-6 border-none bg-transparent p-0 text-sm font-bold focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="natural-gas">Natural Gas</SelectItem>
                  <SelectItem value="electric">Electric</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="text-base font-bold text-card-foreground">${result.breakdown.cooking}</div>
          </div>

          {/* Tenant Provided Appliances */}
          <div className="grid grid-cols-1 gap-2">
            <div className="flex items-center justify-between rounded-lg bg-muted/40 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200">
                  <Refrigerator className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase text-muted-foreground tracking-wide">Refrigerator</div>
                  <div className="text-sm font-bold">Tenant Provides</div>
                </div>
              </div>
              <Switch checked={config.tenantProvidesRefrigerator} onCheckedChange={(v) => updateConfig("tenantProvidesRefrigerator", v)} />
            </div>

            <div className="flex items-center justify-between rounded-lg bg-muted/40 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200">
                  <Wind className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase text-muted-foreground tracking-wide">Range / Microwave</div>
                  <div className="text-sm font-bold">Tenant Provides</div>
                </div>
              </div>
              <Switch checked={config.tenantProvidesRange} onCheckedChange={(v) => updateConfig("tenantProvidesRange", v)} />
            </div>
          </div>
        </div>
      </section>

      {/* 4. Final Result Card */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Base HUD FMR</span>
            <span>${result.baseFMR.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-red-500 font-medium">
            <span>Total Utility Deduction</span>
            <span>-${totalWithFees}</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Estimated Max Rent</div>
              <div className="text-3xl font-extrabold text-green-500">${(result.baseFMR - totalWithFees).toLocaleString()}</div>
            </div>
            <Button size="icon" variant="outline" className="h-10 w-10 rounded-full">
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
