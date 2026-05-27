"use client"

import { useState, useEffect, useMemo } from "react"
import {
  getCommunityServices,
  getCommunityServiceCategories,
  type CommunityService,
} from "@/app/actions/get-community-services"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Loader2, ChevronLeft, ChevronRight, Search, X } from "lucide-react"

const ALL_VALUE = "__all__"
const PAGE_SIZE = 50
const SEARCH_DEBOUNCE_MS = 300

export function CommunityServicesTable() {
  const [services, setServices] = useState<CommunityService[]>([])
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  // Two-tier search state: input value (immediate) and committed query (debounced)
  const [searchInput, setSearchInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [category, setCategory] = useState("")

  // Load categories once
  useEffect(() => {
    getCommunityServiceCategories().then(setCategories)
  }, [])

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => {
      setSearchQuery(searchInput)
      setPage(1)
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [searchInput])

  // Fetch data when filters change
  useEffect(() => {
    let cancelled = false
    const loadData = async () => {
      setLoading(true)
      const result = await getCommunityServices(
        {
          category: category || undefined,
          searchTerm: searchQuery || undefined,
        },
        page,
        PAGE_SIZE,
      )
      if (cancelled) return
      setServices(result.services)
      setTotal(result.total)
      setTotalPages(result.totalPages)
      setLoading(false)
    }

    loadData()
    return () => {
      cancelled = true
    }
  }, [searchQuery, category, page])

  const handleCategoryChange = (value: string) => {
    setCategory(value === ALL_VALUE ? "" : value)
    setPage(1)
  }

  const handleClear = () => {
    setSearchInput("")
    setSearchQuery("")
    setCategory("")
    setPage(1)
  }

  const hasActiveFilters = Boolean(category || searchQuery)

  // Group rows by category — first row in each group gets the badge,
  // subsequent rows get a faint label so the table reads as grouped.
  const groupedByCategory = useMemo(() => {
    const groups: Record<string, CommunityService[]> = {}
    for (const s of services) {
      ;(groups[s.category] ??= []).push(s)
    }
    return groups
  }, [services])

  return (
    <div className="overflow-hidden rounded-md border border-border bg-card shadow-sm">
      {/* Toolbar header — title + filters + count */}
      <div className="flex flex-col gap-3 border-b border-border bg-card p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground sm:text-lg">Resources</h2>
            <p className="text-xs text-muted-foreground sm:text-sm">
              {loading && services.length === 0
                ? "Loading…"
                : `${total.toLocaleString()} ${total === 1 ? "service" : "services"}${
                    hasActiveFilters ? " matching filters" : ""
                  }`}
            </p>
          </div>
          {loading && services.length > 0 && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Refreshing" />
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search resource name, address, phone, or notes…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="h-10 pl-9 pr-9 text-base sm:h-9 sm:text-sm"
              aria-label="Search community services"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Category */}
          <Select value={category || ALL_VALUE} onValueChange={handleCategoryChange}>
            <SelectTrigger className="h-10 w-full text-base sm:h-9 sm:w-[200px] sm:text-sm">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>All categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={handleClear} className="h-10 sm:h-9">
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="sticky left-0 z-10 min-w-[200px] bg-muted/40 backdrop-blur">
                Resource Name
              </TableHead>
              <TableHead className="min-w-[140px]">Category</TableHead>
              <TableHead className="min-w-[140px]">Sub-Category</TableHead>
              <TableHead className="min-w-[140px]">Hours</TableHead>
              <TableHead className="min-w-[220px]">Address</TableHead>
              <TableHead className="min-w-[140px]">Phone</TableHead>
              <TableHead className="min-w-[160px]">Website</TableHead>
              <TableHead className="min-w-[240px]">Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && services.length === 0 ? (
              // Skeleton rows
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={`skeleton-${i}`} className={i % 2 === 0 ? "bg-card" : "bg-muted/20"}>
                  <TableCell className="sticky left-0 bg-inherit">
                    <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                  </TableCell>
                  <TableCell>
                    <div className="h-5 w-20 animate-pulse rounded bg-muted" />
                  </TableCell>
                  <TableCell>
                    <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                  </TableCell>
                  <TableCell>
                    <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                  </TableCell>
                  <TableCell>
                    <div className="h-4 w-40 animate-pulse rounded bg-muted" />
                  </TableCell>
                  <TableCell>
                    <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                  </TableCell>
                  <TableCell>
                    <div className="h-4 w-12 animate-pulse rounded bg-muted" />
                  </TableCell>
                  <TableCell>
                    <div className="h-4 w-48 animate-pulse rounded bg-muted" />
                  </TableCell>
                </TableRow>
              ))
            ) : services.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                  No services found.
                  {hasActiveFilters && (
                    <Button variant="link" size="sm" onClick={handleClear} className="ml-1 h-auto p-0">
                      Clear filters
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              Object.entries(groupedByCategory).flatMap(([cat, rows], groupIdx) =>
                rows.map((service, idx) => {
                  // Zebra-stripe across the entire visible list, not per-group
                  const globalIdx = services.indexOf(service)
                  const isEven = globalIdx % 2 === 0
                  return (
                    <TableRow
                      key={service.id}
                      className={isEven ? "bg-card hover:bg-accent/30" : "bg-muted/20 hover:bg-accent/30"}
                    >
                      <TableCell
                        className={`sticky left-0 ${
                          isEven ? "bg-card" : "bg-muted/20"
                        } font-semibold text-foreground`}
                      >
                        {service.resource_name}
                      </TableCell>
                      <TableCell>
                        {idx === 0 ? (
                          <Badge className="bg-primary font-medium text-primary-foreground hover:bg-primary/90">
                            {cat}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">{cat}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {service.sub_category || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{service.hours || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{service.address || "—"}</TableCell>
                      <TableCell className="text-sm">
                        {service.phone_number ? (
                          <a
                            href={`tel:${service.phone_number}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {service.phone_number}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {service.website ? (
                          <a
                            href={service.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-primary hover:underline"
                          >
                            Visit
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-md whitespace-pre-wrap text-sm text-muted-foreground">
                        {service.notes || "—"}
                      </TableCell>
                    </TableRow>
                  )
                }),
              )
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2 border-t border-border bg-muted/20 px-4 py-3">
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
    </div>
  )
}
