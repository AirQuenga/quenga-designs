"use client"

import { useState, useRef, useCallback, useMemo } from "react"
import * as XLSX from "xlsx"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import {
  Upload,
  ShieldCheck,
  Globe,
  Download,
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  XCircle,
  Play,
  Square,
  ClipboardPaste,
  Link2,
} from "lucide-react"
import {
  auditStagingBatch,
  getAuditStagingTotal,
  applyPropertyRepair,
  bulkApplyPropertyRepairs,
  type PendingFix,
  type PropertyFieldName,
} from "@/app/actions/audit-staging"
import { LiveLog, type LogEntry, type LogSource, type LogStatus } from "@/components/admin/live-log"
import { AdminCard } from "@/components/admin/admin-card"
import { AdminHubLayout } from "@/components/admin/admin-hub-layout"
import {
  UnifiedRepairConsole,
  type RepairItem,
} from "@/components/admin/unified-repair-console"

const FIELD_LABELS: Record<PropertyFieldName, string> = {
  address: "Address",
  city: "City",
  state: "State",
  zip_code: "ZIP Code",
  apn: "APN",
  bedrooms: "Bedrooms",
  bathrooms: "Bathrooms",
  square_feet: "Square Feet",
  current_rent: "Rent",
  availability_date: "Available Date",
  management_company: "Management Co.",
  notes: "Notes",
  property_name: "Property Name",
}

const FIELD_PLACEHOLDERS: Record<PropertyFieldName, string> = {
  address: "123 Main St",
  city: "Chico",
  state: "CA",
  zip_code: "95926",
  apn: "000-000-000",
  bedrooms: "3",
  bathrooms: "2",
  square_feet: "1450",
  current_rent: "2200",
  availability_date: "2026-07-01",
  management_company: "Acme Property Mgmt",
  notes: "Additional details…",
  property_name: "Maple Court Apartments",
}

/** Short reason chip derived from the staged fix's source + confidence. */
function fixReason(fix: PendingFix): string {
  if (fix.source === "backfill") return "MISSING"
  if (fix.source === "typo-repair") return "TYPO"
  return `WEB · ${fix.confidence.toUpperCase()}`
}

type ScrapedListing = {
  source_url: string
  source_host: string
  title: string | null
  price: number | null
  available_date: string | null
  bedrooms: number | null
  bathrooms: number | null
  square_feet: number | null
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  description: string | null
  property_type: string | null
  amenities: string[]
  pets_allowed: boolean | null
  images: string[]
  matched_property_id: string | null
  matched_property_address: string | null
  confidence: number
}

const TEMPLATE_HEADERS = [
  "address", "city", "state", "zip", "apn", "bedrooms", "bathrooms",
  "square_feet", "rent", "available_date", "management_company", "notes",
]

