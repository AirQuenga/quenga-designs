import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Home, Heart, GraduationCap, Briefcase, Shield, DollarSign } from "lucide-react"
import SiteHeader from "@/components/site-header"
import SiteFooter from "@/components/site-footer"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"

export const metadata: Metadata = {
  title: "Programs | Quenga Designs",
  description:
    "Explore Butte County housing assistance programs including Section 8, HUD Fair Market Rent, post-fire recovery, and rental support resources.",
}

interface Program {
  title: string
  description: string
  icon: typeof Home
  status: "active" | "coming-soon"
  href?: string
  highlights: string[]
}

const programs: Program[] = [
  {
    title: "Section 8 Housing Choice Voucher",
    description:
      "Federally funded rental assistance for low-income families, seniors, and individuals with disabilities. Vouchers cover the difference between 30% of household income and the unit's rent.",
    icon: Home,
    status: "active",
    href: "/rental-map?filter=section8",
    highlights: ["Income-based rent", "Tenant choice of unit", "Portable to other counties"],
  },
  {
    title: "HUD Fair Market Rent (FMR)",
    description:
      "Annual rent ceilings published by HUD that determine voucher payment standards. Updated each fiscal year to reflect local rental market conditions in Butte County.",
    icon: DollarSign,
    status: "active",
    href: "/rental-map",
    highlights: ["2026 FMR data", "Per-bedroom limits", "Quarterly rent reasonableness checks"],
  },
  {
    title: "Post-Fire Recovery Housing",
    description:
      "Specialized assistance for households displaced by the Camp Fire and other regional wildfires. Includes priority placement, rebuilding resources, and long-term recovery support.",
    icon: Shield,
    status: "active",
    href: "/rental-map?filter=postfire",
    highlights: ["Displacement priority", "Rebuild grants", "Insurance navigation"],
  },
  {
    title: "Community Services Network",
    description:
      "Coordinated entry into 200+ local resources covering mental health, food security, legal aid, healthcare, and job training across Butte County.",
    icon: Heart,
    status: "active",
    href: "/community-services",
    highlights: ["Mental health support", "Food banks", "Legal aid"],
  },
  {
    title: "Workforce & Education",
    description:
      "Job training, GED preparation, vocational certifications, and career counseling programs designed to help residents achieve economic stability.",
    icon: GraduationCap,
    status: "coming-soon",
    highlights: ["Career counseling", "Skills training", "Education grants"],
  },
  {
    title: "Small Business & Self-Sufficiency",
    description:
      "Family Self-Sufficiency (FSS) program and small business resources that help households build savings and transition off rental assistance.",
    icon: Briefcase,
    status: "coming-soon",
    highlights: ["Escrow accounts", "Financial coaching", "Microloans"],
  },
]

export default function ProgramsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-20 sm:px-6">
        <PageHeader
          title="Programs"
          description="Housing assistance and community programs available to Butte County residents."
          breadcrumbs={[{ label: "Programs" }]}
        />

        {/* Intro card */}
        <div className="mb-8 rounded-md border border-border bg-card p-6 shadow-sm sm:mb-10 sm:p-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-6">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Get connected to housing support</h2>
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                Quenga Designs builds the data tools that municipal staff and case managers use to connect Butte County
                residents with the right program. Below is an overview of the housing programs supported by our
                platform.
              </p>
            </div>
            <Link
              href="/community-services"
              className="inline-flex h-10 flex-shrink-0 items-center justify-center gap-1.5 self-start rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md"
            >
              View Resources
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Programs grid */}
        <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
          {programs.map((program) => {
            const Icon = program.icon
            const isActive = program.status === "active"
            const Wrapper: typeof Link | "div" = isActive && program.href ? Link : "div"
            const wrapperProps = isActive && program.href ? { href: program.href } : {}

            return (
              <Wrapper
                key={program.title}
                {...(wrapperProps as { href: string })}
                className={`group flex flex-col rounded-md border bg-card p-6 shadow-sm transition-all ${
                  isActive
                    ? "border-border hover:border-primary/40 hover:shadow-md"
                    : "border-dashed border-border opacity-75"
                }`}
              >
                <div className="mb-4 flex items-start justify-between">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-md ${
                      isActive ? "bg-primary/10" : "bg-muted"
                    }`}
                  >
                    <Icon
                      className={`h-5 w-5 ${isActive ? "text-primary" : "text-muted-foreground"}`}
                      aria-hidden="true"
                    />
                  </div>
                  {!isActive && (
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                      Coming Soon
                    </Badge>
                  )}
                </div>

                <h3
                  className={`mb-2 text-base font-semibold tracking-tight sm:text-lg ${
                    isActive ? "text-card-foreground group-hover:text-primary" : "text-card-foreground"
                  } transition-colors`}
                >
                  {program.title}
                </h3>
                <p className="mb-4 flex-1 text-sm leading-relaxed text-muted-foreground">{program.description}</p>

                <ul className="mb-4 space-y-1.5 border-t border-border pt-3 text-xs text-muted-foreground">
                  {program.highlights.map((h) => (
                    <li key={h} className="flex items-center gap-2">
                      <span className="h-1 w-1 flex-shrink-0 rounded-full bg-primary" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>

                {isActive && (
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary group-hover:gap-2.5 transition-all">
                    Open Tool
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </span>
                )}
              </Wrapper>
            )
          })}
        </div>

        {/* Footer note */}
        <p className="mt-10 max-w-3xl text-xs leading-relaxed text-muted-foreground">
          Program eligibility, availability, and benefit levels are subject to federal, state, and local funding
          decisions. For official enrollment or case management, contact the Butte County Housing Authority or your
          local services office.
        </p>
      </main>

      <SiteFooter />
    </div>
  )
}
