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
 * Civic Professional palette tuned for a deep-navy background.
 * Status pills use soft, slightly-desaturated tones so they read clearly
 * on `bg-[#0f1e3d]` without the neon "terminal" feel of pure RGB greens/reds.
 */
const STATUS_STYLES: Record<LogStatus, { dot: string; badge: string; text: string }> = {
  SUCCESS: {
    dot: "bg-emerald-300",
    badge: "bg-emerald-400/15 text-emerald-200 border-emerald-300/30",
    text: "text-emerald-50/95",
  },
  FIXED: {
    dot: "bg-emerald-300",
    badge: "bg-emerald-400/15 text-emerald-200 border-emerald-300/30",
    text: "text-emerald-50/95",
  },
  ERROR: {
    dot: "bg-rose-300",
    badge: "bg-rose-400/15 text-rose-200 border-rose-300/30",
    text: "text-rose-50/95",
  },
  WARN: {
    dot: "bg-amber-300",
    badge: "bg-amber-400/15 text-amber-100 border-amber-300/30",
    text: "text-amber-50/95",
  },
  INFO: {
    dot: "bg-sky-300",
    badge: "bg-sky-400/15 text-sky-100 border-sky-300/30",
    text: "text-sky-50/90",
  },
}

const SOURCE_BADGE: Record<LogSource, string> = {
  SCRAPE: "bg-violet-400/15 text-violet-100 border-violet-300/30",
  IMPORT: "bg-blue-400/15 text-blue-100 border-blue-300/30",
  AUDIT: "bg-indigo-400/15 text-indigo-100 border-indigo-300/30",
  WEB: "bg-cyan-400/15 text-cyan-100 border-cyan-300/30",
  SYSTEM: "bg-slate-400/15 text-slate-200 border-slate-300/30",
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
    <section
      className="overflow-hidden rounded-xl border border-slate-700/60 shadow-lg"
      style={{
        // Navy → slightly darker navy gradient, mirroring the Rental Atlas hero card.
        background: "linear-gradient(180deg, #1e3a8a 0%, #15265f 100%)",
      }}
    >
      {/* Civic header strip */}
      <div className="flex items-center justify-between border-b border-slate-100/10 bg-[#1e3a8a]/60 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white/10">
            <Activity className="h-3.5 w-3.5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Activity Log</h3>
            <p className="text-[10px] uppercase tracking-wider text-slate-300/80">
              {entries.length} {entries.length === 1 ? "event" : "events"} · real-time
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Live counts */}
          <div className="hidden items-center gap-2 text-[10px] sm:flex">
            <span className="inline-flex items-center gap-1 rounded border border-emerald-300/30 bg-emerald-400/15 px-1.5 py-0.5 font-medium text-emerald-100">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
              {counts.success} OK
            </span>
            <span className="inline-flex items-center gap-1 rounded border border-rose-300/30 bg-rose-400/15 px-1.5 py-0.5 font-medium text-rose-100">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-300" />
              {counts.error} ERR
            </span>
            {counts.warn > 0 && (
              <span className="inline-flex items-center gap-1 rounded border border-amber-300/30 bg-amber-400/15 px-1.5 py-0.5 font-medium text-amber-100">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                {counts.warn} WARN
              </span>
            )}
          </div>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setPaused((p) => !p)}
            className="h-7 gap-1.5 px-2 text-xs text-slate-100 hover:bg-white/10 hover:text-white"
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
              className="h-7 gap-1.5 px-2 text-xs text-slate-100 hover:bg-white/10 hover:text-white"
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
        className="overflow-y-auto px-4 py-3 font-mono text-[12px] leading-relaxed text-slate-100"
      >
        {entries.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 text-slate-400">
            <Activity className="h-5 w-5 opacity-40" />
            <p className="text-xs">Waiting for activity…</p>
            <p className="text-[10px] text-slate-400/70">
              Scrape, import, and audit events will stream here in real time.
            </p>
          </div>
        ) : (
          <ul className="space-y-1">
            {entries.map((entry) => {
              const styles = STATUS_STYLES[entry.status]
              return (
                <li key={entry.id} className="flex items-start gap-2">
                  <span className="mt-0.5 flex-shrink-0 select-none text-slate-300/70">
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
