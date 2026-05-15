"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Globe, Loader2, Link2, AlertCircle } from "lucide-react"
import type { ScrapedListing } from "@/app/api/scrape/route"

interface ScrapeState {
  status: "idle" | "loading" | "done" | "error"
  listing: ScrapedListing | null
  error: string | null
}

export function ScrapeRunner() {
  const [url, setUrl] = useState("")
  const [state, setState] = useState<ScrapeState>({ status: "idle", listing: null, error: null })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return
    setState({ status: "loading", listing: null, error: null })
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      })
      const json = await res.json()
      if (!res.ok) {
        setState({ status: "error", listing: null, error: json.error || "Scrape failed" })
        return
      }
      setState({ status: "done", listing: json.listing as ScrapedListing, error: null })
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Network error"
      setState({ status: "error", listing: null, error: msg })
    }
  }

  const isLoading = state.status === "loading"
  const listing = state.listing

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2.5">
          <Globe className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-card-foreground">Live Scrape</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Paste a rental listing URL. The scraper extracts price, beds/baths, available date, and description, then
            links the result to the matching property in the Rental Atlas if one exists.
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Input
          type="url"
          required
          placeholder="https://example.com/listing/123"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={isLoading}
          className="flex-1"
        />
        <Button type="submit" disabled={isLoading || !url.trim()}>
          {isLoading ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              Scraping…
            </>
          ) : (
            <>
              <Link2 className="mr-1.5 h-4 w-4" />
              Scrape Listing
            </>
          )}
        </Button>
      </form>

      {state.status === "error" && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      {listing && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
            <span className="truncate">Source: {listing.source_host}</span>
            {listing.matched_property_id ? (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                Matched in Atlas
              </span>
            ) : (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                No Atlas match
              </span>
            )}
          </div>

          {listing.title && <h3 className="text-lg font-semibold text-card-foreground">{listing.title}</h3>}

          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
            <Stat label="Price" value={listing.price ? `$${listing.price.toLocaleString()}/mo` : "—"} />
            <Stat label="Bedrooms" value={listing.bedrooms != null ? String(listing.bedrooms) : "—"} />
            <Stat label="Bathrooms" value={listing.bathrooms != null ? String(listing.bathrooms) : "—"} />
            <Stat label="Square Feet" value={listing.square_feet ? listing.square_feet.toLocaleString() : "—"} />
            <Stat label="Available" value={listing.available_date ?? "—"} />
            <Stat
              label="Address"
              value={listing.address ?? "—"}
              full
            />
          </dl>

          {listing.matched_property_address && (
            <div className="rounded-lg border border-border bg-secondary/40 p-3 text-sm">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Linked Atlas Record</div>
              <div className="mt-1 font-medium text-foreground">{listing.matched_property_address}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">ID: {listing.matched_property_id}</div>
            </div>
          )}

          {listing.description && (
            <div className="rounded-lg border border-border bg-background p-3 text-sm leading-relaxed text-muted-foreground">
              {listing.description}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, full = false }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={full ? "col-span-2 sm:col-span-4" : ""}>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium text-foreground">{value}</dd>
    </div>
  )
}
