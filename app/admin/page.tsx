import Link from "next/link"
import { Settings, Database, FileUp, Users, Shield, Activity, Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SiteHeader } from "@/components/site-header"

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
    <div className="min-h-screen bg-white dark:bg-black transition-colors duration-300">
      <SiteHeader />

      {/* Hero Section */}
      <section className="pt-32 pb-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8 flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Home className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-7xl md:text-8xl font-semibold tracking-tight leading-none mb-6">Admin Dashboard</h1>
              <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mb-16">
                Manage your tools, settings, and data from a centralized control panel.
              </p>

              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-12">
                <Link href="/" className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
                  <Home className="h-4 w-4" />
                </Link>
                <span>/</span>
                <span>Admin</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Admin Tools Grid */}
      <section className="pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Property Import Tool */}
            <Link
              href="/admin/import"
              className="group relative bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-3xl p-8 transition-all hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-xl cursor-pointer"
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
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
                Web Scrape Rental Listings ({totalSources} Sources). Import properties from multiple sources.
              </p>
              <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
                <div className="text-gray-600 dark:text-gray-400">
                  Internal Databases: <span className="font-semibold">{sourceCategories.internal}</span>
                </div>
                <div className="text-gray-600 dark:text-gray-400">
                  Local Sites: <span className="font-semibold">{sourceCategories.local}</span>
                </div>
                <div className="text-gray-600 dark:text-gray-400">
                  National Sites: <span className="font-semibold">{sourceCategories.national}</span>
                </div>
                <div className="text-gray-600 dark:text-gray-400">
                  Classifieds: <span className="font-semibold">{sourceCategories.classifieds}</span>
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
                  className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-3xl p-8 opacity-60 cursor-default"
                >
                  <div className="mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                      <Icon className="h-7 w-7 text-gray-400" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-semibold mb-3">{tool.name}</h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{tool.desc}</p>
                  <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">Coming Soon</div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 py-8 px-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center text-sm text-gray-600 dark:text-gray-400">
          <div>© 2026 Quenga Designs. All rights reserved.</div>
          <div className="flex gap-6">
            <Link href="/projects" className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
              Projects
            </Link>
            <Link href="/admin" className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
              Admin
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
