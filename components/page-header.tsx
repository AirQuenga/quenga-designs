import React from "react"
import Link from "next/link"
import { Home, ChevronRight } from "lucide-react"

interface BreadcrumbItem {
  label: string
  href?: string
}

interface PageHeaderProps {
  title: string
  description?: string
  breadcrumbs?: BreadcrumbItem[]
  children?: React.ReactNode
  /** Use compact layout for admin pages (smaller title, tighter spacing) */
  compact?: boolean
}

export function PageHeader({
  title,
  description,
  breadcrumbs = [],
  children,
  compact = false,
}: PageHeaderProps) {
  return (
    <div className={compact ? "py-6" : "py-16"}>
      {/* Directory-style Breadcrumb */}
      <nav
        className="mb-6 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400"
        aria-label="Breadcrumb"
      >
        <Link
          href="/"
          className="flex items-center gap-1 rounded-md px-1.5 py-1 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          aria-label="Home"
        >
          <Home className="h-4 w-4" />
        </Link>
        {breadcrumbs.map((item, index) => (
          <React.Fragment key={index}>
            <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
            {item.href ? (
              <Link
                href={item.href}
                className="rounded-md px-1.5 py-1 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              >
                {item.label}
              </Link>
            ) : (
              <span className="px-1.5 py-1 font-medium text-slate-900 dark:text-slate-100">{item.label}</span>
            )}
          </React.Fragment>
        ))}
      </nav>

      {/* Title and optional actions */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1
            className={
              compact
                ? "text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl lg:text-4xl"
                : "text-5xl font-semibold tracking-tight leading-none text-slate-900 dark:text-slate-100 sm:text-6xl md:text-7xl lg:text-8xl mb-4"
            }
          >
            {title}
          </h1>
          {description && (
            <p
              className={
                compact
                  ? "mt-1 text-sm text-slate-500 dark:text-slate-400 sm:mt-2 sm:text-base max-w-2xl"
                  : "text-lg text-slate-500 dark:text-slate-400 sm:text-xl max-w-2xl"
              }
            >
              {description}
            </p>
          )}
        </div>
        {children && <div className="shrink-0">{children}</div>}
      </div>
    </div>
  )
}
