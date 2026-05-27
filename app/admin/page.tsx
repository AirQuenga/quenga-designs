import Link from "next/link"
import { Settings, Database, FileUp, Users, Shield, Activity, ShieldCheck, Code2 } from "lucide-react"
import SiteHeader from "@/components/site-header"
import SiteFooter from "@/components/site-footer"
import { PageHeader } from "@/components/page-header"

export const metadata = {
  title: "Admin",
  description: "Administrative tools and settings for Quenga Designs",
}

export default function AdminPage() {
  const sourceCategories = {
    internal: 1,
    local: 8,
    national: 26,
    classifieds: 15,
  }

  const totalSources = Object.values(sourceCategories).reduce((a, b) => a + b, 0)

  return (
    <div className="min-h-screen flex flex-col bg-background transition-colors duration-300">
      <SiteHeader />

      <main className="flex-1 max-w-7xl mx-auto px-6 w-full">
        <PageHeader
          title="Admin Dashboard"
          description="Manage your tools, settings, and data from a centralized control panel."
          breadcrumbs={[{ label: "Admin" }]}
        />

        {/* Admin Tools Grid */}
        <section className="pb-20">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Property Import Tool */}
            <Link
              href="/admin/import"
              className="group relative bg-card border border-border rounded-3xl p-8 transition-all hover:border-muted-foreground/30 hover:shadow-xl cursor-pointer"
            >
              <div className="absolute top-8 right-8">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                  Butte County Rental Map
                </span>
              </div>

              <div className="mb-6">
                <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
                  <Database className="h-7 w-7 text-blue-600 dark:text-blue-400" />
                </div>
              </div>

              <h3 className="text-2xl font-semibold mb-3 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                Property Import
              </h3>

              <p className="text-muted-foreground leading-relaxed mb-6">
                Web Scrape Rental Listings ({totalSources} Sources). Import properties from multiple sources.
              </p>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="text-muted-foreground">
                  Internal Databases: <span className="font-semibold">{sourceCategories.internal}</span>
                </div>
                <div className="text-muted-foreground">
                  Local Sites: <span className="font-semibold">{sourceCategories.local}</span>
                </div>
                <div className="text-muted-foreground">
                  National Sites: <span className="font-semibold">{sourceCategories.national}</span>
                </div>
                <div className="text-muted-foreground">
                  Classifieds: <span className="font-semibold">{sourceCategories.classifieds}</span>
                </div>
              </div>
            </Link>

            {/* Property Data Hub (Import + Audit + Scrape) */}
            <Link
              href="/admin/import"
              className="group relative bg-card border border-border rounded-3xl p-8 transition-all hover:border-muted-foreground/30 hover:shadow-xl cursor-pointer"
            >
              <div className="absolute top-8 right-8">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                  Self-Healing
                </span>
              </div>

              <div className="mb-6">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <ShieldCheck className="h-7 w-7 text-primary" />
                </div>
              </div>

              <h3 className="text-2xl font-semibold mb-3 group-hover:text-primary transition-colors">
                Property Data Hub
              </h3>

              <p className="text-muted-foreground leading-relaxed mb-6">
                Unified workspace for Excel/CSV import, automated audits across 5,789+ records, and URL scraping
                with Easy Paste fallback.
              </p>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="text-muted-foreground">
                  Batch Size: <span className="font-semibold text-foreground">50</span>
                </div>
                <div className="text-muted-foreground">
                  Geocoding: <span className="font-semibold text-foreground">Mapbox</span>
                </div>
              </div>
            </Link>

            {/* Quenga IDE Workspace */}
            <Link
              href="/admin/workspace"
              className="group relative bg-card border border-border rounded-3xl p-8 transition-all hover:border-muted-foreground/30 hover:shadow-xl cursor-pointer"
            >
              <div className="absolute top-8 right-8">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                  GitHub Bound
                </span>
              </div>

              <div className="mb-6">
                <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
                  <Code2 className="h-7 w-7 text-amber-600 dark:text-amber-400" />
                </div>
              </div>

              <h3 className="text-2xl font-semibold mb-3 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                IDE Workspace
              </h3>

              <p className="text-muted-foreground leading-relaxed mb-6">
                Three-panel IDE bound to AirQuenga/quenga-designs. Browse the repo tree, read files with syntax
                highlighting, and refactor with the AI Copilot.
              </p>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="text-muted-foreground">
                  Source: <span className="font-semibold text-foreground">GitHub REST</span>
                </div>
                <div className="text-muted-foreground">
                  Copilot: <span className="font-semibold text-foreground">AI SDK 6</span>
                </div>
              </div>
            </Link>

            {/* Coming Soon Tools */}
            {[
              { name: "User Management", icon: Users, desc: "Manage accounts and permissions" },
              { name: "System Settings", icon: Settings, desc: "Configure application settings" },
              { name: "Data Backups", icon: FileUp, desc: "Manage database backups" },
              { name: "Security", icon: Shield, desc: "Monitor security events" },
              { name: "Analytics", icon: Activity, desc: "View usage statistics" },
            ].map((tool, idx) => {
              const Icon = tool.icon
              return (
                <div
                  key={idx}
                  className="bg-card border border-border rounded-3xl p-8 opacity-60 cursor-default"
                >
                  <div className="mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                      <Icon className="h-7 w-7 text-gray-400" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-semibold mb-3">{tool.name}</h3>
                  <p className="text-muted-foreground leading-relaxed">{tool.desc}</p>
                  <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">Coming Soon</div>
                </div>
              )
            })}
          </div>
        </section>

      </main>

      <SiteFooter />
    </div>
  )
}
