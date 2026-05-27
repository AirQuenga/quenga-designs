import { Suspense } from "react"
import { Loader2 } from "lucide-react"
import { RentalAtlas } from "@/components/rental-atlas"
import { getFilterOptions } from "@/app/actions/get-properties"

export const dynamic = "force-dynamic"

function RentalMapSkeleton() {
  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Toolbar skeleton */}
      <div className="flex h-14 items-center gap-3 border-b border-border bg-card px-4 sm:px-6">
        <div className="h-7 w-32 animate-pulse rounded bg-muted" />
        <div className="ml-auto flex items-center gap-2">
          <div className="h-9 w-9 animate-pulse rounded bg-muted sm:w-24" />
          <div className="h-9 w-9 animate-pulse rounded bg-muted sm:w-20" />
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar skeleton (hidden on mobile) */}
        <aside className="hidden w-72 flex-shrink-0 flex-col gap-3 border-r border-border bg-card p-4 md:flex">
          <div className="h-5 w-20 animate-pulse rounded bg-muted" />
          <div className="h-9 w-full animate-pulse rounded bg-muted" />
          <div className="h-px bg-border" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-16 animate-pulse rounded bg-muted" />
              <div className="h-9 w-full animate-pulse rounded bg-muted" />
            </div>
          ))}
        </aside>

        {/* Map skeleton */}
        <div className="relative flex-1 overflow-hidden bg-secondary/40">
          {/* Faint grid */}
          <svg
            className="absolute inset-0 h-full w-full opacity-40"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <defs>
              <pattern id="map-grid" width="48" height="48" patternUnits="userSpaceOnUse">
                <path d="M 48 0 L 0 0 0 48" fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#map-grid)" />
          </svg>

          {/* Center spinner */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 rounded-md border border-border bg-card/90 px-6 py-4 shadow-lg backdrop-blur">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-sm font-medium text-foreground">Loading Butte County Rental Atlas</span>
              <span className="text-xs text-muted-foreground">Fetching clustered property data…</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default async function RentalMapPage() {
  // Only pre-load filter options (fast) — properties are fetched client-side with pagination
  const { cities, managementCompanies } = await getFilterOptions()

  return (
    <Suspense fallback={<RentalMapSkeleton />}>
      <RentalAtlas cities={cities} managementCompanies={managementCompanies} />
    </Suspense>
  )
}
