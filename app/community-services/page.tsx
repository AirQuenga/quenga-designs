import { Metadata } from "next"
import { CommunityServicesTable } from "@/components/community/community-services-table"
import SiteHeader from "@/components/site-header"
import SiteFooter from "@/components/site-footer"
import { PageHeader } from "@/components/page-header"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Community Services | Quenga Designs",
  description:
    "Find mental health, food banks, legal aid, job training, housing support, and other community resources in Butte County.",
  openGraph: {
    title: "Community Services",
    description: "Local community resources and support services in Butte County",
    type: "website",
  },
}

export default function CommunityServicesPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />

      <main className="flex-1">
        <div className="container mx-auto max-w-6xl px-6 py-12">
          <PageHeader
            title="Community Services Directory"
            description="Find mental health, food banks, legal aid, job training, housing support, and other community resources throughout Butte County."
          />

          <div className="mt-10">
            <CommunityServicesTable />
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
