"use client"

/**
 * PropertyAuditDashboard
 * ----------------------
 * Command center for the property integrity engine. Provides:
 *   - Summary stat cards (total, audited, avg score, flagged, duplicates)
 *   - Status tabs (All / Passed / Flagged / Needs Review / Approved / Duplicate)
 *   - Searchable, paginated table sorted by integrity score (worst first)
 *   - Row selection + bulk self-heal / approve
 *   - Deep-dive modal showing every issue, the integrity breakdown, and
 *     one-click self-heal / approve / mark-duplicate
 *   - "Run Full Audit" trigger and CSV export
 *   - Recent activity feed
 */

import { useCallback, useEffect, useState, useTransition } from "react"
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  Loader2,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import {
  fetchAuditPage,
  runFullAudit,
  selfHealProperty,
  approveProperty,
  markDuplicate,
  bulkSelfHeal,
  bulkApprove,
  exportAuditCsv,
  fetchActivityLog,
  type AuditRow,
  type AuditSummary,
  type ActivityEntry,
  type FetchAuditParams,
} from "@/app/actions/audit-engine"

const TABS: { value: FetchAuditParams["tab"]; label: string }[] = [
  { value: "all", label: "All" },
  { value: "needs_review", label: "Needs Review" },
  { value: "flagged", label: "Flagged" },
  { value: "duplicate", label: "Duplicates" },
  { value: "passed", label: "Passed" },
  { value: "approved", label: "Approved" },
]

const PAGE_SIZE = 25

function scoreColor(score: number | null): string {
  if (score == null) return "text-muted-foreground"
  if (score >= 85) return "text-emerald-600 dark:text-emerald-400"
  if (score >= 50) return "text-amber-600 dark:text-amber-400"
  return "text-red-600 dark:text-red-400"
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    passed: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    approved: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    flagged: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    needs_review: "bg-red-500/10 text-red-600 dark:text-red-400",
    duplicate: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    unaudited: "bg-muted text-muted-foreground",
  }
  return map[status] ?? "bg-muted text-muted-foreground"
}

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`text-3xl font-semibold mt-1 ${accent ?? ""}`}>{value}</p>
    </Card>
  )
}

