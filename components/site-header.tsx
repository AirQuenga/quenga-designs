"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Lock, Wrench } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

// Default passcode. In production this should be validated server-side.
const ADMIN_PASSCODE = process.env.NEXT_PUBLIC_ADMIN_PASSCODE || "quenga2026"
const ADMIN_SESSION_KEY = "qd_admin_unlocked"

export default function SiteHeader() {
  const router = useRouter()
  const [showPasscode, setShowPasscode] = useState(false)
  const [passcode, setPasscode] = useState("")
  const [error, setError] = useState("")

  const handleAdminClick = (e: React.MouseEvent) => {
    e.preventDefault()
    // Skip prompt if already unlocked this session
    if (typeof window !== "undefined" && sessionStorage.getItem(ADMIN_SESSION_KEY) === "true") {
      router.push("/admin")
      return
    }
    setShowPasscode(true)
    setPasscode("")
    setError("")
  }

  const handlePasscodeSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (passcode === ADMIN_PASSCODE) {
      sessionStorage.setItem(ADMIN_SESSION_KEY, "true")
      setShowPasscode(false)
      router.push("/admin")
    } else {
      setError("Incorrect passcode. Please try again.")
    }
  }

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 transition-colors">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo/Home — navigates to Tools/Projects page */}
          <Link
            href="/projects"
            className="text-xl font-semibold tracking-tight hover:opacity-80 transition-opacity"
          >
            Quenga Designs
          </Link>

          <div className="flex items-center gap-8">
            <Link
              href="/projects"
              className="text-sm font-medium hover:text-primary transition-colors relative group flex items-center gap-1.5"
            >
              <Wrench className="h-4 w-4" />
              Tools
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary group-hover:w-full transition-all duration-200" />
            </Link>
            <Link
              href="/community-services"
              className="text-sm font-medium hover:text-primary transition-colors relative group"
            >
              Community Services
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary group-hover:w-full transition-all duration-200" />
            </Link>
            <button
              onClick={handleAdminClick}
              className="text-sm font-medium hover:text-primary transition-colors relative group flex items-center gap-1.5"
            >
              <Lock className="h-3.5 w-3.5" />
              Admin
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary group-hover:w-full transition-all duration-200" />
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Admin Passcode Modal */}
      {showPasscode && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowPasscode(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-full bg-primary/10 p-2.5">
                <Lock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-card-foreground">Admin Access</h2>
                <p className="text-xs text-muted-foreground">Enter passcode to continue</p>
              </div>
            </div>
            <form onSubmit={handlePasscodeSubmit} className="space-y-3">
              <Input
                type="password"
                autoFocus
                placeholder="Passcode"
                value={passcode}
                onChange={(e) => {
                  setPasscode(e.target.value)
                  setError("")
                }}
              />
              {error && <p className="text-xs text-red-500">{error}</p>}
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowPasscode(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  Unlock
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
