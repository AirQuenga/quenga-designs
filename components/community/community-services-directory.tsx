"use client"

import { useEffect, useMemo, useState } from "react"
import {
  getCommunityServices,
  getCommunityServiceSubcategories,
  type CommunityService,
  type CommunityServiceSortField,
  type SortDirection,
} from "@/app/actions/get-community-services"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, Search, X, MapPin, Phone, Clock, Globe, ChevronLeft, ChevronRight, ArrowLeft, Edit2, ArrowDownUp } from "lucide-react"
import { ServiceEditDialog } from "./service-edit-dialog"

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
  { label: "Clothing", match: "Clothing" },
  { label: "Education", match: "Education" },
  { label: "Emergency", match: "Emergency" },
  { label: "Employment", match: "Employment" },
  { label: "Family", match: "Family" },
  { label: "Food", match: "Food" },
  { label: "Housing", match: "Housing" },
  { label: "Legal", match: "Legal" },
  { label: "Medical", match: "Medical" },
  { label: "Other", match: "Other" },
  { label: "Seniors", match: "Seniors" },
  { label: "Shelter", match: "Shelter" },
  { label: "Substance", match: "Substance" },
  { label: "Transportation", match: "Transportation" },
  { label: "Utilities", match: "Utilities" },
  { label: "Veterans", match: "Veterans" },
]

/** Sort presets for the All Resources list. */
const SORT_OPTIONS: {
  value: string
  label: string
  sortField: CommunityServiceSortField
  sortDir: SortDirection
}[] = [
  { value: "newest", label: "Newest first", sortField: "created_at", sortDir: "desc" },
  { value: "updated", label: "Recently updated", sortField: "updated_at", sortDir: "desc" },
  { value: "name-asc", label: "Name (A–Z)", sortField: "resource_name", sortDir: "asc" },
  { value: "name-desc", label: "Name (Z–A)", sortField: "resource_name", sortDir: "desc" },
  { value: "category", label: "Category (A–Z)", sortField: "category", sortDir: "asc" },
]

const ALL_FILTER = "__all__"

