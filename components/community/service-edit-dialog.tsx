"use client"

import { useState } from "react"
import { type CommunityService } from "@/app/actions/get-community-services"
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
import { Loader2, Check, AlertCircle } from "lucide-react"

interface ServiceEditDialogProps {
  service: CommunityService
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ServiceEditDialog({ service, open, onOpenChange }: ServiceEditDialogProps) {
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
  })

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
      })

      if (!result.success) {
        setError(result.message)
      } else {
        setSuccess(true)
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Service Information</DialogTitle>
          <DialogDescription>
            Update missing or incorrect information for{" "}
            <span className="font-semibold text-foreground">{service.resource_name}</span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Address */}
          <div className="space-y-2">
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
              <p className="text-xs text-amber-600">Missing: This service has no phone number on file</p>
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
              <p className="text-xs text-amber-600">Missing: This service has no website on file</p>
            )}
          </div>

          {/* Hours */}
          <div className="space-y-2">
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
              <p className="text-xs text-amber-600">Missing: This service has no hours on file</p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
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
