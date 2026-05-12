"use client"

import { useState, useEffect } from "react"
import {
  getCommunityServices,
  getCommunityServiceCategories,
  getCommunityServiceAreas,
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
import { Loader2, MapPin, Phone, Globe, Mail, Clock, ChevronLeft, ChevronRight } from "lucide-react"

export function CommunityServicesTable() {
  const [services, setServices] = useState<CommunityService[]>([])
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<string[]>([])
  const [serviceAreas, setServiceAreas] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  const [filters, setFilters] = useState({
    category: "",
    serviceArea: "",
    searchTerm: "",
  })

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      const [servicesResult, categoriesResult, areasResult] = await Promise.all([
        getCommunityServices(filters === {} ? undefined : filters, page, pageSize),
        getCommunityServiceCategories(),
        getCommunityServiceAreas(),
      ])

      setServices(servicesResult.services)
      setTotal(servicesResult.total)
      setTotalPages(servicesResult.totalPages)
      setCategories(categoriesResult)
      setServiceAreas(areasResult)
      setLoading(false)
    }

    loadData()
  }, [filters, page, pageSize])

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPage(1) // Reset to first page when filters change
  }

  const handleClearFilters = () => {
    setFilters({ category: "", serviceArea: "", searchTerm: "" })
    setPage(1)
  }

  const formatCategoryLabel = (cat: string) => {
    return cat
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Find Community Services</CardTitle>
          <CardDescription>Browse and filter services by category, location, and keywords</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {/* Search */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <Input
                placeholder="Search by name or description"
                value={filters.searchTerm}
                onChange={(e) => handleFilterChange("searchTerm", e.target.value)}
                className="h-9"
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <Select value={filters.category} onValueChange={(v) => handleFilterChange("category", v)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {formatCategoryLabel(cat)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Service Area */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Service Area</label>
              <Select value={filters.serviceArea} onValueChange={(v) => handleFilterChange("serviceArea", v)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All areas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All areas</SelectItem>
                  {serviceAreas.map((area) => (
                    <SelectItem key={area} value={area}>
                      {area}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Clear button */}
          {(filters.category || filters.serviceArea || filters.searchTerm) && (
            <Button variant="outline" size="sm" onClick={handleClearFilters}>
              Clear Filters
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Services ({total.toLocaleString()})</span>
            {loading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
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
              {/* Service Cards Grid */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {services.map((service) => (
                  <Card key={service.id} className="bg-muted/30">
                    <CardContent className="pt-4">
                      <div className="space-y-2">
                        <div className="font-medium">{service.name}</div>
                        <Badge variant="outline" className="w-fit">
                          {formatCategoryLabel(service.category)}
                        </Badge>
                        {service.address && (
                          <div className="flex items-start gap-2 text-sm">
                            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                            <span>{service.address}</span>
                          </div>
                        )}
                        {service.phone_number && (
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <a href={`tel:${service.phone_number}`} className="hover:underline">
                              {service.phone_number}
                            </a>
                          </div>
                        )}
                        {service.hours && (
                          <div className="flex items-start gap-2 text-sm">
                            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                            <span>{service.hours}</span>
                          </div>
                        )}
                        {service.website && (
                          <div className="flex items-center gap-2 text-sm">
                            <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <a href={service.website} target="_blank" rel="noopener noreferrer" className="hover:underline">
                              Visit website
                            </a>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
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
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
