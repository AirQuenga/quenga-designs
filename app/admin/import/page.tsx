"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import {
  Upload,
  CheckCircle,
  AlertCircle,
  Loader2,
  Database,
  MapPin,
  Home,
  Plus,
  ArrowLeft,
  Globe,
  Search,
} from "lucide-react"
import { parseAPNs, getStats } from "@/data/apns"
import { parseAddresses, getAddressStats } from "@/data/addresses"
import { importAPNsToDatabase } from "@/app/actions/import-apns"
import { importAddressesToDatabase } from "@/app/actions/import-addresses"
import { scrapeRentalListings, importScrapedProperties } from "@/app/actions/scrape-rentals"
import { ManualEntryForm } from "@/components/admin/manual-entry-form"
import Link from "next/link"
import { RENTAL_SOURCES, type RentalSource } from "@/app/actions/scrape-rentals"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { SiteHeader } from "@/components/site-header"

const GOOGLE_SHEETS_URL =
  "https://docs.google.com/spreadsheets/d/174_jO1aF9RLXJhRXeuqqc0HR4j0j5qLh/edit?usp=sharing&ouid=109559821974235632283&rtpof=true&sd=true"

export default function ImportPage() {
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentBatch, setCurrentBatch] = useState(0)
  const [totalBatches, setTotalBatches] = useState(0)
  const [apnStats, setApnStats] = useState<{
    total: number
    unique: number
    duplicates: number
  } | null>(null)
  const [addressStats, setAddressStats] = useState<{
    total: number
    unique: number
    duplicates: number
  } | null>(null)
  const [results, setResults] = useState<{
    success: number
    failed: number
    skipped: number
    errors: string[]
  } | null>(null)
  const [logs, setLogs] = useState<string[]>([])

  const [scrapeSources, setScrapeSources] = useState<string[]>(["known"])
  const [scrapeResults, setScrapeResults] = useState<{
    properties: any[]
    errors: string[]
  } | null>(null)
  const [isScraping, setIsScraping] = useState(false)
  const [scrapePhase, setScrapePhase] = useState<"idle" | "scraping" | "importing">("idle")

  const [sourceFilter, setSourceFilter] = useState<"all" | "active" | "blocked" | "api-only">("all")

  useEffect(() => {
    try {
      setApnStats(getStats())
    } catch (e) {
      console.error("Failed to load APN stats:", e)
    }
    try {
      setAddressStats(getAddressStats())
    } catch (e) {
      console.error("Failed to load address stats:", e)
    }
  }, [])

  const addLog = (message: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`])
  }

  const runImport = async (
    type: "apn" | "address",
    items: string[] | ReturnType<typeof parseAddresses>,
    importFn: (batch: any[]) => Promise<{ success: number; failed: number; skipped: number; errors: string[] }>,
  ) => {
    setIsProcessing(true)
    setProgress(0)
    setResults(null)
    setLogs([])

    try {
      addLog(`Starting ${type} import...`)
      addLog(`Found ${items.length} unique ${type}s to process`)

      const batchSize = 25
      const batches = Math.ceil(items.length / batchSize)
      setTotalBatches(batches)

      let successCount = 0
      let failedCount = 0
      let skippedCount = 0
      const errors: string[] = []

      for (let i = 0; i < batches; i++) {
        setCurrentBatch(i + 1)
        const batch = items.slice(i * batchSize, (i + 1) * batchSize)
        addLog(`Processing batch ${i + 1}/${batches} (${batch.length} ${type}s)...`)

        try {
          const result = await importFn(batch as any)
          successCount += result.success
          failedCount += result.failed
          skippedCount += result.skipped

          if (result.errors.length > 0) {
            const remainingSlots = 200 - errors.length
            if (remainingSlots > 0) {
              errors.push(...result.errors.slice(0, remainingSlots))
            }
          }

          addLog(`Batch ${i + 1}: ${result.success} success, ${result.skipped} skipped, ${result.failed} failed`)
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : "Unknown error"
          addLog(`Batch ${i + 1} failed: ${errMsg.slice(0, 100)}`)
          failedCount += batch.length
          if (errors.length < 200) {
            errors.push(`Batch ${i + 1}: ${errMsg.slice(0, 80)}`)
          }
        }

        setProgress(((i + 1) / batches) * 100)
        await new Promise((resolve) => setTimeout(resolve, 500))
      }

      setResults({ success: successCount, failed: failedCount, skipped: skippedCount, errors })
      addLog(`Import complete! ${successCount} inserted, ${skippedCount} skipped, ${failedCount} failed`)
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unknown error"
      addLog(`Import failed: ${errMsg}`)
    } finally {
      setIsProcessing(false)
      setCurrentBatch(0)
      setTotalBatches(0)
    }
  }

  const handleAPNImport = () => runImport("apn", parseAPNs(), importAPNsToDatabase)
  const handleAddressImport = () => runImport("address", parseAddresses(), importAddressesToDatabase)

  const handleScrape = async () => {
    setIsScraping(true)
    setScrapePhase("scraping")
    setLogs([])
    setScrapeResults(null)
    setResults(null)

    try {
      addLog("Starting web scrape...")
      addLog(`Sources: ${scrapeSources.join(", ")}`)

      const result = await scrapeRentalListings(scrapeSources)

      addLog(`Scrape complete! Found ${result.properties.length} properties`)

      if (result.errors.length > 0) {
        result.errors.forEach((err) => addLog(`Error: ${err}`))
      }

      setScrapeResults({
        properties: result.properties,
        errors: result.errors,
      })
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unknown error"
      addLog(`Scrape failed: ${errMsg}`)
    } finally {
      setIsScraping(false)
      setScrapePhase("idle")
    }
  }

  const handleImportScraped = async () => {
    if (!scrapeResults?.properties.length) return

    setIsProcessing(true)
    setScrapePhase("importing")
    setProgress(0)

    try {
      addLog(`Importing ${scrapeResults.properties.length} scraped properties...`)

      const batchSize = 10
      const batches = Math.ceil(scrapeResults.properties.length / batchSize)
      setTotalBatches(batches)

      let successCount = 0
      let failedCount = 0
      let skippedCount = 0
      const errors: string[] = []

      for (let i = 0; i < batches; i++) {
        setCurrentBatch(i + 1)
        const batch = scrapeResults.properties.slice(i * batchSize, (i + 1) * batchSize)
        addLog(`Importing batch ${i + 1}/${batches}...`)

        try {
          const result = await importScrapedProperties(batch)
          successCount += result.success
          failedCount += result.failed
          skippedCount += result.skipped

          if (result.errors.length > 0) {
            errors.push(...result.errors.slice(0, 50))
          }

          addLog(`Batch ${i + 1}: ${result.success} success, ${result.skipped} skipped, ${result.failed} failed`)
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : "Unknown error"
          addLog(`Batch ${i + 1} failed: ${errMsg.slice(0, 100)}`)
          failedCount += batch.length
        }

        setProgress(((i + 1) / batches) * 100)
        await new Promise((resolve) => setTimeout(resolve, 500))
      }

      setResults({ success: successCount, failed: failedCount, skipped: skippedCount, errors })
      addLog(`Import complete! ${successCount} inserted, ${skippedCount} skipped, ${failedCount} failed`)
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unknown error"
      addLog(`Import failed: ${errMsg}`)
    } finally {
      setIsProcessing(false)
      setScrapePhase("idle")
      setCurrentBatch(0)
      setTotalBatches(0)
    }
  }

  const toggleSource = (source: string) => {
    setScrapeSources((prev) => (prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source]))
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black transition-colors duration-300">
      <SiteHeader />

      {/* Hero Section */}
      <section className="pt-24 pb-12 px-6">
        <div className="max-w-7xl mx-auto">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-8">
            <Link href="/" className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
              <Home className="h-4 w-4" />
            </Link>
            <span>/</span>
            <Link href="/admin" className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
              Admin
            </Link>
            <span>/</span>
            <span>Import</span>
          </div>

          {/* Back button and title */}
          <div className="flex items-center gap-4 mb-8">
            <Link href="/admin">
              <Button variant="ghost" size="icon" className="h-10 w-10">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-5xl md:text-6xl font-semibold tracking-tight">Property Data Import</h1>
          </div>

          <Tabs defaultValue="manual" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="manual" className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Manual Entry
              </TabsTrigger>
              <TabsTrigger value="scrape" className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Web Scrape
              </TabsTrigger>
              <TabsTrigger value="addresses" className="flex items-center gap-2">
                <Home className="h-4 w-4" />
                Addresses ({addressStats?.unique || 0})
              </TabsTrigger>
              <TabsTrigger value="apns" className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                APNs ({apnStats?.unique || 0})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="manual" className="space-y-6">
              <ManualEntryForm />
            </TabsContent>

            <TabsContent value="scrape" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    Web Scrape Rental Listings (50 Sources)
                  </CardTitle>
                  <CardDescription>Select sources to scrape. Most major sites block automation.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Source Selection */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-semibold">
                        All Sources ({Object.keys(RENTAL_SOURCES).length})
                      </Label>
                      <div className="flex gap-2">
                        <Button
                          variant={sourceFilter === "all" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSourceFilter("all")}
                        >
                          All
                        </Button>
                        <Button
                          variant={sourceFilter === "active" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSourceFilter("active")}
                        >
                          Active Only
                        </Button>
                        <Button
                          variant={sourceFilter === "blocked" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSourceFilter("blocked")}
                        >
                          Blocked
                        </Button>
                        <Button
                          variant={sourceFilter === "api-only" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSourceFilter("api-only")}
                        >
                          API Only
                        </Button>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const activeSources = Object.values(RENTAL_SOURCES)
                            .filter((s) => s.status === "active")
                            .map((s) => s.id)
                          setScrapeSources(activeSources)
                        }}
                      >
                        Select Active Only
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setScrapeSources([])}>
                        Clear All
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const filteredSources = Object.values(RENTAL_SOURCES)
                            .filter((s) => sourceFilter === "all" || s.status === sourceFilter)
                            .map((s) => s.id)
                          setScrapeSources(filteredSources)
                        }}
                      >
                        Select Filtered
                      </Button>
                    </div>

                    <ScrollArea className="h-[500px] border rounded-lg p-4">
                      <div className="space-y-6">
                        {/* Internal Databases */}
                        <div>
                          <h3 className="font-semibold mb-3 flex items-center gap-2">
                            <Database className="h-4 w-4" />
                            Internal Databases (
                            {
                              Object.values(RENTAL_SOURCES).filter(
                                (s) =>
                                  s.category === "database" && (sourceFilter === "all" || s.status === sourceFilter),
                              ).length
                            }
                            )
                          </h3>
                          <div className="space-y-2">
                            {Object.values(RENTAL_SOURCES)
                              .filter(
                                (s) =>
                                  s.category === "database" && (sourceFilter === "all" || s.status === sourceFilter),
                              )
                              .map((source) => (
                                <SourceCard
                                  key={source.id}
                                  source={source}
                                  isSelected={scrapeSources.includes(source.id)}
                                  onToggle={() => toggleSource(source.id)}
                                />
                              ))}
                          </div>
                        </div>

                        {/* Local Sites */}
                        <div>
                          <h3 className="font-semibold mb-3 flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            Local Butte County Sites (
                            {
                              Object.values(RENTAL_SOURCES).filter(
                                (s) => s.category === "local" && (sourceFilter === "all" || s.status === sourceFilter),
                              ).length
                            }
                            )
                          </h3>
                          <div className="space-y-2">
                            {Object.values(RENTAL_SOURCES)
                              .filter(
                                (s) => s.category === "local" && (sourceFilter === "all" || s.status === sourceFilter),
                              )
                              .map((source) => (
                                <SourceCard
                                  key={source.id}
                                  source={source}
                                  isSelected={scrapeSources.includes(source.id)}
                                  onToggle={() => toggleSource(source.id)}
                                />
                              ))}
                          </div>
                        </div>

                        {/* National Sites */}
                        <div>
                          <h3 className="font-semibold mb-3 flex items-center gap-2">
                            <Globe className="h-4 w-4" />
                            National Rental Sites (
                            {
                              Object.values(RENTAL_SOURCES).filter(
                                (s) =>
                                  s.category === "national" && (sourceFilter === "all" || s.status === sourceFilter),
                              ).length
                            }
                            )
                          </h3>
                          <div className="space-y-2">
                            {Object.values(RENTAL_SOURCES)
                              .filter(
                                (s) =>
                                  s.category === "national" && (sourceFilter === "all" || s.status === sourceFilter),
                              )
                              .map((source) => (
                                <SourceCard
                                  key={source.id}
                                  source={source}
                                  isSelected={scrapeSources.includes(source.id)}
                                  onToggle={() => toggleSource(source.id)}
                                />
                              ))}
                          </div>
                        </div>
                        {/* Classifieds */}
                        <div>
                          <h3 className="font-semibold mb-3 flex items-center gap-2">
                            <Search className="h-4 w-4" />
                            Classifieds & Marketplaces (
                            {
                              Object.values(RENTAL_SOURCES).filter(
                                (s) =>
                                  s.category === "classifieds" && (sourceFilter === "all" || s.status === sourceFilter),
                              ).length
                            }
                            )
                          </h3>
                          <div className="space-y-2">
                            {Object.values(RENTAL_SOURCES)
                              .filter(
                                (s) =>
                                  s.category === "classifieds" && (sourceFilter === "all" || s.status === sourceFilter),
                              )
                              .map((source) => (
                                <SourceCard
                                  key={source.id}
                                  source={source}
                                  isSelected={scrapeSources.includes(source.id)}
                                  onToggle={() => toggleSource(source.id)}
                                />
                              ))}
                          </div>
                        </div>
                      </div>
                    </ScrollArea>

                    {/* Summary */}
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <span className="text-sm font-medium">
                        {scrapeSources.length} source{scrapeSources.length !== 1 ? "s" : ""} selected
                      </span>
                      <span className="text-sm text-muted-foreground">
                        Est.{" "}
                        {Object.values(RENTAL_SOURCES)
                          .filter((s) => scrapeSources.includes(s.id))
                          .reduce((sum, s) => sum + s.estimatedListings, 0)}{" "}
                        listings
                      </span>
                    </div>
                  </div>

                  {/* Scrape Button */}
                  <Button
                    onClick={handleScrape}
                    disabled={isScraping || isProcessing || scrapeSources.length === 0}
                    className="w-full"
                    size="lg"
                  >
                    {isScraping ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Scraping {scrapeSources.length} source{scrapeSources.length !== 1 ? "s" : ""}...
                      </>
                    ) : (
                      <>
                        <Search className="mr-2 h-4 w-4" />
                        Start Scraping {scrapeSources.length} Source{scrapeSources.length !== 1 ? "s" : ""}
                      </>
                    )}
                  </Button>

                  {/* Scrape Results */}
                  {scrapeResults && (
                    <Card className="bg-muted/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <CheckCircle className="h-5 w-5 text-green-500" />
                          Scrape Results
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="text-center p-4 bg-green-100 dark:bg-green-900/30 rounded-lg">
                            <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                              {scrapeResults.properties.length}
                            </div>
                            <div className="text-sm text-muted-foreground">Properties Found</div>
                          </div>
                          <div className="text-center p-4 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                            <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                              {scrapeResults.errors.length}
                            </div>
                            <div className="text-sm text-muted-foreground">Errors</div>
                          </div>
                        </div>

                        {scrapeResults.properties.length > 0 && (
                          <>
                            <ScrollArea className="h-48 border rounded-lg p-4">
                              <div className="space-y-2">
                                {scrapeResults.properties.slice(0, 20).map((prop, i) => (
                                  <div key={i} className="text-sm p-2 bg-background rounded border">
                                    <div className="font-medium">{prop.propertyName || prop.address}</div>
                                    <div className="text-muted-foreground flex gap-4">
                                      <span>
                                        {prop.bedrooms}BR/{prop.bathrooms}BA
                                      </span>
                                      {prop.rent && <span className="text-green-600">${prop.rent}/mo</span>}
                                      <span className="text-xs">{prop.source}</span>
                                    </div>
                                  </div>
                                ))}
                                {scrapeResults.properties.length > 20 && (
                                  <div className="text-sm text-muted-foreground text-center py-2">
                                    ...and {scrapeResults.properties.length - 20} more
                                  </div>
                                )}
                              </div>
                            </ScrollArea>

                            <Button
                              onClick={handleImportScraped}
                              disabled={isProcessing}
                              className="w-full"
                              variant="default"
                            >
                              {isProcessing ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Importing... {currentBatch > 0 && `(${currentBatch}/${totalBatches})`}
                                </>
                              ) : (
                                <>
                                  <Upload className="mr-2 h-4 w-4" />
                                  Import {scrapeResults.properties.length} Properties to Database
                                </>
                              )}
                            </Button>
                          </>
                        )}

                        {isProcessing && (
                          <div className="space-y-2">
                            <Progress value={progress} />
                            <p className="text-sm text-center text-muted-foreground">
                              {Math.round(progress)}% complete
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Address Import Tab */}
            <TabsContent value="addresses" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Home className="h-5 w-5" />
                    Address File Statistics
                  </CardTitle>
                  <CardDescription>Data loaded from data/addresses.ts</CardDescription>
                </CardHeader>
                <CardContent>
                  {addressStats ? (
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-muted rounded-lg">
                        <div className="text-3xl font-bold">{addressStats.total.toLocaleString()}</div>
                        <div className="text-sm text-muted-foreground">Total Lines</div>
                      </div>
                      <div className="text-center p-4 bg-green-100 dark:bg-green-900/30 rounded-lg">
                        <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                          {addressStats.unique.toLocaleString()}
                        </div>
                        <div className="text-sm text-muted-foreground">Unique Addresses</div>
                      </div>
                      <div className="text-center p-4 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                        <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                          {addressStats.duplicates.toLocaleString()}
                        </div>
                        <div className="text-sm text-muted-foreground">Duplicates</div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Import Addresses
                  </CardTitle>
                  <CardDescription>Geocode addresses and insert into Supabase</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button
                    onClick={handleAddressImport}
                    disabled={isProcessing || !addressStats}
                    className="w-full"
                    size="lg"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Importing... {currentBatch > 0 && `(Batch ${currentBatch}/${totalBatches})`}
                      </>
                    ) : (
                      <>
                        <MapPin className="mr-2 h-4 w-4" />
                        Import {addressStats?.unique.toLocaleString()} Addresses
                      </>
                    )}
                  </Button>

                  {isProcessing && (
                    <div className="space-y-2">
                      <Progress value={progress} />
                      <p className="text-sm text-center text-muted-foreground">
                        {Math.round(progress)}% complete
                        {currentBatch > 0 && ` - Batch ${currentBatch} of ${totalBatches}`}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* APN Import Tab */}
            <TabsContent value="apns" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    APN File Statistics
                  </CardTitle>
                  <CardDescription>Data loaded from data/apns.ts</CardDescription>
                </CardHeader>
                <CardContent>
                  {apnStats ? (
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-muted rounded-lg">
                        <div className="text-3xl font-bold">{apnStats.total.toLocaleString()}</div>
                        <div className="text-sm text-muted-foreground">Total Lines</div>
                      </div>
                      <div className="text-center p-4 bg-green-100 dark:bg-green-900/30 rounded-lg">
                        <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                          {apnStats.unique.toLocaleString()}
                        </div>
                        <div className="text-sm text-muted-foreground">Unique APNs</div>
                      </div>
                      <div className="text-center p-4 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                        <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                          {apnStats.duplicates.toLocaleString()}
                        </div>
                        <div className="text-sm text-muted-foreground">Duplicates</div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Import APNs
                  </CardTitle>
                  <CardDescription>Enrich APNs with address data and insert into Supabase</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button onClick={handleAPNImport} disabled={isProcessing || !apnStats} className="w-full" size="lg">
                    {isProcessing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Importing... {currentBatch > 0 && `(Batch ${currentBatch}/${totalBatches})`}
                      </>
                    ) : (
                      <>
                        <MapPin className="mr-2 h-4 w-4" />
                        Import {apnStats?.unique.toLocaleString()} APNs
                      </>
                    )}
                  </Button>

                  {isProcessing && (
                    <div className="space-y-2">
                      <Progress value={progress} />
                      <p className="text-sm text-center text-muted-foreground">
                        {Math.round(progress)}% complete
                        {currentBatch > 0 && ` - Batch ${currentBatch} of ${totalBatches}`}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Results */}
          {results && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {results.failed === 0 ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-yellow-500" />
                  )}
                  Import Results Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-green-100 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {results.success.toLocaleString()}
                    </div>
                    <div className="text-sm font-medium text-green-700 dark:text-green-300">Inserted</div>
                  </div>
                  <div className="text-center p-4 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg border border-yellow-200 dark:border-yellow-800">
                    <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                      {results.skipped.toLocaleString()}
                    </div>
                    <div className="text-sm font-medium text-yellow-700 dark:text-yellow-300">Skipped</div>
                  </div>
                  <div className="text-center p-4 bg-red-100 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-800">
                    <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                      {results.failed.toLocaleString()}
                    </div>
                    <div className="text-sm font-medium text-red-700 dark:text-red-300">Failed</div>
                  </div>
                </div>

                {results.errors.length > 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>
                      Errors ({results.errors.length}
                      {results.errors.length >= 200 ? "+" : ""})
                    </AlertTitle>
                    <AlertDescription>
                      <ScrollArea className="h-48 mt-2">
                        <ul className="list-none space-y-1">
                          {results.errors.map((error, i) => (
                            <li
                              key={i}
                              className="text-xs font-mono py-1 border-b border-red-200 dark:border-red-800 last:border-0"
                            >
                              {error}
                            </li>
                          ))}
                        </ul>
                      </ScrollArea>
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}

          {/* Logs */}
          {logs.length > 0 && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Import Log</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-48 rounded border p-4">
                  <div className="font-mono text-sm space-y-1">
                    {logs.map((log, i) => (
                      <div key={i} className="text-muted-foreground">
                        {log}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </div>
  )
}

// SourceCard component for individual source selection
function SourceCard({
  source,
  isSelected,
  onToggle,
}: { source: RentalSource; isSelected: boolean; onToggle: () => void }) {
  const statusColors = {
    active: "bg-green-500",
    blocked: "bg-red-500",
    "api-only": "bg-yellow-500",
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
      <Checkbox checked={isSelected} onCheckedChange={onToggle} disabled={source.status !== "active"} />
      <div className={`h-2 w-2 rounded-full ${statusColors[source.status]}`} title={source.status} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{source.name}</span>
          <Badge variant="outline" className="text-xs">
            {source.estimatedListings}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground truncate">{source.description}</p>
      </div>
    </div>
  )
}
