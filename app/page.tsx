import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import { SiteHeader } from "@/components/site-header"
import SiteFooter from "@/components/site-footer"

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-black transition-colors duration-300">
      <SiteHeader />

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h1 className="text-6xl sm:text-7xl md:text-8xl font-semibold tracking-tight leading-none">
            Built to make your job easier.
          </h1>
          <p className="text-xl sm:text-2xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Powerful tools that make work effortless. Simple, intuitive, and built to scale.
          </p>
          <div className="flex gap-4 justify-center pt-4">
            <Button asChild size="lg" className="rounded-full h-12 px-8 text-base">
              <Link href="/projects">
                Explore Tools
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-full h-12 px-8 text-base bg-transparent">
              <Link href="/about">About Us</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Feature Section - Rental Map */}
      <section className="py-20 px-6 bg-gray-50 dark:bg-gray-950">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className="space-y-6">
              <h2 className="text-5xl font-semibold tracking-tight">
                Butte County
                <br />
                Rental Atlas
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-400 leading-relaxed">
                Interactive mapping platform with real-time availability, FMR calculations, and comprehensive property
                data across 5,700+ rental units.
              </p>
              <Link
                href="/rental-map"
                className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:underline text-lg transition-colors"
              >
                Check out Tool
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
              <div className="flex gap-8 pt-4">
                <div>
                  <div className="text-4xl font-semibold">5,700+</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Properties</div>
                </div>
                <div>
                  <div className="text-4xl font-semibold">50+</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Data Sources</div>
                </div>
                <div>
                  <div className="text-4xl font-semibold">2026</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">HUD FMR</div>
                </div>
              </div>
            </div>
            <div className="relative aspect-video rounded-3xl overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600 shadow-2xl">
              <div className="absolute inset-0 flex items-center justify-center text-white/20 text-9xl font-bold">
                MAP
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-semibold tracking-tight mb-4">Designed to empower.</h2>
            <p className="text-xl text-gray-600 dark:text-gray-400">Every feature built with purpose.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-12">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center transition-colors">
                <div className="w-6 h-6 rounded-full bg-blue-500" />
              </div>
              <h3 className="text-2xl font-semibold">Instant Efficiency</h3>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                Tools that work instantly. No learning curve, no complexity. Just results.
              </p>
            </div>
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center transition-colors">
                <div className="w-6 h-6 rounded-full bg-purple-500" />
              </div>
              <h3 className="text-2xl font-semibold">Work Smarter</h3>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                Automate the tedious. Focus on what matters. Let our tools handle the rest.
              </p>
            </div>
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center transition-colors">
                <div className="w-6 h-6 rounded-full bg-green-500" />
              </div>
              <h3 className="text-2xl font-semibold">Always Reliable</h3>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                Built for scale. Designed for speed. Trusted to deliver, every single time.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 px-6">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h2 className="text-5xl sm:text-6xl font-semibold tracking-tight">Ready to get started?</h2>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            Streamline your workflow. Get more done in less time.
          </p>
          <Button asChild size="lg" className="rounded-full h-14 px-10 text-lg">
            <Link href="/projects">
              Explore Tools
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