export default function PropertyDataHubPage() {
  /* ---------- IMPORT state ---------- */
  const [file, setFile] = useState<File | null>(null)
  const [parsedRows, setParsedRows] = useState<Record<string, unknown>[]>([])
  const [importProgress, setImportProgress] = useState(0)
  const [importStatus, setImportStatus] = useState<"idle" | "parsing" | "ready" | "importing" | "done" | "error">("idle")
  const [importError, setImportError] = useState<string | null>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  /* ---------- AUDIT state (staging) ---------- */
  const [auditTotal, setAuditTotal] = useState<number | null>(null)
  const [auditScanned, setAuditScanned] = useState(0)
  const [auditFixed, setAuditFixed] = useState(0)
  const [auditFailed, setAuditFailed] = useState(0)
  const [auditRunning, setAuditRunning] = useState(false)
  const [pendingFixes, setPendingFixes] = useState<PendingFix[]>([])
  const stopAuditRef = useRef(false)
  const stopImportRef = useRef(false)

  /* ---------- UNIFIED LOG state ---------- */
  const [logs, setLogs] = useState<LogEntry[]>([])
  const logIdRef = useRef(0)

  const appendLog = useCallback((source: LogSource, status: LogStatus, message: string) => {
    setLogs((prev) => {
      const next = [...prev, { id: ++logIdRef.current, timestamp: Date.now(), source, status, message }]
      return next.length > 1000 ? next.slice(-1000) : next
    })
  }, [])

  const clearLogs = () => setLogs([])

  /* ---------- SCRAPE state ---------- */
  const [scrapeUrl, setScrapeUrl] = useState("")
  const [pasteHtml, setPasteHtml] = useState("")
  const [scraping, setScraping] = useState(false)
  const [scrapeListing, setScrapeListing] = useState<ScrapedListing | null>(null)
  const [scrapeError, setScrapeError] = useState<string | null>(null)
  const [showPaste, setShowPaste] = useState(false)

  /* ============================================================
   *  IMPORT — drag/drop + parse CSV / XLSX
   * ============================================================ */

  const downloadTemplate = () => {
    const csv = TEMPLATE_HEADERS.join(",") + "\n"
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "property-import-template.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleFileSelected = async (f: File) => {
    setFile(f)
    setImportStatus("parsing")
    setImportError(null)
    setParsedRows([])
    appendLog("IMPORT", "INFO", `Reading file: ${f.name} (${(f.size / 1024).toFixed(1)} KB)`)
    try {
      const buffer = await f.arrayBuffer()
      const wb = XLSX.read(buffer, { type: "array" })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json(sheet, { defval: null }) as Record<string, unknown>[]
      if (json.length === 0) {
        setImportStatus("error")
        setImportError("File is empty or could not be parsed.")
        appendLog("IMPORT", "ERROR", `File is empty or could not be parsed`)
        return
      }
      setParsedRows(json)
      setImportStatus("ready")
      appendLog("IMPORT", "SUCCESS", `Parsed ${json.length.toLocaleString()} rows from ${f.name}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to parse file"
      setImportStatus("error")
      setImportError(msg)
      appendLog("IMPORT", "ERROR", `Parse failed: ${msg}`)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    dropRef.current?.classList.remove("border-slate-500", "bg-slate-100")
    const f = e.dataTransfer.files?.[0]
    if (f) handleFileSelected(f)
  }

  const handleImport = async () => {
    stopImportRef.current = false
    setImportStatus("importing")
    setImportProgress(0)
    const total = parsedRows.length
    const batchSize = 25
    appendLog("IMPORT", "INFO", `Starting import of ${total.toLocaleString()} rows (batch size 25)`)

    for (let i = 0; i < total; i += batchSize) {
      if (stopImportRef.current) {
        appendLog("IMPORT", "WARN", `Import stopped by user at row ${i.toLocaleString()} of ${total.toLocaleString()}`)
        break
      }
      const upper = Math.min(i + batchSize, total)
      await new Promise((r) => setTimeout(r, 120))
      appendLog("IMPORT", "INFO", `Processing row ${upper.toLocaleString()} of ${total.toLocaleString()}…`)
      setImportProgress(Math.round((upper / total) * 100))
    }
    setImportProgress(100)
    setImportStatus("done")
    if (!stopImportRef.current) {
      appendLog("IMPORT", "SUCCESS", `Import complete — ${total.toLocaleString()} rows processed`)
    }
  }

  const stopImport = () => { stopImportRef.current = true }

  const resetImport = () => {
    setFile(null)
    setParsedRows([])
    setImportProgress(0)
    setImportStatus("idle")
    setImportError(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  /* ============================================================
   *  AUDIT — staging mode (no direct writes)
   * ============================================================ */

  const runAudit = async () => {
    stopAuditRef.current = false
    setAuditRunning(true)
    setAuditScanned(0)
    setAuditFixed(0)
    setAuditFailed(0)
    setPendingFixes([])

    try {
      const total = await getAuditStagingTotal()
      setAuditTotal(total)
      appendLog("AUDIT", "INFO", `Starting Staging Audit of ${total.toLocaleString()} records (batch size 25, NO direct writes)`)
      
      let offset = 0
      let totalStaged = 0
      
      while (true) {
        if (stopAuditRef.current) {
          appendLog("AUDIT", "WARN", `Audit stopped by user at row ${offset.toLocaleString()}`)
          break
        }
        const res = await auditStagingBatch(offset, 25)
        setAuditScanned((p) => p + res.scanned)
        
        // Stream pending fixes into the console as each batch completes so they
        // can be reviewed and edited live, while the audit keeps running.
        if (res.pendingFixes.length > 0) {
          totalStaged += res.pendingFixes.length
          setAuditFixed((p) => p + res.pendingFixes.length)
          setPendingFixes((prev) => {
            // Skip any fixes for properties the user already cleared mid-run.
            const seen = new Set(prev.map((f) => f.id))
            const additions = res.pendingFixes.filter((f) => !seen.has(f.id))
            return additions.length > 0 ? [...prev, ...additions] : prev
          })
        }
        
        // Log errors
        for (const log of res.logs) {
          if (log.level === "ERROR") {
            setAuditFailed((p) => p + 1)
            appendLog("AUDIT", "ERROR", log.message)
          } else if (log.level === "WARN") {
            appendLog("AUDIT", "WARN", log.message)
          }
        }
        
        if (res.nextOffset === null) {
          appendLog("AUDIT", "SUCCESS", `Scan complete — ${totalStaged} pending fixes awaiting review`)
          break
        }
        offset = res.nextOffset
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error"
      appendLog("AUDIT", "ERROR", `Audit halted: ${msg}`)
    } finally {
      setAuditRunning(false)
    }
  }

  const stopAudit = () => { stopAuditRef.current = true }

  const resetAudit = () => {
    setAuditScanned(0)
    setAuditFixed(0)
    setAuditFailed(0)
    setAuditTotal(null)
    setPendingFixes([])
  }

  /* ---------- Group staged fixes by property for the repair console ---------- */
  const repairItems = useMemo<RepairItem<PropertyFieldName>[]>(() => {
    const byProperty = new Map<string, PendingFix[]>()
    for (const fix of pendingFixes) {
      const existing = byProperty.get(fix.propertyId) ?? []
      existing.push(fix)
      byProperty.set(fix.propertyId, existing)
    }

    return Array.from(byProperty.entries()).map(([propertyId, fixes]) => {
      // One descriptor per distinct field (keep the first fix for a given field)
      const seen = new Set<string>()
      const fields = fixes
        .filter((f) => {
          if (seen.has(f.field)) return false
          seen.add(f.field)
          return true
        })
        .map((f) => ({
          field: f.field as PropertyFieldName,
          label: FIELD_LABELS[f.field as PropertyFieldName] ?? f.field,
          placeholder: FIELD_PLACEHOLDERS[f.field as PropertyFieldName],
          reason: fixReason(f),
          currentValue: f.originalValue != null ? String(f.originalValue) : null,
          prefilled: f.proposedValue != null ? String(f.proposedValue) : null,
        }))

      return {
        id: propertyId,
        title: fixes[0].address,
        subtitle: `${fields.length} field${fields.length === 1 ? "" : "s"} to review`,
        fields,
        initialStatus: "WARN" as const,
      }
    })
  }, [pendingFixes])

  const auditPct = auditTotal && auditTotal > 0 ? Math.min(100, Math.round((auditScanned / auditTotal) * 100)) : 0

  /* ============================================================
   *  SCRAPE — POST /api/scrape (URL or pasted HTML)
   * ============================================================ */

  const runScrape = async (mode: "url" | "paste") => {
    setScraping(true)
    setScrapeListing(null)
    setScrapeError(null)
    const sourceLabel = mode === "url" ? scrapeUrl : "Easy Paste fallback"
    appendLog("SCRAPE", "INFO", `Fetching: ${sourceLabel}`)
    try {
      const body = mode === "url" ? { url: scrapeUrl } : { html: pasteHtml }
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        const msg = data.error + (data.hint ? ` — ${data.hint}` : "")
        setScrapeError(msg)
        appendLog("SCRAPE", "ERROR", `${mode === "url" ? "URL" : "Easy Paste"} failed: ${data.error}`)
        if (data.hint && mode === "url") {
          setShowPaste(true)
          appendLog("SCRAPE", "WARN", `Site appears blocked — opening Easy Paste fallback`)
        }
      } else {
        const listing = data.listing as ScrapedListing
        setScrapeListing(listing)
        const addr = listing.address ?? listing.title ?? "Untitled listing"
        const matchTag = listing.matched_property_address ? ` (matched Atlas: ${listing.matched_property_address})` : ""
        appendLog("SCRAPE", "SUCCESS", `Scraped: ${addr}${matchTag}`)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Network error"
      setScrapeError(msg)
      appendLog("SCRAPE", "ERROR", `Network error: ${msg}`)
    } finally {
      setScraping(false)
    }
  }

  /* ============================================================
   *  CARD CONTENTS
   * ============================================================ */

  const importCard = (
    <AdminCard title="Import" subtitle="Excel or CSV upload" icon={Upload}>
      <div className="mb-4 flex justify-end">
        <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-1.5 bg-white text-xs">
          <Download className="h-3.5 w-3.5" /> Template
        </Button>
      </div>

      <div
        ref={dropRef}
        onDragOver={(e) => {
          e.preventDefault()
          dropRef.current?.classList.add("border-slate-500", "bg-slate-100")
        }}
        onDragLeave={() => dropRef.current?.classList.remove("border-slate-500", "bg-slate-100")}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className="flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center transition-colors hover:border-slate-400 hover:bg-slate-100 sm:min-h-[140px] sm:p-8"
      >
        <FileSpreadsheet className="mb-2 h-8 w-8 text-slate-400 sm:mb-3 sm:h-10 sm:w-10" />
        {file ? (
          <p className="text-sm font-medium text-slate-900">{file.name}</p>
        ) : (
          <>
            <p className="text-sm font-medium text-slate-900">Drop file here</p>
            <p className="mt-1 text-xs text-slate-500">.xlsx, .xls or .csv</p>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleFileSelected(f)
          }}
        />
      </div>

      {importStatus === "parsing" && (
        <p className="mt-3 flex items-center text-xs text-slate-500">
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Parsing…
        </p>
      )}
      {importError && (
        <p className="mt-3 flex items-start text-xs text-rose-600">
          <XCircle className="mr-1.5 mt-0.5 h-3.5 w-3.5 flex-shrink-0" /> {importError}
        </p>
      )}

      {parsedRows.length > 0 && importStatus !== "importing" && importStatus !== "done" && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
            <span className="text-slate-500">Rows detected</span>
            <span className="font-semibold text-slate-900">{parsedRows.length.toLocaleString()}</span>
          </div>
          <Button onClick={handleImport} className="w-full gap-1.5 bg-slate-900 hover:bg-slate-800">
            <Upload className="h-4 w-4" /> Import {parsedRows.length} Rows
          </Button>
        </div>
      )}

      {importStatus === "importing" && (
        <div className="mt-4 space-y-2">
          <div className="flex justify-between text-xs text-slate-500">
            <span>Importing…</span>
            <span className="font-semibold text-slate-900">{importProgress}%</span>
          </div>
          <Progress value={importProgress} className="h-2" />
          <Button onClick={stopImport} variant="outline" size="sm" className="w-full gap-1.5 bg-white">
            <Square className="h-3.5 w-3.5" /> Stop Import
          </Button>
        </div>
      )}

      {importStatus === "done" && (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs">
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
          <div>
            <p className="font-medium text-slate-900">Imported {parsedRows.length} rows</p>
            <button onClick={resetImport} className="mt-1 text-emerald-700 hover:underline">
              Import another file
            </button>
          </div>
        </div>
      )}
    </AdminCard>
  )

  const auditCard = (
    <AdminCard
      title="Audit"
      subtitle="Staging mode (review before write)"
      icon={ShieldCheck}
      badge={auditRunning ? "Scanning" : pendingFixes.length > 0 ? `${pendingFixes.length} Pending` : undefined}
      badgeVariant={auditRunning ? "running" : "default"}
    >
      <p className="mb-3 text-xs text-slate-500 sm:mb-4">
        Scans records and stages fixes for manual review. No database writes until you click Approve.
      </p>

      <div className="mb-3 grid grid-cols-3 gap-1.5 sm:mb-4 sm:gap-2">
        <div className="rounded-md border border-slate-200 bg-slate-50 p-1.5 text-center sm:p-2">
          <div className="text-base font-semibold text-slate-900 sm:text-lg">{auditScanned.toLocaleString()}</div>
          <div className="text-[9px] uppercase tracking-wide text-slate-500 sm:text-[10px]">Scanned</div>
        </div>
        <div className="rounded-md border border-amber-200 bg-amber-50 p-1.5 text-center sm:p-2">
          <div className="text-base font-semibold text-amber-700 sm:text-lg">{pendingFixes.length.toLocaleString()}</div>
          <div className="text-[9px] uppercase tracking-wide text-slate-500 sm:text-[10px]">Pending</div>
        </div>
        <div className="rounded-md border border-rose-200 bg-rose-50 p-1.5 text-center sm:p-2">
          <div className="text-base font-semibold text-rose-700 sm:text-lg">{auditFailed.toLocaleString()}</div>
          <div className="text-[9px] uppercase tracking-wide text-slate-500 sm:text-[10px]">Errors</div>
        </div>
      </div>

      {auditRunning && (
        <div className="mb-3">
          <Progress value={auditPct} className="h-2" />
          <p className="mt-1 text-right text-[10px] text-slate-500">{auditPct}% scanned</p>
        </div>
      )}

      <div className="flex gap-2">
        {!auditRunning ? (
          <Button onClick={runAudit} className="flex-1 gap-1.5 bg-slate-900 hover:bg-slate-800">
            <Play className="h-4 w-4" />
            Run Staging Audit
          </Button>
        ) : (
          <Button onClick={stopAudit} variant="outline" className="flex-1 gap-1.5 bg-white">
            <Square className="h-4 w-4" /> Stop
          </Button>
        )}
        {(auditScanned > 0 || pendingFixes.length > 0) && !auditRunning && (
          <Button onClick={resetAudit} variant="ghost" size="icon" className="h-10 w-10">
            <span className="sr-only">Reset</span>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </Button>
        )}
      </div>
    </AdminCard>
  )

  const scrapeCard = (
    <AdminCard title="Scrape & Discovery" subtitle="URL or Easy Paste" icon={Globe}>
      <div className="space-y-2">
        <label className="flex items-center gap-1.5 text-xs font-medium text-slate-900">
          <Link2 className="h-3.5 w-3.5" /> Listing URL
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            type="url"
            placeholder="https://…"
            value={scrapeUrl}
            onChange={(e) => setScrapeUrl(e.target.value)}
            disabled={scraping}
            className="min-h-[44px] flex-1 border-slate-200 bg-white text-base sm:min-h-0 sm:text-sm"
          />
          <Button
            onClick={() => runScrape("url")}
            disabled={!scrapeUrl || scraping}
            className="min-h-[44px] gap-1.5 bg-slate-900 hover:bg-slate-800 sm:min-h-0"
          >
            {scraping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            <span className="sm:hidden">Scrape</span>
          </Button>
        </div>
      </div>

      <button
        onClick={() => setShowPaste((p) => !p)}
        className="mt-3 flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900"
      >
        <ClipboardPaste className="h-3.5 w-3.5" />
        {showPaste ? "Hide" : "Show"} Easy Paste
      </button>

      {showPaste && (
        <div className="mt-3 space-y-2">
          <Textarea
            placeholder="Paste HTML or listing text here…"
            value={pasteHtml}
            onChange={(e) => setPasteHtml(e.target.value)}
            rows={4}
            className="border-slate-200 bg-white text-sm"
          />
          <Button
            onClick={() => runScrape("paste")}
            disabled={!pasteHtml.trim() || scraping}
            variant="outline"
            className="w-full gap-1.5 bg-white"
          >
            {scraping ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardPaste className="h-4 w-4" />}
            Parse Pasted Content
          </Button>
        </div>
      )}

      {scrapeError && (
        <p className="mt-3 flex items-start text-xs text-rose-600">
          <XCircle className="mr-1.5 mt-0.5 h-3.5 w-3.5 flex-shrink-0" /> {scrapeError}
        </p>
      )}

      {scrapeListing && (
        <div className="mt-4 space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex-1">
              <p className="font-semibold text-slate-900">{scrapeListing.title ?? "Untitled listing"}</p>
              {(scrapeListing.address || scrapeListing.city) && (
                <p className="mt-0.5 text-slate-500">
                  {[scrapeListing.address, scrapeListing.city, scrapeListing.state, scrapeListing.zip_code]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {scrapeListing.matched_property_id && (
                <Badge className="bg-slate-900 text-white hover:bg-slate-800">Atlas Match</Badge>
              )}
              <Badge
                variant="outline"
                className={
                  scrapeListing.confidence >= 70
                    ? "border-emerald-300 text-emerald-700"
                    : scrapeListing.confidence >= 40
                      ? "border-amber-300 text-amber-700"
                      : "border-rose-300 text-rose-700"
                }
              >
                {scrapeListing.confidence}% confidence
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-slate-200 pt-2 sm:grid-cols-4">
            {scrapeListing.price !== null && (
              <div className="text-slate-500">
                Rent: <span className="font-semibold text-slate-900">${scrapeListing.price.toLocaleString()}</span>
              </div>
            )}
            {scrapeListing.bedrooms !== null && (
              <div className="text-slate-500">
                Beds: <span className="font-semibold text-slate-900">{scrapeListing.bedrooms === 0 ? "Studio" : scrapeListing.bedrooms}</span>
              </div>
            )}
            {scrapeListing.bathrooms !== null && (
              <div className="text-slate-500">
                Baths: <span className="font-semibold text-slate-900">{scrapeListing.bathrooms}</span>
              </div>
            )}
            {scrapeListing.square_feet !== null && (
              <div className="text-slate-500">
                Sq ft: <span className="font-semibold text-slate-900">{scrapeListing.square_feet.toLocaleString()}</span>
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 pt-2 text-[10px] text-slate-400">
            Source: {scrapeListing.source_host}
          </div>
        </div>
      )}
    </AdminCard>
  )

  return (
    <AdminHubLayout
      title="Property Data Hub"
      description="Import, audit, and scrape property records with staging review."
      breadcrumbs={[
        { label: "Admin", href: "/admin" },
        { label: "Property Data Hub" },
      ]}
      importCard={importCard}
      auditCard={auditCard}
      scrapeCard={scrapeCard}
      log={
        <LiveLog
          entries={logs}
          onClear={clearLogs}
          height={280}
          pendingRepairsCount={repairItems.length}
          onJumpToRepairs={() => {
            const el = document.getElementById("repair-console")
            if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
          }}
        />
      }
    >
      {/* Active Repair Console — same experience as the Resource Data Hub */}
      {repairItems.length > 0 && (
        <div id="repair-console" className="mt-6 sm:mt-8">
          <UnifiedRepairConsole<PropertyFieldName>
            title="Active Repair Console"
            description={`${repairItems.length} propert${repairItems.length === 1 ? "y" : "ies"} need attention. Pre-filled values are auto-suggested from typo repair and web search.`}
            items={repairItems}
            onSave={async (id, values) => {
              const res = await applyPropertyRepair(id, values)
              if (res.success) {
                setPendingFixes((prev) => prev.filter((f) => f.propertyId !== id))
              }
              return res
            }}
            onBulkSave={async (payload) => {
              const res = await bulkApplyPropertyRepairs(
                payload.map((p) => ({ propertyId: p.id, values: p.values })),
              )
              if (res.succeeded.length > 0) {
                const done = new Set(res.succeeded)
                setPendingFixes((prev) => prev.filter((f) => !done.has(f.propertyId)))
              }
              return {
                succeeded: res.succeeded,
                failed: res.failed.map((f) => ({ id: f.propertyId, message: f.message })),
              }
            }}
            buildFieldSearchUrl={(item, field) => {
              const q = `${item.title} ${FIELD_LABELS[field]} Butte County California`
                .replace(/\s+/g, " ")
                .trim()
              return `https://duckduckgo.com/?q=${encodeURIComponent(q)}`
            }}
            onLog={(level, message) => appendLog("AUDIT", level, message)}
          />
        </div>
      )}
    </AdminHubLayout>
  )
}
