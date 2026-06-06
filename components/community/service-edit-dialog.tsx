"use client"

import { useEffect, useState, useMemo } from "react"
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
import { Loader2, Check, AlertCircle, Plus, X, Search } from "lucide-react"

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
  onSaved?: () => void
}

export function ServiceEditDialog({ service, open, onOpenChange, onSaved }: ServiceEditDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Resource name (editable)
  const [resourceName, setResourceName] = useState(service.resource_name ?? "")

  const [formData, setFormData] = useState({
    address: service.address ?? "",
    phone_number: service.phone_number ?? "",
    website: service.website ?? "",
    hours: service.hours ?? "",
    notes: service.notes ?? "",
    other_contact_info: service.other_contact_info ?? "",
    back_door_contacts: service.back_door_contacts ?? "",
  })

  // Category (single select) + Subcategories (multi-select)
  const [category, setCategory] = useState(service.category ?? "")
  const initialSubcategories = useMemo(() => {
    const tags = [...(service.sub_categories ?? [])]
    if (service.sub_category && !tags.includes(service.sub_category)) tags.unshift(service.sub_category)
    return tags.filter(Boolean)
  }, [service.sub_categories, service.sub_category])
  const [subCategories, setSubCategories] = useState<string[]>(initialSubcategories)

  // Search filters for the tag pickers
  const [categorySearch, setCategorySearch] = useState("")
  const [subCategorySearch, setSubCategorySearch] = useState("")
  const [newSubCategory, setNewSubCategory] = useState("")

  // Existing subcategories from the taxonomy
  const [suggestions, setSuggestions] = useState<string[]>([])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    getCommunityServiceSubcategories(category || undefined).then((opts) => {
      if (!cancelled) setSuggestions(opts)
    })
    return () => { cancelled = true }
  }, [open, category])

  // Filtered categories based on search
  const filteredCategories = useMemo(() => {
    if (!categorySearch.trim()) return STANDARD_CATEGORIES
    const q = categorySearch.toLowerCase()
    return STANDARD_CATEGORIES.filter((c) => c.toLowerCase().includes(q))
  }, [categorySearch])

  // Filtered subcategory suggestions based on search
  const filteredSubcategories = useMemo(() => {
    const available = suggestions.filter((s) => !subCategories.some((sc) => sc.toLowerCase() === s.toLowerCase()))
    if (!subCategorySearch.trim()) return available
    const q = subCategorySearch.toLowerCase()
    return available.filter((s) => s.toLowerCase().includes(q))
  }, [suggestions, subCategories, subCategorySearch])

  const addSubCategory = (raw: string) => {
    const value = raw.trim()
    if (!value) return
    setSubCategories((prev) => (prev.some((s) => s.toLowerCase() === value.toLowerCase()) ? prev : [...prev, value]))
    setNewSubCategory("")
    setSubCategorySearch("")
  }

  const removeSubCategory = (value: string) => {
    setSubCategories((prev) => prev.filter((s) => s !== value))
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    setSuccess(false)

    try {
      const result = await updateCommunityService(service.id, {
        resource_name: resourceName.trim() || null,
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
        }, 1500)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[800px] max-w-[95vw] overflow-y-auto rounded-xl border-slate-200 bg-white">
        <DialogHeader>
          <DialogTitle>Edit Service Information</DialogTitle>
          <DialogDescription>
            Update details for this community resource.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* ---------- RESOURCE NAME (top) ---------- */}
          <div className="space-y-2">
            <Label htmlFor="resource_name" className="text-sm font-semibold">Resource Name</Label>
            <Input
              id="resource_name"
              value={resourceName}
              onChange={(e) => setResourceName(e.target.value)}
              placeholder="Enter resource name…"
              disabled={loading}
              className="text-base font-medium"
            />
          </div>

          {/* ---------- CATEGORIZATION ---------- */}
          <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            {/* Main Category (single-select tag-pills with search) */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Main Category</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                  placeholder="Search categories…"
                  disabled={loading}
                  className="h-9 pl-9 text-sm"
                />
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {filteredCategories.map((cat) => {
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
                {filteredCategories.length === 0 && (
                  <span className="text-xs text-muted-foreground">No categories match your search.</span>
                )}
              </div>
              {!STANDARD_CATEGORIES.some((c) => c.toLowerCase() === category.toLowerCase()) && category && (
                <p className="text-xs text-muted-foreground">
                  Current: <span className="font-medium text-foreground">{category}</span> (custom)
                </p>
              )}
            </div>

            {/* Subcategories (multi-select tag-pills with search + add) */}
            <div className="space-y-2 border-t border-slate-200 pt-3">
              <Label className="text-sm font-semibold">Subcategories</Label>
              <p className="text-xs text-muted-foreground">
                Click to toggle subcategories. Add new ones below.
              </p>

              {/* Current assigned subcategories */}
              {subCategories.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {subCategories.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-full border border-primary bg-primary/10 py-0.5 pl-2.5 pr-1 text-xs font-medium text-primary"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeSubCategory(tag)}
                        disabled={loading}
                        aria-label={`Remove ${tag}`}
                        className="inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-primary/20"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Search existing subcategories */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={subCategorySearch}
                  onChange={(e) => setSubCategorySearch(e.target.value)}
                  placeholder="Search existing subcategories…"
                  disabled={loading}
                  className="h-9 pl-9 text-sm"
                />
              </div>

              {/* Available subcategories to toggle */}
              {filteredSubcategories.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {filteredSubcategories.slice(0, 20).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => addSubCategory(s)}
                      disabled={loading}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-primary/40 hover:text-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {/* Add new subcategory */}
              <div className="flex gap-2 pt-1">
                <Input
                  value={newSubCategory}
                  onChange={(e) => setNewSubCategory(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      addSubCategory(newSubCategory)
                    }
                  }}
                  placeholder="Add a new subcategory…"
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
            </div>
          </div>

          {/* ---------- CONTACT FIELDS (two-column grid) ---------- */}
          <div className="grid gap-4 sm:grid-cols-2">
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

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <p>{error}</p>
              </div>
            </div>
          )}

          {success && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
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
