import Link from "next/link"
import { ThemeToggle } from "@/components/theme-toggle"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-black/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:supports-[backdrop-filter]:bg-black/80 transition-colors">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="text-xl font-semibold tracking-tight hover:opacity-80 transition-opacity">
          Quenga Designs
        </Link>

        <div className="flex items-center gap-8">
          <Link
            href="/projects"
            className="text-sm font-medium hover:text-blue-600 dark:hover:text-blue-400 transition-colors relative group"
          >
            Projects
            <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-600 dark:bg-blue-400 group-hover:w-full transition-all duration-200" />
          </Link>
          <Link
            href="/admin"
            className="text-sm font-medium hover:text-blue-600 dark:hover:text-blue-400 transition-colors relative group"
          >
            Admin
            <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-600 dark:bg-blue-400 group-hover:w-full transition-all duration-200" />
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
