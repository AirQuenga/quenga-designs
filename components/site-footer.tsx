import Link from "next/link"

export default function SiteFooter() {
  return (
    <footer className="border-t border-border py-8 px-6 bg-background transition-colors">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
        <div>© 2026 Quenga Designs. All rights reserved.</div>
        <nav className="flex gap-6" aria-label="Footer navigation">
          <Link
            href="/community-services"
            className="hover:text-foreground transition-colors"
          >
            Community Services
          </Link>
          <Link
            href="/admin"
            className="hover:text-foreground transition-colors"
          >
            Admin
          </Link>
        </nav>
      </div>
    </footer>
  )
}
