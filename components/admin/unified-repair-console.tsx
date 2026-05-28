"use client"

/**
 * UnifiedRepairConsole
 * --------------------
 * Shared "Active Repair Console" used by both the Property Data Hub and the
 * Resource Data Hub. It provides:
 *
 *   1. Tri-State tabs:  [Needs Fix] · [Pending Review] · [Fixed]
 *      A row "moves" between tabs based on its local status.
 *   2. One dropdown per record (regardless of how many fields are missing).
 *   3. Per-field search button that opens a focused web search in a new tab.
 *   4. Pre-filled values surfaced as a one-click "Use" suggestion.
 *   5. Auto-Validate button — if every filled field passes format validation,
 *      the row promotes itself to "Fixed" with no further clicks.
 *   6. Bulk Approve — promote every selected row in one shot.
 *   7. Lazy-rendered list (windowed with IntersectionObserver) so thousands of
 *      records can sit in this console without freezing the browser.
 */

import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Loader2,
  Search,
  Save,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"

/* -------------------------------------------------------------------------- */
/*  Public types                                                              */
/* -------------------------------------------------------------------------- */

export type RepairStatus = "WARN" | "PENDING" | "FIXED"

export interface RepairFieldDescriptor<F extends string = string> {
  /** Stable identifier — must match the property/column name on the backend. */
  field: F
  /** Human label shown in the UI. */
  label: string
  /** Placeholder for the input. */
  placeholder?: string
  /** Optional reason chip (e.g. "MISSING", "INVALID FORMAT"). */
  reason?: string
  /** Existing (current) value already on the record, if any. */
  currentValue?: string | null
  /** Pre-filled candidate scraped from the audit results, if any. */
  prefilled?: string | null
}

export interface RepairItem<F extends string = string> {
  /** Unique id (e.g. property id or resource id). */
  id: string
  /** Display title (e.g. property address or resource name). */
  title: string
  /** Secondary line (e.g. category, city). */
  subtitle?: string | null
  /** Fields that need attention. One dropdown groups them all. */
  fields: RepairFieldDescriptor<F>[]
  /** Convenience: pre-built search URL for the whole record. */
  searchUrl?: string
  /** Free-form snippets surfaced under the dropdown. */
  snippets?: { title: string; url: string; snippet: string }[]
  /** Server-marked status when the row was first emitted. Defaults to WARN. */
  initialStatus?: RepairStatus
}

export interface UnifiedRepairConsoleProps<F extends string = string> {
  /** Visible heading in the console header. */
  title: string
  /** Subheading. */
  description?: string
  /** Items to manage. */
  items: RepairItem<F>[]
  /** Persist a single row. Receive only fields the user actually filled. */
  onSave: (id: string, values: Partial<Record<F, string>>) => Promise<{ success: boolean; message: string }>
  /** Persist many rows at once. Defaults to a sequential `onSave` loop if omitted. */
  onBulkSave?: (
    payload: { id: string; values: Partial<Record<F, string>> }[],
  ) => Promise<{ succeeded: string[]; failed: { id: string; message: string }[] }>
  /** Validate filled values for a single row. Defaults to the local validator below. */
  validate?: (values: Partial<Record<F, string>>) => { valid: boolean; failures: F[] }
  /** Build a per-field search URL (defaults to DuckDuckGo). */
  buildFieldSearchUrl?: (item: RepairItem<F>, field: F) => string
  /** Optional log callback so the parent's LiveLog stays in sync. */
  onLog?: (level: "INFO" | "WARN" | "FIXED" | "ERROR", message: string) => void
}

/* -------------------------------------------------------------------------- */
/*  Default validators (mirror server-side rules)                             */
/* -------------------------------------------------------------------------- */

function defaultValidate<F extends string>(
  values: Partial<Record<F, string>>,
): { valid: boolean; failures: F[] } {
  const failures: F[] = []
  for (const [key, raw] of Object.entries(values) as [F, string | undefined][]) {
    if (typeof raw !== "string" || raw.trim().length === 0) continue
    const v = raw.trim()
    const k = String(key)
    let ok = true
    if (k === "phone_number" || k === "phone") {
      const digits = v.replace(/[^\d]/g, "")
      ok = digits.length === 10 || (digits.length === 11 && digits.startsWith("1"))
    } else if (k === "website" || k === "url") {
      ok = /^https?:\/\/.+\..+/.test(v)
    } else if (k === "address") {
      ok = /\d+/.test(v) && /[A-Za-z]/.test(v) && v.length >= 8
    } else {
      ok = v.length >= 2
    }
    if (!ok) failures.push(key)
  }
  return { valid: failures.length === 0, failures }
}

