import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SiteHeader } from "@/components/site-header"
import SiteFooter from "@/components/site-footer"
import { PageHeader } from "@/components/page-header"

export const metadata = {
  title: "About Us",
  description: "Learn more about Quenga Designs",
}

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-black transition-colors duration-300">
      <SiteHeader />

      <main className="flex-1 max-w-7xl mx-auto px-6 w-full">
        <PageHeader
          title="About Us"
          breadcrumbs={[{ label: "About Us" }]}
        />

        <div className="max-w-3xl pb-16">
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
      </main>

      <SiteFooter />
    </div>
  )
}
