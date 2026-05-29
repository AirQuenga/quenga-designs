"use client"

import { ReactNode } from "react"
import { LucideIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface AdminCardProps {
  title: string
  subtitle: string
  icon: LucideIcon
  badge?: string
  badgeVariant?: "running" | "default"
  children: ReactNode
}

export function AdminCard({
  title,
  subtitle,
  icon: Icon,
  badge,
  badgeVariant = "default",
  children,
}: AdminCardProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6">
      <div className="mb-4 flex items-start justify-between sm:mb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-900/5 dark:bg-slate-700 sm:h-10 sm:w-10">
            <Icon className="h-4 w-4 text-slate-700 dark:text-slate-300 sm:h-5 sm:w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 sm:text-lg">{title}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
          </div>
        </div>
        {badge && (
          <Badge
            className={
              badgeVariant === "running"
                ? "h-6 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800"
                : "h-6 bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600"
            }
          >
            {badge}
          </Badge>
        )}
      </div>
      {children}
    </section>
  )
}
