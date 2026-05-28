"use client"

import { useEffect, useMemo, useState } from "react"
import {
  getCommunityServices,
  type CommunityService,
} from "@/app/actions/get-community-services"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Loader2, Search, X, MapPin, Phone, Clock, Globe, ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react"

const PAGE_SIZE = 25
const SEARCH_DEBOUNCE_MS = 300

/**
 * Curated, fixed category grid for the public directory.
 * Each entry has:
 *   - label: the short UI label shown on the card (Civic Professional aesthetic)
 *   - match: the substring used to filter the DB `category` column via ilike
 *           (so "Food" matches "Food Assistance", "Seniors" matches "Senior Services", etc.)
 */
const CATEGORIES: { label: string; match: string }[] = [
  { label: "Clothing", match: "Cloth" },
  { label: "Education", match: "Education" },
  { label: "Emergency", match: "Emergency" },
  { label: "Employment", match: "Employ" },
  { label: "Family", match: "Family" },
  { label: "Food", match: "Food" },
  { label: "Housing", match: "Housing" },
  { label: "Legal", match: "Legal" },
  { label: "Medical", match: "Health" },
  { label: "Other", match: "General" },
  { label: "Seniors", match: "Senior" },
  { label: "Shelter", match: "Shelter" },
  { label: "Substance", match: "Substance" },
  { label: "Transportation", match: "Transport" },
  { label: "Utilities", match: "Utilit" },
  { label: "Veterans", match: "Veteran" },
]

