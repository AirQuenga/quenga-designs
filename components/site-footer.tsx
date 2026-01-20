import Link from "next/link"

export default function SiteFooter() {
  return (
    <footer className="border-t border-gray-200 dark:border-gray-800 py-8 px-6 bg-white dark:bg-black transition-colors">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
        <div>© 2026 Quenga Designs. All rights reserved.</div>
        <nav className="flex gap-6">
          <Link 
            href="/projects" 
            className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          >
            Projects
          </Link>
          <Link 
            href="/admin" 
            className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          >
            Admin
          </Link>
        </nav>
      </div>
    </footer>
  )
}
