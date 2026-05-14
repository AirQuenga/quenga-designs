import Link from "next/link"
import { Map, Clock, HeartHandshake } from "lucide-react"
import SiteHeader from "@/components/site-header"
import SiteFooter from "@/components/site-footer"
import { PageHeader } from "@/components/page-header"

export const metadata = {
  title: "Projects",
  description: "Explore all Quenga Designs tools and projects",
}

export default function ProjectsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background transition-colors duration-300">
      <SiteHeader />

      <main className="flex-1 max-w-7xl mx-auto px-6 w-full pb-20">
        <PageHeader
          title="Tools"
          description="Explore our suite of powerful tools designed to make your work effortless."
          breadcrumbs={[{ label: "Tools" }]}
        />

        {/* Projects Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 pt-4">
          {/* Active Project - Rental Map */}
          <Link
            href="/rental-map"
            className="group bg-card border border-border rounded-3xl p-8 transition-all hover:border-muted-foreground/30 hover:shadow-xl"
          >
            <div className="mb-6">
              <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
                <Map className="h-7 w-7 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <h3 className="text-2xl font-semibold mb-3 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              Butte County Rental Atlas
            </h3>
            <p className="text-muted-foreground leading-relaxed mb-6">
              Interactive mapping platform with real-time availability, FMR calculations, and comprehensive property
              data.
            </p>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div>
                <div className="text-lg font-semibold">5,700+</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Properties</div>
              </div>
              <div>
                <div className="text-lg font-semibold">50+</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Sources</div>
              </div>
              <div>
                <div className="text-lg font-semibold">2026</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">HUD FMR</div>
              </div>
            </div>
            <div className="flex items-center font-medium text-blue-600 dark:text-blue-400 group-hover:gap-2 transition-all">
              Try Now
            </div>
          </Link>

          {/* Active Project - Community Services */}
          <Link
            href="/community-services"
            className="group bg-card border border-border rounded-3xl p-8 transition-all hover:border-muted-foreground/30 hover:shadow-xl"
          >
            <div className="mb-6">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
                <HeartHandshake className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <h3 className="text-2xl font-semibold mb-3 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
              Community Services
            </h3>
            <p className="text-muted-foreground leading-relaxed mb-6">
              Find mental health, food banks, legal aid, job training, housing support, and other community resources
              throughout Butte County.
            </p>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div>
                <div className="text-lg font-semibold">200+</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Services</div>
              </div>
              <div>
                <div className="text-lg font-semibold">12</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Categories</div>
              </div>
              <div>
                <div className="text-lg font-semibold">24/7</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Access</div>
              </div>
            </div>
            <div className="flex items-center font-medium text-emerald-600 dark:text-emerald-400 group-hover:gap-2 transition-all">
              Try Now
            </div>
          </Link>

          {/* Coming Soon Placeholder */}
          <div className="bg-card border border-border rounded-3xl p-8 opacity-60">
            <div className="mb-6">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                <Clock className="h-7 w-7 text-gray-400" />
              </div>
            </div>
            <h3 className="text-2xl font-semibold mb-3">Coming Soon</h3>
            <p className="text-muted-foreground leading-relaxed">
              New tools and projects are currently in development.
            </p>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
