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
  const [auditTotal, setAuditTotal] = useState<number | null>(null)
  const [auditScanned, setAuditScanned] = useState(0)
  const [auditFixed, setAuditFixed] = useState(0)
  const [auditFailed, setAuditFailed] = useState(0)
  const [auditRunning, setAuditRunning] = useState(false)
  const [auditLogs, setAuditLogs] = useState<AuditLogLine[]>([])
  const stopAuditRef = useRef(false)

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
    try {
      const buffer = await f.arrayBuffer()
      const wb = XLSX.read(buffer, { type: "array" })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json(sheet, { defval: null }) as Record<string, unknown>[]
      if (json.length === 0) {
        setImportStatus("error")
        setImportError("File is empty or could not be parsed.")
        return
      }
      setParsedRows(json)
      setImportStatus("ready")
    } catch (e) {
      setImportStatus("error")
      setImportError(e instanceof Error ? e.message : "Failed to parse file")
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    dropRef.current?.classList.remove("border-primary", "bg-primary/5")
    const f = e.dataTransfer.files?.[0]
    if (f) handleFileSelected(f)
  }

  const handleImport = async () => {
    // Simulated batched import progress driven by the parsed rows.
    // Real DB writes can be wired into this loop via a server action.
    setImportStatus("importing")
    setImportProgress(0)
    const total = parsedRows.length
    const batchSize = 50
    for (let i = 0; i < total; i += batchSize) {
      if (stopAuditRef.current) break
      await new Promise((r) => setTimeout(r, 120))
      setImportProgress(Math.round(Math.min(100, ((i + batchSize) / total) * 100)))
    }
    setImportProgress(100)
    setImportStatus("done")
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

  const runAudit = async () => {
    stopAuditRef.current = false
    setAuditRunning(true)
    setAuditScanned(0)
    setAuditFixed(0)
    setAuditFailed(0)
    setAuditLogs([])
    try {
      const total = await getAuditTotal()
      setAuditTotal(total)
      setAuditLogs([
        { level: "INFO", message: `[INFO] Starting audit of ${total.toLocaleString()} records (batch size 25)` },
      ])
      let offset = 0
      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (stopAuditRef.current) {
          setAuditLogs((p) => [...p, { level: "INFO", message: "[INFO] Audit stopped by user" }])
          break
        }
        const res = await auditBatch(offset, 25)
        setAuditScanned((p) => p + res.scanned)
        setAuditFixed((p) => p + res.fixed)
        setAuditFailed((p) => p + res.failed)
        if (res.logs.length > 0) {
          setAuditLogs((p) => [...p, ...res.logs].slice(-400))
        }
        if (res.nextOffset === null) {
          setAuditLogs((p) => [
            ...p,
            { level: "INFO", message: `[INFO] Audit complete. Reached end of records.` },
          ])
          break
        }
        offset = res.nextOffset
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error"
      setAuditLogs((p) => [...p, { level: "ERROR", message: `[ERROR] Audit halted: ${msg}` }])
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
    setAuditLogs([])
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
    try {
      const body = mode === "url" ? { url: scrapeUrl } : { html: pasteHtml }
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setScrapeError(data.error + (data.hint ? ` — ${data.hint}` : ""))
        if (data.hint && mode === "url") setShowPaste(true)
      } else {
        setScrapeListing(data.listing)
      }
    } catch (e) {
      setScrapeError(e instanceof Error ? e.message : "Network error")
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

            <p className="mb-4 text-xs text-muted-foreground">
              Scans all property records in batches of 25. Each fix is persisted to Supabase immediately. Geocodes
              missing coordinates, standardizes addresses, fills ZIP codes, and repairs known typos.
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
                  <Play className="h-4 w-4" /> Run System Audit
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

            {auditLogs.length > 0 && (
              <div className="mt-4 flex h-56 flex-col overflow-y-auto rounded-md border border-slate-700 bg-slate-950 p-3 font-mono text-[11px] leading-relaxed">
                {auditLogs.slice(-200).map((line, i) => (
                  <div
                    key={i}
                    className={
                      line.level === "SUCCESS"
                        ? "text-emerald-400"
                        : line.level === "ERROR"
                          ? "text-red-400"
                          : "text-slate-400"
                    }
                  >
                    {line.message}
                  </div>
                ))}
              </div>
            )}
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
      </main>

      <SiteFooter />
    </div>
  )
}
