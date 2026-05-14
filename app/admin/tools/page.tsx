import SiteHeader from "@/components/site-header"
import SiteFooter from "@/components/site-footer"
import { PageHeader } from "@/components/page-header"
import { AuditRunner } from "@/components/admin/audit-runner"
import { ScrapeRunner } from "@/components/admin/scrape-runner"

export const metadata = {
  title: "Database Tools — Admin",
  description: "Run live scrapes and database audits for the Butte County Rental Atlas.",
}

export default function AdminToolsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 pb-20">
        <PageHeader
          title="Database Tools"
          description="Maintain data integrity for the Butte County Rental Atlas. Audits run in batches of 50 and can be paused at any time."
          breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Database Tools" }]}
        />
        <div className="space-y-6">
          <ScrapeRunner />
          <AuditRunner />
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
