"use client"

import { useRef, useCallback } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { PropertyCard } from "./property-card"
import type { Property } from "@/types/property"
import { Building2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface PropertyListProps {
  properties: Property[]
  selectedProperty: Property | null
  onPropertySelect: (property: Property) => void
  onWatch: (property: Property) => void
  /** Total record count across all pages */
  total?: number
  /** Whether a next page is being fetched */
  isLoadingMore?: boolean
  /** Load next page callback */
  onLoadMore?: () => void
}

const ITEM_HEIGHT = 168 // approximate card height in px

export function PropertyList({
  properties,
  selectedProperty,
  onPropertySelect,
  onWatch,
  total,
  isLoadingMore,
  onLoadMore,
}: PropertyListProps) {
  const parentRef = useRef<HTMLDivElement>(null)

  // Sorted: available first, then by city
  const sortedProperties = [...properties].sort((a, b) => {
    if (a.is_available !== b.is_available) return a.is_available ? -1 : 1
    return a.city.localeCompare(b.city)
  })

  const rowVirtualizer = useVirtualizer({
    count: sortedProperties.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ITEM_HEIGHT,
    overscan: 8,
  })

  // Trigger load-more when the user scrolls near the bottom
  const handleScroll = useCallback(() => {
    if (!onLoadMore || isLoadingMore) return
    const el = parentRef.current
    if (!el) return
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 300) {
      onLoadMore()
    }
  }, [onLoadMore, isLoadingMore])

  if (properties.length === 0 && !isLoadingMore) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <Building2 className="mb-4 h-12 w-12 text-muted-foreground/50" />
        <h3 className="mb-2 font-semibold text-card-foreground">No properties found</h3>
        <p className="text-sm text-muted-foreground">Try adjusting your filters to see more results.</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header row */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="text-sm text-muted-foreground">
          Showing {sortedProperties.length.toLocaleString()}
          {total !== undefined && ` of ${total.toLocaleString()}`}{" "}
          {total === 1 ? "property" : "properties"}
        </span>
        <span className="text-sm font-medium text-green-500">
          {properties.filter((p) => p.is_available).length} available
        </span>
      </div>

      {/* Virtualized list */}
      <div
        ref={parentRef}
        className="flex-1 overflow-y-auto p-4"
        onScroll={handleScroll}
      >
        <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
          {rowVirtualizer.getVirtualItems().map((virtualItem) => {
            const property = sortedProperties[virtualItem.index]
            return (
              <div
                key={virtualItem.key}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: virtualItem.size,
                  transform: `translateY(${virtualItem.start}px)`,
                  paddingBottom: "12px",
                }}
              >
                <PropertyCard
                  property={property}
                  isSelected={selectedProperty?.id === property.id}
                  onSelect={() => onPropertySelect(property)}
                  onWatch={() => onWatch(property)}
                />
              </div>
            )
          })}
        </div>

        {/* Load more / spinner */}
        {isLoadingMore && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading more…</span>
          </div>
        )}
        {onLoadMore && !isLoadingMore && total !== undefined && properties.length < total && (
          <div className="flex justify-center py-4">
            <Button variant="outline" size="sm" onClick={onLoadMore}>
              Load more ({(total - properties.length).toLocaleString()} remaining)
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
