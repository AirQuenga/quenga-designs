import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, HeartHandshake, Phone, Clock, MapPin } from "lucide-react"
import SiteHeader from "@/components/site-header"
import SiteFooter from "@/components/site-footer"
import { RentalMapPreview } from "@/components/rental-map-preview"

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-background transition-colors duration-300">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h1 className="text-6xl sm:text-7xl md:text-8xl font-semibold tracking-tight leading-none">
            Built to make your job easier.
          </h1>
          <p className="text-xl sm:text-2xl text-muted-foreground max-w-2xl mx-auto">
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
      <section className="py-20 px-6 bg-secondary/30">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className="space-y-6">
              <h2 className="text-5xl font-semibold tracking-tight">
                Butte County
                <br />
                Rental Atlas
              </h2>
              <p className="text-xl text-muted-foreground leading-relaxed">
                Interactive mapping platform with real-time availability, FMR calculations, and comprehensive property
                data across 5,700+ rental units.
              </p>
              <Link
                href="/rental-map"
                className="inline-flex items-center text-primary hover:underline text-lg transition-colors"
              >
                Check out Tool
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
              <div className="flex gap-8 pt-4">
                <div>
                  <div className="text-4xl font-semibold">5,700+</div>
                  <div className="text-sm text-muted-foreground">Properties</div>
                </div>
                <div>
                  <div className="text-4xl font-semibold">50+</div>
                  <div className="text-sm text-muted-foreground">Data Sources</div>
                </div>
                <div>
                  <div className="text-4xl font-semibold">2026</div>
                  <div className="text-sm text-muted-foreground">HUD FMR</div>
                </div>
              </div>
            </div>
            <RentalMapPreview />
          </div>
        </div>
      </section>

      {/* Feature Section - Community Services */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            {/* Visual preview — order on the left for variety */}
            <div className="relative order-2 md:order-1">
              <div className="aspect-video rounded-xl overflow-hidden bg-card border border-border shadow-xl">
                {/* Mock directory card */}
                <div className="flex h-full flex-col">
                  <div className="flex items-center justify-between border-b border-border bg-primary px-5 py-3">
                    <div className="flex items-center gap-2 text-primary-foreground">
                      <HeartHandshake className="h-4 w-4" />
                      <span className="text-sm font-semibold tracking-wide">Community Services Directory</span>
                    </div>
                    <span className="rounded-full bg-primary-foreground/15 px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                      Butte County
                    </span>
                  </div>
                  <div className="grid flex-1 grid-cols-2 gap-3 p-5">
                    {[
                      { cat: "Food", name: "Jesus Center", meta: "Mon–Fri 8a–4p" },
                      { cat: "Housing", name: "Torres Shelter", meta: "24/7 Intake" },
                      { cat: "Mental Health", name: "BH Crisis Line", meta: "(800) 334-6622" },
                      { cat: "Legal", name: "Legal Services NorCal", meta: "Free civil aid" },
                    ].map((item) => (
                      <div
                        key={item.name}
                        className="flex flex-col gap-1 rounded-lg border border-border bg-background p-3"
                      >
                        <span className="inline-flex w-fit items-center rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground">
                          {item.cat}
                        </span>
                        <span className="text-sm font-semibold text-foreground">{item.name}</span>
                        <span className="text-xs text-muted-foreground">{item.meta}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Copy */}
            <div className="order-1 md:order-2 space-y-6">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <HeartHandshake className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-5xl font-semibold tracking-tight">
                Community Services
                <br />
                Directory
              </h2>
              <p className="text-xl text-muted-foreground leading-relaxed">
                Connect Butte County residents to mental health, food, housing, legal aid, job training, and
                healthcare resources in one searchable directory.
              </p>
              <Link
                href="/community-services"
                className="inline-flex items-center text-primary hover:underline text-lg font-medium transition-colors"
              >
                Browse Resources
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
              <div className="flex gap-8 pt-4">
                <div>
                  <div className="text-4xl font-semibold">200+</div>
                  <div className="text-sm text-muted-foreground">Services</div>
                </div>
                <div>
                  <div className="text-4xl font-semibold">12</div>
                  <div className="text-sm text-muted-foreground">Categories</div>
                </div>
                <div>
                  <div className="text-4xl font-semibold">24/7</div>
                  <div className="text-sm text-muted-foreground">Access</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="h-4 w-4 text-primary" /> Direct phone
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-primary" /> Hours of operation
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-primary" /> Addresses
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="py-20 px-6 bg-secondary/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-semibold tracking-tight mb-4">Designed to empower.</h2>
            <p className="text-xl text-muted-foreground">Every feature built with purpose.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-12">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center transition-colors">
                <div className="w-6 h-6 rounded-full bg-primary" />
              </div>
              <h3 className="text-2xl font-semibold">Instant Efficiency</h3>
              <p className="text-muted-foreground leading-relaxed">
                Tools that work instantly. No learning curve, no complexity. Just results.
              </p>
            </div>
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center transition-colors">
                <div className="w-6 h-6 rounded-full bg-primary/70" />
              </div>
              <h3 className="text-2xl font-semibold">Work Smarter</h3>
              <p className="text-muted-foreground leading-relaxed">
                Automate the tedious. Focus on what matters. Let our tools handle the rest.
              </p>
            </div>
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center transition-colors">
                <div className="w-6 h-6 rounded-full bg-slate-500" />
              </div>
              <h3 className="text-2xl font-semibold">Always Reliable</h3>
              <p className="text-muted-foreground leading-relaxed">
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
          <p className="text-xl text-muted-foreground">
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
      </main>

      <SiteFooter />
    </div>
  )
}
