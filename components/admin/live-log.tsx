"use client"

import { useEffect, useRef, useState } from "react"
import { Pause, Play, Trash2, Activity } from "lucide-react"
import { Button } from "@/components/ui/button"

export type LogSource = "SCRAPE" | "IMPORT" | "AUDIT" | "WEB" | "SYSTEM"
export type LogStatus = "SUCCESS" | "FIXED" | "ERROR" | "WARN" | "INFO"

export interface LogEntry {
  id: number
  timestamp: number
  source: LogSource
  status: LogStatus
  message: string
}

interface LiveLogProps {
  entries: LogEntry[]
  onClear?: () => void
  height?: number
  /** Called when user clicks the WARN or ERROR filter chip — used to jump to the Repair Console */
  onJumpToRepairs?: (status: "WARN" | "ERROR") => void
  /** Number of pending repair items, shown next to a "Jump to Repairs" link */
  pendingRepairsCount?: number
}

const STATUS_STYLES: Record<LogStatus, { dot: string; badge: string; chip: string; chipActive: string }> = {
  SUCCESS: {
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800",
    chip: "border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/30",
    chipActive: "bg-emerald-100 border-emerald-300 text-emerald-800 dark:bg-emerald-950/50 dark:border-emerald-700 dark:text-emerald-300",
  },
  FIXED: {
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800",
    chip: "border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/30",
    chipActive: "bg-emerald-100 border-emerald-300 text-emerald-800 dark:bg-emerald-950/50 dark:border-emerald-700 dark:text-emerald-300",
  },
  ERROR: {
    dot: "bg-rose-500",
    badge: "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800",
    chip: "border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950/30",
    chipActive: "bg-rose-100 border-rose-300 text-rose-800 dark:bg-rose-950/50 dark:border-rose-700 dark:text-rose-300",
  },
  WARN: {
    dot: "bg-amber-500",
    badge: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800",
    chip: "border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-950/30",
    chipActive: "bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-950/50 dark:border-amber-700 dark:text-amber-300",
  },
  INFO: {
    dot: "bg-indigo-500",
    badge: "bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800",
    chip: "border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-400 dark:hover:bg-indigo-950/30",
    chipActive: "bg-indigo-100 border-indigo-300 text-indigo-800 dark:bg-indigo-950/50 dark:border-indigo-700 dark:text-indigo-300",
  },
}

const SOURCE_BADGE: Record<LogSource, string> = {
  SCRAPE: "bg-violet-50 text-violet-800 border-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-800",
  IMPORT: "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800",
  AUDIT: "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600",
  WEB: "bg-cyan-50 text-cyan-800 border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border-cyan-800",
  SYSTEM: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600",
}

type FilterType = "ALL" | LogStatus

const FILTER_OPTIONS: { key: FilterType; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "FIXED", label: "Fixed" },
  { key: "INFO", label: "Info" },
  { key: "WARN", label: "Warn" },
  { key: "ERROR", label: "Error" },
]

function formatTimestamp(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  })
}

