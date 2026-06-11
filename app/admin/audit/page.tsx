import SiteHeader from "@/components/site-header"
import SiteFooter from "@/components/site-footer"
import { PageHeader } from "@/components/page-header"
import { PropertyAuditDashboard } from "@/components/admin/property-audit-dashboard"

export const metadata = {
  title: "Property Audit Engine",
  description:
    "Tri-factor data integrity engine for property listings — completeness, validity, and duplicate detection with self-healing.",
}

export default function PropertyAuditPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background transition-colors duration-300">
      <SiteHeader />

      <main className="flex-1 max-w-7xl mx-auto px-6 w-full">
        <PageHeader
          title="Property Audit Engine"
          description="Continuously scores every listing for completeness, validity, and duplication — then self-heals what it can and routes the rest for review."
          breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Audit Engine" }]}
        />

        <section className="pb-20">
          <PropertyAuditDashboard />
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
