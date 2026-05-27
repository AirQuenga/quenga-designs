"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Check, X, Pencil, CheckCheck, Loader2 } from "lucide-react"
import type { PendingFix } from "@/app/actions/audit-staging"

interface AuditReviewTableProps {
  fixes: PendingFix[]
  onApprove: (fix: PendingFix) => Promise<void>
  onApproveWithEdit: (fix: PendingFix, editedValue: string | number) => Promise<void>
  onDeny: (fix: PendingFix) => void
  onApproveAll: () => Promise<void>
  isApproving?: boolean
}

const CONFIDENCE_STYLES: Record<string, string> = {
  high: "bg-emerald-50 text-emerald-800 border-emerald-200",
  medium: "bg-amber-50 text-amber-800 border-amber-200",
  low: "bg-rose-50 text-rose-800 border-rose-200",
}

const SOURCE_LABELS: Record<string, string> = {
  "typo-repair": "Typo Fix",
  "web-search": "Web Search",
  backfill: "Backfill",
}

export function AuditReviewTable({
  fixes,
  onApprove,
  onApproveWithEdit,
  onDeny,
  onApproveAll,
  isApproving = false,
}: AuditReviewTableProps) {
  const [editingFix, setEditingFix] = useState<PendingFix | null>(null)
  const [editValue, setEditValue] = useState("")
  const [processingId, setProcessingId] = useState<string | null>(null)

  const handleEdit = (fix: PendingFix) => {
    setEditingFix(fix)
    setEditValue(String(fix.proposedValue ?? ""))
  }

  const handleSaveEdit = async () => {
    if (!editingFix) return
    setProcessingId(editingFix.id)
    await onApproveWithEdit(editingFix, editValue)
    setEditingFix(null)
    setEditValue("")
    setProcessingId(null)
  }

  const handleApprove = async (fix: PendingFix) => {
    setProcessingId(fix.id)
    await onApprove(fix)
    setProcessingId(null)
  }

  if (fixes.length === 0) {
    return (
      <div className="flex h-32 flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500">
        <p className="text-sm">No pending fixes</p>
        <p className="text-xs text-slate-400">Run an audit to discover fixes</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header with Approve All */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium text-slate-700">
          {fixes.length} pending fix{fixes.length !== 1 ? "es" : ""} awaiting review
        </p>
        <Button
          size="sm"
          onClick={onApproveAll}
          disabled={isApproving}
          className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
        >
          {isApproving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckCheck className="h-3.5 w-3.5" />
          )}
          Approve All ({fixes.length})
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Property
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Field
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Original
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Proposed
                </th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Confidence
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {fixes.map((fix) => {
                const isProcessing = processingId === fix.id
                return (
                  <tr key={fix.id} className="hover:bg-slate-50/50">
                    <td className="px-3 py-2.5">
                      <div className="max-w-[180px] truncate font-medium text-slate-900" title={fix.address}>
                        {fix.address}
                      </div>
                      <div className="text-[10px] text-slate-400">{SOURCE_LABELS[fix.source]}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">
                        {fix.field}
                      </code>
                    </td>
                    <td className="px-3 py-2.5 text-slate-500">
                      {fix.originalValue === null ? (
                        <span className="italic text-slate-400">null</span>
                      ) : (
                        <span className="max-w-[120px] truncate">{String(fix.originalValue)}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-medium text-slate-900">
                        {fix.proposedValue === null ? (
                          <span className="italic text-slate-400">null</span>
                        ) : (
                          String(fix.proposedValue)
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-semibold ${CONFIDENCE_STYLES[fix.confidence]}`}
                      >
                        {fix.confidence}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleApprove(fix)}
                          disabled={isProcessing}
                          className="h-7 w-7 p-0 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                          title="Approve"
                        >
                          {isProcessing ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(fix)}
                          disabled={isProcessing}
                          className="h-7 w-7 p-0 text-slate-600 hover:bg-slate-100 hover:text-slate-700"
                          title="Edit before approving"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onDeny(fix)}
                          disabled={isProcessing}
                          className="h-7 w-7 p-0 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                          title="Deny"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      <Dialog open={!!editingFix} onOpenChange={(open) => !open && setEditingFix(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Proposed Value</DialogTitle>
            <DialogDescription>
              Modify the value before applying it to{" "}
              <span className="font-medium text-slate-900">{editingFix?.address}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Field</label>
              <code className="rounded bg-slate-100 px-2 py-1 text-sm text-slate-700">
                {editingFix?.field}
              </code>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Original Value</label>
              <p className="text-sm text-slate-500">
                {editingFix?.originalValue === null ? (
                  <span className="italic">null</span>
                ) : (
                  String(editingFix?.originalValue)
                )}
              </p>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">New Value</label>
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder="Enter new value"
                className="text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingFix(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={!editValue.trim()}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Apply Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
