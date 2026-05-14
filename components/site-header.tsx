import Link from "next/link"
import { ThemeToggle } from "@/components/theme-toggle"

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 transition-colors">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo/Home — navigates to Tools/Projects page */}
        <Link
          href="/projects"
          className="text-xl font-semibold tracking-tight hover:opacity-80 transition-opacity"
        >
          Quenga Designs
        </Link>

        <nav className="flex items-center gap-8" aria-label="Primary navigation">
          <Link
            href="/projects"
            className="text-sm font-medium hover:text-primary transition-colors relative group"
          >
            Home
            <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary group-hover:w-full transition-all duration-200" />
          </Link>
          <Link
            href="/programs"
            className="text-sm font-medium hover:text-primary transition-colors relative group"
          >
            Programs
            <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary group-hover:w-full transition-all duration-200" />
          </Link>
          <Link
            href="/projects"
            className="text-sm font-medium hover:text-primary transition-colors relative group"
          >
            Tools
            <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary group-hover:w-full transition-all duration-200" />
          </Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  )
}
