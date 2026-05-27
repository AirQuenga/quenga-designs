"use client"

import { useState, useRef } from "react"
import Link from "next/link"
import SiteHeader from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ArrowLeft,
  Plus,
  Globe,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  Play,
  Square,
  RotateCcw,
  Search,
  PlusCircle,
  Check,
} from "lucide-react"
import { LiveLog, type LogEntry, type LogSource, type LogStatus } from "@/components/admin/live-log"
import {
  scrapeResourceDirectory,
  addDiscoveredResources,
  createResource,
  auditResourceBatch,
  getResourceAuditTotal,
  type ScrapedResource,
  type ResourceLogLine,
} from "@/app/actions/resource-hub"

type TabId = "manual" | "scraper" | "audit"

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

export default function ResourceDataHubPage() {
  /* ---------- TAB state ---------- */
  const [activeTab, setActiveTab] = useState<TabId>("manual")

  /* ---------- UNIFIED LOG state ---------- */
  const [logs, setLogs] = useState<LogEntry[]>([])
  const logIdRef = useRef(0)

  const appendLog = (source: LogSource, status: LogStatus, message: string) => {
    setLogs((prev) => {
      const next = [
        ...prev,
        { id: ++logIdRef.current, timestamp: Date.now(), source, status, message },
      ]
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

  /* ---------- MANUAL ENTRY state ---------- */
  const [manualForm, setManualForm] = useState({
    category: "",
    sub_category: "",
    resource_name: "",
    hours: "",
    address: "",
    phone_number: "",
    website: "",
    notes: "",
  })
  const [manualSubmitting, setManualSubmitting] = useState(false)
  const [manualSuccess, setManualSuccess] = useState(false)

  const handleManualSubmit = async () => {
    if (!manualForm.category || !manualForm.resource_name) {
      appendLog("SYSTEM", "WARN", "Category and Resource Name are required")
      return
    }

    setManualSubmitting(true)
    setManualSuccess(false)

    try {
      const result = await createResource({
        category: manualForm.category,
        resource_name: manualForm.resource_name,
        sub_category: manualForm.sub_category || null,
        hours: manualForm.hours || null,
        address: manualForm.address || null,
        phone_number: manualForm.phone_number || null,
        website: manualForm.website || null,
        notes: manualForm.notes || null,
      })

      for (const line of result.logs) {
        appendLog("IMPORT", mapLevel(line.level), line.message)
      }

      if (result.success) {
        setManualSuccess(true)
        setManualForm({
          category: "",
          sub_category: "",
          resource_name: "",
          hours: "",
          address: "",
          phone_number: "",
          website: "",
          notes: "",
        })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error"
      appendLog("IMPORT", "ERROR", `Failed to create resource: ${msg}`)
    } finally {
      setManualSubmitting(false)
    }
  }

  /* ---------- SCRAPER state ---------- */
  const [scrapeUrl, setScrapeUrl] = useState("")
  const [scraping, setScraping] = useState(false)
  const [discoveredResources, setDiscoveredResources] = useState<ScrapedResource[]>([])
  const [addingAll, setAddingAll] = useState(false)
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set())

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
      // Mark added resources as existing
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
      // Mark as existing
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

  /* ---------- AUDIT state ---------- */
  const [auditTotal, setAuditTotal] = useState<number | null>(null)
  const [auditScanned, setAuditScanned] = useState(0)
  const [auditFixed, setAuditFixed] = useState(0)
  const [auditFailed, setAuditFailed] = useState(0)
  const [auditRunning, setAuditRunning] = useState(false)
  const stopAuditRef = useRef(false)

  const runAudit = async () => {
    stopAuditRef.current = false
    setAuditRunning(true)
    setAuditScanned(0)
    setAuditFixed(0)
    setAuditFailed(0)

    try {
      const total = await getResourceAuditTotal()
      setAuditTotal(total)
      appendLog(
        "AUDIT",
        "INFO",
        `Starting Resource Audit of ${total.toLocaleString()} records (batch size 25)`,
      )

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
          appendLog(
            "AUDIT",
            "SUCCESS",
            `Audit complete — scanned ${total.toLocaleString()} records`,
          )
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

  const auditPct =
    auditTotal && auditTotal > 0 ? Math.min(100, Math.round((auditScanned / auditTotal) * 100)) : 0

  const newCount = discoveredResources.filter((r) => r.status === "new").length

  /* ---------- RENDER ---------- */
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
        {/* Page header */}
        <header className="mb-6 flex flex-col gap-3 sm:mb-10 sm:gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Link
              href="/admin"
              className="inline-flex items-center text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="mr-1 h-4 w-4" /> Back to Admin
            </Link>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
              Resource Data Hub
            </h1>
            <p className="mt-1 text-sm text-muted-foreground sm:mt-2 sm:text-base">
              Manage community services — manual entry, web scraping, and data auditing.
            </p>
          </div>
          <Badge variant="secondary" className="h-7 self-start bg-primary/10 px-3 text-primary md:self-end">
            Restricted Access
          </Badge>
        </header>

        {/* Tab Navigation */}
        <div className="mb-6 flex gap-1 rounded-lg border border-border bg-muted/30 p-1">
          <button
            onClick={() => setActiveTab("manual")}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "manual"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Plus className="mr-1.5 inline-block h-4 w-4" />
            Manual Entry
          </button>
          <button
            onClick={() => setActiveTab("scraper")}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "scraper"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Globe className="mr-1.5 inline-block h-4 w-4" />
            Scraper & Discovery
          </button>
          <button
            onClick={() => setActiveTab("audit")}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "audit"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ShieldCheck className="mr-1.5 inline-block h-4 w-4" />
            Resource Audit
          </button>
        </div>

        {/* Tab Content */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* ---------- MANUAL ENTRY TAB ---------- */}
          {activeTab === "manual" && (
            <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6 lg:col-span-2">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Plus className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Add New Resource</h2>
                  <p className="text-xs text-muted-foreground">
                    Manually enter a community service or resource
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground">
                    Category <span className="text-destructive">*</span>
                  </label>
                  <Select
                    value={manualForm.category}
                    onValueChange={(v) => setManualForm((p) => ({ ...p, category: v }))}
                  >
                    <SelectTrigger className="min-h-[44px] sm:min-h-0">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground">Sub-Category</label>
                  <Input
                    placeholder="e.g., Emergency Food"
                    value={manualForm.sub_category}
                    onChange={(e) => setManualForm((p) => ({ ...p, sub_category: e.target.value }))}
                    className="min-h-[44px] text-base sm:min-h-0 sm:text-sm"
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <label className="text-xs font-medium text-foreground">
                    Resource Name <span className="text-destructive">*</span>
                  </label>
                  <Input
                    placeholder="e.g., Chico Food Pantry"
                    value={manualForm.resource_name}
                    onChange={(e) => setManualForm((p) => ({ ...p, resource_name: e.target.value }))}
                    className="min-h-[44px] text-base sm:min-h-0 sm:text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground">Hours</label>
                  <Input
                    placeholder="e.g., Mon-Fri 9am-5pm"
                    value={manualForm.hours}
                    onChange={(e) => setManualForm((p) => ({ ...p, hours: e.target.value }))}
                    className="min-h-[44px] text-base sm:min-h-0 sm:text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground">Address</label>
                  <Input
                    placeholder="123 Main St, Chico, CA"
                    value={manualForm.address}
                    onChange={(e) => setManualForm((p) => ({ ...p, address: e.target.value }))}
                    className="min-h-[44px] text-base sm:min-h-0 sm:text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground">Phone</label>
                  <Input
                    type="tel"
                    placeholder="(530) 555-0123"
                    value={manualForm.phone_number}
                    onChange={(e) => setManualForm((p) => ({ ...p, phone_number: e.target.value }))}
                    className="min-h-[44px] text-base sm:min-h-0 sm:text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground">Website</label>
                  <Input
                    type="url"
                    placeholder="https://..."
                    value={manualForm.website}
                    onChange={(e) => setManualForm((p) => ({ ...p, website: e.target.value }))}
                    className="min-h-[44px] text-base sm:min-h-0 sm:text-sm"
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <label className="text-xs font-medium text-foreground">Notes</label>
                  <Textarea
                    placeholder="Additional details, eligibility requirements, etc."
                    value={manualForm.notes}
                    onChange={(e) => setManualForm((p) => ({ ...p, notes: e.target.value }))}
                    rows={3}
                    className="text-base sm:text-sm"
                  />
                </div>

                <div className="sm:col-span-2">
                  {manualSuccess ? (
                    <div className="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      <span className="font-medium text-foreground">Resource added successfully!</span>
                      <button
                        onClick={() => setManualSuccess(false)}
                        className="ml-auto text-primary hover:underline"
                      >
                        Add another
                      </button>
                    </div>
                  ) : (
                    <Button
                      onClick={handleManualSubmit}
                      disabled={manualSubmitting || !manualForm.category || !manualForm.resource_name}
                      className="min-h-[44px] w-full gap-1.5 sm:min-h-0 sm:w-auto"
                    >
                      {manualSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <PlusCircle className="h-4 w-4" />
                      )}
                      Add Resource
                    </Button>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* ---------- SCRAPER TAB ---------- */}
          {activeTab === "scraper" && (
            <>
              <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Globe className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Directory Scraper</h2>
                    <p className="text-xs text-muted-foreground">
                      Extract multiple resources from a directory page
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                      <Search className="h-3.5 w-3.5" /> Directory URL
                    </label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input
                        type="url"
                        placeholder="https://example.org/community-resources"
                        value={scrapeUrl}
                        onChange={(e) => setScrapeUrl(e.target.value)}
                        disabled={scraping}
                        className="min-h-[44px] flex-1 text-base sm:min-h-0 sm:text-sm"
                      />
                      <Button
                        onClick={runScrape}
                        disabled={!scrapeUrl || scraping}
                        className="min-h-[44px] gap-1.5 sm:min-h-0"
                      >
                        {scraping ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                        Scrape
                      </Button>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Paste a URL to a directory or listing page. The scraper will extract organization
                    names, addresses, phone numbers, and websites.
                  </p>
                </div>
              </section>

              {/* Discovery Table */}
              <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Discovery Results</h3>
                    <p className="text-xs text-muted-foreground">
                      {discoveredResources.length === 0
                        ? "Run a scrape to discover resources"
                        : `${discoveredResources.length} resources found · ${newCount} new`}
                    </p>
                  </div>
                  {newCount > 0 && (
                    <Button
                      size="sm"
                      onClick={addAllResources}
                      disabled={addingAll}
                      className="gap-1.5"
                    >
                      {addingAll ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <PlusCircle className="h-3.5 w-3.5" />
                      )}
                      Add All ({newCount})
                    </Button>
                  )}
                </div>

                <div className="max-h-[400px] overflow-y-auto rounded-md border border-border">
                  {discoveredResources.length === 0 ? (
                    <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                      No resources discovered yet
                    </div>
                  ) : (
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 border-b border-border bg-muted/50">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-foreground">Name</th>
                          <th className="hidden px-3 py-2 text-left font-medium text-foreground sm:table-cell">
                            Address
                          </th>
                          <th className="hidden px-3 py-2 text-left font-medium text-foreground md:table-cell">
                            Phone
                          </th>
                          <th className="px-3 py-2 text-center font-medium text-foreground">Status</th>
                          <th className="px-3 py-2 text-right font-medium text-foreground">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {discoveredResources.map((resource, index) => (
                          <tr key={index} className="hover:bg-muted/30">
                            <td className="px-3 py-2">
                              <div className="font-medium text-foreground">{resource.resource_name}</div>
                              <div className="text-[10px] text-muted-foreground">{resource.category}</div>
                            </td>
                            <td className="hidden px-3 py-2 text-muted-foreground sm:table-cell">
                              {resource.address || "—"}
                            </td>
                            <td className="hidden px-3 py-2 text-muted-foreground md:table-cell">
                              {resource.phone_number || "—"}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <Badge
                                variant="outline"
                                className={
                                  resource.status === "new"
                                    ? "border-emerald-500/50 text-emerald-700"
                                    : "border-slate-300 text-slate-600"
                                }
                              >
                                {resource.status === "new" ? "New" : "Existing"}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 text-right">
                              {resource.status === "new" ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => addSingleResource(resource, index)}
                                  disabled={addingIds.has(`${index}`)}
                                  className="h-7 gap-1 px-2"
                                >
                                  {addingIds.has(`${index}`) ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Plus className="h-3 w-3" />
                                  )}
                                  Add
                                </Button>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-slate-500">
                                  <Check className="h-3 w-3" /> Added
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </section>
            </>
          )}

          {/* ---------- AUDIT TAB ---------- */}
          {activeTab === "audit" && (
            <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6 lg:col-span-2">
              <div className="mb-5 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Resource Audit</h2>
                    <p className="text-xs text-muted-foreground">
                      Verify and repair community service records
                    </p>
                  </div>
                </div>
                {auditRunning && (
                  <Badge className="h-6 bg-primary/10 text-primary hover:bg-primary/10">Running</Badge>
                )}
              </div>

              <p className="mb-4 text-xs text-muted-foreground">
                Scans all community service records in batches of 25. Checks website availability,
                standardizes phone formats, and trims whitespace. Unreachable websites are flagged
                for manual review.
              </p>

              <div className="mb-4 grid grid-cols-3 gap-2">
                <div className="rounded-md border border-border bg-muted/30 p-2 text-center">
                  <div className="text-lg font-semibold text-foreground">
                    {auditScanned.toLocaleString()}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Scanned
                  </div>
                </div>
                <div className="rounded-md border border-border bg-emerald-50 p-2 text-center dark:bg-emerald-950/30">
                  <div className="text-lg font-semibold text-emerald-700 dark:text-emerald-400">
                    {auditFixed.toLocaleString()}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Fixed
                  </div>
                </div>
                <div className="rounded-md border border-border bg-red-50 p-2 text-center dark:bg-red-950/30">
                  <div className="text-lg font-semibold text-red-700 dark:text-red-400">
                    {auditFailed.toLocaleString()}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Errors
                  </div>
                </div>
              </div>

              {auditRunning && (
                <div className="mb-4 space-y-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Progress</span>
                    <span className="font-semibold text-foreground">{auditPct}%</span>
                  </div>
                  <Progress value={auditPct} className="h-2" />
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {!auditRunning ? (
                  <Button onClick={runAudit} className="min-h-[44px] flex-1 gap-1.5 sm:min-h-0 sm:flex-none">
                    <Play className="h-4 w-4" />
                    Run Resource Audit
                  </Button>
                ) : (
                  <Button
                    onClick={stopAudit}
                    variant="outline"
                    className="min-h-[44px] flex-1 gap-1.5 bg-transparent sm:min-h-0 sm:flex-none"
                  >
                    <Square className="h-4 w-4" /> Stop
                  </Button>
                )}
                <Button
                  onClick={resetAudit}
                  variant="outline"
                  disabled={auditRunning}
                  className="min-h-[44px] gap-1.5 bg-transparent sm:min-h-0"
                >
                  <RotateCcw className="h-4 w-4" /> Reset
                </Button>
              </div>
            </section>
          )}
        </div>

        {/* Activity Log */}
        <div className="mt-6 sm:mt-8">
          <LiveLog entries={logs} onClear={clearLogs} height={280} />
          <p className="mt-2 text-[11px] text-muted-foreground sm:text-xs">
            Tracks every Manual Entry, Scrape, and Audit event in real time. Database updates are
            logged only after Supabase confirms the write.
          </p>
        </div>
      </main>
    </div>
  )
}
