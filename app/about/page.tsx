import Link from "next/link"
import { Home, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SiteHeader } from "@/components/site-header"

export const metadata = {
  title: "About Us",
  description: "Learn more about Quenga Designs",
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-black transition-colors duration-300">
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
            <span>About Us</span>
          </div>

          <h1 className="text-7xl md:text-8xl font-semibold tracking-tight leading-none mb-6">About Us</h1>

          <div className="max-w-3xl">
            <p className="text-xl text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
              We build tools that make work effortless. Our mission is simple: empower professionals with intuitive
              software that eliminates complexity and amplifies productivity.
            </p>
            <p className="text-xl text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
              From real estate management to data analytics, every tool we create is designed with one goal—to make your
              job easier. We believe powerful software should be accessible, reliable, and a joy to use.
            </p>
            <p className="text-xl text-gray-600 dark:text-gray-400 leading-relaxed mb-12">
              Founded on principles of simplicity and efficiency, Quenga Designs continues to innovate and deliver
              solutions that professionals trust every day.
            </p>
            <Button asChild size="lg" className="rounded-full h-12 px-8 text-base">
              <Link href="/projects">
                Explore Our Tools
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
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