function defaultSearchUrl<F extends string>(item: RepairItem<F>, field: F): string {
  const q = `${item.title} ${String(field)}`.replace(/\s+/g, " ").trim()
  return `https://duckduckgo.com/?q=${encodeURIComponent(q)}`
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

type Tab = "needs-fix" | "pending" | "fixed"

export function UnifiedRepairConsole<F extends string = string>({
  title,
  description,
  items,
  onSave,
  onBulkSave,
  validate = defaultValidate,
  buildFieldSearchUrl = defaultSearchUrl,
  onLog,
}: UnifiedRepairConsoleProps<F>) {
  const [tab, setTab] = useState<Tab>("needs-fix")
  const [statuses, setStatuses] = useState<Record<string, RepairStatus>>({})
  const [edits, setEdits] = useState<Record<string, Partial<Record<F, string>>>>({})
  const [openId, setOpenId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)

  /* Seed initial statuses + auto-prefill values from server-supplied prefills. */
  useEffect(() => {
    setStatuses((prev) => {
      const next = { ...prev }
      for (const it of items) {
        if (!(it.id in next)) next[it.id] = it.initialStatus ?? "WARN"
      }
      return next
    })
    setEdits((prev) => {
      const next = { ...prev }
      for (const it of items) {
        if (next[it.id]) continue
        const seed: Partial<Record<F, string>> = {}
        for (const f of it.fields) {
          if (typeof f.prefilled === "string" && f.prefilled.trim().length > 0) {
            seed[f.field] = f.prefilled
          }
        }
        if (Object.keys(seed).length > 0) next[it.id] = seed
      }
      return next
    })
  }, [items])

  /* Group items by tab. */
  const grouped = useMemo(() => {
    const buckets: Record<Tab, RepairItem<F>[]> = { "needs-fix": [], pending: [], fixed: [] }
    for (const it of items) {
      const s = statuses[it.id] ?? it.initialStatus ?? "WARN"
      if (s === "FIXED") buckets.fixed.push(it)
      else if (s === "PENDING") buckets.pending.push(it)
      else buckets["needs-fix"].push(it)
    }
    return buckets
  }, [items, statuses])

  const visibleItems = grouped[tab]

  /* ── Lazy / windowed rendering ────────────────────────────────────────── */
  const PAGE = 25
  const [renderCount, setRenderCount] = useState(PAGE)
  useEffect(() => {
    setRenderCount(PAGE) // reset window when tab changes
  }, [tab])
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setRenderCount((c) => Math.min(c + PAGE, visibleItems.length))
        }
      },
      { rootMargin: "200px" },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [visibleItems.length])

  /* ── Handlers ────────────────────────────────────────────────────────── */

  const setField = useCallback((id: string, field: F, value: string) => {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }))
  }, [])

  const filledFor = (id: string): Partial<Record<F, string>> => {
    const raw = edits[id] || {}
    const out: Partial<Record<F, string>> = {}
    for (const [k, v] of Object.entries(raw) as [F, string | undefined][]) {
      if (typeof v === "string" && v.trim().length > 0) out[k] = v.trim()
    }
    return out
  }

  const saveOne = useCallback(
    async (item: RepairItem<F>, opts: { silent?: boolean } = {}) => {
      const values = filledFor(item.id)
      if (Object.keys(values).length === 0) {
        if (!opts.silent) onLog?.("WARN", `No fields filled for "${item.title}"`)
        return false
      }
      setSavingId(item.id)
      setStatuses((prev) => ({ ...prev, [item.id]: "PENDING" }))
      const res = await onSave(item.id, values)
      setSavingId(null)
      if (res.success) {
        setStatuses((prev) => ({ ...prev, [item.id]: "FIXED" }))
        onLog?.("FIXED", `Saved "${item.title}": ${Object.keys(values).join(", ")}`)
        return true
      }
      setStatuses((prev) => ({ ...prev, [item.id]: "WARN" }))
      onLog?.("ERROR", `Save failed for "${item.title}": ${res.message}`)
      return false
    },
    [edits, onLog, onSave],
  )

  const autoValidateOne = useCallback(
    async (item: RepairItem<F>) => {
      const values = filledFor(item.id)
      if (Object.keys(values).length === 0) {
        onLog?.("WARN", `Auto-Validate skipped — no values for "${item.title}"`)
        return
      }
      const v = validate(values)
      if (!v.valid) {
        onLog?.(
          "WARN",
          `Auto-Validate rejected "${item.title}" — invalid: ${v.failures.map(String).join(", ")}`,
        )
        return
      }
      onLog?.("INFO", `Auto-Validate passed for "${item.title}" — saving`)
      await saveOne(item, { silent: true })
    },
    [edits, onLog, saveOne, validate],
  )

  const dismissOne = useCallback(
    (item: RepairItem<F>) => {
      setStatuses((prev) => ({ ...prev, [item.id]: "FIXED" }))
      onLog?.("INFO", `Dismissed "${item.title}"`)
    },
    [onLog],
  )

  const bulkApprove = useCallback(async () => {
    const ids = Object.keys(selected).filter((id) => selected[id])
    if (ids.length === 0) return
    setBulkBusy(true)
    onLog?.("INFO", `Bulk approving ${ids.length} record(s)…`)

    const targets = ids
      .map((id) => items.find((it) => it.id === id))
      .filter((x): x is RepairItem<F> => Boolean(x))

    const payload = targets
      .map((it) => ({ id: it.id, values: filledFor(it.id) }))
      .filter((p) => Object.keys(p.values).length > 0)

    if (payload.length === 0) {
      onLog?.("WARN", `Bulk approve skipped — no rows had filled values`)
      setBulkBusy(false)
      return
    }

    // Pessimistically mark as pending
    setStatuses((prev) => {
      const next = { ...prev }
      for (const p of payload) next[p.id] = "PENDING"
      return next
    })

    let succeeded: string[] = []
    let failed: { id: string; message: string }[] = []

    if (onBulkSave) {
      const res = await onBulkSave(payload)
      succeeded = res.succeeded
      failed = res.failed
    } else {
      for (const p of payload) {
        const res = await onSave(p.id, p.values)
        if (res.success) succeeded.push(p.id)
        else failed.push({ id: p.id, message: res.message })
      }
    }

    setStatuses((prev) => {
      const next = { ...prev }
      for (const id of succeeded) next[id] = "FIXED"
      for (const f of failed) next[f.id] = "WARN"
      return next
    })
    setSelected({})
    onLog?.(
      "FIXED",
      `Bulk approve complete — ${succeeded.length} fixed${failed.length ? `, ${failed.length} failed` : ""}`,
    )
    setBulkBusy(false)
  }, [edits, items, onBulkSave, onLog, onSave, selected])

  const selectedCount = Object.values(selected).filter(Boolean).length

  /* ── Tab counts ──────────────────────────────────────────────────────── */
  const counts = {
    "needs-fix": grouped["needs-fix"].length,
    pending: grouped.pending.length,
    fixed: grouped.fixed.length,
  }

  /* ── Render ──────────────────────────────────────────────────────────── */
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {description && <p className="text-xs text-slate-500">{description}</p>}
        </div>
        <div className="flex items-center gap-2">
          {selectedCount > 0 && tab === "needs-fix" && (
            <Button
              size="sm"
              onClick={bulkApprove}
              disabled={bulkBusy}
              className="h-8 gap-1.5 bg-slate-900 text-xs text-white hover:bg-slate-800"
            >
              {bulkBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
              Bulk Approve ({selectedCount})
            </Button>
          )}
        </div>
      </div>

      {/* Tri-State tabs */}
      <div className="flex border-b border-slate-200 bg-white">
        <TabButton active={tab === "needs-fix"} onClick={() => setTab("needs-fix")} label="Needs Fix" count={counts["needs-fix"]} tone="rose" />
        <TabButton active={tab === "pending"} onClick={() => setTab("pending")} label="Pending Review" count={counts.pending} tone="amber" />
        <TabButton active={tab === "fixed"} onClick={() => setTab("fixed")} label="Fixed" count={counts.fixed} tone="emerald" />
      </div>

      {/* List */}
      {visibleItems.length === 0 ? (
        <div className="px-4 py-12 text-center text-sm text-slate-500">
          {tab === "needs-fix"
            ? "Nothing to repair — every record passes validation."
            : tab === "pending"
              ? "No edits awaiting review."
              : "No fixed records yet."}
        </div>
      ) : (
        <ul className="divide-y divide-slate-200">
          {visibleItems.slice(0, renderCount).map((item) => (
            <RepairRow
              key={item.id}
              item={item}
              status={statuses[item.id] ?? "WARN"}
              isOpen={openId === item.id}
              onToggle={() => setOpenId((p) => (p === item.id ? null : item.id))}
              edits={edits[item.id] || {}}
              onField={(field, v) => setField(item.id, field, v)}
              isSelected={!!selected[item.id]}
              onSelectToggle={(v) =>
                setSelected((prev) => ({ ...prev, [item.id]: v }))
              }
              showSelection={tab === "needs-fix"}
              saving={savingId === item.id}
              onSave={() => saveOne(item)}
              onAutoValidate={() => autoValidateOne(item)}
              onDismiss={() => dismissOne(item)}
              buildFieldSearchUrl={(field) => buildFieldSearchUrl(item, field)}
            />
          ))}
          {renderCount < visibleItems.length && (
            <li ref={sentinelRef} className="flex items-center justify-center px-4 py-3 text-xs text-slate-500">
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              Loading more… ({renderCount} of {visibleItems.length})
            </li>
          )}
        </ul>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Tab button                                                                */
/* -------------------------------------------------------------------------- */

function TabButton({
  active,
  onClick,
  label,
  count,
  tone,
}: {
  active: boolean
  onClick: () => void
  label: string
  count: number
  tone: "rose" | "amber" | "emerald"
}) {
  const toneClass =
    tone === "rose"
      ? "bg-rose-50 text-rose-700 border-rose-200"
      : tone === "amber"
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : "bg-emerald-50 text-emerald-700 border-emerald-200"

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex flex-1 items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium transition-colors",
        active
          ? "border-b-2 border-slate-900 text-slate-900"
          : "border-b-2 border-transparent text-slate-500 hover:text-slate-900",
      ].join(" ")}
    >
      <span>{label}</span>
      <span className={`inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full border px-1.5 text-[10px] font-semibold ${toneClass}`}>
        {count}
      </span>
    </button>
  )
}

