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
}

/**
 * Civic Professional palette — light theme.
 *
 * The container now matches the off-white Import / Audit / Scrape cards so the
 * page reads as one cohesive Civic surface instead of a "terminal in a panel".
 * Status pills use soft, desaturated pastels (sage, lavender, rose, sky) over
 * crisp slate-900 message text for maximum readability.
 */
const STATUS_STYLES: Record<LogStatus, { dot: string; badge: string }> = {
  SUCCESS: {
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  FIXED: {
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  ERROR: {
    dot: "bg-rose-500",
    badge: "bg-rose-50 text-rose-800 border-rose-200",
  },
  WARN: {
    dot: "bg-amber-500",
    badge: "bg-amber-50 text-amber-800 border-amber-200",
  },
  INFO: {
    dot: "bg-indigo-500",
    badge: "bg-indigo-50 text-indigo-800 border-indigo-200",
  },
}

const SOURCE_BADGE: Record<LogSource, string> = {
  SCRAPE: "bg-violet-50 text-violet-800 border-violet-200",
  IMPORT: "bg-blue-50 text-blue-800 border-blue-200",
  AUDIT: "bg-slate-100 text-slate-800 border-slate-300",
  WEB: "bg-cyan-50 text-cyan-800 border-cyan-200",
  SYSTEM: "bg-slate-100 text-slate-700 border-slate-300",
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  })
}

export function LiveLog({ entries, onClear, height = 380 }: LiveLogProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused) return
    const el = containerRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [entries, paused])

  const counts = entries.reduce(
    (acc, e) => {
      if (e.status === "FIXED" || e.status === "SUCCESS") acc.success++
      else if (e.status === "ERROR") acc.error++
      else if (e.status === "WARN") acc.warn++
      return acc
    },
    { success: 0, error: 0, warn: 0 },
  )

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Civic header strip */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-900/5">
            <Activity className="h-3.5 w-3.5 text-slate-700" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Activity Log</h3>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">
              {entries.length} {entries.length === 1 ? "event" : "events"} · real-time
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Live counts */}
          <div className="hidden items-center gap-2 text-[10px] sm:flex">
            <span className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-800">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {counts.success} OK
            </span>
            <span className="inline-flex items-center gap-1 rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 font-semibold text-rose-800">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
              {counts.error} ERR
            </span>
            {counts.warn > 0 && (
              <span className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 font-semibold text-amber-800">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                {counts.warn} WARN
              </span>
            )}
          </div>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setPaused((p) => !p)}
            className="h-7 gap-1.5 px-2 text-xs text-slate-700 hover:bg-slate-100 hover:text-slate-900"
          >
            {paused ? (
              <>
                <Play className="h-3 w-3" /> Resume
              </>
            ) : (
              <>
                <Pause className="h-3 w-3" /> Pause
              </>
            )}
          </Button>

          {onClear && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onClear}
              className="h-7 gap-1.5 px-2 text-xs text-slate-700 hover:bg-slate-100 hover:text-slate-900"
            >
              <Trash2 className="h-3 w-3" /> Clear
            </Button>
          )}
        </div>
      </div>

      {/* Log body */}
      <div
        ref={containerRef}
        style={{ height }}
        className="overflow-y-auto bg-slate-50/40 px-4 py-3 font-mono text-[12px] leading-relaxed text-slate-900"
      >
        {entries.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 text-slate-400">
            <Activity className="h-5 w-5 opacity-40" />
            <p className="text-xs">Waiting for activity…</p>
            <p className="text-[10px] text-slate-400/80">
              System Audit events will stream here in real time.
            </p>
          </div>
        ) : (
          <ul className="space-y-1">
            {entries.map((entry) => {
              const styles = STATUS_STYLES[entry.status]
              return (
                <li key={entry.id} className="flex items-start gap-2">
                  <span className="mt-0.5 flex-shrink-0 select-none text-slate-500">
                    [{formatTimestamp(entry.timestamp)}]
                  </span>
                  <span
                    className={`mt-0.5 inline-flex flex-shrink-0 items-center rounded border px-1.5 py-0 text-[10px] font-semibold tracking-wide ${SOURCE_BADGE[entry.source]}`}
                  >
                    {entry.source}
                  </span>
                  <span
                    className={`mt-0.5 inline-flex flex-shrink-0 items-center gap-1 rounded border px-1.5 py-0 text-[10px] font-semibold tracking-wide ${styles.badge}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />
                    {entry.status}
                  </span>
                  <span className="break-all text-slate-800">{entry.message}</span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
