"use client"

import { useState, useEffect } from "react"
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

  // If no utilities data, return null (will use defaults)
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
    console.warn("[PropertyDetailPanel] Error parsing utility config:", error)
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

  const fmrData = (() => {
    try {
      const utilityConfig = getUtilityConfig(property)
      // calculateFMR now handles null config gracefully
      return calculateFMR(property.bedrooms || 1, utilityConfig)
    } catch (error) {
      console.warn("[PropertyDetailPanel] FMR calculation failed:", error)
      setFmrError("Unable to calculate FMR")
      // Return safe defaults
      return {
        baseFMR: FMR_2025[property.bedrooms || 1] || 1096,
        utilityAllowance: 0,
        utilityBreakdown: {
          heating: 0,
          cooking: 0,
          airConditioning: 0,
          waterHeater: 0,
          waterSewer: 0,
          trash: 0,
          refrigerator: 0,
          range: 0,
        },
        adjustedFMR: FMR_2025[property.bedrooms || 1] || 1096,
        maxAllowableRent: FMR_2025[property.bedrooms || 1] || 1096,
        overrideApplied: false,
      }
    }
  })()

  // Fetch related data
  useEffect(() => {
    const fetchRelatedData = async () => {
      const supabase = createClient()

      try {
        // Fetch units
        const { data: unitsData } = await supabase
          .from("property_units")
          .select("*")
          .eq("property_id", property.id)
          .order("unit_number")

        if (unitsData) setUnits(unitsData)

        // Fetch photos
        const { data: photosData } = await supabase
          .from("property_photos")
          .select("*")
          .eq("property_id", property.id)
          .order("sort_order")

        if (photosData) setPhotos(photosData)

        // Fetch fees
        const { data: feesData } = await supabase.from("property_fees").select("*").eq("property_id", property.id)

        if (feesData) setFees(feesData)
      } catch (error) {
        console.warn("[PropertyDetailPanel] Error fetching related data:", error)
      }
    }

    fetchRelatedData()
  }, [property.id])

  const handleWatch = async () => {
    if (!email) return

    setIsWatching(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from("watchlist").insert({
        property_id: property.id,
        email: email,
      })

      if (!error) {
        setWatchSuccess(true)
        setTimeout(() => setWatchSuccess(false), 3000)
      }
    } catch (err) {
      console.error("Error adding to watchlist:", err)
    } finally {
      setIsWatching(false)
    }
  }

  // Get amenity labels
  const getAmenityLabel = (amenityId: string) => {
    for (const category of AMENITY_CATEGORIES) {
      const amenity = category.amenities.find((a) => a.id === amenityId)
      if (amenity) return amenity.label
    }
    return amenityId
  }

  // Get fee label
  const getFeeLabel = (feeTypeId: string) => {
    const fee = FEE_TYPES.find((f) => f.id === feeTypeId)
    return fee?.label || feeTypeId
  }

  return (
    <div className="flex h-full w-[420px] flex-col border-l border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-4">
        <h2 className="font-semibold text-card-foreground">Property Details</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4">
          {/* Status & Price */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex flex-wrap gap-1">
              <Badge
                className={
                  property.is_available
                    ? "bg-green-500 text-white hover:bg-green-600"
                    : "bg-muted text-muted-foreground"
                }
              >
                {property.is_available ? "Available Now" : "Currently Occupied"}
              </Badge>
              {property.is_section_8 && (
                <Badge className="bg-purple-500 text-white hover:bg-purple-600">Section 8</Badge>
              )}
              {property.is_seniors_only && <Badge className="bg-blue-500 text-white hover:bg-blue-600">55+</Badge>}
            </div>
            {property.is_available && property.current_rent && (
              <div className="text-right">
                <span className="text-2xl font-bold text-green-500">${property.current_rent.toLocaleString()}</span>
                <span className="text-sm text-muted-foreground">/month</span>
              </div>
            )}
          </div>

          {/* Address */}
          <div className="mb-4">
            <div className="flex items-start gap-2">
              <div className="mt-0.5 rounded-full bg-primary/10 p-2">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                {property.property_name && (
                  <h3 className="font-semibold text-card-foreground">{property.property_name}</h3>
                )}
                <h3
                  className={
                    property.property_name ? "text-sm text-muted-foreground" : "font-semibold text-card-foreground"
                  }
                >
                  {property.address}
                </h3>
                <p className="flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {property.city}, CA {property.zip_code}
                </p>
              </div>
            </div>
          </div>

          {/* Contact Info */}
          {(property.phone_number || property.website || property.office_hours) && (
            <div className="mb-4 flex flex-wrap gap-2">
              {property.phone_number && (
                <a
                  href={`tel:${property.phone_number}`}
                  className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs text-primary hover:bg-primary/20"
                >
                  <Phone className="h-3 w-3" />
                  {property.phone_number}
                </a>
              )}
              {property.website && (
                <a
                  href={property.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs text-primary hover:bg-primary/20"
                >
                  <Globe className="h-3 w-3" />
                  Website
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {property.office_hours && (
                <span className="flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {property.office_hours}
                </span>
              )}
            </div>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="details" className="text-xs">
                <Info className="mr-1 h-3 w-3" />
                Details
              </TabsTrigger>
              <TabsTrigger value="fmr" className="text-xs">
                <Calculator className="mr-1 h-3 w-3" />
                FMR
              </TabsTrigger>
              <TabsTrigger value="units" className="text-xs">
                <Building2 className="mr-1 h-3 w-3" />
                Units
              </TabsTrigger>
              <TabsTrigger value="photos" className="text-xs">
                <ImageIcon className="mr-1 h-3 w-3" />
                Photos
              </TabsTrigger>
            </TabsList>

            {/* Details Tab */}
            <TabsContent value="details" className="mt-4 space-y-4">
              {/* Property Details */}
              <div>
                <h4 className="mb-3 text-sm font-semibold text-card-foreground">Property Details</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-2">
                    <Bed className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">{property.bedrooms || "—"}</div>
                      <div className="text-xs text-muted-foreground">Bedrooms</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-2">
                    <Bath className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">{property.bathrooms || "—"}</div>
                      <div className="text-xs text-muted-foreground">Bathrooms</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-2">
                    <Square className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">{property.square_feet?.toLocaleString() || "—"}</div>
                      <div className="text-xs text-muted-foreground">Sq Ft</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">{property.year_built || "—"}</div>
                      <div className="text-xs text-muted-foreground">Year Built</div>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Management Info */}
              <div>
                <h4 className="mb-3 text-sm font-semibold text-card-foreground">Management</h4>
                <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium capitalize">
                      {property.management_type === "professional"
                        ? property.management_company || "Professional Management"
                        : "Private Landlord"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {property.management_type === "professional"
                        ? "Professionally Managed"
                        : "Owner-Managed Property"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Utilities - with safe access */}
              {property.utilities && (
                <>
                  <Separator />
                  <div>
                    <h4 className="mb-3 text-sm font-semibold text-card-foreground">Utilities</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-2 rounded bg-muted/30 p-2">
                        <Thermometer className="h-3 w-3 text-orange-500" />
                        <span>{property.utilities?.heating?.type || "—"}</span>
                        {property.utilities?.heating?.tenant_pays && (
                          <Badge variant="outline" className="ml-auto text-[10px]">
                            Tenant
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 rounded bg-muted/30 p-2">
                        <ChefHat className="h-3 w-3 text-blue-500" />
                        <span>{property.utilities?.cooking?.type || "—"}</span>
                        {property.utilities?.cooking?.tenant_pays && (
                          <Badge variant="outline" className="ml-auto text-[10px]">
                            Tenant
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 rounded bg-muted/30 p-2">
                        <Wind className="h-3 w-3 text-cyan-500" />
                        <span>{property.utilities?.air_conditioning?.type || "—"}</span>
                      </div>
                      <div className="flex items-center gap-2 rounded bg-muted/30 p-2">
                        <Zap className="h-3 w-3 text-yellow-500" />
                        <span>{property.utilities?.water_heater?.type || "—"}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Pet Policy */}
              <Separator />
              <div>
                <h4 className="mb-3 text-sm font-semibold text-card-foreground">Pet Policy</h4>
                <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3">
                  <PawPrint
                    className={`h-4 w-4 ${property.pets_allowed !== false ? "text-green-500" : "text-red-500"}`}
                  />
                  <div>
                    <div className="text-sm font-medium">
                      {property.pets_allowed !== false ? "Pets Allowed" : "No Pets"}
                    </div>
                    {property.pet_restrictions && (
                      <div className="text-xs text-muted-foreground">{property.pet_restrictions}</div>
                    )}
                    {property.pets_allowed !== false && (property.pet_deposit || property.pet_rent) && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {property.pet_deposit && <span>Deposit: ${property.pet_deposit}</span>}
                        {property.pet_deposit && property.pet_rent && <span> • </span>}
                        {property.pet_rent && <span>Rent: ${property.pet_rent}/mo</span>}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Fees */}
              {fees.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="mb-3 text-sm font-semibold text-card-foreground">Fees</h4>
                    <div className="space-y-2">
                      {fees.map((fee) => (
                        <div key={fee.id} className="flex items-center justify-between rounded bg-muted/30 p-2 text-sm">
                          <span>{getFeeLabel(fee.fee_type_id)}</span>
                          <span className="font-medium">${fee.amount}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Amenities */}
              {property.amenities && property.amenities.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="mb-3 text-sm font-semibold text-card-foreground">Amenities</h4>
                    <div className="flex flex-wrap gap-1">
                      {property.amenities.map((amenityId) => (
                        <Badge key={amenityId} variant="secondary" className="text-xs">
                          {getAmenityLabel(amenityId)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Special Features */}
              {(property.is_post_fire_rebuild || property.is_student_housing) && (
                <>
                  <Separator />
                  <div>
                    <h4 className="mb-3 text-sm font-semibold text-card-foreground">Special Features</h4>
                    <div className="space-y-2">
                      {property.is_post_fire_rebuild && (
                        <div className="flex items-center gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 p-2">
                          <Flame className="h-4 w-4 text-orange-500" />
                          <span className="text-sm text-orange-600">Post-2018 Camp Fire Rebuild</span>
                        </div>
                      )}
                      {property.is_student_housing && (
                        <div className="flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 p-2">
                          <GraduationCap className="h-4 w-4 text-blue-500" />
                          <span className="text-sm text-blue-600">Near CSUC / Student Area</span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* APN Info */}
              <Separator />
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground">Assessor Parcel Number (APN)</div>
                <div className="font-mono text-sm font-medium text-card-foreground">{property.apn}</div>
              </div>
            </TabsContent>

            <TabsContent value="fmr" className="mt-4">
              <FMRCalculatorPanel
                bedrooms={property.bedrooms || 2}
                city={property.city}
                currentRent={property.current_rent}
              />
            </TabsContent>

            {/* Units Tab */}
            <TabsContent value="units" className="mt-4 space-y-4">
              {units.length > 0 ? (
                <div className="space-y-2">
                  {units.map((unit) => (
                    <div key={unit.id} className="rounded-lg border border-border p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Unit {unit.unit_number}</span>
                        <Badge
                          className={
                            unit.status === "available"
                              ? "bg-green-500 text-white"
                              : unit.status === "pending"
                                ? "bg-yellow-500 text-white"
                                : "bg-muted text-muted-foreground"
                          }
                        >
                          {unit.status}
                        </Badge>
                      </div>
                      <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{unit.bedrooms} BR</span>
                        <span>{unit.bathrooms} BA</span>
                        {unit.square_feet && <span>{unit.square_feet} sqft</span>}
                        {unit.rent && <span className="font-medium text-foreground">${unit.rent}/mo</span>}
                      </div>
                      {unit.available_date && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          Available: {new Date(unit.available_date).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  <Building2 className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  <p>No unit details available</p>
                </div>
              )}
            </TabsContent>

            {/* Photos Tab */}
            <TabsContent value="photos" className="mt-4 space-y-4">
              {photos.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {photos.map((photo) => (
                    <div key={photo.id} className="relative overflow-hidden rounded-lg">
                      <img
                        src={photo.url || "/placeholder.svg"}
                        alt={photo.caption || "Property photo"}
                        className="h-32 w-full object-cover"
                      />
                      {photo.caption && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/50 p-1 text-xs text-white">
                          {photo.caption}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  <ImageIcon className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  <p>No photos available</p>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Watch Notification - Only for occupied properties */}
          {!property.is_available && (
            <>
              <Separator className="my-4" />
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Bell className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-card-foreground">Get Notified When Available</span>
                </div>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="flex-1 bg-background"
                  />
                  <Button onClick={handleWatch} disabled={isWatching || !email} size="sm">
                    {isWatching ? "..." : "Watch"}
                  </Button>
                </div>
                {watchSuccess && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-green-500">
                    <CheckCircle2 className="h-3 w-3" />
                    You&apos;ll be notified when this property becomes available!
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
