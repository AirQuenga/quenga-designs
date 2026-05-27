"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useEffect } from "react"
import { Menu, X } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"

const NAV_LINKS = [
  { href: "/projects", label: "Home", match: ["/projects", "/"] },
  { href: "/projects", label: "Tools", match: ["/rental-map", "/community-services"] },
] as const

export default function SiteHeader() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  // Close drawer on route change
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [open])

  const isActive = (matches: readonly string[]) =>
    matches.some((m) => (m === "/" ? pathname === "/" : pathname.startsWith(m)))

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 transition-colors">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link
          href="/projects"
          className="text-lg font-semibold tracking-tight transition-opacity hover:opacity-80 sm:text-xl"
        >
          Quenga Designs
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary navigation">
          {NAV_LINKS.map((link, i) => {
            const active = isActive(link.match)
            return (
              <Link
                key={`${link.label}-${i}`}
                href={link.href}
                className={`group relative text-sm transition-colors ${
                  active ? "font-semibold text-foreground" : "font-medium hover:text-primary"
                }`}
              >
                {link.label}
                <span
                  className={`absolute -bottom-1 left-0 h-0.5 bg-primary transition-all duration-200 ${
                    active ? "w-full" : "w-0 group-hover:w-full"
                  }`}
                />
              </Link>
            )
          })}
          <ThemeToggle />
        </nav>

        {/* Mobile controls */}
        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-nav-drawer"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-foreground transition-colors hover:bg-accent"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      <div
        className={`md:hidden ${open ? "pointer-events-auto" : "pointer-events-none"}`}
        aria-hidden={!open}
      >
        {/* Backdrop */}
        <div
          onClick={() => setOpen(false)}
          className={`fixed inset-0 top-16 z-40 bg-foreground/30 backdrop-blur-sm transition-opacity duration-200 ${
            open ? "opacity-100" : "opacity-0"
          }`}
        />
        {/* Panel */}
        <nav
          id="mobile-nav-drawer"
          aria-label="Mobile navigation"
          className={`fixed inset-x-0 top-16 z-50 border-b border-border bg-background shadow-lg transition-transform duration-200 ${
            open ? "translate-y-0" : "-translate-y-2 opacity-0"
          }`}
        >
          <ul className="flex flex-col py-2">
            {NAV_LINKS.map((link, i) => {
              const active = isActive(link.match)
              return (
                <li key={`mobile-${link.label}-${i}`}>
                  <Link
                    href={link.href}
                    className={`flex items-center justify-between border-l-4 px-6 py-3 text-base transition-colors ${
                      active
                        ? "border-primary bg-accent/50 font-semibold text-foreground"
                        : "border-transparent text-foreground hover:border-primary/40 hover:bg-accent/30"
                    }`}
                  >
                    <span>{link.label}</span>
                    {active && <span className="text-xs font-medium text-primary">Current</span>}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      </div>
    </header>
  )
}
