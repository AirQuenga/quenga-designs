"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Save, CheckCircle, AlertCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import {
  PROPERTY_TYPES,
  BEDROOM_COUNTS,
  HEATING_TYPES,
  COOKING_TYPES,
  AC_TYPES,
  WATER_HEATER_TYPES,
  BUTTE_COUNTY_CITIES,
} from "@/config/enums"
import { AMENITY_CATEGORIES } from "@/config/amenities"
import { saveManualProperty } from "@/app/actions/save-manual-property"

interface FormData {
  // Property Info
  census_tract: string
  complex_name: string
  address: string
  city: string
  phone_number: string

  // Unit Details
  bedrooms: number
  bathrooms: number
  rent_amount: string
  available_date: string
  office_hours: string
  management_company: string

  // Features
  amenities: string[]
  pets_allowed: boolean
  pet_restrictions: string
  ada_accessible: boolean
  property_type: string

  // Utilities
  heating: string
  cooking: string
  other_electric: string
  air_conditioning: string
  water_heater: string
  water_included: boolean
  sewer_included: boolean
  trash_included: boolean
  range_microwave: string
  refrigerator: string

  // Financial
  extra_fees: string
  utility_allowance_fees: string

  // Notes
  notes: string
  data_recorder: string
}

const initialFormData: FormData = {
  census_tract: "",
  complex_name: "",
  address: "",
  city: "Chico",
  phone_number: "",
  bedrooms: 1,
  bathrooms: 1,
  rent_amount: "",
  available_date: "",
  office_hours: "",
  management_company: "",
  amenities: [],
  pets_allowed: false,
  pet_restrictions: "",
  ada_accessible: false,
  property_type: "apartment",
  heating: "none",
  cooking: "none",
  other_electric: "",
  air_conditioning: "none",
  water_heater: "none",
  water_included: false,
  sewer_included: false,
  trash_included: false,
  range_microwave: "provided",
  refrigerator: "provided",
  extra_fees: "",
  utility_allowance_fees: "",
  notes: "",
  data_recorder: "",
}

