"use client"

import { useCallback, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { auditBatch, getAuditTotal } from "@/app/actions/audit-db"
import { Play, Square, RotateCcw, ShieldCheck } from "lucide-react"

const BATCH_SIZE = 50

interface RunState {
  status: "idle" | "running" | "paused" | "complete" | "error"
  scanned: number
  fixed: number
  failed: number
  total: number
  offset: number
  log: string[]
}

const initialState: RunState = {
  status: "idle",
  scanned: 0,
  fixed: 0,
  failed: 0,
  total: 0,
  offset: 0,
  log: [],
}

export function AuditRunner() {
  const [state, setState] = useState<RunState>(initialState)
  const stopRequested = useRef(false)

  const appendLog = useCallback((line: string) => {
    setState((s) => ({ ...s, log: [...s.log.slice(-200), line] }))
  }, [])

  const start = useCallback(async () => {
    stopRequested.current = false
    setState({ ...initialState, status: "running" })
    appendLog("Starting database audit…")

    let total = await getAuditTotal()
    setState((s) => ({ ...s, total }))
    appendLog(`Discovered ${total.toLocaleString()} property records to audit.`)

    let offset = 0
    let scanned = 0
    let fixed = 0
    let failed = 0

    while (!stopRequested.current) {
      try {
        const result = await auditBatch(offset, BATCH_SIZE)
        scanned += result.scanned
        fixed += result.fixed
        failed += result.failed
        total = result.total || total

        for (const note of result.notes.slice(0, 4)) appendLog(note)
        appendLog(
          `Audited ${scanned.toLocaleString()}/${total.toLocaleString()}… ${fixed} fixed, ${failed} failed.`,
        )

        setState((s) => ({
          ...s,
          scanned,
          fixed,
          failed,
          total,
          offset: result.nextOffset ?? offset + result.scanned,
        }))

        if (result.nextOffset === null) {
          setState((s) => ({ ...s, status: "complete" }))
          appendLog("Audit complete.")
          return
        }
        offset = result.nextOffset
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error"
        appendLog(`Batch error: ${msg}`)
        setState((s) => ({ ...s, status: "error" }))
        return
      }
    }

    setState((s) => ({ ...s, status: "paused" }))
    appendLog("Audit paused by user.")
  }, [appendLog])

  const stop = () => {
    stopRequested.current = true
  }

  const reset = () => {
    stopRequested.current = true
    setState(initialState)
  }

  const pct = state.total > 0 ? Math.min(100, Math.round((state.scanned / state.total) * 100)) : 0
  const isRunning = state.status === "running"

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2.5">
          <ShieldCheck className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-card-foreground">Database Audit</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Standardize addresses, fill missing city/zip, fix geocoding, and repair known typos across all property records.
            Processes {BATCH_SIZE} at a time.
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Button onClick={start} disabled={isRunning} size="sm">
          <Play className="mr-1.5 h-4 w-4" />
          {state.status === "complete" || state.status === "paused" || state.status === "error"
            ? "Restart Audit"
            : "Start Audit"}
        </Button>
        <Button onClick={stop} disabled={!isRunning} size="sm" variant="outline">
          <Square className="mr-1.5 h-4 w-4" />
          Stop
        </Button>
        <Button onClick={reset} disabled={state.status === "idle"} size="sm" variant="ghost">
          <RotateCcw className="mr-1.5 h-4 w-4" />
          Reset
        </Button>
      </div>

      {/* Progress bar */}
      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Audited{" "}
            <span className="font-semibold text-foreground">{state.scanned.toLocaleString()}</span>
            {" / "}
            <span className="font-semibold text-foreground">{state.total.toLocaleString()}</span>
          </span>
          <span className="font-medium text-foreground">{pct}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${pct}%` }}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-lg border border-border bg-background p-3">
          <div className="text-2xl font-semibold text-foreground">{state.fixed.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">Fixed</div>
        </div>
        <div className="rounded-lg border border-border bg-background p-3">
          <div className="text-2xl font-semibold text-foreground">{state.failed.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">Failed</div>
        </div>
        <div className="rounded-lg border border-border bg-background p-3">
          <div className="text-2xl font-semibold text-foreground capitalize">{state.status}</div>
          <div className="text-xs text-muted-foreground">Status</div>
        </div>
      </div>

      {/* Log */}
      <div className="mt-4 max-h-56 overflow-y-auto rounded-lg border border-border bg-slate-950 p-3 font-mono text-xs leading-relaxed text-slate-200">
        {state.log.length === 0 ? (
          <div className="text-slate-500">No activity yet. Click Start Audit to begin.</div>
        ) : (
          state.log.map((line, i) => (
            <div key={i} className="whitespace-pre-wrap">
              <span className="text-slate-500">›</span> {line}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
