"use client"

import { useMemo, useState } from "react"
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Hourglass,
  Loader2,
  Sparkles,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  applyResourceFix,
  type PendingResourceFix,
  type ResourceFieldName,
} from "@/app/actions/resource-hub"

export interface RepairRowState extends PendingResourceFix {
  manualValue?: string
  saving?: boolean
}

interface ResourceRepairTableProps {
  fixes: PendingResourceFix[]
  onFixApplied: (id: string, message: string) => void
  onFixDenied: (id: string, message: string) => void
  onFixError: (id: string, message: string) => void
}

const FIELD_LABELS: Record<ResourceFieldName, string> = {
  address: "Address",
  phone_number: "Phone",
  website: "Website",
  hours: "Hours",
  category: "Category",
}

function StatusBadge({ status }: { status: RepairRowState["status"] }) {
  if (status === "FIXED") {
    return (
      <Badge variant="outline" className="gap-1 border-emerald-300 bg-emerald-50 text-emerald-700">
        <Check className="h-3 w-3" /> FIXED
      </Badge>
    )
  }
  if (status === "PENDING") {
    return (
      <Badge variant="outline" className="gap-1 border-amber-300 bg-amber-50 text-amber-700">
        <Hourglass className="h-3 w-3" /> PENDING APPROVAL
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="gap-1 border-rose-300 bg-rose-50 text-rose-700">
      <AlertTriangle className="h-3 w-3" /> WARN
    </Badge>
  )
}

function ConfidencePill({ confidence }: { confidence: number }) {
  const color =
    confidence >= 71
      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
      : confidence >= 31
        ? "border-amber-300 bg-amber-50 text-amber-700"
        : "border-slate-300 bg-slate-50 text-slate-600"
  const label = confidence >= 71 ? "High" : confidence >= 31 ? "Plausible" : "Manual"
  return (
    <Badge variant="outline" className={`gap-1 ${color}`}>
      <Sparkles className="h-3 w-3" /> {label} {confidence}%
    </Badge>
  )
}

export function ResourceRepairTable({
  fixes,
  onFixApplied,
  onFixDenied,
  onFixError,
}: ResourceRepairTableProps) {
  const [rows, setRows] = useState<RepairRowState[]>(() => fixes.map((f) => ({ ...f })))
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // Sync if parent fixes change
  useMemo(() => {
    setRows((prev) => {
      const map = new Map(prev.map((r) => [r.id, r]))
      return fixes.map((f) => ({ ...f, ...(map.get(f.id) ?? {}) }))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixes.length])

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const updateRow = (id: string, patch: Partial<RepairRowState>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  const apply = async (row: RepairRowState, value: string | null) => {
    if (row.saving) return
    updateRow(row.id, { saving: true, status: "PENDING" })
    try {
      const result = await applyResourceFix(row.resourceId, row.field, value)
      if (result.success) {
        updateRow(row.id, { saving: false, status: "FIXED" })
        onFixApplied(
          row.id,
          `Fixed: "${row.resourceName}" → ${FIELD_LABELS[row.field]} = "${value ?? "(cleared)"}"`,
        )
      } else {
        updateRow(row.id, { saving: false, status: "WARN" })
        onFixError(row.id, `Failed: ${row.resourceName} → ${row.field}: ${result.message}`)
      }
    } catch (e) {
      updateRow(row.id, { saving: false, status: "WARN" })
      onFixError(
        row.id,
        `Failed: ${row.resourceName} → ${row.field}: ${e instanceof Error ? e.message : "unknown"}`,
      )
    }
  }

  const deny = (row: RepairRowState) => {
    updateRow(row.id, { status: "FIXED" }) // dismiss row
    onFixDenied(row.id, `Dismissed: "${row.resourceName}" → ${FIELD_LABELS[row.field]}`)
  }

  const visibleRows = rows.filter((r) => r.status !== "FIXED")
  const fixedCount = rows.length - visibleRows.length

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
        No pending fixes. Run the audit to detect missing or invalid resource fields.
      </div>
    )
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-900/5">
            <AlertTriangle className="h-3.5 w-3.5 text-slate-700" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Active Repair Console</h3>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">
              {visibleRows.length} pending · {fixedCount} resolved
            </p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-left text-[10px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="w-6 px-2 py-2"></th>
              <th className="px-2 py-2 font-medium">Resource</th>
              <th className="px-2 py-2 font-medium">Field</th>
              <th className="px-2 py-2 font-medium">Original</th>
              <th className="px-2 py-2 font-medium">AI Suggestion</th>
              <th className="px-2 py-2 font-medium">Status</th>
              <th className="px-2 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleRows.map((row) => {
              const isOpen = expanded.has(row.id)
              const manual = row.manualValue ?? ""
              return (
                <>
                  <tr key={row.id} className="bg-white align-top hover:bg-slate-50">
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        onClick={() => toggleExpand(row.id)}
                        className="text-slate-400 hover:text-slate-700"
                        aria-label={isOpen ? "Collapse" : "Expand"}
                      >
                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                    </td>
                    <td className="px-2 py-2 font-medium text-slate-900">{row.resourceName}</td>
                    <td className="px-2 py-2 text-slate-700">{FIELD_LABELS[row.field]}</td>
                    <td className="px-2 py-2 text-rose-700">
                      <span className="font-mono text-[11px]">
                        {row.originalValue ?? <em className="text-slate-400">null</em>}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      {row.suggestedValue ? (
                        <div className="flex flex-col gap-1">
                          <span className="font-mono text-[11px] text-slate-900">
                            {row.suggestedValue}
                          </span>
                          <ConfidencePill confidence={row.confidence} />
                        </div>
                      ) : (
                        <Badge variant="outline" className="border-slate-300 bg-slate-50 text-slate-600">
                          Manual intervention required
                        </Badge>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex justify-end gap-1">
                        {row.suggestedValue && (
                          <Button
                            size="sm"
                            onClick={() => apply(row, row.suggestedValue)}
                            disabled={row.saving}
                            className="h-7 gap-1 bg-emerald-600 px-2 text-[11px] hover:bg-emerald-700"
                          >
                            {row.saving ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Check className="h-3 w-3" />
                            )}
                            Apply
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deny(row)}
                          disabled={row.saving}
                          className="h-7 gap-1 bg-white px-2 text-[11px]"
                        >
                          <X className="h-3 w-3" /> Deny
                        </Button>
                      </div>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-slate-50/60">
                      <td></td>
                      <td colSpan={6} className="px-2 py-3">
                        <div className="space-y-2 rounded-md border border-slate-200 bg-white p-3">
                          <p className="text-[11px] text-slate-500">
                            <span className="font-semibold text-slate-700">Reason:</span> {row.reason}
                          </p>
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <label className="text-[11px] font-medium text-slate-700 sm:w-32">
                              Manual override:
                            </label>
                            <Input
                              value={manual}
                              onChange={(e) => updateRow(row.id, { manualValue: e.target.value })}
                              placeholder={`Type custom ${FIELD_LABELS[row.field].toLowerCase()}…`}
                              className="h-8 flex-1 border-slate-300 bg-white text-xs text-slate-900"
                              disabled={row.saving}
                            />
                            <Button
                              size="sm"
                              onClick={() => apply(row, manual.trim() || null)}
                              disabled={row.saving || manual.trim().length === 0}
                              className="h-8 gap-1 bg-slate-900 px-3 text-[11px] hover:bg-slate-800"
                            >
                              {row.saving ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Check className="h-3 w-3" />
                              )}
                              Save & Update
                            </Button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-xs text-slate-500">
                  All warnings resolved. {fixedCount} fixes applied.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
