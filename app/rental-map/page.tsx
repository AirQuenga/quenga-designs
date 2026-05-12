import { Suspense } from "react"
import { RentalAtlas } from "@/components/rental-atlas"
import { getFilterOptions } from "@/app/actions/get-properties"

export const dynamic = "force-dynamic"

export default async function RentalMapPage() {
  // Only pre-load filter options (fast) — properties are fetched client-side with pagination
  const { cities, managementCompanies } = await getFilterOptions()

  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-background text-muted-foreground">Loading Butte County Rental Map…</div>}>
      <RentalAtlas cities={cities} managementCompanies={managementCompanies} />
    </Suspense>
  )
}
