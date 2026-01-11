"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Property, PropertyUnit, PropertyPhoto, PropertyFee } from "@/types/property"
import { AMENITY_CATEGORIES } from "@/config/amenities"
import { FEE_TYPES } from "@/config/fees"
import { FMRCalculatorPanel } from "./fmr-calculator-panel"
import {
  X,
  Home,
  Building2,
  Bed,
  Bath,
  Square,
  Calendar,
  MapPin,
  User,
  Bell,
  Phone,
  Globe,
  Clock,
  PawPrint,
  ImageIcon,
  Info,
  Calculator,
  Search,
  ArrowUpDown,
  Filter,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { type UtilityConfiguration, calculateFMR, FMR_2025 } from "@/utils/property-utils"

interface PropertyDetailPanelProps {
  property: Property
  onClose: () => void
}

const propertyTypeIcons: Record<string, typeof Home> = {
  "single-family": Home,
  apartment: Building2,
  duplex: Building2,
  triplex: Building2,
  fourplex: Building2,
  condo: Building2,
  townhouse: Building2,
  "mobile-home": Home,
  "multi-family": Building2,
}

function getUtilityConfig(property: Property): UtilityConfiguration | null {
  const utils = property.utilities
  if (!utils) return null
  try {
    return {
      heating: {
        type: utils.heating?.type || "natural-gas",
        tenantPays: utils.heating?.tenant_pays ?? true,
      },
      cooking: {
        type: utils.cooking?.type || "electric",
        tenantPays: utils.cooking?.tenant_pays ?? true,
      },
      airConditioning: {
        type: utils.air_conditioning?.type || "refrigerated",
        tenantPays: utils.air_conditioning?.tenant_pays ?? true,
      },
      waterHeater: {
        type: utils.water_heater?.type || "natural-gas",
        tenantPays: utils.water_heater?.tenant_pays ?? true,
      },
      waterSewer: utils.water_sewer || "not-included",
      trash: utils.trash || "included",
      refrigeratorProvided: utils.refrigerator_provided ?? true,
      rangeProvided: utils.range_provided ?? true,
    }
  } catch (error) {
    return null
  }
}

export function PropertyDetailPanel({ property, onClose }: PropertyDetailPanelProps) {
  const [email, setEmail] = useState("")
  const [isWatching, setIsWatching] = useState(false)
  const [units, setUnits] = useState<PropertyUnit[]>([])
  const [photos, setPhotos] = useState<PropertyPhoto[]>([])
  const [activeTab, setActiveTab] = useState("details")
  
  // Unit Tab State
  const [unitSearch, setUnitSearch] = useState("")
  const [unitSort, setUnitSort] = useState<"unit-asc" | "price-asc" | "price-desc">("unit-asc")
  const [unitFilterBR, setUnitFilterBR] = useState<string>("all")

  const Icon = propertyTypeIcons[property.property_type] || Home

  const fmrData = useMemo(() => {
    try {
      const utilityConfig = getUtilityConfig(property)
      return calculateFMR(property.bedrooms || 1, utilityConfig)
    } catch (error) {
      return {
        baseFMR: FMR_2025[property.bedrooms || 1] || 1096,
        maxAllowableRent: FMR_2025[property.bedrooms || 1] || 1096,
      }
    }
  }, [property.bedrooms, property.utilities, property]);

  useEffect(() => {
    const fetchRelatedData = async () => {
      const supabase = createClient()
      try {
        const [unitsRes, photosRes] = await Promise.all([
          supabase.from("property_units").select("*").eq("property_id", property.id),
          supabase.from("property_photos").select("*").eq("property_id", property.id).order("sort_order")
        ]);
        if (unitsRes.data) setUnits(unitsRes.data);
        if (photosRes.data) setPhotos(photosRes.data);
      } catch (error) {
        console.error("Error fetching data:", error)
      }
    }
    fetchRelatedData()
  }, [property.id])

  // Logic for filtering and sorting units
  const processedUnits = useMemo(() => {
    let filtered = units.filter(u => {
      const matchesSearch = u.unit_number.toLowerCase().includes(unitSearch.toLowerCase())
      const matchesBR = unitFilterBR === "all" || u.bedrooms.toString() === unitFilterBR
      return matchesSearch && matchesBR
    })

    filtered.sort((a, b) => {
      if (unitSort === "price-asc") return (a.rent || 0) - (b.rent || 0)
      if (unitSort === "price-desc") return (b.rent || 0) - (a.rent || 0)
      return a.unit_number.localeCompare(b.unit_number, undefined, { numeric: true })
    })

    const available = filtered.filter(u => u.is_available)
    const occupied = filtered.filter(u => !u.is_available)

    return { available, occupied }
  }, [units, unitSearch, unitSort, unitFilterBR])

  const handleWatch = async () => {
    if (!email) return
    setIsWatching(true)
    const supabase = createClient()
    await supabase.from("watchlist").insert({ property_id: property.id, email: email })
    setIsWatching(false)
    setEmail("")
  }

  return (
    <div className="flex h-full w-[420px] flex-col border-l border-border bg-card">
      <div className="flex-shrink-0 flex items-center justify-between border-b border-border p-4">
        <h2 className="font-semibold text-card-foreground">Property Details</h2>
        <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>

      <ScrollArea className="flex-1 overflow-auto">
        <div className="p-4">
          <div className="mb-6 flex items-start gap-3">
            <div className="rounded-full bg-primary/10 p-2.5"><Icon className="h-6 w-6 text-primary" /></div>
            <div>
              <h3 className="text-lg font-bold text-card-foreground leading-tight">{property.property_name || property.address}</h3>
              <p className="flex items-center gap-1 text-xs text-muted-foreground mt-1"><MapPin className="h-3 w-3" /> {property.city}, CA</p>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-muted/50 p-1">
              <TabsTrigger value="details" className="text-xs">Details</TabsTrigger>
              <TabsTrigger value="fmr" className="text-xs">FMR</TabsTrigger>
              <TabsTrigger value="units" className="text-xs">Units</TabsTrigger>
              <TabsTrigger value="photos" className="text-xs">Photos</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="mt-6 space-y-6">
               <div className="grid grid-cols-4 border-y border-border py-4">
                <div className="flex flex-col items-center border-r"><Bed className="h-4 w-4 mb-1" /><span className="text-sm font-bold">{property.bedrooms}</span><span className="text-[10px] text-muted-foreground uppercase">Beds</span></div>
                <div className="flex flex-col items-center border-r"><Bath className="h-4 w-4 mb-1" /><span className="text-sm font-bold">{property.bathrooms}</span><span className="text-[10px] text-muted-foreground uppercase">Baths</span></div>
                <div className="flex flex-col items-center border-r"><Square className="h-4 w-4 mb-1" /><span className="text-sm font-bold">{property.square_feet}</span><span className="text-[10px] text-muted-foreground uppercase">Sq Ft</span></div>
                <div className="flex flex-col items-center"><Calendar className="h-4 w-4 mb-1" /><span className="text-sm font-bold">{property.year_built}</span><span className="text-[10px] text-muted-foreground uppercase">Year</span></div>
              </div>
              <section className="space-y-2">
                <div className="flex items-center gap-3 rounded-lg bg-muted/40 p-4"><User className="h-5 w-5 text-blue-500" /><div><div className="text-sm font-bold">{property.management_company || "Landlord"}</div><div className="text-[10px] uppercase text-muted-foreground">Management</div></div></div>
                <div className="flex items-center gap-3 rounded-lg bg-muted/40 p-4"><Phone className="h-5 w-5 text-green-500" /><div><div className="text-sm font-bold">{property.phone_number || "--"}</div><div className="text-[10px] uppercase text-muted-foreground">Phone</div></div></div>
              </section>
            </TabsContent>

            <TabsContent value="fmr" className="mt-4">
              <FMRCalculatorPanel bedrooms={property.bedrooms || 2} city={property.city} currentRent={property.current_rent} propertyType={property.property_type} />
            </TabsContent>

            <TabsContent value="units" className="mt-4 space-y-4">
              {/* Unit Controls */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search unit #" className="pl-9 h-9 text-xs" value={unitSearch} onChange={(e) => setUnitSearch(e.target.value)} />
                </div>
                <div className="flex gap-2">
                  <Select value={unitFilterBR} onValueChange={setUnitFilterBR}>
                    <SelectTrigger className="h-8 text-[10px] font-bold uppercase"><Filter className="mr-1 h-3 w-3" /><SelectValue placeholder="Beds" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sizes</SelectItem>
                      <SelectItem value="0">Studio</SelectItem>
                      <SelectItem value="1">1 Bed</SelectItem>
                      <SelectItem value="2">2 Bed</SelectItem>
                      <SelectItem value="3">3 Bed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={unitSort} onValueChange={(v: any) => setUnitSort(v)}>
                    <SelectTrigger className="h-8 text-[10px] font-bold uppercase"><ArrowUpDown className="mr-1 h-3 w-3" /><SelectValue placeholder="Sort" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unit-asc">Unit Number</SelectItem>
                      <SelectItem value="price-asc">Price: Low to High</SelectItem>
                      <SelectItem value="price-desc">Price: High to Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Available Units */}
              {processedUnits.available.length > 0 && (
                <section className="space-y-2">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-green-600 flex items-center gap-2">
                    Available Units <span className="h-1 flex-1 bg-green-100" />
                  </h4>
                  {processedUnits.available.map(u => (
                    <div key={u.id} className="rounded-lg border-2 border-green-500/20 bg-green-500/5 p-3 flex justify-between items-center">
                      <div>
                        <div className="font-bold text-sm">Unit {u.unit_number}</div>
                        <div className="text-[10px] font-bold text-muted-foreground uppercase">{u.bedrooms} BR • {u.bathrooms} BA</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-black text-green-600">${u.rent?.toLocaleString()}</div>
                        <Badge className="bg-green-500 text-[9px] h-4">Ready Now</Badge>
                      </div>
                    </div>
                  ))}
                </section>
              )}

              {/* Occupied Units */}
              {processedUnits.occupied.length > 0 && (
                <section className="space-y-2">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    Occupied ({processedUnits.occupied.length}) <span className="h-1 flex-1 bg-muted" />
                  </h4>
                  <div className="grid gap-2">
                    {processedUnits.occupied.map(u => (
                      <div key={u.id} className="rounded-lg border border-border p-3 bg-muted/10 flex justify-between items-center opacity-70">
                        <div>
                          <div className="font-bold text-sm text-card-foreground">Unit {u.unit_number}</div>
                          <div className="text-[10px] font-medium text-muted-foreground uppercase">{u.bedrooms} BR</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-muted-foreground">${u.rent?.toLocaleString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </TabsContent>

            <TabsContent value="photos" className="mt-4">
              <div className="grid grid-cols-2 gap-2">
                {photos.map(p => <img key={p.id} src={p.url} className="rounded-lg object-cover h-32 w-full border border-border" />)}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </div>
  )
}
