"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const ADMIN_PASSCODE = "1234"
const ADMIN_SESSION_KEY = "qd_admin_unlocked"

export default function SiteFooter() {
  const router = useRouter()
  const [showPasscode, setShowPasscode] = useState(false)
  const [passcode, setPasscode] = useState("")
  const [error, setError] = useState("")

  const handleAdminClick = (e: React.MouseEvent) => {
    e.preventDefault()
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
      <footer className="border-t border-border py-8 px-6 bg-background transition-colors">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <div>© 2026 Quenga Designs. All rights reserved.</div>
          <nav className="flex gap-6" aria-label="Footer navigation">
            <button
              onClick={handleAdminClick}
              className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              <Lock className="h-3.5 w-3.5" />
              Admin
            </button>
          </nav>
        </div>
      </footer>

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
