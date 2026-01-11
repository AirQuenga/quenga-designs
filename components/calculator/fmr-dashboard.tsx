"use client"

import type React from "react"

import { useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Flame,
  Thermometer,
  Droplets,
  Wind,
  Trash2,
  Refrigerator,
  CookingPot,
  DollarSign,
  Home,
  Calculator,
  MapPin,
  Zap,
} from "lucide-react"
import {
  FMR_2026,
  BUTTE_CITIES,
  calculateFMR2026,
  type CityZone,
  type HeatingType,
  type CookingType,
  type WaterHeaterType,
  type ACType,
  type CalculatorConfig,
} from "@/config/fmr-2026"
import { ButteCountySVGMap } from "@/components/calculator/butte-county-svg-map"

const HEATING_OPTIONS: Array<{ value: HeatingType; label: string }> = [
  { value: "natural-gas", label: "Natural Gas" },
  { value: "bottled-gas", label: "Bottled Gas (Propane)" },
  { value: "electric", label: "Electric" },
  { value: "heat-pump", label: "Electric Heat Pump" },
  { value: "fuel-oil", label: "Fuel Oil" },
  { value: "none", label: "Not Applicable" },
]

const COOKING_OPTIONS: Array<{ value: CookingType; label: string }> = [
  { value: "natural-gas", label: "Natural Gas" },
  { value: "bottled-gas", label: "Bottled Gas (Propane)" },
  { value: "electric", label: "Electric" },
  { value: "none", label: "Included in Rent" },
]

const WATER_HEATER_OPTIONS: Array<{ value: WaterHeaterType; label: string }> = [
  { value: "natural-gas", label: "Natural Gas" },
  { value: "bottled-gas", label: "Bottled Gas (Propane)" },
  { value: "electric", label: "Electric" },
  { value: "none", label: "Included in Rent" },
]

const AC_OPTIONS: Array<{ value: ACType; label: string }> = [
  { value: "refrigerated", label: "Central/Window AC" },
  { value: "evaporative", label: "Evaporative (Swamp) Cooler" },
  { value: "none", label: "No Air Conditioning" },
]

const BEDROOM_LABELS = ["Studio", "1 Bed", "2 Bed", "3 Bed", "4 Bed", "5+ Bed"]

