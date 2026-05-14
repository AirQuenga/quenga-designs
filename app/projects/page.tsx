import Link from "next/link"
import type { Metadata } from "next"
import { Map, Clock, HeartHandshake, ArrowRight } from "lucide-react"
import SiteHeader from "@/components/site-header"
import SiteFooter from "@/components/site-footer"
import { PageHeader } from "@/components/page-header"

export const metadata: Metadata = {
  title: "Tools",
  description:
    "Explore the Quenga Designs suite of civic tools for Butte County — including the Rental Atlas and Community Services directory.",
}

interface ToolCard {
  href: string
  title: string
  description: string
  icon: typeof Map
  stats: { value: string; label: string }[]
}

const tools: ToolCard[] = [
  {
    href: "/rental-map",
    title: "Butte County Rental Atlas",
    description:
      "Interactive mapping platform with real-time availability, FMR calculations, and comprehensive property data.",
    icon: Map,
    stats: [
      { value: "5,700+", label: "Properties" },
      { value: "50+", label: "Sources" },
      { value: "2026", label: "HUD FMR" },
    ],
  },
  {
    href: "/community-services",
    title: "Community Services",
    description:
      "Find mental health, food banks, legal aid, job training, housing support, and other community resources throughout Butte County.",
    icon: HeartHandshake,
    stats: [
      { value: "200+", label: "Services" },
      { value: "12", label: "Categories" },
      { value: "24/7", label: "Access" },
    ],
  },
]

export default function ProjectsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />

      <main className="flex-1 max-w-7xl mx-auto px-6 w-full pb-20">
        <PageHeader
          title="Tools"
          description="Explore our suite of powerful tools designed to make your work effortless."
          breadcrumbs={[{ label: "Tools" }]}
        />

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
          {tools.map((tool) => {
            const Icon = tool.icon
            return (
              <Link
                key={tool.href}
                href={tool.href}
                className="group bg-card border border-border rounded-xl p-8 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
              >
                <div className="mb-6">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold mb-2 text-card-foreground group-hover:text-primary transition-colors">
                  {tool.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                  {tool.description}
                </p>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  {tool.stats.map((stat) => (
                    <div key={stat.label}>
                      <div className="text-lg font-semibold text-card-foreground">
                        {stat.value}
                      </div>
                      <div className="text-xs text-muted-foreground">{stat.label}</div>
                    </div>
                  ))}
                </div>
                <div className="inline-flex items-center gap-1.5 text-sm font-medium text-primary group-hover:gap-2.5 transition-all">
                  Try Now
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </div>
              </Link>
            )
          })}

          {/* Coming Soon Placeholder */}
          <div className="bg-card border border-dashed border-border rounded-xl p-8 opacity-70">
            <div className="mb-6">
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                <Clock className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
              </div>
            </div>
            <h3 className="text-xl font-semibold mb-2 text-card-foreground">Coming Soon</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              New tools and projects are currently in development.
            </p>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
