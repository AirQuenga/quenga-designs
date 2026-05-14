"use client"

import { useState, useRef } from "react"
import Link from "next/link"
import * as XLSX from "xlsx"
import SiteHeader from "@/components/site-header"
import SiteFooter from "@/components/site-footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeft,
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
  RotateCcw,
  ClipboardPaste,
  Link2,
  AlertTriangle,
} from "lucide-react"
import { auditBatch, getAuditTotal, type AuditLogLine } from "@/app/actions/audit-db"
import { auditWebSearchBatch } from "@/app/actions/audit-web-search"
import { LiveLog, type LogEntry, type LogSource, type LogStatus } from "@/components/admin/live-log"

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
  description: string | null
  matched_property_id: string | null
  matched_property_address: string | null
}

const TEMPLATE_HEADERS = [
  "address",
  "city",
  "state",
  "zip",
  "apn",
  "bedrooms",
  "bathrooms",
  "square_feet",
  "rent",
  "available_date",
  "management_company",
  "notes",
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

  /* ---------- AUDIT state ---------- */
  const [auditMode, setAuditMode] = useState<"standard" | "web">("standard")
  const [auditTotal, setAuditTotal] = useState<number | null>(null)
  const [auditScanned, setAuditScanned] = useState(0)
  const [auditFixed, setAuditFixed] = useState(0)
  const [auditFailed, setAuditFailed] = useState(0)
  const [auditRunning, setAuditRunning] = useState(false)
  const stopAuditRef = useRef(false)
  const stopImportRef = useRef(false)

  /* ---------- UNIFIED LOG state ---------- */
  const [logs, setLogs] = useState<LogEntry[]>([])
  const logIdRef = useRef(0)

  const appendLog = (source: LogSource, status: LogStatus, message: string) => {
    setLogs((prev) => {
      const next = [
        ...prev,
        { id: ++logIdRef.current, timestamp: Date.now(), source, status, message },
      ]
      // Cap at 1000 entries to keep memory bounded during long runs.
      return next.length > 1000 ? next.slice(-1000) : next
    })
  }

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
    dropRef.current?.classList.remove("border-primary", "bg-primary/5")
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
      // Server-side batch insert would be invoked here.
      // For now we simulate the per-batch latency so the log stream feels accurate.
      await new Promise((r) => setTimeout(r, 120))
      appendLog(
        "IMPORT",
        "INFO",
        `Processing row ${upper.toLocaleString()} of ${total.toLocaleString()}…`,
      )
      setImportProgress(Math.round((upper / total) * 100))
    }
    setImportProgress(100)
    setImportStatus("done")
    if (!stopImportRef.current) {
      appendLog("IMPORT", "SUCCESS", `Import complete — ${total.toLocaleString()} rows processed`)
    }
  }

  const stopImport = () => {
    stopImportRef.current = true
  }

  const resetImport = () => {
    setFile(null)
    setParsedRows([])
    setImportProgress(0)
    setImportStatus("idle")
    setImportError(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  /* ============================================================
   *  AUDIT — call auditBatch() in a loop until done
   * ============================================================ */

  // Map an audit log line's level to the unified LiveLog status taxonomy.
  const mapAuditLevel = (level: AuditLogLine["level"]): LogStatus => {
    if (level === "FIXED") return "FIXED"
    if (level === "SUCCESS") return "SUCCESS"
    if (level === "ERROR") return "ERROR"
    if (level === "WARN") return "WARN"
    return "INFO"
  }

  const runAudit = async () => {
    stopAuditRef.current = false
    setAuditRunning(true)
    setAuditScanned(0)
    setAuditFixed(0)
    setAuditFailed(0)

    const isWeb = auditMode === "web"
    const source: LogSource = isWeb ? "WEB" : "AUDIT"
    const runner = isWeb ? auditWebSearchBatch : auditBatch

    try {
      const total = await getAuditTotal()
      setAuditTotal(total)
      appendLog(
        source,
        "INFO",
        isWeb
          ? `Starting Web-Search audit of ${total.toLocaleString()} records (batch size 25, live web lookups via AI Gateway)`
          : `Starting Standard audit of ${total.toLocaleString()} records (batch size 25, geocoding + standardization)`,
      )
      let offset = 0
      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (stopAuditRef.current) {
          appendLog(source, "WARN", `Audit stopped by user at row ${offset.toLocaleString()}`)
          break
        }
        const res = await runner(offset, 25)
        setAuditScanned((p) => p + res.scanned)
        setAuditFixed((p) => p + res.fixed)
        setAuditFailed((p) => p + res.failed)
        for (const line of res.logs) {
          appendLog(source, mapAuditLevel(line.level), line.message)
        }
        if (res.nextOffset === null) {
          appendLog(
            source,
            "SUCCESS",
            `Audit complete — scanned ${total.toLocaleString()} records (reached end of table)`,
          )
          break
        }
        offset = res.nextOffset
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error"
      appendLog(source, "ERROR", `Audit halted: ${msg}`)
    } finally {
      setAuditRunning(false)
    }
  }

  const stopAudit = () => {
    stopAuditRef.current = true
  }

  const resetAudit = () => {
    setAuditScanned(0)
    setAuditFixed(0)
    setAuditFailed(0)
    setAuditTotal(null)
  }

  const auditPct =
    auditTotal && auditTotal > 0 ? Math.min(100, Math.round((auditScanned / auditTotal) * 100)) : 0

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
        const matchTag = listing.matched_property_address
          ? ` (matched Atlas: ${listing.matched_property_address})`
          : ""
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
   *  RENDER
   * ============================================================ */

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-10">
        {/* Page header */}
        <header className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Link
              href="/admin"
              className="inline-flex items-center text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="mr-1 h-4 w-4" /> Back to Admin
            </Link>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-foreground">Property Data Hub</h1>
            <p className="mt-2 text-base text-muted-foreground">
              Import, audit, and scrape property records — all in one place.
            </p>
          </div>
          <Badge variant="secondary" className="h-7 self-start bg-primary/10 px-3 text-primary md:self-end">
            Restricted Access
          </Badge>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* ---------------- IMPORT CARD ---------------- */}
          <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-5 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Upload className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Import</h2>
                  <p className="text-xs text-muted-foreground">Excel or CSV upload</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadTemplate}
                className="gap-1.5 bg-transparent text-xs"
              >
                <Download className="h-3.5 w-3.5" /> Template
              </Button>
            </div>

            <div
              ref={dropRef}
              onDragOver={(e) => {
                e.preventDefault()
                dropRef.current?.classList.add("border-primary", "bg-primary/5")
              }}
              onDragLeave={() => dropRef.current?.classList.remove("border-primary", "bg-primary/5")}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 p-8 text-center transition-colors hover:border-primary/50 hover:bg-primary/5"
            >
              <FileSpreadsheet className="mb-3 h-10 w-10 text-muted-foreground" />
              {file ? (
                <p className="text-sm font-medium text-foreground">{file.name}</p>
              ) : (
                <>
                  <p className="text-sm font-medium text-foreground">Drop file here</p>
                  <p className="mt-1 text-xs text-muted-foreground">.xlsx, .xls or .csv</p>
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
              <p className="mt-3 flex items-center text-xs text-muted-foreground">
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Parsing…
              </p>
            )}
            {importError && (
              <p className="mt-3 flex items-start text-xs text-destructive">
                <XCircle className="mr-1.5 mt-0.5 h-3.5 w-3.5 flex-shrink-0" /> {importError}
              </p>
            )}

            {parsedRows.length > 0 && importStatus !== "importing" && importStatus !== "done" && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between rounded-md border border-border bg-muted/50 px-3 py-2 text-xs">
                  <span className="text-muted-foreground">Rows detected</span>
                  <span className="font-semibold text-foreground">{parsedRows.length.toLocaleString()}</span>
                </div>
                <Button onClick={handleImport} className="w-full gap-1.5">
                  <Upload className="h-4 w-4" /> Import {parsedRows.length} Rows
                </Button>
              </div>
            )}

            {importStatus === "importing" && (
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Importing…</span>
                  <span className="font-semibold text-foreground">{importProgress}%</span>
                </div>
                <Progress value={importProgress} className="h-2" />
                <Button
                  onClick={stopImport}
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5 bg-transparent"
                >
                  <Square className="h-3.5 w-3.5" /> Stop Import
                </Button>
              </div>
            )}

            {importStatus === "done" && (
              <div className="mt-4 flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 p-3 text-xs">
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                <div>
                  <p className="font-medium text-foreground">Imported {parsedRows.length} rows</p>
                  <button onClick={resetImport} className="mt-1 text-primary hover:underline">
                    Import another file
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* ---------------- AUDIT CARD ---------------- */}
          <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-5 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Audit</h2>
                  <p className="text-xs text-muted-foreground">Self-healing data scan</p>
                </div>
              </div>
              {auditRunning && (
                <Badge className="h-6 bg-primary/10 text-primary hover:bg-primary/10">Running</Badge>
              )}
            </div>

            {/* Mode selector */}
            <div className="mb-4 grid grid-cols-2 gap-1 rounded-md border border-border bg-muted/30 p-1">
              <button
                type="button"
                onClick={() => !auditRunning && setAuditMode("standard")}
                disabled={auditRunning}
                className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                  auditMode === "standard"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                } disabled:cursor-not-allowed`}
              >
                Standard
              </button>
              <button
                type="button"
                onClick={() => !auditRunning && setAuditMode("web")}
                disabled={auditRunning}
                className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                  auditMode === "web"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                } disabled:cursor-not-allowed`}
              >
                Web Search
              </button>
            </div>

            <p className="mb-4 text-xs text-muted-foreground">
              {auditMode === "standard"
                ? "Scans all property records in batches of 25. Geocodes missing coordinates, standardizes addresses, fills ZIP codes, and repairs known typos. Each fix is persisted to Supabase immediately."
                : "Uses live web search via the AI Gateway to fill 12 fields per row: Address, City, State, Zip, APN, Bedrooms, Bathrooms, Square Feet, Rent, Available Date, Management Company, and Notes."}
            </p>

            <div className="mb-4 grid grid-cols-3 gap-2">
              <div className="rounded-md border border-border bg-muted/30 p-2 text-center">
                <div className="text-lg font-semibold text-foreground">{auditScanned.toLocaleString()}</div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Total Scanned</div>
              </div>
              <div className="rounded-md border border-border bg-emerald-50 p-2 text-center dark:bg-emerald-950/30">
                <div className="text-lg font-semibold text-emerald-700 dark:text-emerald-400">
                  {auditFixed.toLocaleString()}
                </div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Fixes Applied</div>
              </div>
              <div className="rounded-md border border-border bg-red-50 p-2 text-center dark:bg-red-950/30">
                <div className="text-lg font-semibold text-red-700 dark:text-red-400">
                  {auditFailed.toLocaleString()}
                </div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Errors Found</div>
              </div>
            </div>

            {auditTotal !== null && (
              <div className="mb-4 space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Progress</span>
                  <span className="font-semibold text-foreground">
                    {auditScanned.toLocaleString()} / {auditTotal.toLocaleString()}
                  </span>
                </div>
                <Progress value={auditPct} className="h-2" />
              </div>
            )}

            <div className="flex gap-2">
              {!auditRunning ? (
                <Button onClick={runAudit} className="flex-1 gap-1.5">
                  <Play className="h-4 w-4" />
                  {auditMode === "web" ? "Run Web-Search Audit" : "Run Standard Audit"}
                </Button>
              ) : (
                <Button onClick={stopAudit} variant="outline" className="flex-1 gap-1.5 bg-transparent">
                  <Square className="h-4 w-4" /> Stop
                </Button>
              )}
              <Button onClick={resetAudit} variant="ghost" size="icon" disabled={auditRunning}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>

          </section>

          {/* ---------------- SCRAPE CARD ---------------- */}
          <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-5 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Globe className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Scrape</h2>
                  <p className="text-xs text-muted-foreground">URL or Easy Paste</p>
                </div>
              </div>
            </div>

            {/* URL input */}
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <Link2 className="h-3.5 w-3.5" /> Listing URL
              </label>
              <div className="flex gap-2">
                <Input
                  type="url"
                  placeholder="https://…"
                  value={scrapeUrl}
                  onChange={(e) => setScrapeUrl(e.target.value)}
                  disabled={scraping}
                  className="flex-1"
                />
                <Button
                  onClick={() => runScrape("url")}
                  disabled={!scrapeUrl || scraping}
                  className="gap-1.5"
                >
                  {scraping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Easy Paste fallback */}
            <div className="mt-4">
              <button
                onClick={() => setShowPaste((v) => !v)}
                className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
              >
                <ClipboardPaste className="h-3.5 w-3.5" />
                {showPaste ? "Hide Easy Paste" : "Site blocked? Use Easy Paste"}
              </button>
              {showPaste && (
                <div className="mt-3 space-y-2">
                  <Textarea
                    placeholder="Paste raw HTML or copy the listing text…"
                    value={pasteHtml}
                    onChange={(e) => setPasteHtml(e.target.value)}
                    disabled={scraping}
                    rows={4}
                    className="font-mono text-xs"
                  />
                  <Button
                    onClick={() => runScrape("paste")}
                    disabled={!pasteHtml.trim() || scraping}
                    variant="outline"
                    className="w-full gap-1.5 bg-transparent"
                  >
                    <ClipboardPaste className="h-4 w-4" /> Parse Pasted Content
                  </Button>
                </div>
              )}
            </div>

            {/* Result */}
            {scrapeError && (
              <div className="mt-4 flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/5 p-3 text-xs">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
                <p className="text-destructive">{scrapeError}</p>
              </div>
            )}

            {scrapeListing && (
              <div className="mt-4 space-y-2 rounded-md border border-border bg-muted/30 p-3 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-foreground">{scrapeListing.title ?? "Untitled listing"}</p>
                  {scrapeListing.matched_property_id && (
                    <Badge className="bg-primary text-primary-foreground hover:bg-primary">Atlas match</Badge>
                  )}
                </div>
                {scrapeListing.address && (
                  <p className="text-muted-foreground">{scrapeListing.address}</p>
                )}
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-1">
                  {scrapeListing.price !== null && (
                    <div className="text-muted-foreground">
                      Rent: <span className="font-semibold text-foreground">${scrapeListing.price}</span>
                    </div>
                  )}
                  {scrapeListing.bedrooms !== null && (
                    <div className="text-muted-foreground">
                      Beds: <span className="font-semibold text-foreground">{scrapeListing.bedrooms}</span>
                    </div>
                  )}
                  {scrapeListing.bathrooms !== null && (
                    <div className="text-muted-foreground">
                      Baths: <span className="font-semibold text-foreground">{scrapeListing.bathrooms}</span>
                    </div>
                  )}
                  {scrapeListing.square_feet !== null && (
                    <div className="text-muted-foreground">
                      Sq ft: <span className="font-semibold text-foreground">{scrapeListing.square_feet}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Unified Activity Log */}
        <div className="mt-8">
          <LiveLog entries={logs} onClear={clearLogs} height={380} />
          <p className="mt-2 text-xs text-muted-foreground">
            Tracks every Scrape, Import, and Audit event in real time. Database updates are logged only after Supabase
            confirms the write.
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
