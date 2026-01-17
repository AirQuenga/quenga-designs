"use client"

import type React from "react"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { SiteHeader } from "@/components/site-header"
import { ManualEntryForm } from "@/components/admin/manual-entry-form"
import {
  Home,
  ArrowLeft,
  Upload,
  Database,
  Globe,
  Loader2,
  CheckCircle,
  AlertCircle,
  Plus,
  MapPin,
  Search,
  RefreshCw,
  ExternalLink,
} from "lucide-react"
import { importAPNs, getAPNStats, type ImportResult } from "@/app/actions/import-apns"
import { importAddresses, getAddressStats } from "@/app/actions/import-addresses"
import { scrapeRentals, importScrapedProperties, type ScrapeResult } from "@/app/actions/scrape-rentals"
import { refreshAllProperties, type RefreshResult } from "@/app/actions/refresh-properties"

const SOURCES = [
  // Internal Databases (1)
  {
    id: "known",
    name: "Known Properties Database",
    category: "database",
    status: "active" as const,
    estimatedListings: 25,
    description: "Butte County apartment complexes - WORKS AUTOMATICALLY",
    url: null,
  },
  // Local Butte County Sites (8)
  {
    id: "hignell",
    name: "Hignell Companies",
    category: "local",
    status: "blocked" as const,
    estimatedListings: 50,
    description: "Local property management",
    url: "https://www.hignell.com/rentals",
  },
  {
    id: "blueoak",
    name: "Blue Oak Property Management",
    category: "local",
    status: "blocked" as const,
    estimatedListings: 30,
    description: "Chico rentals",
    url: "https://www.blueoakpm.com/rentals",
  },
  {
    id: "sheraton",
    name: "Sheraton Properties",
    category: "local",
    status: "blocked" as const,
    estimatedListings: 40,
    description: "North state rentals",
    url: "https://www.sheratonproperties.com",
  },
  {
    id: "fpi",
    name: "FPI Management",
    category: "local",
    status: "blocked" as const,
    estimatedListings: 35,
    description: "Apartment communities",
    url: "https://www.fpimgt.com/apartments/california/chico",
  },
  {
    id: "weidner",
    name: "Weidner Apartment Homes",
    category: "local",
    status: "blocked" as const,
    estimatedListings: 45,
    description: "Apartment living",
    url: "https://www.weidner.com/apartments/ca/chico",
  },
  {
    id: "chicoforrent",
    name: "ChicoForRent.com",
    category: "local",
    status: "blocked" as const,
    estimatedListings: 60,
    description: "Local rental listings",
    url: "https://www.chicoforrent.com",
  },
  {
    id: "rentinchico",
    name: "RentInChico.com",
    category: "local",
    status: "blocked" as const,
    estimatedListings: 55,
    description: "Chico area rentals",
    url: "https://www.rentinchico.com",
  },
  {
    id: "eaglepointe",
    name: "Eaglepointe Paradise",
    category: "local",
    status: "blocked" as const,
    estimatedListings: 20,
    description: "Paradise apartments",
    url: "https://www.eaglepointeparadise.com",
  },
  // National Rental Sites (26)
  {
    id: "zillow",
    name: "Zillow",
    category: "national",
    status: "api-only" as const,
    estimatedListings: 500,
    description: "Real estate marketplace",
    url: "https://www.zillow.com/chico-ca/rentals/",
  },
  {
    id: "apartments",
    name: "Apartments.com",
    category: "national",
    status: "blocked" as const,
    estimatedListings: 400,
    description: "Apartment search",
    url: "https://www.apartments.com/chico-ca/",
  },
  {
    id: "realtor",
    name: "Realtor.com",
    category: "national",
    status: "api-only" as const,
    estimatedListings: 350,
    description: "Real estate listings",
    url: "https://www.realtor.com/apartments/Chico_CA",
  },
  {
    id: "trulia",
    name: "Trulia",
    category: "national",
    status: "blocked" as const,
    estimatedListings: 300,
    description: "Home rentals",
    url: "https://www.trulia.com/for_rent/Chico,CA/",
  },
  {
    id: "hotpads",
    name: "HotPads",
    category: "national",
    status: "blocked" as const,
    estimatedListings: 250,
    description: "Map-based search",
    url: "https://hotpads.com/chico-ca/apartments-for-rent",
  },
  {
    id: "rent",
    name: "Rent.com",
    category: "national",
    status: "blocked" as const,
    estimatedListings: 200,
    description: "Apartment finder",
    url: "https://www.rent.com/california/chico-apartments",
  },
  {
    id: "zumper",
    name: "Zumper",
    category: "national",
    status: "blocked" as const,
    estimatedListings: 180,
    description: "Rental platform",
    url: "https://www.zumper.com/apartments-for-rent/chico-ca",
  },
  {
    id: "padmapper",
    name: "PadMapper",
    category: "national",
    status: "blocked" as const,
    estimatedListings: 150,
    description: "Map search",
    url: "https://www.padmapper.com/apartments/chico-ca",
  },
  {
    id: "forrent",
    name: "ForRent.com",
    category: "national",
    status: "blocked" as const,
    estimatedListings: 120,
    description: "Rental listings",
    url: "https://www.forrent.com/find/CA/metro-Chico",
  },
  {
    id: "rentcafe",
    name: "RentCafe",
    category: "national",
    status: "blocked" as const,
    estimatedListings: 100,
    description: "Apartment search",
    url: "https://www.rentcafe.com/apartments-for-rent/us/ca/chico/",
  },
  {
    id: "apartmentguide",
    name: "Apartment Guide",
    category: "national",
    status: "blocked" as const,
    estimatedListings: 90,
    description: "Apartment finder",
    url: "https://www.apartmentguide.com/apartments/California/Chico/",
  },
  {
    id: "rentpath",
    name: "RentPath",
    category: "national",
    status: "blocked" as const,
    estimatedListings: 80,
    description: "Rental network",
    url: "https://www.rentpath.com",
  },
  {
    id: "cozy",
    name: "Cozy (Apartments.com)",
    category: "national",
    status: "blocked" as const,
    estimatedListings: 70,
    description: "Rental management",
    url: "https://cozy.co",
  },
  {
    id: "avail",
    name: "Avail",
    category: "national",
    status: "blocked" as const,
    estimatedListings: 60,
    description: "Landlord tools",
    url: "https://www.avail.co/rentals",
  },
  {
    id: "turbotenant",
    name: "TurboTenant",
    category: "national",
    status: "blocked" as const,
    estimatedListings: 55,
    description: "Landlord software",
    url: "https://www.turbotenant.com/rental-listings/california/chico/",
  },
  {
    id: "rentberry",
    name: "Rentberry",
    category: "national",
    status: "blocked" as const,
    estimatedListings: 50,
    description: "Rental bidding",
    url: "https://rentberry.com/apartments/s/chico-ca",
  },
  {
    id: "apartmentlist",
    name: "Apartment List",
    category: "national",
    status: "blocked" as const,
    estimatedListings: 200,
    description: "Personalized search",
    url: "https://www.apartmentlist.com/ca/chico",
  },
  {
    id: "rentals",
    name: "Rentals.com",
    category: "national",
    status: "blocked" as const,
    estimatedListings: 150,
    description: "Rental marketplace",
    url: "https://www.rentals.com/california/chico/",
  },
  {
    id: "westsiderentals",
    name: "Westside Rentals",
    category: "national",
    status: "blocked" as const,
    estimatedListings: 40,
    description: "CA rentals",
    url: "https://www.westsiderentals.com/chico-ca",
  },
  {
    id: "abodo",
    name: "ABODO",
    category: "national",
    status: "blocked" as const,
    estimatedListings: 100,
    description: "Apartment search",
    url: "https://www.abodo.com/chico-ca",
  },
  {
    id: "rentjungle",
    name: "Rent Jungle",
    category: "national",
    status: "blocked" as const,
    estimatedListings: 80,
    description: "Aggregator",
    url: "https://www.rentjungle.com/apartments/california/chico/",
  },
  {
    id: "housinglist",
    name: "HousingList",
    category: "national",
    status: "blocked" as const,
    estimatedListings: 60,
    description: "Section 8 listings",
    url: "https://www.housinglist.com/ca/chico",
  },
  {
    id: "gosection8",
    name: "GoSection8",
    category: "national",
    status: "api-only" as const,
    estimatedListings: 75,
    description: "Section 8 housing",
    url: "https://www.gosection8.com/Section-8-housing-in-Chico-CA",
  },
  {
    id: "affordablehousing",
    name: "AffordableHousing.com",
    category: "national",
    status: "blocked" as const,
    estimatedListings: 50,
    description: "Low income housing",
    url: "https://affordablehousingonline.com/housing-search/California/Chico",
  },
  {
    id: "socialserve",
    name: "Socialserve.com",
    category: "national",
    status: "blocked" as const,
    estimatedListings: 45,
    description: "Affordable housing",
    url: "https://www.socialserve.com/tenant/CA/Search.html",
  },
  {
    id: "hud",
    name: "HUD Resource Locator",
    category: "national",
    status: "api-only" as const,
    estimatedListings: 30,
    description: "HUD housing",
    url: "https://resources.hud.gov/",
  },
  // Classifieds & Marketplaces (15)
  {
    id: "craigslist",
    name: "Craigslist Chico",
    category: "classifieds",
    status: "blocked" as const,
    estimatedListings: 150,
    description: "Local classifieds",
    url: "https://chico.craigslist.org/search/apa",
  },
  {
    id: "facebook",
    name: "Facebook Marketplace",
    category: "classifieds",
    status: "blocked" as const,
    estimatedListings: 200,
    description: "Social marketplace",
    url: "https://www.facebook.com/marketplace/chico/propertyrentals",
  },
  {
    id: "fbgroups",
    name: "Facebook Rental Groups",
    category: "classifieds",
    status: "blocked" as const,
    estimatedListings: 100,
    description: "Community groups",
    url: "https://www.facebook.com/groups/search/groups?q=chico%20rentals",
  },
  {
    id: "nextdoor",
    name: "Nextdoor",
    category: "classifieds",
    status: "blocked" as const,
    estimatedListings: 50,
    description: "Neighborhood app",
    url: "https://nextdoor.com",
  },
  {
    id: "oodle",
    name: "Oodle",
    category: "classifieds",
    status: "blocked" as const,
    estimatedListings: 40,
    description: "Classifieds aggregator",
    url: "https://www.oodle.com/housing/for-rent/chico-ca/",
  },
  {
    id: "geebo",
    name: "Geebo",
    category: "classifieds",
    status: "blocked" as const,
    estimatedListings: 30,
    description: "Safe classifieds",
    url: "https://chico.geebo.com/housing-rent/",
  },
  {
    id: "offerup",
    name: "OfferUp",
    category: "classifieds",
    status: "blocked" as const,
    estimatedListings: 25,
    description: "Local marketplace",
    url: "https://offerup.com/explore/l/chico-ca/real-estate/rentals",
  },
  {
    id: "kijiji",
    name: "Kijiji",
    category: "classifieds",
    status: "blocked" as const,
    estimatedListings: 20,
    description: "Classifieds",
    url: "https://www.kijiji.ca/b-for-rent/california/chico/k0c30349001l9001",
  },
  {
    id: "recycler",
    name: "Recycler",
    category: "classifieds",
    status: "blocked" as const,
    estimatedListings: 15,
    description: "Free classifieds",
    url: "https://www.recycler.com/chico/rentals",
  },
  {
    id: "locanto",
    name: "Locanto",
    category: "classifieds",
    status: "blocked" as const,
    estimatedListings: 20,
    description: "Free ads",
    url: "https://chico.locanto.com/Apartments-For-Rent/270/",
  },
  {
    id: "pennysaver",
    name: "PennySaver",
    category: "classifieds",
    status: "blocked" as const,
    estimatedListings: 15,
    description: "Local ads",
    url: "https://www.pennysaverusa.com/california/chico/real-estate/for-rent/",
  },
  {
    id: "classifiedads",
    name: "ClassifiedAds.com",
    category: "classifieds",
    status: "blocked" as const,
    estimatedListings: 10,
    description: "Free classifieds",
    url: "https://www.classifiedads.com/real_estate_rentals/chico-ca/",
  },
  {
    id: "americanlisted",
    name: "AmericanListed",
    category: "classifieds",
    status: "blocked" as const,
    estimatedListings: 15,
    description: "US classifieds",
    url: "https://chico.americanlisted.com/house-apartment-for-rent/",
  },
  {
    id: "adpost",
    name: "Adpost",
    category: "classifieds",
    status: "blocked" as const,
    estimatedListings: 10,
    description: "Global classifieds",
    url: "https://www.adpost.com/us/california/chico/real_estate/rentals/",
  },
  {
    id: "postlets",
    name: "Postlets (Zillow)",
    category: "classifieds",
    status: "blocked" as const,
    estimatedListings: 20,
    description: "Rental posting",
    url: "https://www.zillow.com/rental-manager/",
  },
]

