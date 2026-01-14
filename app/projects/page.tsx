import Link from "next/link"
import { Home, Map, Clock } from "lucide-react"
import { SiteHeader } from "@/components/site-header"

export const metadata = {
  title: "Projects",
  description: "Explore all Quenga Designs tools and projects",
}

export default function ProjectsPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-black transition-colors duration-300">
      {/* Navigation */}
      <SiteHeader />

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-6">
        <div className="py-16">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-12">
            <Link href="/" className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
              <Home className="h-4 w-4" />
            </Link>
            <span>/</span>
            <span>Projects</span>
          </div>

          {/* Large heading */}
          <h1 className="text-7xl md:text-8xl font-semibold tracking-tight leading-none mb-6">Our Projects</h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-16 max-w-2xl">
            Explore our suite of powerful tools designed to make your work effortless.
          </p>

          {/* Projects Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Active Project - Rental Map */}
            <Link
              href="/rental-map"
              className="group bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-3xl p-8 transition-all hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-xl"
            >
              <div className="mb-6">
                <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
                  <Map className="h-7 w-7 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <h3 className="text-2xl font-semibold mb-3 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                Butte County Rental Atlas
              </h3>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
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
                View Tools
              </div>
            </Link>

            {/* Coming Soon Placeholders */}
            <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-3xl p-8 opacity-60">
              <div className="mb-6">
                <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                  <Clock className="h-7 w-7 text-gray-400" />
                </div>
              </div>
              <h3 className="text-2xl font-semibold mb-3">Coming Soon</h3>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                New tools and projects are currently in development.
              </p>
            </div>

            <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-3xl p-8 opacity-60">
              <div className="mb-6">
                <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                  <Clock className="h-7 w-7 text-gray-400" />
                </div>
              </div>
              <h3 className="text-2xl font-semibold mb-3">Coming Soon</h3>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                New tools and projects are currently in development.
              </p>
            </div>
          </div>
        </div>
      </main>

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
