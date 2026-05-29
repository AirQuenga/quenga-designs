"use client"

import { ReactNode } from "react"
import SiteHeader from "@/components/site-header"
import SiteFooter from "@/components/site-footer"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"

interface BreadcrumbItem {
  label: string
  href?: string
}

export interface AdminHubLayoutProps {
  title: string
  description: string
  breadcrumbs: BreadcrumbItem[]
  importCard: ReactNode
  auditCard: ReactNode
  scrapeCard: ReactNode
  log: ReactNode
  children?: ReactNode
}

export function AdminHubLayout({
  title,
  description,
  breadcrumbs,
  importCard,
  auditCard,
  scrapeCard,
  log,
  children,
}: AdminHubLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <SiteHeader />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
        {/* Page header with breadcrumbs */}
        <header className="mb-6 sm:mb-10">
          <PageHeader title={title} description={description} breadcrumbs={breadcrumbs}>
            <Badge
              variant="secondary"
              className="h-7 bg-slate-900/5 px-3 text-slate-700 border border-slate-200"
            >
              Restricted Access
            </Badge>
          </PageHeader>
        </header>

        {/* 3-Card Grid: Import | Audit | Scrape */}
        <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
          {importCard}
          {auditCard}
          {scrapeCard}
        </div>

        {/* Unified Activity Log */}
        <div className="mt-6 sm:mt-8">
          {log}
          <p className="mt-2 text-[11px] text-slate-500 sm:text-xs">
            Tracks every Import, Audit, and Scrape event in real time. Database updates are logged only
            after Supabase confirms the write.
          </p>
        </div>

        {/* Optional children (e.g., review tables) */}
        {children}
      </main>

      <SiteFooter />
    </div>
  )
}
