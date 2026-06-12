import Link from "next/link"
import { Settings, FileUp, Users, Shield, Activity, ShieldCheck, Code2, HeartHandshake } from "lucide-react"
import SiteHeader from "@/components/site-header"
import SiteFooter from "@/components/site-footer"
import { PageHeader } from "@/components/page-header"

export const metadata = {
  title: "Admin",
  description: "Administrative tools and settings for Quenga Designs",
}

export default function AdminPage() {
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
                  Batch Size: <span className="font-semibold text-foreground">25</span>
                </div>
                <div className="text-muted-foreground">
                  Geocoding: <span className="font-semibold text-foreground">Mapbox</span>
                </div>
              </div>
            </Link>

            {/* Property Integrity Audit Engine */}
            <Link
              href="/admin/audit"
              className="group relative bg-card border border-border rounded-3xl p-8 transition-all hover:border-muted-foreground/30 hover:shadow-xl cursor-pointer"
            >
              <div className="absolute top-8 right-8">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                  Tri-Factor
                </span>
              </div>

              <div className="mb-6">
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
                  <Activity className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>

              <h3 className="text-2xl font-semibold mb-3 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                Integrity Audit Engine
              </h3>

              <p className="text-muted-foreground leading-relaxed mb-6">
                Score every listing on completeness, validity, and duplicates. Auto-heal coordinates and addresses,
                review flagged records, and export reports.
              </p>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="text-muted-foreground">
                  Scoring: <span className="font-semibold text-foreground">0–100</span>
                </div>
                <div className="text-muted-foreground">
                  Heal: <span className="font-semibold text-foreground">Mapbox + Zod</span>
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

            {/* Resource Data Hub (Community Services) */}
            <Link
              href="/admin/resources"
              className="group relative bg-card border border-border rounded-3xl p-8 transition-all hover:border-muted-foreground/30 hover:shadow-xl cursor-pointer"
            >
              <div className="absolute top-8 right-8">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400">
                  Discovery Mode
                </span>
              </div>

              <div className="mb-6">
                <div className="w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center mb-4">
                  <HeartHandshake className="h-7 w-7 text-rose-600 dark:text-rose-400" />
                </div>
              </div>

              <h3 className="text-2xl font-semibold mb-3 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                Resource Data Hub
              </h3>

              <p className="text-muted-foreground leading-relaxed mb-6">
                Manage community services — manual entry, multi-resource directory scraping, and automated data
                auditing with website verification.
              </p>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="text-muted-foreground">
                  Scraper: <span className="font-semibold text-foreground">Multi-Resource</span>
                </div>
                <div className="text-muted-foreground">
                  Audit: <span className="font-semibold text-foreground">Link Checker</span>
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
