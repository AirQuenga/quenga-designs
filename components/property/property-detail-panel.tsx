"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
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
  Flame,
  GraduationCap,
  CheckCircle2,
  Phone,
  Globe,
  Clock,
  PawPrint,
  Zap,
  Thermometer,
  ChefHat,
  Wind,
  ImageIcon,
  Info,
  Calculator,
  ExternalLink,
  DollarSign,
  Trash2,
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
  const [watchSuccess, setWatchSuccess] = useState(false)
  const [units, setUnits] = useState<PropertyUnit[]>([])
  const [photos, setPhotos] = useState<PropertyPhoto[]>([])
  const [fees, setFees] = useState<PropertyFee[]>([])
  const [activeTab, setActiveTab] = useState("details")
  const [fmrError, setFmrError] = useState<string | null>(null)

  const Icon = propertyTypeIcons[property.property_type] || Home

  const fmrData = useMemo(() => {
    try {
      const utilityConfig = getUtilityConfig(property)
      return calculateFMR(property.bedrooms || 1, utilityConfig)
    } catch (error) {
      setFmrError("Unable to calculate FMR")
      return {
        baseFMR: FMR_2025[property.bedrooms || 1] || 1096,
        utilityAllowance: 0,
        utilityBreakdown: { heating: 0, cooking: 0, airConditioning: 0, waterHeater: 0, waterSewer: 0, trash: 0, refrigerator: 0, range: 0 },
        adjustedFMR: FMR_2025[property.bedrooms || 1] || 1096,
        maxAllowableRent: FMR_2025[property.bedrooms || 1] || 1096,
        overrideApplied: false,
      }
    }
  }, [property.bedrooms, property.utilities, property]);

  useEffect(() => {
    setEmail("");
    setWatchSuccess(false);
    setFmrError(null);
    const fetchRelatedData = async () => {
      const supabase = createClient()
      try {
        const [unitsRes, photosRes, feesRes] = await Promise.all([
          supabase.from("property_units").select("*").eq("property_id", property.id).order("unit_number"),
          supabase.from("property_photos").select("*").eq("property_id", property.id).order("sort_order"),
          supabase.from("property_fees").select("*").eq("property_id", property.id)
        ]);
        if (unitsRes.data) setUnits(unitsRes.data);
        if (photosRes.data) setPhotos(photosRes.data);
        if (feesRes.data) setFees(feesRes.data);
      } catch (error) {
        console.error("Error fetching data:", error)
      }
    }
    fetchRelatedData()
  }, [property.id])

  const handleWatch = async () => {
    if (!email) return
    setIsWatching(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from("watchlist").insert({ property_id: property.id, email: email })
      if (!error) {
        setWatchSuccess(true)
        setTimeout(() => setWatchSuccess(false), 3000)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsWatching(false)
    }
  }

  const getAmenityLabel = (amenityId: string) => {
    for (const category of AMENITY_CATEGORIES) {
      const amenity = category.amenities.find((a) => a.id === amenityId)
      if (amenity) return amenity.label
    }
    return amenityId
  }

  const getFeeLabel = (feeTypeId: string) => {
    const fee = FEE_TYPES.find((f) => f.id === feeTypeId)
    return fee?.label || feeTypeId
  }

  const isBelowFMR = property.current_rent && property.current_rent < fmrData.maxAllowableRent;

  return (
    <div className="flex h-full w-[420px] flex-col border-l border-border bg-card">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between border-b border-border p-4">
        <h2 className="font-semibold text-card-foreground">Property Details</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 overflow-auto">
        <div className="p-4">
          {/* Status & Price */}
          <div className="mb-4">
            <div className="flex items-baseline justify-between">
              <div className="flex flex-wrap gap-1">
                <Badge className={property.is_available ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"}>
                  {property.is_available ? "Available Now" : "Currently Occupied"}
                </Badge>
                {property.is_section_8 && <Badge className="bg-purple-500 text-white">Section 8</Badge>}
                {property.is_available && isBelowFMR && <Badge className="bg-emerald-600 text-white">Below FMR</Badge>}
              </div>
              {property.is_available && property.current_rent && (
                <div className="text-right">
                  <span className="text-3xl font-extrabold text-green-500">${property.current_rent.toLocaleString()}</span>
                  <span className="text-sm text-muted-foreground">/month</span>
                </div>
              )}
            </div>
          </div>

          {/* Address Header */}
          <div className="mb-6 flex items-start gap-3">
            <div className="rounded-full bg-primary/10 p-2.5">
              <Icon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-card-foreground leading-tight">{property.property_name || property.address}</h3>
              {property.property_name && <p className="text-sm text-muted-foreground">{property.address}</p>}
              <p className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                <MapPin className="h-3 w-3" /> {property.city}, CA {property.zip_code}
              </p>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-muted/50 p-1">
              <TabsTrigger value="details" className="text-xs data-[state=active]:bg-card"><Info className="mr-1.5 h-3 w-3" />Details</TabsTrigger>
              <TabsTrigger value="fmr" className="text-xs data-[state=active]:bg-card"><Calculator className="mr-1.5 h-3 w-3" />FMR</TabsTrigger>
              <TabsTrigger value="units" className="text-xs data-[state=active]:bg-card"><Building2 className="mr-1.5 h-3 w-3" />Units</TabsTrigger>
              <TabsTrigger value="photos" className="text-xs data-[state=active]:bg-card"><ImageIcon className="mr-1.5 h-3 w-3" />Photos</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="mt-6 space-y-8 animate-in fade-in slide-in-from-right-2">
              {/* Core Specs Grid */}
              <div className="grid grid-cols-4 border-y border-border py-4">
                <div className="flex flex-col items-center justify-center border-r border-border">
                  <Bed className="h-4 w-4 text-muted-foreground mb-1.5" />
                  <span className="text-base font-bold text-card-foreground">{property.bedrooms === 0 ? "Studio" : property.bedrooms || "--"}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Beds</span>
                </div>
                <div className="flex flex-col items-center justify-center border-r border-border">
                  <Bath className="h-4 w-4 text-muted-foreground mb-1.5" />
                  <span className="text-base font-bold text-card-foreground">{property.bathrooms || "--"}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Baths</span>
                </div>
                <div className="flex flex-col items-center justify-center border-r border-border">
                  <Square className="h-4 w-4 text-muted-foreground mb-1.5" />
                  <span className="text-base font-bold text-card-foreground">{property.square_feet?.toLocaleString() || "--"}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Sq Ft</span>
                </div>
                <div className="flex flex-col items-center justify-center">
                  <Calendar className="h-4 w-4 text-muted-foreground mb-1.5" />
                  <span className="text-base font-bold text-card-foreground">{property.year_built || "--"}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Built</span>
                </div>
              </div>

              {/* Management Section */}
              <section>
                <h4 className="mb-3 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Management & Contact</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 rounded-lg bg-muted/40 p-4">
                    <User className="h-5 w-5 text-blue-500" />
                    <div className="flex-1">
                      <div className="text-sm font-bold text-card-foreground">{property.management_company || (property.management_type === "private" ? "Private Landlord" : "--")}</div>
                      <div className="text-[10px] font-medium uppercase text-muted-foreground tracking-wide">{property.management_type === "professional" ? "Professionally Managed" : "Owner-Managed"}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-lg bg-muted/40 p-4">
                    <Phone className="h-5 w-5 text-green-500" />
                    <div className="flex-1">
                      <div className="text-sm font-bold text-card-foreground">{property.phone_number || "--"}</div>
                      <div className="text-[10px] font-medium uppercase text-muted-foreground tracking-wide">Primary Contact</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-lg bg-muted/40 p-4">
                    <Globe className="h-5 w-5 text-blue-400" />
                    <div className="flex-1">
                      <div className="text-sm font-bold text-card-foreground">{property.website || "--"}</div>
                      <div className="text-[10px] font-medium uppercase text-muted-foreground tracking-wide">Official Page</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-lg bg-muted/40 p-4">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1">
                      <div className="text-sm font-bold text-card-foreground">{property.office_hours || "--"}</div>
                      <div className="text-[10px] font-medium uppercase text-muted-foreground tracking-wide">Business Hours</div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Pet Policy */}
              <section>
                <h4 className="mb-3 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Pet Policy</h4>
                <div className="flex items-center gap-3 rounded-lg bg-muted/40 p-4">
                  <PawPrint className={`h-5 w-5 ${property.pets_allowed !== false ? "text-green-500" : "text-red-500"}`} />
                  <div className="text-sm font-bold text-card-foreground">{property.pets_allowed !== false ? "Pets Allowed" : "No Pets"}</div>
                </div>
              </section>

              {/* Legal Info */}
              <section>
                <h4 className="mb-3 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Legal Information</h4>
                <div className="rounded-lg bg-muted/40 p-4 space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground font-medium">APN</span>
                    <span className="font-mono font-bold text-card-foreground">{property.apn || "--"}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground font-medium">Census Tract</span>
                    <span className="font-mono font-bold text-card-foreground">{property.census_tract || "--"}</span>
                  </div>
                </div>
              </section>
            </TabsContent>

            {/* FMR Tab */}
            <TabsContent value="fmr" className="mt-4 animate-in fade-in slide-in-from-right-2">
              <FMRCalculatorPanel bedrooms={property.bedrooms || 2} city={property.city} currentRent={property.current_rent} propertyType={property.property_type} />
            </TabsContent>

            {/* Units Tab */}
            <TabsContent value="units" className="mt-4 space-y-3 animate-in fade-in slide-in-from-right-2">
              {units.length > 0 ? units.map(u => (
                <div key={u.id} className="rounded-lg border border-border p-4 bg-muted/20 flex justify-between items-center">
                  <div>
                    <div className="font-bold text-card-foreground text-sm">Unit {u.unit_number}</div>
                    <div className="text-xs text-muted-foreground uppercase font-bold mt-0.5">{u.bedrooms} BR • {u.bathrooms} BA</div>
                  </div>
                  <div className="text-lg font-extrabold text-primary">${u.rent || "--"}</div>
                </div>
              )) : <div className="text-center py-10 text-sm text-muted-foreground">No units listed</div>}
            </TabsContent>

            {/* Photos Tab */}
            <TabsContent value="photos" className="mt-4 animate-in fade-in slide-in-from-right-2">
              {photos.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {photos.map(p => <img key={p.id} src={p.url} className="rounded-lg object-cover h-32 w-full border border-border" loading="lazy" />)}
                </div>
              ) : <div className="text-center py-10 text-sm text-muted-foreground">No photos available</div>}
            </TabsContent>
          </Tabs>

          {/* Watch Notification */}
          {!property.is_available && (
            <div className="mt-8 rounded-xl border border-primary/20 bg-primary/5 p-5">
              <div className="mb-4 flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                <span className="text-sm font-bold text-card-foreground">Watch Property</span>
              </div>
              <div className="flex gap-2">
                <Input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-card" />
                <Button onClick={handleWatch} disabled={isWatching || !email} size="sm" className="font-bold">Watch</Button>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