const statusColors = { active: "bg-green-500", blocked: "bg-red-500", "api-only": "bg-yellow-500" }
const statusLabels = { active: "Works", blocked: "Manual Only", "api-only": "API Required" }

export default function AdminImportPage() {
  const [isProcessing, setIsProcessing] = useState(false)
  const [isScraping, setIsScraping] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentBatch, setCurrentBatch] = useState(0)
  const [totalBatches, setTotalBatches] = useState(0)
  const [results, setResults] = useState<ImportResult | null>(null)
  const [refreshResults, setRefreshResults] = useState<RefreshResult | null>(null)
  const [scrapeResults, setScrapeResults] = useState<ScrapeResult | null>(null)
  const [scrapePhase, setScrapePhase] = useState<"idle" | "scraping" | "importing">("idle")
  const [apnStats, setApnStats] = useState<{ total: number; unique: number; duplicates: number } | null>(null)
  const [addressStats, setAddressStats] = useState<{ total: number; unique: number; duplicates: number } | null>(null)
  const [scrapeSources, setScrapeSources] = useState<string[]>(["known"])
  const [sourceFilter, setSourceFilter] = useState<"all" | "active" | "blocked" | "api-only">("all")
  const [logs, setLogs] = useState<string[]>([])
  const [manualPasteData, setManualPasteData] = useState("")
  const [manualPasteSource, setManualPasteSource] = useState("")
  const [showManualPaste, setShowManualPaste] = useState(false)

  const addLog = (msg: string) => setLogs((prev) => [...prev.slice(-99), `[${new Date().toLocaleTimeString()}] ${msg}`])

  useEffect(() => {
    getAPNStats().then(setApnStats)
    getAddressStats().then(setAddressStats)
  }, [])

  const filteredSources = useMemo(() => {
    if (sourceFilter === "all") return SOURCES
    return SOURCES.filter((s) => s.status === sourceFilter)
  }, [sourceFilter])

  const databaseSources = useMemo(() => filteredSources.filter((s) => s.category === "database"), [filteredSources])
  const localSources = useMemo(() => filteredSources.filter((s) => s.category === "local"), [filteredSources])
  const nationalSources = useMemo(() => filteredSources.filter((s) => s.category === "national"), [filteredSources])
  const classifiedSources = useMemo(
    () => filteredSources.filter((s) => s.category === "classifieds"),
    [filteredSources],
  )

  const toggleSource = (id: string) => {
    setScrapeSources((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]))
  }

  const handleAPNImport = async () => {
    setIsProcessing(true)
    setResults(null)
    setProgress(0)
    addLog("Starting APN import...")
    try {
      const result = await importAPNs((p, batch, total) => {
        setProgress(p)
        setCurrentBatch(batch)
        setTotalBatches(total)
      })
      setResults(result)
      addLog(`Import complete: ${result.success} inserted, ${result.skipped} skipped, ${result.failed} failed`)
    } catch (error) {
      addLog(`Error: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleAddressImport = async () => {
    setIsProcessing(true)
    setResults(null)
    setProgress(0)
    addLog("Starting address import...")
    try {
      const result = await importAddresses((p, batch, total) => {
        setProgress(p)
        setCurrentBatch(batch)
        setTotalBatches(total)
      })
      setResults(result)
      addLog(`Import complete: ${result.success} inserted, ${result.skipped} skipped, ${result.failed} failed`)
    } catch (error) {
      addLog(`Error: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleScrape = async () => {
    setIsScraping(true)
    setScrapeResults(null)
    setScrapePhase("scraping")
    addLog(`Starting scrape of ${scrapeSources.length} source(s)...`)
    try {
      const result = await scrapeRentals(scrapeSources)
      setScrapeResults(result)
      addLog(`Scrape complete: Found ${result.properties.length} properties`)
    } catch (error) {
      addLog(`Scrape error: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsScraping(false)
      setScrapePhase("idle")
    }
  }

  const handleImportScraped = async () => {
    if (!scrapeResults) return
    setIsProcessing(true)
    setScrapePhase("importing")
    addLog("Importing scraped properties...")
    try {
      const result = await importScrapedProperties(scrapeResults.properties, (p, batch, total) => {
        setProgress(p)
        setCurrentBatch(batch)
        setTotalBatches(total)
      })
      setResults(result)
      addLog(`Import complete: ${result.success} inserted, ${result.skipped} skipped, ${result.failed} failed`)
    } catch (error) {
      addLog(`Import error: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsProcessing(false)
      setScrapePhase("idle")
    }
  }

  const handleRefreshAll = async () => {
    setIsRefreshing(true)
    setRefreshResults(null)
    addLog("Refreshing all property data...")
    try {
      const result = await refreshAllProperties()
      setRefreshResults(result)
      addLog(`Refresh complete: ${result.updated} updated, ${result.failed} failed out of ${result.total} total`)
    } catch (error) {
      addLog(`Refresh error: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsRefreshing(false)
    }
  }

  const renderSourceList = (sources: typeof SOURCES, title: string, icon: React.ReactNode) => {
    if (sources.length === 0) return null
    return (
      <div className="mb-6">
        <h3 className="font-semibold mb-3 flex items-center gap-2 text-lg">
          {icon}
          {title} ({sources.length})
        </h3>
        <div className="space-y-2">
          {sources.map((source) => (
            <div
              key={source.id}
              className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <Checkbox
                checked={scrapeSources.includes(source.id)}
                onCheckedChange={() => toggleSource(source.id)}
                disabled={source.status !== "active"}
              />
              <div className={`h-3 w-3 rounded-full shrink-0 ${statusColors[source.status]}`} title={source.status} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{source.name}</span>
                  <Badge variant="outline" className="text-xs">
                    ~{source.estimatedListings} listings
                  </Badge>
                  <Badge
                    variant={
                      source.status === "active"
                        ? "default"
                        : source.status === "api-only"
                          ? "secondary"
                          : "destructive"
                    }
                    className="text-xs"
                  >
                    {statusLabels[source.status]}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{source.description}</p>
              </div>
              {source.url && (
                <a href={source.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                  <Button variant="outline" size="sm" className="gap-1 bg-transparent">
                    <ExternalLink className="h-3 w-3" />
                    Visit
                  </Button>
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container max-w-5xl mx-auto px-6 py-12">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
          <Link href="/" className="hover:text-foreground transition-colors">
            <Home className="h-4 w-4" />
          </Link>
          <span>/</span>
          <Link href="/admin" className="hover:text-foreground transition-colors">
            Admin
          </Link>
          <span>/</span>
          <span className="text-foreground">Import</span>
        </nav>

        {/* Page Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/admin">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-4xl font-bold tracking-tight">Property Data Import</h1>
            <p className="text-muted-foreground mt-1">Import and manage rental property data</p>
          </div>
          <Button variant="outline" onClick={handleRefreshAll} disabled={isRefreshing}>
            {isRefreshing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Refresh All Data
          </Button>
        </div>

        {/* Refresh Results */}
        {refreshResults && (
          <Alert className="mb-6">
            <CheckCircle className="h-4 w-4" />
            <AlertTitle>Data Refresh Complete</AlertTitle>
            <AlertDescription>
              Updated {refreshResults.updated} of {refreshResults.total} properties.
              {refreshResults.failed > 0 && ` ${refreshResults.failed} failed.`}
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="scrape" className="space-y-6">
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
              APNs ({apnStats?.unique?.toLocaleString() || 0})
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
                  Web Scrape Rental Listings ({SOURCES.length} Sources)
                </CardTitle>
                <CardDescription>
                  Select sources to scrape. Most sites block automation - use "Visit" links to browse manually and use
                  Manual Entry to add listings.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>How Web Scraping Works</AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p>
                      <strong className="text-green-600">Green (Works)</strong> - Automatic scraping works. Select and
                      click "Start Scraping".
                    </p>
                    <p>
                      <strong className="text-yellow-600">Yellow (API Required)</strong> - Requires API key setup.
                      Contact source for developer access.
                    </p>
                    <p>
                      <strong className="text-red-600">Red (Manual Only)</strong> - Site blocks bots. Click "Visit" to
                      browse, then use Manual Entry to add listings.
                    </p>
                  </AlertDescription>
                </Alert>

                {/* Filter Buttons */}
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <Label className="text-base font-semibold">
                    Showing {filteredSources.length} of {SOURCES.length} Sources
                  </Label>
                  <div className="flex gap-2 flex-wrap">
                    {(["all", "active", "blocked", "api-only"] as const).map((filter) => (
                      <Button
                        key={filter}
                        variant={sourceFilter === filter ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSourceFilter(filter)}
                      >
                        {filter === "all"
                          ? "All"
                          : filter === "active"
                            ? "Works"
                            : filter === "blocked"
                              ? "Manual Only"
                              : "API Required"}{" "}
                        ({filter === "all" ? SOURCES.length : SOURCES.filter((s) => s.status === filter).length})
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setScrapeSources(SOURCES.filter((s) => s.status === "active").map((s) => s.id))}
                  >
                    Select Working Sources
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setScrapeSources([])}>
                    Clear All
                  </Button>
                </div>

                {/* Sources List */}
                <ScrollArea className="h-[500px] border rounded-lg p-4">
                  <div className="space-y-2">
                    {renderSourceList(databaseSources, "Internal Databases", <Database className="h-4 w-4" />)}
                    {renderSourceList(localSources, "Local Butte County Sites", <MapPin className="h-4 w-4" />)}
                    {renderSourceList(nationalSources, "National Rental Sites", <Globe className="h-4 w-4" />)}
                    {renderSourceList(classifiedSources, "Classifieds & Marketplaces", <Search className="h-4 w-4" />)}
                  </div>
                </ScrollArea>

                {/* Selected Count and Scrape Button */}
                <div className="flex items-center justify-between pt-4 border-t">
                  <span className="text-sm text-muted-foreground">
                    {scrapeSources.length} source(s) selected (
                    {scrapeSources.filter((id) => SOURCES.find((s) => s.id === id)?.status === "active").length} will
                    work automatically)
                  </span>
                  <div className="flex gap-2">
                    {scrapeResults && scrapeResults.properties.length > 0 && (
                      <Button onClick={handleImportScraped} disabled={isProcessing}>
                        {isProcessing ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        Import {scrapeResults.properties.length} Properties
                      </Button>
                    )}
                    <Button
                      onClick={handleScrape}
                      disabled={
                        isScraping ||
                        scrapeSources.filter((id) => SOURCES.find((s) => s.id === id)?.status === "active").length === 0
                      }
                    >
                      {isScraping ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Globe className="h-4 w-4 mr-2" />
                      )}
                      Start Scraping
                    </Button>
                  </div>
                </div>

                {/* Progress */}
                {(isScraping || (isProcessing && scrapePhase === "importing")) && (
                  <div className="space-y-2">
                    <Progress value={progress} />
                    <p className="text-sm text-muted-foreground text-center">
                      {scrapePhase === "scraping"
                        ? "Scraping..."
                        : `Importing batch ${currentBatch} of ${totalBatches}...`}
                    </p>
                  </div>
                )}

                {scrapeResults && (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertTitle>Scrape Complete</AlertTitle>
                    <AlertDescription>
                      Found {scrapeResults.properties.length} properties from working sources.
                      {scrapeResults.errors.length > 0 && (
                        <span className="block mt-1 text-muted-foreground">
                          {scrapeResults.errors.length} sources skipped (blocked or require API).
                        </span>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="addresses" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Home className="h-5 w-5" />
                  Import Addresses
                </CardTitle>
                <CardDescription>Import property addresses from the local database.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {addressStats && (
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <div className="text-2xl font-bold">{addressStats.total}</div>
                      <div className="text-sm text-muted-foreground">Total</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <div className="text-2xl font-bold">{addressStats.unique}</div>
                      <div className="text-sm text-muted-foreground">Unique</div>
                    </div>
                    <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                      <div className="text-2xl font-bold">{addressStats.duplicates}</div>
                      <div className="text-sm text-muted-foreground">Duplicates</div>
                    </div>
                  </div>
                )}
                <Button onClick={handleAddressImport} disabled={isProcessing} className="w-full">
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Import {addressStats?.unique || 0} Addresses
                </Button>
                {isProcessing && (
                  <div className="space-y-2">
                    <Progress value={progress} />
                    <p className="text-sm text-muted-foreground text-center">
                      Processing batch {currentBatch} of {totalBatches}...
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="apns" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Import APNs
                </CardTitle>
                <CardDescription>Import Assessor Parcel Numbers from the local database.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {apnStats && (
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <div className="text-2xl font-bold">{apnStats.total.toLocaleString()}</div>
                      <div className="text-sm text-muted-foreground">Total</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <div className="text-2xl font-bold">{apnStats.unique.toLocaleString()}</div>
                      <div className="text-sm text-muted-foreground">Unique</div>
                    </div>
                    <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                      <div className="text-2xl font-bold">{apnStats.duplicates.toLocaleString()}</div>
                      <div className="text-sm text-muted-foreground">Duplicates</div>
                    </div>
                  </div>
                )}
                <Button onClick={handleAPNImport} disabled={isProcessing} className="w-full">
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Import {apnStats?.unique.toLocaleString() || 0} APNs
                </Button>
                {isProcessing && (
                  <div className="space-y-2">
                    <Progress value={progress} />
                    <p className="text-sm text-muted-foreground text-center">
                      Processing batch {currentBatch} of {totalBatches}...
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
                <div className="mt-4">
                  <h4 className="font-medium mb-2 text-destructive">Errors ({results.errors.length}):</h4>
                  <ScrollArea className="h-40 border rounded-lg p-3 bg-destructive/5">
                    {results.errors.slice(0, 50).map((err, i) => (
                      <div key={i} className="text-sm text-destructive py-1 font-mono">
                        {err}
                      </div>
                    ))}
                    {results.errors.length > 50 && (
                      <div className="text-sm text-muted-foreground">...and {results.errors.length - 50} more</div>
                    )}
                  </ScrollArea>
                </div>
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
      </main>
    </div>
  )
}