export function CommunityServicesDirectory() {
  const [services, setServices] = useState<CommunityService[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  // "Browse all" list shown on the landing page (under the category grid)
  const [allServices, setAllServices] = useState<CommunityService[]>([])
  const [allLoading, setAllLoading] = useState(false)
  const [allPage, setAllPage] = useState(1)
  const [allTotal, setAllTotal] = useState(0)
  const [allTotalPages, setAllTotalPages] = useState(0)

  // Sorting + filtering controls for the All Resources list
  const [allSort, setAllSort] = useState<string>("name-asc")
  const [allCategory, setAllCategory] = useState<string>(ALL_FILTER)
  const [allSubCategory, setAllSubCategory] = useState<string>(ALL_FILTER)
  const [subcategoryOptions, setSubcategoryOptions] = useState<string[]>([])

  // Two-tier search: input value (immediate) + committed query (debounced)
  const [searchInput, setSearchInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  // Bumped after an edit saves so both lists re-fetch fresh data.
  const [refreshKey, setRefreshKey] = useState(0)

  // A "browsing" state means the user has selected a category or typed a search.
  // Until then, show the FindHelp-style landing (search hero + category grid only).
  const isBrowsing = Boolean(activeCategory || searchQuery)

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
  }, [isBrowsing, activeCategory, searchQuery, page, refreshKey])

  // Keep the subcategory filter options in sync with the chosen main category.
  useEffect(() => {
    let cancelled = false
    const cat = allCategory === ALL_FILTER ? undefined : allCategory
    getCommunityServiceSubcategories(cat).then((opts) => {
      if (cancelled) return
      setSubcategoryOptions(opts)
      // Drop a stale subcategory selection that no longer applies.
      setAllSubCategory((prev) => (prev !== ALL_FILTER && !opts.includes(prev) ? ALL_FILTER : prev))
    })
    return () => {
      cancelled = true
    }
  }, [allCategory])

  // Fetch the full directory for the landing "All resources" list,
  // honoring the sort + filter controls above it.
  useEffect(() => {
    if (isBrowsing) return
    let cancelled = false
    setAllLoading(true)
    const sort = SORT_OPTIONS.find((s) => s.value === allSort) ?? SORT_OPTIONS[2]
    getCommunityServices(
      {
        category: allCategory === ALL_FILTER ? undefined : allCategory,
        subCategory: allSubCategory === ALL_FILTER ? undefined : allSubCategory,
        sortField: sort.sortField,
        sortDir: sort.sortDir,
      },
      allPage,
      PAGE_SIZE,
    ).then((res) => {
      if (cancelled) return
      setAllServices(res.services)
      setAllTotal(res.total)
      setAllTotalPages(res.totalPages)
      setAllLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [isBrowsing, allPage, allSort, allCategory, allSubCategory, refreshKey])

  // Reset to page 1 whenever the All Resources sort/filters change.
  useEffect(() => {
    setAllPage(1)
  }, [allSort, allCategory, allSubCategory])

  const clearAll = () => {
    setSearchInput("")
    setSearchQuery("")
    setActiveCategory(null)
    setPage(1)
  }

  const activeFilterLabel = useMemo(() => {
    const parts: string[] = []
    if (activeCategory) {
      // Find the display label for this match string
      const catObj = CATEGORIES.find((c) => c.match === activeCategory)
      parts.push(catObj?.label ?? activeCategory)
    }
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
              {CATEGORIES.length} {CATEGORIES.length === 1 ? "category" : "categories"}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.label}
                type="button"
                onClick={() => {
                  setActiveCategory(cat.match)
                  setPage(1)
                }}
                className="group flex items-center justify-between rounded-xl border border-border bg-card p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
              >
                <span className="text-base font-medium text-foreground group-hover:text-primary">
                  {cat.label}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ---------------- ALL RESOURCES (landing list under categories) ---------------- */}
      {!isBrowsing && (
        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <h3 className="text-lg font-semibold text-foreground sm:text-xl">All resources</h3>
            <span className="text-xs text-muted-foreground">
              {allTotal.toLocaleString()} {allTotal === 1 ? "resource" : "resources"}
            </span>
          </div>

          {/* Sort + filter controls */}
          <div className="mb-4 flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-sm sm:flex-row sm:items-end sm:gap-4">
            <div className="flex flex-1 flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Sort by</label>
              <Select value={allSort} onValueChange={setAllSort}>
                <SelectTrigger className="h-9">
                  <ArrowDownUp className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-1 flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Category</label>
              <Select value={allCategory} onValueChange={setAllCategory}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTER}>All categories</SelectItem>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.match} value={c.match}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-1 flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Subcategory</label>
              <Select
                value={allSubCategory}
                onValueChange={setAllSubCategory}
                disabled={subcategoryOptions.length === 0}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All subcategories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTER}>All subcategories</SelectItem>
                  {subcategoryOptions.map((sc) => (
                    <SelectItem key={sc} value={sc}>
                      {sc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(allCategory !== ALL_FILTER || allSubCategory !== ALL_FILTER || allSort !== "name-asc") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAllSort("name-asc")
                  setAllCategory(ALL_FILTER)
                  setAllSubCategory(ALL_FILTER)
                }}
                className="h-9 gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
                Reset
              </Button>
            )}
          </div>

          {allLoading && allServices.length === 0 ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-32 animate-pulse rounded-xl border border-border bg-card shadow-sm"
                />
              ))}
            </div>
          ) : allServices.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-12 text-center shadow-sm">
              <p className="text-sm text-muted-foreground">No resources available yet.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {allServices.map((s) => (
                <ServiceCard key={s.id} service={s} onSaved={() => setRefreshKey((k) => k + 1)} />
              ))}
            </ul>
          )}

          {/* Pagination */}
          {allTotalPages > 1 && (
            <div className="mt-6 flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
              <span className="text-xs text-muted-foreground">
                Page {allPage} of {allTotalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAllPage(Math.max(1, allPage - 1))}
                  disabled={allPage === 1 || allLoading}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAllPage(Math.min(allTotalPages, allPage + 1))}
                  disabled={allPage === allTotalPages || allLoading}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
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
                <ServiceCard key={s.id} service={s} onSaved={() => setRefreshKey((k) => k + 1)} />
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

function ServiceCard({ service, onSaved }: { service: CommunityService; onSaved?: () => void }) {
  const [showDetails, setShowDetails] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)

  // Merge the multi-tag array with the legacy single column, de-duplicated.
  const subCategoryTags = useMemo(() => {
    const tags = [...(service.sub_categories ?? [])]
    if (service.sub_category && !tags.includes(service.sub_category)) tags.unshift(service.sub_category)
    return tags.filter(Boolean)
  }, [service.sub_categories, service.sub_category])

  return (
    <>
      <li className="rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-base font-semibold text-foreground sm:text-lg">{service.resource_name}</h4>
              <Badge className="bg-primary/10 text-primary hover:bg-primary/10">{service.category}</Badge>
              {subCategoryTags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
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

          <div className="flex gap-2 self-start">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDetails((v) => !v)}
              aria-expanded={showDetails}
            >
              {showDetails ? "Hide details" : "Details"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEditDialog(true)}
              className="gap-1.5"
            >
              <Edit2 className="h-4 w-4" />
              <span className="hidden sm:inline">Edit</span>
            </Button>
          </div>
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

      <ServiceEditDialog
        service={service}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onSaved={onSaved}
      />
    </>
  )
}