export function PropertyAuditDashboard() {
  const [tab, setTab] = useState<FetchAuditParams["tab"]>("needs_review")
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [rows, setRows] = useState<AuditRow[]>([])
  const [total, setTotal] = useState(0)
  const [summary, setSummary] = useState<AuditSummary | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [active, setActive] = useState<AuditRow | null>(null)
  const [activity, setActivity] = useState<ActivityEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [auditing, startAudit] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetchAuditPage({ tab, page, pageSize: PAGE_SIZE, search: debouncedSearch })
    setRows(res.rows)
    setTotal(res.total)
    setSummary(res.summary)
    setSelected(new Set())
    setLoading(false)
  }, [tab, page, debouncedSearch])

  const loadActivity = useCallback(async () => {
    const a = await fetchActivityLog(20)
    setActivity(a)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void loadActivity()
  }, [loadActivity])

  // Reset to page 0 when tab or search changes
  useEffect(() => {
    setPage(0)
  }, [tab, debouncedSearch])

  const handleRunAudit = () => {
    startAudit(async () => {
      await runFullAudit()
      await load()
      await loadActivity()
    })
  }

  const handleHeal = async (id: string) => {
    setBusyId(id)
    await selfHealProperty(id)
    await load()
    await loadActivity()
    setBusyId(null)
    setActive(null)
  }

  const handleApprove = async (id: string) => {
    setBusyId(id)
    await approveProperty(id)
    await load()
    await loadActivity()
    setBusyId(null)
    setActive(null)
  }

  const handleMarkDuplicate = async (id: string, canonical: string | null) => {
    setBusyId(id)
    await markDuplicate(id, canonical)
    await load()
    await loadActivity()
    setBusyId(null)
    setActive(null)
  }

  const handleBulkHeal = async () => {
    if (selected.size === 0) return
    setBulkBusy(true)
    await bulkSelfHeal([...selected])
    await load()
    await loadActivity()
    setBulkBusy(false)
  }

  const handleBulkApprove = async () => {
    if (selected.size === 0) return
    setBulkBusy(true)
    await bulkApprove([...selected])
    await load()
    await loadActivity()
    setBulkBusy(false)
  }

  const handleExport = async () => {
    const { filename, csv } = await exportAuditCsv(tab)
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id))
  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-8">
      {/* Action bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button onClick={handleRunAudit} disabled={auditing} className="gap-2">
            {auditing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {auditing ? "Auditing…" : "Run Full Audit"}
          </Button>
          <Button variant="outline" onClick={handleExport} className="gap-2 bg-transparent">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
        <Button variant="ghost" onClick={() => void load()} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard label="Total" value={summary.total} />
          <StatCard label="Audited" value={summary.audited} />
          <StatCard
            label="Avg Score"
            value={summary.averageScore}
            accent={scoreColor(summary.averageScore)}
          />
          <StatCard label="Flagged" value={summary.flagged} accent="text-amber-600 dark:text-amber-400" />
          <StatCard
            label="Needs Review"
            value={summary.needsReview}
            accent="text-red-600 dark:text-red-400"
          />
          <StatCard label="Duplicates" value={summary.duplicates} accent="text-blue-600 dark:text-blue-400" />
        </div>
      )}

      {/* Tabs + search */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as FetchAuditParams["tab"])}>
          <TabsList className="flex-wrap h-auto">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search address, city, ZIP…"
            className="pl-9"
          />
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <Separator orientation="vertical" className="h-5" />
          <Button size="sm" variant="outline" onClick={handleBulkHeal} disabled={bulkBusy} className="gap-2 bg-transparent">
            {bulkBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Self-Heal
          </Button>
          <Button size="sm" variant="outline" onClick={handleBulkApprove} disabled={bulkBusy} className="gap-2 bg-transparent">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Approve
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} className="ml-auto">
            Clear
          </Button>
        </div>
      )}

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30">
              <tr className="text-left text-muted-foreground">
                <th className="w-10 px-4 py-3">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                </th>
                <th className="px-4 py-3 font-medium">Address</th>
                <th className="px-4 py-3 font-medium">City</th>
                <th className="px-4 py-3 font-medium text-right">Score</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Issues</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-muted-foreground">
                    No properties in this category.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-border/60 hover:bg-muted/20 cursor-pointer"
                    onClick={() => setActive(r)}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selected.has(r.id)}
                        onCheckedChange={() => toggleSelect(r.id)}
                        aria-label={`Select ${r.address}`}
                      />
                    </td>
                    <td className="px-4 py-3 font-medium max-w-xs truncate">{r.address ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.city ?? "—"}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${scoreColor(r.integrity_score)}`}>
                      {r.integrity_score ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className={statusBadge(r.audit_status)}>
                        {r.audit_status.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {Array.isArray(r.audit_issues) ? r.audit_issues.length : 0}
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1.5"
                        disabled={busyId === r.id}
                        onClick={() => void handleHeal(r.id)}
                      >
                        {busyId === r.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5" />
                        )}
                        Heal
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <span className="text-sm text-muted-foreground">
              Page {page + 1} of {totalPages} · {total} records
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="bg-transparent"
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="bg-transparent"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Activity feed */}
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Recent Activity
        </h3>
        <Card className="divide-y divide-border/60">
          {activity.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">No audit activity yet.</p>
          ) : (
            activity.map((a) => (
              <div key={a.id} className="flex items-start gap-3 px-4 py-3 text-sm">
                <span className="mt-0.5 text-muted-foreground">
                  {a.action === "self_heal" ? (
                    <Sparkles className="h-4 w-4" />
                  ) : a.action === "approve" ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : a.action === "full_audit" ? (
                    <ShieldCheck className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </span>
                <div className="flex-1">
                  <p>{a.detail ?? a.action}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {a.actor} ·{" "}
                    {new Date(a.created_at).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {a.integrity_before != null && a.integrity_after != null && (
                      <span className="ml-1">
                        ({a.integrity_before} → {a.integrity_after})
                      </span>
                    )}
                  </p>
                </div>
              </div>
            ))
          )}
        </Card>
      </div>

      {/* Deep-dive modal */}
      <Dialog open={Boolean(active)} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {active && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between gap-4 pr-6">
                  <span className="truncate">{active.address ?? "Untitled property"}</span>
                  <span className={`text-2xl font-bold ${scoreColor(active.integrity_score)}`}>
                    {active.integrity_score ?? "—"}
                  </span>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className={statusBadge(active.audit_status)}>
                    {active.audit_status.replace("_", " ")}
                  </Badge>
                  {active.last_audited_at && (
                    <span className="text-xs text-muted-foreground">
                      Last audited {new Date(active.last_audited_at).toLocaleString()}
                    </span>
                  )}
                </div>

                {/* Field grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  <Field label="City" value={active.city} />
                  <Field label="State" value={active.state} />
                  <Field label="ZIP" value={active.zip_code} />
                  <Field label="Price" value={active.price != null ? `$${active.price}` : null} />
                  <Field label="Beds" value={active.bedrooms} />
                  <Field label="Baths" value={active.bathrooms} />
                  <Field label="Sq Ft" value={active.square_feet} />
                  <Field label="Type" value={active.property_type} />
                  <Field
                    label="Coords"
                    value={
                      active.latitude != null && active.longitude != null
                        ? `${Number(active.latitude).toFixed(4)}, ${Number(active.longitude).toFixed(4)}`
                        : null
                    }
                  />
                </div>

                <Separator />

                {/* Issues */}
                <div>
                  <h4 className="text-sm font-semibold mb-2">
                    Issues ({Array.isArray(active.audit_issues) ? active.audit_issues.length : 0})
                  </h4>
                  {Array.isArray(active.audit_issues) && active.audit_issues.length > 0 ? (
                    <ul className="space-y-2">
                      {active.audit_issues.map((issue, i) => (
                        <li key={`${issue.code}-${i}`} className="flex items-start gap-2 text-sm">
                          <AlertTriangle
                            className={`h-4 w-4 mt-0.5 shrink-0 ${
                              issue.severity === "critical"
                                ? "text-red-500"
                                : issue.severity === "warning"
                                  ? "text-amber-500"
                                  : "text-muted-foreground"
                            }`}
                          />
                          <div>
                            <span>{issue.message}</span>
                            <span className="text-xs text-muted-foreground ml-2">−{issue.penalty}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      No issues detected.
                    </p>
                  )}
                </div>

                {active.source_url && (
                  <a
                    href={active.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                  >
                    View source listing
                  </a>
                )}

                <Separator />

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => void handleHeal(active.id)}
                    disabled={busyId === active.id}
                    className="gap-2"
                  >
                    {busyId === active.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Self-Heal
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void handleApprove(active.id)}
                    disabled={busyId === active.id}
                    className="gap-2 bg-transparent"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void handleMarkDuplicate(active.id, active.duplicate_of)}
                    disabled={busyId === active.id}
                    className="gap-2 bg-transparent"
                  >
                    <Copy className="h-4 w-4" />
                    Mark Duplicate
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium truncate">{value != null && value !== "" ? value : "—"}</p>
    </div>
  )
}
