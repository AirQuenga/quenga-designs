"use client"

import { useEffect, useRef, useState } from "react"
import { Pause, Play, Trash2, Terminal } from "lucide-react"
import { Button } from "@/components/ui/button"

export type LogSource = "SCRAPE" | "IMPORT" | "AUDIT" | "SYSTEM"
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

const STATUS_STYLES: Record<LogStatus, { dot: string; badge: string; text: string }> = {
  SUCCESS: {
    dot: "bg-emerald-400",
    badge: "bg-emerald-400/10 text-emerald-300 border-emerald-400/30",
    text: "text-emerald-200",
  },
  FIXED: {
    dot: "bg-emerald-400",
    badge: "bg-emerald-400/10 text-emerald-300 border-emerald-400/30",
    text: "text-emerald-200",
  },
  ERROR: {
    dot: "bg-red-400",
    badge: "bg-red-400/10 text-red-300 border-red-400/30",
    text: "text-red-200",
  },
  WARN: {
    dot: "bg-amber-400",
    badge: "bg-amber-400/10 text-amber-300 border-amber-400/30",
    text: "text-amber-200",
  },
  INFO: {
    dot: "bg-sky-400",
    badge: "bg-sky-400/10 text-sky-300 border-sky-400/30",
    text: "text-sky-200",
  },
}

const SOURCE_BADGE: Record<LogSource, string> = {
  SCRAPE: "bg-purple-400/10 text-purple-300 border-purple-400/30",
  IMPORT: "bg-blue-400/10 text-blue-300 border-blue-400/30",
  AUDIT: "bg-indigo-400/10 text-indigo-300 border-indigo-400/30",
  SYSTEM: "bg-slate-400/10 text-slate-300 border-slate-400/30",
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

export function LiveLog({ entries, onClear, height = 360 }: LiveLogProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [paused, setPaused] = useState(false)

  // Auto-scroll to bottom on new entries unless paused.
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
    <section className="rounded-xl border border-slate-800 bg-slate-950 shadow-lg">
      {/* Terminal header */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/60 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-100">Activity Log</h3>
          <span className="ml-2 text-[10px] uppercase tracking-wide text-slate-500">
            {entries.length} {entries.length === 1 ? "entry" : "entries"}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Live counts */}
          <div className="hidden items-center gap-2 text-[10px] sm:flex">
            <span className="inline-flex items-center gap-1 rounded border border-emerald-400/30 bg-emerald-400/10 px-1.5 py-0.5 text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {counts.success}
            </span>
            <span className="inline-flex items-center gap-1 rounded border border-red-400/30 bg-red-400/10 px-1.5 py-0.5 text-red-300">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
              {counts.error}
            </span>
            {counts.warn > 0 && (
              <span className="inline-flex items-center gap-1 rounded border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-amber-300">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                {counts.warn}
              </span>
            )}
          </div>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setPaused((p) => !p)}
            className="h-7 gap-1.5 px-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-slate-100"
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
              className="h-7 gap-1.5 px-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-slate-100"
            >
              <Trash2 className="h-3 w-3" /> Clear
            </Button>
          )}
        </div>
      </div>

      {/* Terminal body */}
      <div
        ref={containerRef}
        style={{ height }}
        className="overflow-y-auto px-4 py-3 font-mono text-[12px] leading-relaxed"
      >
        {entries.length === 0 ? (
          <div className="flex h-full items-center justify-center text-slate-600">
            <p>Waiting for activity…</p>
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
                  <span className={`break-all ${styles.text}`}>{entry.message}</span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
