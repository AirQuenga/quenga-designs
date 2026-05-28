"use client"

import { useState } from "react"
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Loader2,
  Search,
  Save,
  XCircle,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { applyResourceRepair, type PendingResourceRepair, type ResourceFieldName } from "@/app/actions/resource-hub"

const FIELD_LABELS: Record<ResourceFieldName, string> = {
  address: "Address",
  phone_number: "Phone",
  website: "Website",
  hours: "Hours",
  category: "Category",
}

const FIELD_PLACEHOLDERS: Record<ResourceFieldName, string> = {
  address: "123 Main St, Chico, CA 95926",
  phone_number: "(530) 555-0123",
  website: "https://example.org",
  hours: "Mon–Fri 9am–5pm",
  category: "Food Assistance",
}

interface ConsolidatedResourceRepairProps {
  repairs: PendingResourceRepair[]
  /** Externally controlled id of repair to expand & focus (e.g. from log click) */
  focusResourceId?: string | null
  onSaved?: (resourceId: string, message: string) => void
  onError?: (resourceId: string, message: string) => void
  onDismissed?: (resourceId: string, message: string) => void
}

type RowStatus = "WARN" | "PENDING" | "FIXED"

export function ConsolidatedResourceRepair({
  repairs,
  focusResourceId,
  onSaved,
  onError,
  onDismissed,
}: ConsolidatedResourceRepairProps) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, Partial<Record<ResourceFieldName, string>>>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [statuses, setStatuses] = useState<Record<string, RowStatus>>({})

  // External focus → auto-expand
  if (focusResourceId && openId !== focusResourceId) {
    setOpenId(focusResourceId)
  }

  const setField = (resourceId: string, field: ResourceFieldName, value: string) => {
    setEdits((prev) => ({
      ...prev,
      [resourceId]: { ...prev[resourceId], [field]: value },
    }))
  }

  const handleSave = async (repair: PendingResourceRepair) => {
    const resourceId = repair.resourceId
    const values = edits[resourceId] || {}
    const filled = Object.entries(values).filter(
      ([, v]) => typeof v === "string" && v.trim().length > 0,
    )
    if (filled.length === 0) {
      onError?.(resourceId, `No fields filled for "${repair.resourceName}"`)
      return
    }
    setSavingId(resourceId)
    setStatuses((prev) => ({ ...prev, [resourceId]: "PENDING" }))

    const result = await applyResourceRepair(
      resourceId,
      Object.fromEntries(filled) as Partial<Record<ResourceFieldName, string>>,
    )

    setSavingId(null)
    if (result.success) {
      setStatuses((prev) => ({ ...prev, [resourceId]: "FIXED" }))
      onSaved?.(
        resourceId,
        `Saved ${filled.map(([f]) => f).join(", ")} for "${repair.resourceName}"`,
      )
    } else {
      setStatuses((prev) => ({ ...prev, [resourceId]: "WARN" }))
      onError?.(resourceId, `Save failed for "${repair.resourceName}": ${result.message}`)
    }
  }

  const handleDismiss = (repair: PendingResourceRepair) => {
    setStatuses((prev) => ({ ...prev, [repair.resourceId]: "FIXED" }))
    onDismissed?.(repair.resourceId, `Dismissed "${repair.resourceName}"`)
  }

  if (repairs.length === 0) return null

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Resource Repair Console</h3>
          <p className="text-xs text-slate-500">
            {repairs.length} resource{repairs.length === 1 ? "" : "s"} need attention. Use the search
            link to find correct values, then fill in manually.
          </p>
        </div>
        <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200">
          {repairs.filter((r) => statuses[r.resourceId] !== "FIXED").length} pending
        </Badge>
      </div>

      <ul className="divide-y divide-slate-200">
        {repairs.map((repair) => {
          const isOpen = openId === repair.resourceId
          const status: RowStatus = statuses[repair.resourceId] ?? "WARN"
          const isFixed = status === "FIXED"
          const isPending = status === "PENDING"
          const filledCount = Object.values(edits[repair.resourceId] || {}).filter(
            (v) => typeof v === "string" && v.trim().length > 0,
          ).length

          return (
            <li key={repair.resourceId} id={`repair-${repair.resourceId}`} className={isFixed ? "opacity-60" : ""}>
              {/* Header row */}
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : repair.resourceId)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                aria-expanded={isOpen}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 flex-shrink-0 text-slate-500" />
                  ) : (
                    <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-500" />
                  )}

                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm font-medium text-slate-900">
                      {repair.resourceName}
                    </span>
                    <span className="truncate text-xs text-slate-500">
                      {repair.category || "Uncategorized"} ·{" "}
                      {repair.missingFields.length} missing field
                      {repair.missingFields.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  <div className="hidden flex-shrink-0 items-center gap-1.5 sm:flex">
                    {repair.missingFields.map((f) => (
                      <Badge
                        key={f}
                        variant="outline"
                        className="border-rose-200 bg-rose-50 text-[10px] font-medium text-rose-700"
                      >
                        {FIELD_LABELS[f]}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex flex-shrink-0 items-center gap-2">
                  {isFixed && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Fixed
                    </span>
                  )}
                  {isPending && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Saving
                    </span>
                  )}
                  {!isFixed && !isPending && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-600">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Needs repair
                    </span>
                  )}
                </div>
              </button>

              {/* Expanded panel */}
              {isOpen && !isFixed && (
                <div className="border-t border-slate-200 bg-slate-50/60 px-4 py-4">
                  {/* Search-results helper */}
                  <div className="mb-4 flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Search className="h-3.5 w-3.5 text-slate-500" />
                        <span className="text-xs font-medium text-slate-700">
                          Web search results for &ldquo;{repair.resourceName}&rdquo;
                        </span>
                      </div>
                      <a
                        href={repair.searchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 underline-offset-2 hover:underline"
                      >
                        Open full search
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>

                    {repair.searchResults.length === 0 ? (
                      <p className="text-xs italic text-slate-500">
                        No raw snippets captured. Use &ldquo;Open full search&rdquo; to verify manually.
                      </p>
                    ) : (
                      <ul className="flex flex-col gap-2">
                        {repair.searchResults.slice(0, 5).map((r, i) => (
                          <li
                            key={i}
                            className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2"
                          >
                            <a
                              href={r.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block truncate text-xs font-semibold text-slate-900 hover:underline"
                            >
                              {r.title}
                            </a>
                            <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-600">
                              {r.snippet}
                            </p>
                            <span className="mt-0.5 block truncate text-[10px] text-slate-400">
                              {r.url}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Grouped manual inputs */}
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {repair.missingFields.map((field) => {
                      const current = repair.currentValues[field]
                      const reason = repair.reasons[field]
                      const editedValue = edits[repair.resourceId]?.[field] ?? ""

                      return (
                        <div key={field} className="flex flex-col gap-1">
                          <div className="flex items-center justify-between">
                            <label
                              htmlFor={`${repair.resourceId}-${field}`}
                              className="text-xs font-medium text-slate-700"
                            >
                              {FIELD_LABELS[field]}
                            </label>
                            {reason && (
                              <span className="text-[10px] uppercase tracking-wider text-rose-600">
                                {reason}
                              </span>
                            )}
                          </div>
                          {current && current !== "" && (
                            <span className="text-[10px] text-slate-500">
                              Current:{" "}
                              <span className="font-mono text-slate-700">{current}</span>
                            </span>
                          )}
                          <Input
                            id={`${repair.resourceId}-${field}`}
                            value={editedValue}
                            onChange={(e) => setField(repair.resourceId, field, e.target.value)}
                            placeholder={FIELD_PLACEHOLDERS[field]}
                            className="h-8 bg-white text-sm"
                            autoComplete="off"
                          />
                        </div>
                      )
                    })}
                  </div>

                  {/* Actions */}
                  <div className="mt-4 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-500">
                      {filledCount} of {repair.missingFields.length} fields filled
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDismiss(repair)}
                        className="h-8 text-xs"
                      >
                        <XCircle className="mr-1 h-3.5 w-3.5" />
                        Dismiss
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleSave(repair)}
                        disabled={filledCount === 0 || savingId === repair.resourceId}
                        className="h-8 bg-slate-900 text-xs text-white hover:bg-slate-800"
                      >
                        {savingId === repair.resourceId ? (
                          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Save className="mr-1 h-3.5 w-3.5" />
                        )}
                        Save & Update
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
