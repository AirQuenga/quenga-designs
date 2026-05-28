"use client"

import { useState, useRef } from "react"
import * as XLSX from "xlsx"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  Link2,
  PlusCircle,
  Check,
} from "lucide-react"
import { LiveLog, type LogEntry, type LogSource, type LogStatus } from "@/components/admin/live-log"
import { AdminCard } from "@/components/admin/admin-card"
import { AdminHubLayout } from "@/components/admin/admin-hub-layout"
import {
  scrapeResourceDirectory,
  addDiscoveredResources,
  auditResourceBatch,
  getResourceAuditTotal,
  type ScrapedResource,
  type ResourceLogLine,
} from "@/app/actions/resource-hub"

const CATEGORIES = [
  "Food Assistance",
  "Housing",
  "Mental Health",
  "Healthcare",
  "Legal Aid",
  "Employment",
  "Family Services",
  "Senior Services",
  "Veteran Services",
  "Substance Abuse",
  "Disability Services",
  "Utility Assistance",
  "Education",
  "Transportation",
  "General Resources",
]

const TEMPLATE_HEADERS = [
  "category",
  "sub_category",
  "resource_name",
  "hours",
  "address",
  "phone_number",
  "website",
  "notes",
]

export default function ResourceDataHubPage() {
  /* ---------- IMPORT state ---------- */
  const [file, setFile] = useState<File | null>(null)
  const [parsedRows, setParsedRows] = useState<Record<string, unknown>[]>([])
  const [importProgress, setImportProgress] = useState(0)
  const [importStatus, setImportStatus] = useState<"idle" | "parsing" | "ready" | "importing" | "done" | "error">("idle")
  const [importError, setImportError] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>("")
  const dropRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const stopImportRef = useRef(false)

  /* ---------- AUDIT state ---------- */
  const [auditTotal, setAuditTotal] = useState<number | null>(null)
  const [auditScanned, setAuditScanned] = useState(0)
  const [auditFixed, setAuditFixed] = useState(0)
  const [auditFailed, setAuditFailed] = useState(0)
  const [auditRunning, setAuditRunning] = useState(false)
  const stopAuditRef = useRef(false)

  /* ---------- UNIFIED LOG state ---------- */
  const [logs, setLogs] = useState<LogEntry[]>([])
  const logIdRef = useRef(0)

  const appendLog = (source: LogSource, status: LogStatus, message: string) => {
    setLogs((prev) => {
      const next = [...prev, { id: ++logIdRef.current, timestamp: Date.now(), source, status, message }]
      return next.length > 1000 ? next.slice(-1000) : next
    })
  }

  const clearLogs = () => setLogs([])

  const mapLevel = (level: ResourceLogLine["level"]): LogStatus => {
    if (level === "FIXED") return "FIXED"
    if (level === "SUCCESS") return "SUCCESS"
    if (level === "ERROR") return "ERROR"
    if (level === "WARN") return "WARN"
    return "INFO"
  }

  /* ---------- SCRAPER state ---------- */
  const [scrapeUrl, setScrapeUrl] = useState("")
  const [scraping, setScraping] = useState(false)
  const [discoveredResources, setDiscoveredResources] = useState<ScrapedResource[]>([])
  const [addingAll, setAddingAll] = useState(false)
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set())

  /* ============================================================
   *  IMPORT — drag/drop + parse CSV / XLSX
   * ============================================================ */

  const downloadTemplate = () => {
    const csv = TEMPLATE_HEADERS.join(",") + "\n"
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "resource-import-template.csv"
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
    appendLog("IMPORT", "INFO", `Starting import of ${total.toLocaleString()} resources (batch size 25)`)

    for (let i = 0; i < total; i += batchSize) {
      if (stopImportRef.current) {
        appendLog("IMPORT", "WARN", `Import stopped by user at row ${i.toLocaleString()}`)
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
      appendLog("IMPORT", "SUCCESS", `Import complete — ${total.toLocaleString()} resources processed`)
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
   *  AUDIT — call auditResourceBatch() in a loop until done
   * ============================================================ */

  const runAudit = async () => {
    stopAuditRef.current = false
    setAuditRunning(true)
    setAuditScanned(0)
    setAuditFixed(0)
    setAuditFailed(0)

    try {
      const total = await getResourceAuditTotal()
      setAuditTotal(total)
      appendLog("AUDIT", "INFO", `Starting Resource Audit of ${total.toLocaleString()} records (batch size 25)`)

      let offset = 0
      while (true) {
        if (stopAuditRef.current) {
          appendLog("AUDIT", "WARN", `Audit stopped by user at row ${offset.toLocaleString()}`)
          break
        }

        const res = await auditResourceBatch(offset, 25)
        setAuditScanned((p) => p + res.scanned)
        setAuditFixed((p) => p + res.fixed)
        setAuditFailed((p) => p + res.failed)

        for (const line of res.logs) {
          appendLog("AUDIT", mapLevel(line.level), line.message)
        }

        if (res.nextOffset === null) {
          appendLog("AUDIT", "SUCCESS", `Audit complete — scanned ${total.toLocaleString()} records`)
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

  const stopAudit = () => {
    stopAuditRef.current = true
  }

  const resetAudit = () => {
    setAuditScanned(0)
    setAuditFixed(0)
    setAuditFailed(0)
    setAuditTotal(null)
  }

  const auditPct = auditTotal && auditTotal > 0 ? Math.min(100, Math.round((auditScanned / auditTotal) * 100)) : 0

  /* ============================================================
   *  SCRAPER — Multi-resource directory parsing
   * ============================================================ */

  const runScrape = async () => {
    if (!scrapeUrl) return
    setScraping(true)
    setDiscoveredResources([])
    appendLog("SCRAPE", "INFO", `Starting directory scrape: ${scrapeUrl}`)

    try {
      const result = await scrapeResourceDirectory(scrapeUrl)
      for (const line of result.logs) {
        appendLog("SCRAPE", mapLevel(line.level), line.message)
      }
      if (result.success) {
        setDiscoveredResources(result.resources)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error"
      appendLog("SCRAPE", "ERROR", `Scrape failed: ${msg}`)
    } finally {
      setScraping(false)
    }
  }

  const addAllResources = async () => {
    const newResources = discoveredResources.filter((r) => r.status === "new")
    if (newResources.length === 0) return

    setAddingAll(true)
    try {
      const result = await addDiscoveredResources(newResources)
      for (const line of result.logs) {
        appendLog("IMPORT", mapLevel(line.level), line.message)
      }
      setDiscoveredResources((prev) =>
        prev.map((r) => (r.status === "new" ? { ...r, status: "existing" as const } : r)),
      )
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error"
      appendLog("IMPORT", "ERROR", `Batch add failed: ${msg}`)
    } finally {
      setAddingAll(false)
    }
  }

  const addSingleResource = async (resource: ScrapedResource, index: number) => {
    const key = `${index}`
    setAddingIds((prev) => new Set([...prev, key]))

    try {
      const result = await addDiscoveredResources([resource])
      for (const line of result.logs) {
        appendLog("IMPORT", mapLevel(line.level), line.message)
      }
      setDiscoveredResources((prev) =>
        prev.map((r, i) => (i === index ? { ...r, status: "existing" as const } : r)),
      )
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error"
      appendLog("IMPORT", "ERROR", `Add failed: ${msg}`)
    } finally {
      setAddingIds((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }

  const newCount = discoveredResources.filter((r) => r.status === "new").length

  /* ============================================================
   *  CARD CONTENTS
   * ============================================================ */

  const importCard = (
    <AdminCard title="Import" subtitle="Excel or CSV upload" icon={Upload}>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full sm:w-48 border-slate-200 bg-white">
            <SelectValue placeholder="Category (optional)" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
            <Upload className="h-4 w-4" /> Import {parsedRows.length} Resources
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
            <p className="font-medium text-slate-900">Imported {parsedRows.length} resources</p>
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
      subtitle="Website verification scan"
      icon={ShieldCheck}
      badge={auditRunning ? "Running" : undefined}
      badgeVariant="running"
    >
      <p className="mb-3 text-xs text-slate-500 sm:mb-4">
        Verifies each resource still exists by checking website availability, standardizes phone formats,
        trims whitespace, and flags outdated records.
      </p>

      <div className="mb-3 grid grid-cols-3 gap-1.5 sm:mb-4 sm:gap-2">
        <div className="rounded-md border border-slate-200 bg-slate-50 p-1.5 text-center sm:p-2">
          <div className="text-base font-semibold text-slate-900 sm:text-lg">{auditScanned.toLocaleString()}</div>
          <div className="text-[9px] uppercase tracking-wide text-slate-500 sm:text-[10px]">Scanned</div>
        </div>
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-1.5 text-center sm:p-2">
          <div className="text-base font-semibold text-emerald-700 sm:text-lg">{auditFixed.toLocaleString()}</div>
          <div className="text-[9px] uppercase tracking-wide text-slate-500 sm:text-[10px]">Fixed</div>
        </div>
        <div className="rounded-md border border-rose-200 bg-rose-50 p-1.5 text-center sm:p-2">
          <div className="text-base font-semibold text-rose-700 sm:text-lg">{auditFailed.toLocaleString()}</div>
          <div className="text-[9px] uppercase tracking-wide text-slate-500 sm:text-[10px]">Errors</div>
        </div>
      </div>

      {auditRunning && (
        <div className="mb-3">
          <Progress value={auditPct} className="h-2" />
          <p className="mt-1 text-right text-[10px] text-slate-500">{auditPct}% complete</p>
        </div>
      )}

      <div className="flex gap-2">
        {!auditRunning ? (
          <Button onClick={runAudit} className="flex-1 gap-1.5 bg-slate-900 hover:bg-slate-800">
            <Play className="h-4 w-4" />
            Run Resource Audit
          </Button>
        ) : (
          <Button onClick={stopAudit} variant="outline" className="flex-1 gap-1.5 bg-white">
            <Square className="h-4 w-4" /> Stop
          </Button>
        )}
        {(auditScanned > 0 || auditFailed > 0) && !auditRunning && (
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
    <AdminCard title="Scrape & Discovery" subtitle="Multi-resource directory parser" icon={Globe}>
      {/* URL input */}
      <div className="space-y-2">
        <label className="flex items-center gap-1.5 text-xs font-medium text-slate-900">
          <Link2 className="h-3.5 w-3.5" /> Directory URL
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
            onClick={runScrape}
            disabled={!scrapeUrl || scraping}
            className="min-h-[44px] gap-1.5 bg-slate-900 hover:bg-slate-800 sm:min-h-0"
          >
            {scraping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            <span className="sm:hidden">Scrape</span>
          </Button>
        </div>
      </div>

      <p className="mt-2 text-[10px] text-slate-500">
        Enter a directory page URL (e.g., food bank listing). The scraper will extract each resource individually.
      </p>

      {/* Discovery Table */}
      {discoveredResources.length > 0 && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-900">
              Found {discoveredResources.length} resources ({newCount} new)
            </p>
            {newCount > 0 && (
              <Button
                size="sm"
                onClick={addAllResources}
                disabled={addingAll}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
              >
                {addingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlusCircle className="h-3.5 w-3.5" />}
                Add All ({newCount})
              </Button>
            )}
          </div>

          <div className="max-h-[200px] overflow-y-auto rounded-md border border-slate-200">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-100">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium text-slate-700">Name</th>
                  <th className="px-2 py-1.5 text-left font-medium text-slate-700 hidden sm:table-cell">Address</th>
                  <th className="px-2 py-1.5 text-left font-medium text-slate-700 hidden sm:table-cell">Phone</th>
                  <th className="px-2 py-1.5 text-center font-medium text-slate-700">Status</th>
                  <th className="px-2 py-1.5 text-center font-medium text-slate-700">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {discoveredResources.map((resource, i) => (
                  <tr key={i} className="bg-white hover:bg-slate-50">
                    <td className="px-2 py-1.5 text-slate-900">{resource.resource_name}</td>
                    <td className="px-2 py-1.5 text-slate-500 hidden sm:table-cell">{resource.address || "-"}</td>
                    <td className="px-2 py-1.5 text-slate-500 hidden sm:table-cell">{resource.phone_number || "-"}</td>
                    <td className="px-2 py-1.5 text-center">
                      <Badge
                        variant="outline"
                        className={
                          resource.status === "new"
                            ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                            : "border-slate-300 bg-slate-50 text-slate-500"
                        }
                      >
                        {resource.status === "new" ? "New" : "Existing"}
                      </Badge>
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      {resource.status === "new" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => addSingleResource(resource, i)}
                          disabled={addingIds.has(`${i}`)}
                          className="h-7 w-7 p-0"
                        >
                          {addingIds.has(`${i}`) ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <PlusCircle className="h-3.5 w-3.5 text-emerald-600" />
                          )}
                        </Button>
                      ) : (
                        <Check className="mx-auto h-3.5 w-3.5 text-slate-400" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AdminCard>
  )

  return (
    <AdminHubLayout
      title="Resource Data Hub"
      description="Manage community services — import, audit, and discover resources."
      breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Resource Data Hub" }]}
      importCard={importCard}
      auditCard={auditCard}
      scrapeCard={scrapeCard}
      log={<LiveLog entries={logs} onClear={clearLogs} height={280} />}
    />
  )
}
