"use client"

import { useState, useEffect } from "react"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Download, 
  Calculator, 
  Info, 
  Zap, 
  Droplets, 
  Trash2, 
  Wind, 
  Flame, 
  ChefHat, 
  Thermometer 
} from "lucide-react"
import {
  BUTTE_CITIES,
  UTILITY_RATES_2026,
  FMR_2026,
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
  propertyType?: string
}

export function FMRCalculatorPanel({ bedrooms, city, currentRent, propertyType }: FMRCalculatorPanelProps) {
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

  const [otherFees, setOtherFees] = useState(0)
  const [result, setResult] = useState<CalculationResult | null>(null)

  useEffect(() => {
    setResult(calculateFMR2026(config))
  }, [config])

  const updateConfig = <K extends keyof CalculatorConfig>(key: K, value: CalculatorConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  const hasGas = config.heating === "natural-gas" || config.cooking === "natural-gas" || config.waterHeater === "natural-gas"
  const hasElectric = true // Generally always has some electric load
  const gasCustomerCharge = hasGas ? 4 : 0
  const electricCustomerCharge = 12
  const totalWithFees = (result?.totalUtilityAllowance || 0) + otherFees + gasCustomerCharge + electricCustomerCharge

  if (!result) return null

  return (
    <div className="space-y-6">
      {/* 2026 HUD Overview - Unified with "Legal Info" style */}
      <section>
        <h4 className="mb-3 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">HUD 2026 FMR Reference</h4>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <div className="flex flex-wrap gap-2">
            {Object.entries(FMR_2026).map(([br, amount]) => (
              <Badge
                key={br}
                variant={config.bedrooms === Number(br) ? "default" : "outline"}
                className={config.bedrooms === Number(br) ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground border-border"}
              >
                {br === "0" ? "Studio" : `${br}BR`}: ${amount.toLocaleString()}
              </Badge>
            ))}
          </div>
        </div>
      </section>

      {/* Configuration Header */}
      <section>
        <h4 className="mb-3 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Calculator Settings</h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-[10px] font-bold uppercase text-muted-foreground">City Zone</Label>
            <Select value={config.city} onValueChange={(v) => updateConfig("city", v as CityZone)}>
              <SelectTrigger className="h-9 text-xs bg-muted/40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BUTTE_CITIES.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] font-bold uppercase text-muted-foreground">Bedroom Count</Label>
            <Select value={config.bedrooms.toString()} onValueChange={(v) => updateConfig("bedrooms", Number.parseInt(v))}>
              <SelectTrigger className="h-9 text-xs bg-muted/40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[0, 1, 2, 3, 4, 5].map(n => <SelectItem key={n} value={n.toString()}>{n === 0 ? "Studio" : `${n} Bedrooms`}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {/* Utility Breakdown - Unified with "Management" style */}
      <section>
        <h4 className="mb-3 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Utility Allowances</h4>
        <div className="space-y-2">
          {/* Heating */}
          <div className="flex items-center gap-3 rounded-lg bg-muted/40 p-3">
            <Flame className="h-4 w-4 text-orange-500" />
            <div className="flex-1">
              <div className="text-[10px] font-bold uppercase text-muted-foreground">Heating</div>
              <Select value={config.heating} onValueChange={(v) => updateConfig("heating", v as HeatingType)}>
                <SelectTrigger className="h-6 border-none bg-transparent p-0 text-xs font-bold focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="natural-gas">Natural Gas</SelectItem>
                  <SelectItem value="electric">Electric</SelectItem>
                  <SelectItem value="heat-pump">Heat Pump</SelectItem>
                  <SelectItem value="none">Landlord Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="text-sm font-bold">${result.breakdown.heating}</div>
          </div>

          {/* Cooking */}
          <div className="flex items-center gap-3 rounded-lg bg-muted/40 p-3">
            <ChefHat className="h-4 w-4 text-blue-500" />
            <div className="flex-1">
              <div className="text-[10px] font-bold uppercase text-muted-foreground">Cooking</div>
              <Select value={config.cooking} onValueChange={(v) => updateConfig("cooking", v as CookingType)}>
                <SelectTrigger className="h-6 border-none bg-transparent p-0 text-xs font-bold focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="natural-gas">Natural Gas</SelectItem>
                  <SelectItem value="electric">Electric</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="text-sm font-bold">${result.breakdown.cooking}</div>
          </div>

          {/* Water, Sewer, Trash Group */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
              <div className="flex items-center gap-2">
                <Droplets className="h-4 w-4 text-blue-400" />
                <span className="text-[10px] font-bold uppercase text-muted-foreground">Water</span>
              </div>
              <Switch checked={!config.waterIncluded} onCheckedChange={(v) => updateConfig("waterIncluded", !v)} className="scale-75" />
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
              <div className="flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-[10px] font-bold uppercase text-muted-foreground">Trash</span>
              </div>
              <Switch checked={!config.trashIncluded} onCheckedChange={(v) => updateConfig("trashIncluded", !v)} className="scale-75" />
            </div>
          </div>
        </div>
      </section>

      {/* Final Calculation - Unified with Price Header style */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Base FMR Limit</span>
            <span>${result.baseFMR.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-red-500 font-medium">
            <span>Total Utility Allowance</span>
            <span>-${totalWithFees}</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Net Rent Limit</div>
              <div className="text-3xl font-extrabold text-green-500">${(result.baseFMR - totalWithFees).toLocaleString()}</div>
            </div>
            <Button size="icon" variant="outline" className="h-10 w-10 rounded-full" onClick={() => {/* Download function */}}>
              <Download className="h-4 w-4" />
            </Button>
          </div>
          
          {currentRent && (
            <div className={`mt-2 rounded-lg p-3 text-center text-xs font-bold uppercase tracking-wide ${currentRent <= (result.baseFMR - totalWithFees) ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'}`}>
              {currentRent <= (result.baseFMR - totalWithFees) 
                ? `Currently $${(result.baseFMR - totalWithFees - currentRent).toLocaleString()} Below Limit`
                : `Currently $${(currentRent - (result.baseFMR - totalWithFees)).toLocaleString()} Above Limit`}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