export function CommunityServicesDirectory() {
  const [services, setServices] = useState<CommunityService[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  // Two-tier search: input value (immediate) + committed query (debounced)
  const [searchInput, setSearchInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  // A "browsing" state means the user has selected a category or typed a search.
  // Until then, show the FindHelp-style landing (search hero + category grid only).
  const isBrowsing = Boolean(activeCategory || searchQuery)

  // Load categories once
  useEffect(() => {
    getCommunityServiceCategories().then(setCategories)
  }, [])

  // Debounce typed input
  useEffect(() => {
    const t = setTimeout(() => {
      setSearchQuery(searchInput.trim())
      setPage(1)
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [searchInput])

  // Fetch only when browsing
  useEffect(() => {
    if (!isBrowsing) {
      setServices([])
      setTotal(0)
      setTotalPages(0)
      return
    }
    let cancelled = false
    setLoading(true)
    getCommunityServices(
      {
        category: activeCategory || undefined,
        searchTerm: searchQuery || undefined,
      },
      page,
      PAGE_SIZE,
    ).then((res) => {
      if (cancelled) return
      setServices(res.services)
      setTotal(res.total)
      setTotalPages(res.totalPages)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [isBrowsing, activeCategory, searchQuery, page])

  const clearAll = () => {
    setSearchInput("")
    setSearchQuery("")
    setActiveCategory(null)
    setPage(1)
  }

  const activeFilterLabel = useMemo(() => {
    const parts: string[] = []
    if (activeCategory) parts.push(activeCategory)
    if (searchQuery) parts.push(`"${searchQuery}"`)
    return parts.join(" · ")
  }, [activeCategory, searchQuery])

  return (
    <div className="space-y-10">
      {/* ---------------- HERO SEARCH ---------------- */}
      <section className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-10">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Find Help</h2>
          <p className="mt-2 text-pretty text-sm text-muted-foreground sm:text-base">
            Search Butte County resources for housing, food, healthcare, financial aid, legal services, and more.
          </p>
          <div className="relative mx-auto mt-6 max-w-xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Try “food bank”, “rental assistance”, or a city name…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="h-14 rounded-full border-2 border-border bg-background pl-12 pr-12 text-base shadow-sm focus-visible:border-primary"
              aria-label="Search community services"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                aria-label="Clear search"
                className="absolute right-4 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ---------------- CATEGORY GRID (only when not browsing) ---------------- */}
      {!isBrowsing && (
        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <h3 className="text-lg font-semibold text-foreground sm:text-xl">Browse by category</h3>
            <span className="text-xs text-muted-foreground">
              {categories.length} {categories.length === 1 ? "category" : "categories"}
            </span>
          </div>

          {categories.length === 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-20 animate-pulse rounded-xl border border-border bg-card shadow-sm"
                />
              ))}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setActiveCategory(cat)
                    setPage(1)
                  }}
                  className="group flex items-center justify-between rounded-xl border border-border bg-card p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                >
                  <span className="text-base font-medium text-foreground group-hover:text-primary">
                    {cat}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ---------------- RESULTS LIST (only when browsing) ---------------- */}
      {isBrowsing && (
        <section>
          {/* Results header */}
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                className="-ml-2 gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                All categories
              </Button>
              <div className="hidden h-4 w-px bg-border sm:block" />
              <p className="text-sm text-muted-foreground">
                {loading
                  ? "Searching…"
                  : `${total.toLocaleString()} ${total === 1 ? "result" : "results"} for `}
                {!loading && (
                  <span className="font-semibold text-foreground">{activeFilterLabel || "all services"}</span>
                )}
              </p>
            </div>
            {loading && services.length > 0 && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Refreshing" />
            )}
          </div>

          {/* Cards */}
          {loading && services.length === 0 ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-32 animate-pulse rounded-xl border border-border bg-card shadow-sm"
                />
              ))}
            </div>
          ) : services.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-12 text-center shadow-sm">
              <p className="text-sm text-muted-foreground">No services match your search.</p>
              <Button variant="link" size="sm" onClick={clearAll} className="mt-2">
                Clear filters and start over
              </Button>
            </div>
          ) : (
            <ul className="space-y-3">
              {services.map((s) => (
                <ServiceCard key={s.id} service={s} />
              ))}
            </ul>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
              <span className="text-xs text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1 || loading}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages || loading}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  )
}

/* ---------- Single Civic Card ---------- */

function ServiceCard({ service }: { service: CommunityService }) {
  const [showDetails, setShowDetails] = useState(false)

  return (
    <li className="rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-base font-semibold text-foreground sm:text-lg">{service.resource_name}</h4>
            <Badge className="bg-primary/10 text-primary hover:bg-primary/10">{service.category}</Badge>
            {service.sub_category && (
              <Badge variant="outline" className="text-xs">
                {service.sub_category}
              </Badge>
            )}
          </div>

          <dl className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
            {service.address && (
              <div className="flex items-start gap-2 text-muted-foreground">
                <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                <span className="text-pretty">{service.address}</span>
              </div>
            )}
            {service.phone_number && (
              <div className="flex items-start gap-2 text-muted-foreground">
                <Phone className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                <a
                  href={`tel:${service.phone_number}`}
                  className="font-medium text-primary hover:underline"
                >
                  {service.phone_number}
                </a>
              </div>
            )}
            {service.hours && (
              <div className="flex items-start gap-2 text-muted-foreground">
                <Clock className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                <span>{service.hours}</span>
              </div>
            )}
            {service.website && (
              <div className="flex items-start gap-2 text-muted-foreground">
                <Globe className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                <a
                  href={service.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  Visit website
                </a>
              </div>
            )}
          </dl>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowDetails((v) => !v)}
          className="self-start"
          aria-expanded={showDetails}
        >
          {showDetails ? "Hide details" : "Details"}
        </Button>
      </div>

      {showDetails && (service.notes || service.other_contact_info) && (
        <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
          {service.notes && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes</p>
              <p className="mt-1 whitespace-pre-wrap text-foreground">{service.notes}</p>
            </div>
          )}
          {service.other_contact_info && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Other Contact
              </p>
              <p className="mt-1 whitespace-pre-wrap text-foreground">{service.other_contact_info}</p>
            </div>
          )}
        </div>
      )}
    </li>
  )
}