export function ManualEntryForm() {
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [existingComplexes, setExistingComplexes] = useState<string[]>([])
  const [existingManagers, setExistingManagers] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState<{ success: boolean; message: string } | null>(null)

  // Load existing complex names and management companies for dropdowns
  useEffect(() => {
    async function loadExistingData() {
      try {
        const supabase = createClient()

        // Get unique complex names
        const { data: complexData } = await supabase
          .from("properties")
          .select("property_name")
          .not("property_name", "is", null)
          .order("property_name")

        if (complexData) {
          const uniqueComplexes = [...new Set(complexData.map((d: { property_name: string | null }) => d.property_name).filter(Boolean))]
          setExistingComplexes(uniqueComplexes as string[])
        }

        // Get unique management companies
        const { data: managerData } = await supabase
          .from("properties")
          .select("management_company")
          .not("management_company", "is", null)
          .order("management_company")

        if (managerData) {
          const uniqueManagers = [...new Set(managerData.map((d: { management_company: string | null }) => d.management_company).filter(Boolean))]
          setExistingManagers(uniqueManagers as string[])
        }
      } catch (error) {
        console.error("Failed to load existing data:", error)
      }
    }

    loadExistingData()
  }, [])

  const handleChange = (field: keyof FormData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setSubmitResult(null)
  }

  const handleAmenityToggle = (amenityId: string) => {
    setFormData((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(amenityId)
        ? prev.amenities.filter((a) => a !== amenityId)
        : [...prev.amenities, amenityId],
    }))
  }

  const handleSubmit = async () => {
    if (!formData.address || !formData.city) {
      setSubmitResult({ success: false, message: "Address and City are required" })
      return
    }

    setIsSubmitting(true)
    setSubmitResult(null)

    try {
      const result = await saveManualProperty(formData)

      if (result.success) {
        setSubmitResult({ success: true, message: `Property saved successfully! ID: ${result.id}` })
        // Reset form but keep data recorder name
        const dataRecorder = formData.data_recorder
        setFormData({ ...initialFormData, data_recorder: dataRecorder })

        // Refresh complex names list
        if (formData.complex_name && !existingComplexes.includes(formData.complex_name)) {
          setExistingComplexes((prev) => [...prev, formData.complex_name].sort())
        }
        if (formData.management_company && !existingManagers.includes(formData.management_company)) {
          setExistingManagers((prev) => [...prev, formData.management_company].sort())
        }
      } else {
        setSubmitResult({ success: false, message: result.error || "Failed to save property" })
      }
    } catch (error) {
      setSubmitResult({ success: false, message: error instanceof Error ? error.message : "Unknown error" })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <ScrollArea className="h-[calc(100vh-280px)]">
      <div className="space-y-6 pr-4">
        {/* Property Information */}
        <Card>
          <CardHeader>
            <CardTitle>Property Information</CardTitle>
            <CardDescription>Basic property details and location</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="census_tract">Census Tract Number</Label>
                <Input
                  id="census_tract"
                  placeholder="e.g., 0001.00"
                  value={formData.census_tract}
                  onChange={(e) => handleChange("census_tract", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="complex_name">Complex Name</Label>
                <Select
                  value={formData.complex_name}
                  onValueChange={(value) => handleChange("complex_name", value === "__new__" ? "" : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select or type new..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__new__">+ Add New Complex</SelectItem>
                    {existingComplexes.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.complex_name === "" && (
                  <Input
                    placeholder="Enter new complex name..."
                    onChange={(e) => handleChange("complex_name", e.target.value)}
                  />
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address *</Label>
              <Input
                id="address"
                placeholder="123 Main St, Apt 4"
                value={formData.address}
                onChange={(e) => handleChange("address", e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City *</Label>
                <Select value={formData.city} onValueChange={(value) => handleChange("city", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BUTTE_COUNTY_CITIES.map((city) => (
                      <SelectItem key={city} value={city}>
                        {city}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone_number">Phone Number</Label>
                <Input
                  id="phone_number"
                  placeholder="(530) 555-0123"
                  value={formData.phone_number}
                  onChange={(e) => handleChange("phone_number", e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Unit Details */}
        <Card>
          <CardHeader>
            <CardTitle>Unit Details</CardTitle>
            <CardDescription>Bedrooms, bathrooms, rent, and availability</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bedrooms">Bedrooms</Label>
                <Select
                  value={String(formData.bedrooms)}
                  onValueChange={(value) => handleChange("bedrooms", Number.parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BEDROOM_COUNTS.map((br) => (
                      <SelectItem key={br.value} value={String(br.value)}>
                        {br.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bathrooms">Bathrooms</Label>
                <Select
                  value={String(formData.bathrooms)}
                  onValueChange={(value) => handleChange("bathrooms", Number.parseFloat(value))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1</SelectItem>
                    <SelectItem value="1.5">1.5</SelectItem>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="2.5">2.5</SelectItem>
                    <SelectItem value="3">3+</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rent_amount">Rent Amount</Label>
                <Input
                  id="rent_amount"
                  placeholder="$1,500"
                  value={formData.rent_amount}
                  onChange={(e) => handleChange("rent_amount", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="available_date">Available Date</Label>
                <Input
                  id="available_date"
                  type="date"
                  value={formData.available_date}
                  onChange={(e) => handleChange("available_date", e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="property_type">Unit Type</Label>
                <Select value={formData.property_type} onValueChange={(value) => handleChange("property_type", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROPERTY_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="office_hours">Office Hours</Label>
                <Input
                  id="office_hours"
                  placeholder="Mon-Fri 9am-5pm"
                  value={formData.office_hours}
                  onChange={(e) => handleChange("office_hours", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="management_company">Management Company</Label>
              <Select
                value={formData.management_company}
                onValueChange={(value) => handleChange("management_company", value === "__new__" ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select or type new..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__new__">+ Add New Manager</SelectItem>
                  <SelectItem value="private">Private Landlord</SelectItem>
                  {existingManagers.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.management_company === "" && (
                <Input
                  placeholder="Enter new management company..."
                  onChange={(e) => handleChange("management_company", e.target.value)}
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Utility Types */}
        <Card>
          <CardHeader>
            <CardTitle>Utility Types</CardTitle>
            <CardDescription>Heating, cooling, and utility configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Heating</Label>
                <Select value={formData.heating} onValueChange={(value) => handleChange("heating", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None / Paid by Landlord</SelectItem>
                    {HEATING_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cooking</Label>
                <Select value={formData.cooking} onValueChange={(value) => handleChange("cooking", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None / Paid by Landlord</SelectItem>
                    {COOKING_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Air Conditioning</Label>
                <Select
                  value={formData.air_conditioning}
                  onValueChange={(value) => handleChange("air_conditioning", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AC_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Water Heater</Label>
                <Select value={formData.water_heater} onValueChange={(value) => handleChange("water_heater", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None / Paid by Landlord</SelectItem>
                    {WATER_HEATER_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <Label htmlFor="water_included">Water Included</Label>
                <Switch
                  id="water_included"
                  checked={formData.water_included}
                  onCheckedChange={(checked) => handleChange("water_included", checked)}
                />
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <Label htmlFor="sewer_included">Sewer Included</Label>
                <Switch
                  id="sewer_included"
                  checked={formData.sewer_included}
                  onCheckedChange={(checked) => handleChange("sewer_included", checked)}
                />
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <Label htmlFor="trash_included">Trash Included</Label>
                <Switch
                  id="trash_included"
                  checked={formData.trash_included}
                  onCheckedChange={(checked) => handleChange("trash_included", checked)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Range/Microwave</Label>
                <Select
                  value={formData.range_microwave}
                  onValueChange={(value) => handleChange("range_microwave", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="provided">Provided by Landlord</SelectItem>
                    <SelectItem value="tenant">Tenant Provides (+$8)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Refrigerator</Label>
                <Select value={formData.refrigerator} onValueChange={(value) => handleChange("refrigerator", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="provided">Provided by Landlord</SelectItem>
                    <SelectItem value="tenant">Tenant Provides (+$12)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="other_electric">Other Electric ($/month)</Label>
              <Input
                id="other_electric"
                placeholder="e.g., 25"
                value={formData.other_electric}
                onChange={(e) => handleChange("other_electric", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Features & Amenities */}
        <Card>
          <CardHeader>
            <CardTitle>Features & Amenities</CardTitle>
            <CardDescription>Pets, accessibility, and amenities</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <Label htmlFor="pets_allowed">Pets Allowed</Label>
                <Switch
                  id="pets_allowed"
                  checked={formData.pets_allowed}
                  onCheckedChange={(checked) => handleChange("pets_allowed", checked)}
                />
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <Label htmlFor="ada_accessible">ADA Accessible</Label>
                <Switch
                  id="ada_accessible"
                  checked={formData.ada_accessible}
                  onCheckedChange={(checked) => handleChange("ada_accessible", checked)}
                />
              </div>
            </div>

            {formData.pets_allowed && (
              <div className="space-y-2">
                <Label htmlFor="pet_restrictions">Pet Restrictions</Label>
                <Input
                  id="pet_restrictions"
                  placeholder="e.g., No dogs over 25 lbs, $500 deposit"
                  value={formData.pet_restrictions}
                  onChange={(e) => handleChange("pet_restrictions", e.target.value)}
                />
              </div>
            )}

            <Separator />

            <div className="space-y-3">
              <Label>Amenities</Label>
              <div className="grid grid-cols-2 gap-4">
                {AMENITY_CATEGORIES.slice(0, 4).map((category) => (
                  <div key={category.id} className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">{category.label}</p>
                    <div className="space-y-1">
                      {category.amenities.slice(0, 4).map((amenity) => (
                        <div key={amenity.id} className="flex items-center gap-2">
                          <Switch
                            id={amenity.id}
                            checked={formData.amenities.includes(amenity.id)}
                            onCheckedChange={() => handleAmenityToggle(amenity.id)}
                          />
                          <Label htmlFor={amenity.id} className="text-sm font-normal">
                            {amenity.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Financial & Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Financial & Notes</CardTitle>
            <CardDescription>Extra fees, utility allowances, and notes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="extra_fees">Extra Fees</Label>
                <Textarea
                  id="extra_fees"
                  placeholder="e.g., $50 parking, $25 pet rent"
                  value={formData.extra_fees}
                  onChange={(e) => handleChange("extra_fees", e.target.value)}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="utility_allowance_fees">Utility Allowances + Fees</Label>
                <Textarea
                  id="utility_allowance_fees"
                  placeholder="Calculated utility allowance details..."
                  value={formData.utility_allowance_fees}
                  onChange={(e) => handleChange("utility_allowance_fees", e.target.value)}
                  rows={2}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Additional notes about this property..."
                value={formData.notes}
                onChange={(e) => handleChange("notes", e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="data_recorder">Data Recorder</Label>
              <Input
                id="data_recorder"
                placeholder="Your name"
                value={formData.data_recorder}
                onChange={(e) => handleChange("data_recorder", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        {submitResult && (
          <Alert variant={submitResult.success ? "default" : "destructive"}>
            {submitResult.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <AlertDescription>{submitResult.message}</AlertDescription>
          </Alert>
        )}

        <Button onClick={handleSubmit} disabled={isSubmitting} size="lg" className="w-full">
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Property
            </>
          )}
        </Button>
      </div>
    </ScrollArea>
  )
}