function formatTimestampShort(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

export function LiveLog({ entries, onClear, height = 280, onJumpToRepairs, pendingRepairsCount = 0 }: LiveLogProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [paused, setPaused] = useState(false)
  const [filter, setFilter] = useState<FilterType>("ALL")

  useEffect(() => {
    if (paused) return
    const el = containerRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [entries, paused])

  const counts = entries.reduce(
    (acc, e) => {
      if (e.status === "FIXED" || e.status === "SUCCESS") acc.fixed++
      if (e.status === "ERROR") acc.error++
      if (e.status === "WARN") acc.warn++
      if (e.status === "INFO") acc.info++
      return acc
    },
    { fixed: 0, error: 0, warn: 0, info: 0 },
  )

  // Filter entries based on selected filter
  const filteredEntries =
    filter === "ALL"
      ? entries
      : entries.filter((e) => {
          if (filter === "FIXED") return e.status === "FIXED" || e.status === "SUCCESS"
          return e.status === filter
        })

  const handleFilterClick = (key: FilterType) => {
    setFilter((prev) => (prev === key ? "ALL" : key))
    if ((key === "WARN" || key === "ERROR") && onJumpToRepairs && pendingRepairsCount > 0) {
      onJumpToRepairs(key)
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      {/* Header strip */}
      <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-slate-900/5 dark:bg-slate-700">
            <Activity className="h-3.5 w-3.5 text-slate-700 dark:text-slate-300" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Activity Log</h3>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {filteredEntries.length} of {entries.length} {entries.length === 1 ? "event" : "events"}
              {pendingRepairsCount > 0 && onJumpToRepairs && (
                <>
                  {" · "}
                  <button
                    type="button"
                    onClick={() => onJumpToRepairs("WARN")}
                    className="font-semibold text-rose-600 underline-offset-2 hover:underline dark:text-rose-400"
                  >
                    {pendingRepairsCount} need repair →
                  </button>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setPaused((p) => !p)}
              className="h-8 min-w-[44px] gap-1 px-2 text-xs text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-100 sm:h-7 sm:min-w-0 sm:gap-1.5"
            >
              {paused ? <Play className="h-3.5 w-3.5 sm:h-3 sm:w-3" /> : <Pause className="h-3.5 w-3.5 sm:h-3 sm:w-3" />}
              <span className="hidden sm:inline">{paused ? "Resume" : "Pause"}</span>
            </Button>

            {onClear && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onClear}
                className="h-8 min-w-[44px] gap-1 px-2 text-xs text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-100 sm:h-7 sm:min-w-0 sm:gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
                <span className="hidden sm:inline">Clear</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Filter chips row */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 bg-slate-50/50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/50 sm:px-4">
        <span className="mr-1 text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Filter:</span>
        {FILTER_OPTIONS.map(({ key, label }) => {
          const isActive = filter === key
          const isAll = key === "ALL"
          const styles = isAll ? null : STATUS_STYLES[key as LogStatus]
          const count =
            key === "ALL"
              ? entries.length
              : key === "FIXED"
                ? counts.fixed
                : key === "ERROR"
                  ? counts.error
                  : key === "WARN"
                    ? counts.warn
                    : counts.info

          return (
            <button
              key={key}
              type="button"
              onClick={() => handleFilterClick(key)}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                isAll
                  ? isActive
                    ? "border-slate-400 bg-slate-200 text-slate-800 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-200"
                    : "border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700"
                  : isActive
                    ? styles?.chipActive
                    : styles?.chip
              }`}
            >
              {!isAll && <span className={`h-1.5 w-1.5 rounded-full ${styles?.dot}`} />}
              {label}
              <span className="ml-0.5 opacity-70">({count})</span>
            </button>
          )
        })}
      </div>

      {/* Log body */}
      <div
        ref={containerRef}
        style={{ maxHeight: height }}
        className="overflow-y-auto bg-slate-50/40 px-3 py-2.5 text-[11px] leading-relaxed text-slate-900 dark:bg-slate-900/50 dark:text-slate-100 sm:px-4 sm:py-3 sm:text-[12px]"
      >
        {filteredEntries.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center gap-1.5 text-slate-400 dark:text-slate-500 sm:h-40">
            <Activity className="h-5 w-5 opacity-40" />
            <p className="text-xs">
              {entries.length === 0 ? "Waiting for activity..." : `No ${filter.toLowerCase()} events`}
            </p>
          </div>
        ) : (
          <ul className="space-y-1.5 sm:space-y-1">
            {filteredEntries.map((entry) => {
              const styles = STATUS_STYLES[entry.status]
              return (
                <li key={entry.id} className="flex flex-wrap items-start gap-1 sm:flex-nowrap sm:gap-2">
                  {/* Timestamp */}
                  <span className="flex-shrink-0 select-none font-mono text-[10px] text-slate-400 dark:text-slate-500 sm:mt-0.5 sm:text-slate-500">
                    <span className="hidden sm:inline">[{formatTimestamp(entry.timestamp)}]</span>
                    <span className="sm:hidden">{formatTimestampShort(entry.timestamp)}</span>
                  </span>
                  {/* Badges */}
                  <span
                    className={`inline-flex flex-shrink-0 items-center rounded border px-1 py-0 text-[9px] font-semibold tracking-wide sm:mt-0.5 sm:px-1.5 sm:text-[10px] ${SOURCE_BADGE[entry.source]}`}
                  >
                    {entry.source}
                  </span>
                  <span
                    className={`inline-flex flex-shrink-0 items-center gap-0.5 rounded border px-1 py-0 text-[9px] font-semibold tracking-wide sm:mt-0.5 sm:gap-1 sm:px-1.5 sm:text-[10px] ${styles.badge}`}
                  >
                    <span className={`h-1 w-1 rounded-full sm:h-1.5 sm:w-1.5 ${styles.dot}`} />
                    {entry.status}
                  </span>
                  {/* Message */}
                  <span className="w-full break-words text-slate-800 dark:text-slate-200 sm:w-auto sm:flex-1">{entry.message}</span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
