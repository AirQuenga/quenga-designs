"use client"

import { useEffect, useState } from "react"
import {
  getCommunityServiceSubcategories,
  type CommunityService,
} from "@/app/actions/get-community-services"
import { updateCommunityService } from "@/app/actions/update-community-service"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Loader2, Check, AlertCircle, Plus, X } from "lucide-react"

/** The 16 standard categories surfaced as selectable tag-pills. */
const STANDARD_CATEGORIES = [
  "Clothing",
  "Education",
  "Emergency",
  "Employment",
  "Family",
  "Food",
  "Housing",
  "Legal",
  "Medical",
  "Other",
  "Seniors",
  "Shelter",
  "Substance",
  "Transportation",
  "Utilities",
  "Veterans",
]

interface ServiceEditDialogProps {
  service: CommunityService
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called after a successful save so the parent list can refresh. */
  onSaved?: () => void
}

export function ServiceEditDialog({ service, open, onOpenChange, onSaved }: ServiceEditDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [formData, setFormData] = useState({
    address: service.address ?? "",
    phone_number: service.phone_number ?? "",
    website: service.website ?? "",
    hours: service.hours ?? "",
    notes: service.notes ?? "",
    other_contact_info: service.other_contact_info ?? "",
    back_door_contacts: service.back_door_contacts ?? "",
  })

  // Category + multi-subcategory management
  const initialSubcategories = (() => {
    const tags = [...(service.sub_categories ?? [])]
    if (service.sub_category && !tags.includes(service.sub_category)) tags.unshift(service.sub_category)
    return tags.filter(Boolean)
  })()
  const [category, setCategory] = useState(service.category ?? "")
  const [subCategories, setSubCategories] = useState<string[]>(initialSubcategories)
  const [newSubCategory, setNewSubCategory] = useState("")
  const [suggestions, setSuggestions] = useState<string[]>([])

  // Load existing subcategories under this main category as quick-add suggestions.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    getCommunityServiceSubcategories(category || undefined).then((opts) => {
      if (!cancelled) setSuggestions(opts)
    })
    return () => {
      cancelled = true
    }
  }, [open, category])

  const addSubCategory = (raw: string) => {
    const value = raw.trim()
    if (!value) return
    setSubCategories((prev) => (prev.some((s) => s.toLowerCase() === value.toLowerCase()) ? prev : [...prev, value]))
    setNewSubCategory("")
  }

  const removeSubCategory = (value: string) => {
    setSubCategories((prev) => prev.filter((s) => s !== value))
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    setSuccess(false)

    try {
      const result = await updateCommunityService(service.id, {
        address: formData.address || null,
        phone_number: formData.phone_number || null,
        website: formData.website || null,
        hours: formData.hours || null,
        notes: formData.notes || null,
        other_contact_info: formData.other_contact_info || null,
        back_door_contacts: formData.back_door_contacts || null,
        category: category.trim() || null,
        sub_categories: subCategories,
      })

      if (!result.success) {
        setError(result.message)
      } else {
        setSuccess(true)
        onSaved?.()
        setTimeout(() => {
          onOpenChange(false)
          setSuccess(false)
        }, 2000)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  // Subcategories not yet assigned, surfaced as quick-add chips.
  const unusedSuggestions = suggestions.filter(
    (s) => !subCategories.some((c) => c.toLowerCase() === s.toLowerCase()),
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[95vw] overflow-y-auto rounded-xl border-slate-200 bg-white sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Edit Service Information</DialogTitle>
          <DialogDescription>
            Update missing or incorrect information for{" "}
            <span className="font-semibold text-foreground">{service.resource_name}</span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* ---------- CATEGORIZATION ---------- */}
          <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            {/* Main Category as selectable tag-pills */}
            <div className="space-y-2">
              <Label>Main Category</Label>
              <p className="text-xs text-muted-foreground">
                Select the single primary category this resource falls under.
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {STANDARD_CATEGORIES.map((cat) => {
                  const active = category.toLowerCase() === cat.toLowerCase()
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      disabled={loading}
                      aria-pressed={active}
                      className={
                        active
                          ? "rounded-full border border-primary bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-colors"
                          : "rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-primary/40 hover:text-foreground"
                      }
                    >
                      {cat}
                    </button>
                  )
                })}
              </div>
              {!STANDARD_CATEGORIES.some((c) => c.toLowerCase() === category.toLowerCase()) && category && (
                <p className="text-xs text-muted-foreground">
                  Current: <span className="font-medium text-foreground">{category}</span> (custom)
                </p>
              )}
            </div>

            {/* Subcategories — denser management tool */}
            <div className="space-y-1.5 border-t border-slate-200 pt-3">
              <Label className="text-sm">Subcategories</Label>
              <p className="text-xs text-muted-foreground">
                Assign one or more subcategories so this resource can appear under multiple groupings.
              </p>

              {/* Current tags (compact) */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {subCategories.length === 0 ? (
                  <span className="text-xs text-muted-foreground">No subcategories assigned yet.</span>
                ) : (
                  subCategories.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-full bg-slate-200 py-0.5 pl-2.5 pr-1 text-xs font-medium text-slate-700"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeSubCategory(tag)}
                        disabled={loading}
                        aria-label={`Remove ${tag}`}
                        className="inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-slate-300"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))
                )}
              </div>

              {/* Add new tag */}
              <div className="flex gap-2 pt-1.5">
                <Input
                  value={newSubCategory}
                  onChange={(e) => setNewSubCategory(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      addSubCategory(newSubCategory)
                    }
                  }}
                  placeholder="Add a subcategory…"
                  disabled={loading}
                  className="h-8 text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addSubCategory(newSubCategory)}
                  disabled={loading || !newSubCategory.trim()}
                  className="h-8 gap-1 px-2.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </Button>
              </div>

              {/* Suggestions from existing taxonomy */}
              {unusedSuggestions.length > 0 && (
                <div className="pt-1.5">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Existing subcategories
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {unusedSuggestions.slice(0, 16).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => addSubCategory(s)}
                        disabled={loading}
                        className="inline-flex items-center gap-0.5 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-500 transition-colors hover:border-primary/40 hover:text-foreground"
                      >
                        <Plus className="h-2.5 w-2.5" />
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ---------- CONTACT FIELDS (two-column grid) ---------- */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Address */}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                name="address"
                placeholder="123 Main St, Chico, CA 95926"
                value={formData.address}
                onChange={handleChange}
                disabled={loading}
              />
              {!formData.address && (
                <p className="text-xs text-amber-600">Missing: This service has no address on file</p>
              )}
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone_number">Phone Number</Label>
              <Input
                id="phone_number"
                name="phone_number"
                placeholder="(530) 555-0123"
                value={formData.phone_number}
                onChange={handleChange}
                disabled={loading}
              />
              {!formData.phone_number && (
                <p className="text-xs text-amber-600">Missing: No phone number on file</p>
              )}
            </div>

            {/* Website */}
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                name="website"
                placeholder="https://example.org"
                value={formData.website}
                onChange={handleChange}
                disabled={loading}
              />
              {!formData.website && (
                <p className="text-xs text-amber-600">Missing: No website on file</p>
              )}
            </div>

            {/* Hours */}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="hours">Hours of Operation</Label>
              <Input
                id="hours"
                name="hours"
                placeholder="Mon–Fri 9am–5pm"
                value={formData.hours}
                onChange={handleChange}
                disabled={loading}
              />
              {!formData.hours && (
                <p className="text-xs text-amber-600">Missing: No hours on file</p>
              )}
            </div>

            {/* Other Contact */}
            <div className="space-y-2">
              <Label htmlFor="other_contact_info">Other Contact Information</Label>
              <Textarea
                id="other_contact_info"
                name="other_contact_info"
                placeholder="Alternative phone, email, or other ways to reach this service…"
                value={formData.other_contact_info}
                onChange={handleChange}
                disabled={loading}
                rows={2}
              />
            </div>

            {/* Backdoor Contact */}
            <div className="space-y-2">
              <Label htmlFor="back_door_contacts">Backdoor Contact</Label>
              <Textarea
                id="back_door_contacts"
                name="back_door_contacts"
                placeholder="Direct staff email, extension, or internal contact…"
                value={formData.back_door_contacts}
                onChange={handleChange}
                disabled={loading}
                rows={2}
              />
              <p className="text-xs text-muted-foreground">Private direct line for staff use.</p>
            </div>

            {/* Notes */}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                placeholder="Any additional details about this service…"
                value={formData.notes}
                onChange={handleChange}
                disabled={loading}
                rows={3}
              />
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-100">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <p>{error}</p>
              </div>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
              <div className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <p>Service information updated successfully!</p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {success ? "Saved!" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