export function FMRDashboard() {
  const [config, setConfig] = useState<CalculatorConfig>({
    city: "chico",
    bedrooms: 2,
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

  const result = calculateFMR2026(config)
  const selectedCity = BUTTE_CITIES.find((c) => c.id === config.city)

  const handleCitySelect = useCallback((cityId: CityZone) => {
    setConfig((prev) => ({ ...prev, city: cityId }))
  }, [])

  const updateConfig = <K extends keyof CalculatorConfig>(key: K, value: CalculatorConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50">
      {/* Left Panel - Calculator */}
      <div className="flex w-1/2 flex-col overflow-y-auto border-r border-slate-200 bg-white">
        {/* Header */}
        <div className="border-b border-slate-200 bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-white/20 p-2">
              <Calculator className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">2026 Butte County</h1>
              <p className="text-sm text-emerald-100">Utility Allowance & FMR Calculator</p>
            </div>
          </div>
        </div>

        <div className="flex-1 p-6">
          <Tabs defaultValue="configuration" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="configuration">Configuration</TabsTrigger>
              <TabsTrigger value="results">Results</TabsTrigger>
            </TabsList>

            <TabsContent value="configuration" className="space-y-6">
              {/* Location & Unit */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Home className="h-4 w-4 text-emerald-600" />
                    Location & Unit Type
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* City Selection */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      City
                    </Label>
                    <Select value={config.city} onValueChange={(v) => updateConfig("city", v as CityZone)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select city" />
                      </SelectTrigger>
                      <SelectContent>
                        {BUTTE_CITIES.map((city) => (
                          <SelectItem key={city.id} value={city.id}>
                            {city.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-500">Or click a city on the map →</p>
                  </div>

                  {/* Bedroom Count */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Bedrooms</Label>
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">
                        {BEDROOM_LABELS[config.bedrooms]}
                      </span>
                    </div>
                    <Slider
                      value={[config.bedrooms]}
                      onValueChange={([v]) => updateConfig("bedrooms", v)}
                      max={5}
                      min={0}
                      step={1}
                      className="py-2"
                    />
                    <div className="flex justify-between text-xs text-slate-400">
                      {BEDROOM_LABELS.map((label, i) => (
                        <span key={label} className={config.bedrooms === i ? "font-medium text-emerald-600" : ""}>
                          {i}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Base FMR Display */}
                  <div className="rounded-lg bg-emerald-50 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-emerald-700">Base FMR ({BEDROOM_LABELS[config.bedrooms]})</span>
                      <span className="text-2xl font-bold text-emerald-700">${FMR_2026[config.bedrooms]}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Utilities Section */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Zap className="h-4 w-4 text-amber-500" />
                    Utilities
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Heating */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Flame className="h-3.5 w-3.5 text-orange-500" />
                      Heating
                    </Label>
                    <Select value={config.heating} onValueChange={(v) => updateConfig("heating", v as HeatingType)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {HEATING_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Cooking */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <CookingPot className="h-3.5 w-3.5 text-red-500" />
                      Cooking
                    </Label>
                    <Select value={config.cooking} onValueChange={(v) => updateConfig("cooking", v as CookingType)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COOKING_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Water Heater */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Thermometer className="h-3.5 w-3.5 text-blue-500" />
                      Water Heater
                    </Label>
                    <Select
                      value={config.waterHeater}
                      onValueChange={(v) => updateConfig("waterHeater", v as WaterHeaterType)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {WATER_HEATER_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Air Conditioning */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Wind className="h-3.5 w-3.5 text-cyan-500" />
                      Air Conditioning
                    </Label>
                    <Select
                      value={config.airConditioning}
                      onValueChange={(v) => updateConfig("airConditioning", v as ACType)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {AC_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Water/Sewer/Trash */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Droplets className="h-4 w-4 text-blue-500" />
                    Water, Sewer & Trash
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <Label htmlFor="water-included" className="flex items-center gap-2 font-normal">
                      <Droplets className="h-4 w-4 text-blue-400" />
                      Water included in rent
                    </Label>
                    <Switch
                      id="water-included"
                      checked={config.waterIncluded}
                      onCheckedChange={(v) => updateConfig("waterIncluded", v)}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <Label htmlFor="sewer-included" className="flex items-center gap-2 font-normal">
                      <Droplets className="h-4 w-4 text-slate-400" />
                      Sewer included in rent
                    </Label>
                    <Switch
                      id="sewer-included"
                      checked={config.sewerIncluded}
                      onCheckedChange={(v) => updateConfig("sewerIncluded", v)}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <Label htmlFor="trash-included" className="flex items-center gap-2 font-normal">
                      <Trash2 className="h-4 w-4 text-slate-400" />
                      Trash included in rent
                    </Label>
                    <Switch
                      id="trash-included"
                      checked={config.trashIncluded}
                      onCheckedChange={(v) => updateConfig("trashIncluded", v)}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Appliances */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Refrigerator className="h-4 w-4 text-slate-600" />
                    Tenant-Provided Appliances
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs text-slate-500">Add allowance if tenant must provide their own appliances</p>

                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-2">
                      <CookingPot className="h-4 w-4 text-slate-400" />
                      <Label htmlFor="tenant-range" className="font-normal">
                        Range/Stove (+$8/mo)
                      </Label>
                    </div>
                    <Switch
                      id="tenant-range"
                      checked={config.tenantProvidesRange}
                      onCheckedChange={(v) => updateConfig("tenantProvidesRange", v)}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-2">
                      <Refrigerator className="h-4 w-4 text-slate-400" />
                      <Label htmlFor="tenant-fridge" className="font-normal">
                        Refrigerator (+$12/mo)
                      </Label>
                    </div>
                    <Switch
                      id="tenant-fridge"
                      checked={config.tenantProvidesRefrigerator}
                      onCheckedChange={(v) => updateConfig("tenantProvidesRefrigerator", v)}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="results" className="space-y-6">
              {/* Results Summary */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50">
                  <CardContent className="pt-6">
                    <div className="mb-6 text-center">
                      <p className="text-sm font-medium text-emerald-600">Maximum Allowable Rent</p>
                      <p className="text-5xl font-bold text-emerald-700">${result.netRent}</p>
                      <p className="mt-1 text-sm text-slate-500">per month for {selectedCity?.name}</p>
                    </div>

                    <div className="space-y-3 rounded-lg bg-white/80 p-4">
                      <div className="flex items-center justify-between border-b pb-2">
                        <span className="text-slate-600">Base FMR ({BEDROOM_LABELS[config.bedrooms]})</span>
                        <span className="font-semibold">${result.baseFMR}</span>
                      </div>
                      <div className="flex items-center justify-between border-b pb-2">
                        <span className="text-slate-600">Total Utility Allowance</span>
                        <span className="font-semibold text-red-600">-${result.totalUtilityAllowance}</span>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <span className="font-medium text-emerald-700">Net Rent Limit</span>
                        <span className="text-xl font-bold text-emerald-700">${result.netRent}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <DollarSign className="h-4 w-4 text-emerald-600" />
                    Utility Allowance Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <AnimatePresence>
                      {Object.entries(result.breakdown).map(([key, value]) => {
                        if (value === 0) return null
                        const icons: Record<string, React.ReactNode> = {
                          heating: <Flame className="h-4 w-4 text-orange-500" />,
                          cooking: <CookingPot className="h-4 w-4 text-red-500" />,
                          waterHeater: <Thermometer className="h-4 w-4 text-blue-500" />,
                          airConditioning: <Wind className="h-4 w-4 text-cyan-500" />,
                          water: <Droplets className="h-4 w-4 text-blue-400" />,
                          sewer: <Droplets className="h-4 w-4 text-slate-400" />,
                          trash: <Trash2 className="h-4 w-4 text-slate-400" />,
                          range: <CookingPot className="h-4 w-4 text-slate-400" />,
                          refrigerator: <Refrigerator className="h-4 w-4 text-slate-400" />,
                        }
                        const labels: Record<string, string> = {
                          heating: "Heating",
                          cooking: "Cooking",
                          waterHeater: "Water Heater",
                          airConditioning: "Air Conditioning",
                          water: "Water",
                          sewer: "Sewer",
                          trash: "Trash",
                          range: "Range/Stove",
                          refrigerator: "Refrigerator",
                        }
                        return (
                          <motion.div
                            key={key}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
                          >
                            <div className="flex items-center gap-2">
                              {icons[key]}
                              <span className="text-sm text-slate-700">{labels[key]}</span>
                            </div>
                            <span className="font-medium text-slate-900">${value}</span>
                          </motion.div>
                        )
                      })}
                    </AnimatePresence>

                    {result.totalUtilityAllowance === 0 && (
                      <p className="py-4 text-center text-sm text-slate-500">
                        No utility allowances apply with current configuration
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Info */}
              <Card className="border-blue-100 bg-blue-50/50">
                <CardContent className="pt-4">
                  <p className="text-xs text-blue-700">
                    <strong>Note:</strong> These rates are based on the 2026 HUD Fair Market Rent schedule for Butte
                    County, CA. Actual allowances may vary. Contact your local housing authority for official
                    determinations.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Right Panel - Map */}
      <div className="relative w-1/2 bg-slate-100">
        <ButteCountySVGMap selectedCity={config.city} onCitySelect={handleCitySelect} />
      </div>
    </div>
  )
}
