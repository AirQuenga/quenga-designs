import React from "react"
import Link from "next/link"
import { Home } from "lucide-react"

interface BreadcrumbItem {
  label: string
  href?: string
}

interface PageHeaderProps {
  title: string
  description?: string
  breadcrumbs: BreadcrumbItem[]
  children?: React.ReactNode
}

export function PageHeader({ title, description, breadcrumbs, children }: PageHeaderProps) {
  return (
    <div className="py-16">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-12">
        <Link 
          href="/" 
          className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          aria-label="Home"
        >
          <Home className="h-4 w-4" />
        </Link>
        {breadcrumbs.map((item, index) => (
          <span key={index} className="flex items-center gap-2">
            <span aria-hidden="true">/</span>
            {item.href ? (
              <Link 
                href={item.href} 
                className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span>{item.label}</span>
            )}
          </span>
        ))}
      </nav>

      {/* Title and optional actions */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
        <div>
          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-semibold tracking-tight leading-none mb-4">
            {title}
          </h1>
          {description && (
            <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 max-w-2xl">
              {description}
            </p>
          )}
        </div>
        {children && <div className="shrink-0">{children}</div>}
      </div>
    </div>
  )
}