/* -------------------------------------------------------------------------- */
/*  Repair row                                                                */
/* -------------------------------------------------------------------------- */

interface RepairRowProps<F extends string> {
  item: RepairItem<F>
  status: RepairStatus
  isOpen: boolean
  onToggle: () => void
  edits: Partial<Record<F, string>>
  onField: (field: F, value: string) => void
  isSelected: boolean
  onSelectToggle: (v: boolean) => void
  showSelection: boolean
  saving: boolean
  onSave: () => void
  onAutoValidate: () => void
  onDismiss: () => void
  buildFieldSearchUrl: (field: F) => string
}

function RepairRow<F extends string>({
  item,
  status,
  isOpen,
  onToggle,
  edits,
  onField,
  isSelected,
  onSelectToggle,
  showSelection,
  saving,
  onSave,
  onAutoValidate,
  onDismiss,
  buildFieldSearchUrl,
}: RepairRowProps<F>) {
  const filledCount = item.fields.filter(
    (f) => typeof edits[f.field] === "string" && (edits[f.field] as string).trim().length > 0,
  ).length

  return (
    <li className={status === "FIXED" ? "opacity-60" : ""}>
      <div className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50">
        {showSelection && (
          <Checkbox
            checked={isSelected}
            onCheckedChange={(c) => onSelectToggle(Boolean(c))}
            aria-label={`Select ${item.title}`}
            className="flex-shrink-0"
          />
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          {isOpen ? (
            <ChevronDown className="h-4 w-4 flex-shrink-0 text-slate-500" />
          ) : (
            <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-500" />
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-sm font-medium text-slate-900">{item.title}</span>
            {item.subtitle && <span className="truncate text-xs text-slate-500">{item.subtitle}</span>}
          </div>
          <div className="hidden flex-shrink-0 items-center gap-1.5 sm:flex">
            {item.fields.slice(0, 4).map((f) => (
              <Badge
                key={String(f.field)}
                variant="outline"
                className="border-rose-200 bg-rose-50 text-[10px] font-medium text-rose-700"
              >
                {f.label}
              </Badge>
            ))}
            {item.fields.length > 4 && (
              <span className="text-[10px] text-slate-500">+{item.fields.length - 4}</span>
            )}
          </div>
        </button>
        <StatusPill status={status} />
      </div>

      {isOpen && status !== "FIXED" && (
        <div className="border-t border-slate-200 bg-slate-50/60 px-4 py-4">
          {/* Snippets */}
          {item.snippets && item.snippets.length > 0 && (
            <div className="mb-4 rounded-lg border border-slate-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-700">
                  Web search results for &ldquo;{item.title}&rdquo;
                </span>
                {item.searchUrl && (
                  <a
                    href={item.searchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 underline-offset-2 hover:underline"
                  >
                    Open full search
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              <ul className="flex flex-col gap-2">
                {item.snippets.slice(0, 5).map((r, i) => (
                  <li key={i} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block truncate text-xs font-semibold text-slate-900 hover:underline"
                    >
                      {r.title}
                    </a>
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-600">{r.snippet}</p>
                    <span className="mt-0.5 block truncate text-[10px] text-slate-400">{r.url}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Fields */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {item.fields.map((f) => {
              const value = edits[f.field] ?? ""
              const usedPrefill =
                typeof f.prefilled === "string" &&
                f.prefilled.trim().length > 0 &&
                value === f.prefilled
              return (
                <div key={String(f.field)} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor={`${item.id}-${String(f.field)}`}
                      className="text-xs font-medium text-slate-700"
                    >
                      {f.label}
                    </label>
                    {f.reason && (
                      <span className="text-[10px] uppercase tracking-wider text-rose-600">
                        {f.reason}
                      </span>
                    )}
                  </div>
                  {f.currentValue && f.currentValue !== "" && (
                    <span className="text-[10px] text-slate-500">
                      Current: <span className="font-mono text-slate-700">{f.currentValue}</span>
                    </span>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Input
                      id={`${item.id}-${String(f.field)}`}
                      value={value}
                      onChange={(e) => onField(f.field, e.target.value)}
                      placeholder={f.placeholder ?? ""}
                      className="h-8 bg-white text-sm"
                      autoComplete="off"
                    />
                    <a
                      href={buildFieldSearchUrl(f.field)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-100"
                      aria-label={`Search the web for ${f.label}`}
                      title={`Search the web for ${f.label}`}
                    >
                      <Search className="h-3.5 w-3.5" />
                    </a>
                  </div>
                  {f.prefilled && f.prefilled !== value && (
                    <button
                      type="button"
                      onClick={() => onField(f.field, f.prefilled as string)}
                      className="self-start text-[10px] font-medium text-slate-700 underline underline-offset-2 hover:text-slate-900"
                    >
                      Use suggestion: <span className="font-mono">{f.prefilled}</span>
                    </button>
                  )}
                  {usedPrefill && (
                    <span className="inline-flex items-center gap-1 self-start text-[10px] text-emerald-700">
                      <Sparkles className="h-3 w-3" /> Pre-filled
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Actions */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-slate-500">
              {filledCount} of {item.fields.length} fields filled
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={onDismiss} className="h-8 text-xs">
                <XCircle className="mr-1 h-3.5 w-3.5" />
                Dismiss
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onAutoValidate}
                disabled={filledCount === 0 || saving}
                className="h-8 text-xs"
                title="Validate format; if it passes, save automatically"
              >
                <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                Auto-Validate
              </Button>
              <Button
                size="sm"
                onClick={onSave}
                disabled={filledCount === 0 || saving}
                className="h-8 bg-slate-900 text-xs text-white hover:bg-slate-800"
              >
                {saving ? (
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
}

function StatusPill({ status }: { status: RepairStatus }) {
  if (status === "FIXED") {
    return (
      <span className="inline-flex flex-shrink-0 items-center gap-1 text-xs font-medium text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Fixed
      </span>
    )
  }
  if (status === "PENDING") {
    return (
      <span className="inline-flex flex-shrink-0 items-center gap-1 text-xs font-medium text-amber-700">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Pending
      </span>
    )
  }
  return (
    <span className="inline-flex flex-shrink-0 items-center gap-1 text-xs font-medium text-rose-600">
      <AlertTriangle className="h-3.5 w-3.5" />
      Needs fix
    </span>
  )
}
