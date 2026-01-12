"use client"

import { useState, useEffect } from "react"
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
  Hash,
  Thermometer,
  Zap
} from "lucide-react"
import {
  BUTTE_CITIES,
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
  censusTract?: string
}

export function FMRCalculatorPanel({ 
  bedrooms: initialBedrooms, 
  city, 
  currentRent, 
  propertyType,
  censusTract 
}: FMRCalculatorPanelProps) {
  
  const detectCity = (cityName?: string): CityZone => {
    if (!cityName) return "chico"
    const lower = cityName.toLowerCase()
    if (lower.includes("paradise")) return "paradise"
    if (lower.includes("oroville")) return "oroville"
    if (lower.includes("gridley")) return "gridley"
    return "chico"
  }

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

  const gasCustomerCharge = (config.heating === "natural-gas" || config.cooking === "natural-gas" || config.waterHeater === "natural-gas") ? 4 : 0
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
                  isSelected ? "bg-card shadow-sm border-border" : "bg-transparent border-transparent hover:bg-muted/50"
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

      {/* 2. Unit Details */}
      <section>
        <h4 className="mb-3 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Unit Details</h4>
        <div className="grid grid-cols-3 gap-3 rounded-lg border border-border bg-muted/20 p-3">
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-muted-foreground"><MapPin className="h-3 w-3" />City</div>
            <div className="flex h-8 items-center px-2 rounded-md border border-border bg-card text-[11px] font-bold">{cityNameDisplay}</div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-muted-foreground"><Building2 className="h-3 w-3" />Unit Type</div>
            <div className="flex h-8 items-center px-2 rounded-md border border-border bg-card text-[11px] font-bold capitalize">{propertyType || "Apartment"}</div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-muted-foreground"><Hash className="h-3 w-3" />Census Tract</div>
            <div className="flex h-8 items-center px-2 rounded-md border border-border bg-card text-[11px] font-bold">{censusTract || "--"}</div>
          </div>
        </div>
      </section>

      {/* 3. Monthly Utility Breakdown */}
      <section className="space-y-4">
        <h4 className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Monthly Utility Breakdown</h4>
        
        <div className="space-y-2">
          {/* Heating */}
          <div className="flex items-center gap-3 rounded-lg bg-muted/40 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-500/10"><Flame className="h-5 w-5 text-orange-500" /></div>
            <div className="flex-1">
              <div className="text-[10px] font-bold uppercase text-muted-foreground">Heating Type</div>
              <Select value={config.heating} onValueChange={(v) => updateConfig("heating", v as HeatingType)}>
                <SelectTrigger className="h-6 border-none bg-transparent p-0 text-sm font-bold focus:ring-0"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="natural-gas">Natural Gas</SelectItem>
                  <SelectItem value="bottled-gas">Bottled Gas</SelectItem>
                  <SelectItem value="electric">Electric</SelectItem>
                  <SelectItem value="heat-pump">Electric - Heat Pump</SelectItem>
                  <SelectItem value="fuel-oil">Fuel Oil</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="text-base font-bold text-card-foreground">${result.breakdown.heating}</div>
          </div>

          {/* Cooking */}
          <div className="flex items-center gap-3 rounded-lg bg-muted/40 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500/10"><ChefHat className="h-5 w-5 text-blue-500" /></div>
            <div className="flex-1">
              <div className="text-[10px] font-bold uppercase text-muted-foreground">Cooking</div>
              <Select value={config.cooking} onValueChange={(v) => updateConfig("cooking", v as CookingType)}>
                <SelectTrigger className="h-6 border-none bg-transparent p-0 text-sm font-bold focus:ring-0"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="natural-gas">Natural Gas</SelectItem>
                  <SelectItem value="bottled-gas">Bottled Gas</SelectItem>
                  <SelectItem value="electric">Electric</SelectItem>
                  <SelectItem value="fuel-oil">Fuel Oil</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="text-base font-bold text-card-foreground">${result.breakdown.cooking}</div>
          </div>

          {/* AC */}
          <div className="flex items-center gap-3 rounded-lg bg-muted/40 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-500/10"><Wind className="h-5 w-5 text-cyan-500" /></div>
            <div className="flex-1">
              <div className="text-[10px] font-bold uppercase text-muted-foreground">Air Conditioning</div>
              <Select value={config.airConditioning} onValueChange={(v) => updateConfig("airConditioning", v as ACType)}>
                <SelectTrigger className="h-6 border-none bg-transparent p-0 text-sm font-bold focus:ring-0"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="refrigerated">Refrigerated Air</SelectItem>
                  <SelectItem value="evaporative">Evaporative Cooling</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="text-base font-bold text-card-foreground">${result.breakdown.airConditioning}</div>
          </div>

          {/* Water Heater */}
          <div className="flex items-center gap-3 rounded-lg bg-muted/40 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-500/10"><Thermometer className="h-5 w-5 text-red-500" /></div>
            <div className="flex-1">
              <div className="text-[10px] font-bold uppercase text-muted-foreground">Water Heater</div>
              <Select value={config.waterHeater} onValueChange={(v) => updateConfig("waterHeater", v as WaterHeaterType)}>
                <SelectTrigger className="h-6 border-none bg-transparent p-0 text-sm font-bold focus:ring-0"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="natural-gas">Natural Gas</SelectItem>
                  <SelectItem value="bottled-gas">Bottled Gas</SelectItem>
                  <SelectItem value="electric">Electric</SelectItem>
                  <SelectItem value="heat-pump">Electric - Heat Pump</SelectItem>
                  <SelectItem value="fuel-oil">Fuel Oil</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="text-base font-bold text-card-foreground">${result.breakdown.waterHeater}</div>
          </div>
        </div>

        {/* Tenant Paid Utilities Grid */}
        <div className="grid grid-cols-3 gap-2">
          <button 
            onClick={() => updateConfig("waterIncluded", !config.waterIncluded)} 
            className={`flex flex-col items-center justify-center gap-1 rounded-xl border py-4 transition-all duration-200 ${
              !config.waterIncluded 
                ? 'bg-blue-600 border-blue-700 shadow-md transform scale-[1.02]' 
                : 'bg-muted/20 border-border hover:bg-muted/40'
            }`}
          >
            <Droplets className={`h-5 w-5 ${!config.waterIncluded ? 'text-white' : 'text-muted-foreground'}`} />
            <span className={`text-[10px] font-black uppercase ${!config.waterIncluded ? 'text-white' : 'text-muted-foreground'}`}>Water</span>
            <span className={`text-[11px] font-bold ${!config.waterIncluded ? 'text-blue-100' : 'text-muted-foreground/60'}`}>${result.breakdown.water}</span>
          </button>

          <button 
            onClick={() => updateConfig("sewerIncluded", !config.sewerIncluded)} 
            className={`flex flex-col items-center justify-center gap-1 rounded-xl border py-4 transition-all duration-200 ${
              !config.sewerIncluded 
                ? 'bg-indigo-600 border-indigo-700 shadow-md transform scale-[1.02]' 
                : 'bg-muted/20 border-border hover:bg-muted/40'
            }`}
          >
            <Zap className={`h-5 w-5 ${!config.sewerIncluded ? 'text-white' : 'text-muted-foreground'}`} />
            <span className={`text-[10px] font-black uppercase ${!config.sewerIncluded ? 'text-white' : 'text-muted-foreground'}`}>Sewer</span>
            <span className={`text-[11px] font-bold ${!config.sewerIncluded ? 'text-indigo-100' : 'text-muted-foreground/60'}`}>${result.breakdown.sewer}</span>
          </button>

          <button 
            onClick={() => updateConfig("trashIncluded", !config.trashIncluded)} 
            className={`flex flex-col items-center justify-center gap-1 rounded-xl border py-4 transition-all duration-200 ${
              !config.trashIncluded 
                ? 'bg-slate-700 border-slate-800 shadow-md transform scale-[1.02]' 
                : 'bg-muted/20 border-border hover:bg-muted/40'
            }`}
          >
            <Trash2 className={`h-5 w-5 ${!config.trashIncluded ? 'text-white' : 'text-muted-foreground'}`} />
            <span className={`text-[10px] font-black uppercase ${!config.trashIncluded ? 'text-white' : 'text-muted-foreground'}`}>Trash</span>
            <span className={`text-[11px] font-bold ${!config.trashIncluded ? 'text-slate-200' : 'text-muted-foreground/60'}`}>${result.breakdown.trash}</span>
          </button>
        </div>

        {/* Appliances Selection Grid */}
        <div className="grid grid-cols-2 gap-2">
          <button 
            onClick={() => updateConfig("tenantProvidesRefrigerator", !config.tenantProvidesRefrigerator)} 
            className={`flex flex-col items-center justify-center gap-1 rounded-xl border py-4 transition-all duration-200 ${
              config.tenantProvidesRefrigerator 
                ? 'bg-emerald-600 border-emerald-700 shadow-md transform scale-[1.02]' 
                : 'bg-muted/20 border-border hover:bg-muted/40'
            }`}
          >
            <Refrigerator className={`h-5 w-5 ${config.tenantProvidesRefrigerator ? 'text-white' : 'text-muted-foreground'}`} />
            <span className={`text-[10px] font-black uppercase text-center leading-tight ${config.tenantProvidesRefrigerator ? 'text-white' : 'text-muted-foreground'}`}>Fridge</span>
            <span className={`text-[11px] font-bold ${config.tenantProvidesRefrigerator ? 'text-emerald-100' : 'text-muted-foreground/60'}`}>${result.breakdown.refrigerator}</span>
          </button>

          <button 
            onClick={() => updateConfig("tenantProvidesRange", !config.tenantProvidesRange)} 
            className={`flex flex-col items-center justify-center gap-1 rounded-xl border py-4 transition-all duration-200 ${
              config.tenantProvidesRange 
                ? 'bg-emerald-600 border-emerald-700 shadow-md transform scale-[1.02]' 
                : 'bg-muted/20 border-border hover:bg-muted/40'
            }`}
          >
            <ChefHat className={`h-5 w-5 ${config.tenantProvidesRange ? 'text-white' : 'text-muted-foreground'}`} />
            <span className={`text-[10px] font-black uppercase text-center leading-tight ${config.tenantProvidesRange ? 'text-white' : 'text-muted-foreground'}`}>Range</span>
            <span className={`text-[11px] font-bold ${config.tenantProvidesRange ? 'text-emerald-100' : 'text-muted-foreground/60'}`}>${result.breakdown.range}</span>
          </button>
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
            <Button size="icon" variant="outline" className="h-10 w-10 rounded-full"><Download className="h-4 w-4" /></Button>
          </div>
        </div>
      </section>
    </div>
  )
}
