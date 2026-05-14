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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Loader2, ChevronLeft, ChevronRight, Search } from "lucide-react"

const ALL_VALUE = "__all__"

export function CommunityServicesTable() {
  const [services, setServices] = useState<CommunityService[]>([])
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [pageSize] = useState(50)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  const [filters, setFilters] = useState({
    category: "",
    searchTerm: "",
  })

  // Load categories once
  useEffect(() => {
    getCommunityServiceCategories().then(setCategories)
  }, [])

  useEffect(() => {
    let cancelled = false
    const loadData = async () => {
      setLoading(true)
      const activeFilters = {
        category: filters.category || undefined,
        searchTerm: filters.searchTerm || undefined,
      }
      const result = await getCommunityServices(activeFilters, page, pageSize)
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
  }, [filters, page, pageSize])

  const handleSearchChange = (value: string) => {
    setFilters((prev) => ({ ...prev, searchTerm: value }))
    setPage(1)
  }

  const handleCategoryChange = (value: string) => {
    setFilters((prev) => ({ ...prev, category: value === ALL_VALUE ? "" : value }))
    setPage(1)
  }

  const handleClearFilters = () => {
    setFilters({ category: "", searchTerm: "" })
    setPage(1)
  }

  const hasActiveFilters = filters.category || filters.searchTerm

  // Group rows by category for visual breaks
  const groupedByCategory = useMemo(() => {
    const groups: Record<string, CommunityService[]> = {}
    for (const s of services) {
      ;(groups[s.category] ??= []).push(s)
    }
    return groups
  }, [services])

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Find Community Services</CardTitle>
          <CardDescription>
            Browse resources by category or search by name, address, or keyword.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search resource, address, or keyword"
                  value={filters.searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="h-9 pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <Select
                value={filters.category || ALL_VALUE}
                onValueChange={handleCategoryChange}
              >
                <SelectTrigger className="h-9">
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
            </div>
          </div>

          {hasActiveFilters ? (
            <Button variant="outline" size="sm" onClick={handleClearFilters}>
              Clear Filters
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Resources ({total.toLocaleString()})</span>
            {loading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : null}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading && services.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : services.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <p>No services found. Try adjusting your filters.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[140px]">Category</TableHead>
                      <TableHead className="min-w-[140px]">Sub Category</TableHead>
                      <TableHead className="min-w-[200px]">Resource Name</TableHead>
                      <TableHead className="min-w-[140px]">Hours</TableHead>
                      <TableHead className="min-w-[220px]">Address</TableHead>
                      <TableHead className="min-w-[140px]">Phone</TableHead>
                      <TableHead className="min-w-[180px]">Other Contact</TableHead>
                      <TableHead className="min-w-[160px]">Website</TableHead>
                      <TableHead className="min-w-[240px]">Notes</TableHead>
                      <TableHead className="min-w-[200px]">Back Door Contacts</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(groupedByCategory).map(([category, rows]) =>
                      rows.map((service, idx) => (
                        <TableRow key={service.id}>
                          <TableCell>
                            {idx === 0 ? (
                              <Badge variant="secondary" className="font-medium">
                                {category}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">{category}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {service.sub_category || "—"}
                          </TableCell>
                          <TableCell className="font-medium">{service.resource_name}</TableCell>
                          <TableCell className="text-sm">{service.hours || "—"}</TableCell>
                          <TableCell className="text-sm">{service.address || "—"}</TableCell>
                          <TableCell className="text-sm">
                            {service.phone_number ? (
                              <a
                                href={`tel:${service.phone_number}`}
                                className="hover:underline"
                              >
                                {service.phone_number}
                              </a>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {service.other_contact_info || "—"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {service.website ? (
                              <a
                                href={service.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:underline"
                              >
                                Visit
                              </a>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="max-w-md whitespace-pre-wrap text-sm text-muted-foreground">
                            {service.notes || "—"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {service.back_door_contacts || "—"}
                          </TableCell>
                        </TableRow>
                      )),
                    )}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 ? (
                <div className="mt-6 flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
