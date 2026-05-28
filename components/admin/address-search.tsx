"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Loader2, MapPin } from "lucide-react"
import { BUTTE_COUNTY_CENTER, BUTTE_COUNTY_RADIUS_M, type ParsedAddress } from "@/config/address-constants"

// --------------------------------------------------------------------------
// Google Maps types (subset — avoids needing @types/google.maps globally)
// --------------------------------------------------------------------------
declare global {
  interface Window {
    google?: {
      maps: {
        places: {
          Autocomplete: new (
            input: HTMLInputElement,
            opts?: Record<string, unknown>,
          ) => {
            addListener: (event: string, cb: () => void) => void
            getPlace: () => {
              formatted_address?: string
              address_components?: Array<{
                long_name: string
                short_name: string
                types: string[]
              }>
              geometry?: { location: { lat: () => number; lng: () => number } }
            }
          }
          AutocompleteSessionToken: new () => unknown
        }
        LatLng: new (lat: number, lng: number) => unknown
        Circle: new (opts: unknown) => { getBounds: () => unknown }
      }
    }
    initGooglePlacesCallback?: () => void
  }
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function extractComponent(
  components: Array<{ long_name: string; short_name: string; types: string[] }>,
  type: string,
  useShort = false,
): string {
  const comp = components.find((c) => c.types.includes(type))
  return comp ? (useShort ? comp.short_name : comp.long_name) : ""
}

// @ts-expect-error - google namespace is loaded dynamically via script
function parsePlace(place: google.maps.places.PlaceResult | undefined): ParsedAddress | null {
  if (!place?.address_components) return null

  const comps = place.address_components
  const street_number = extractComponent(comps, "street_number")
  const route = extractComponent(comps, "route")
  const city =
    extractComponent(comps, "locality") ||
    extractComponent(comps, "sublocality") ||
    extractComponent(comps, "administrative_area_level_2")
  const state = extractComponent(comps, "administrative_area_level_1", true)
  const zip = extractComponent(comps, "postal_code")
  const lat = place.geometry?.location?.lat()
  const lng = place.geometry?.location?.lng()

  return {
    street_number,
    route,
    city,
    state,
    zip,
    formatted_address: place.formatted_address ?? `${street_number} ${route}, ${city}, ${state} ${zip}`,
    lat,
    lng,
  }
}

// --------------------------------------------------------------------------
// Hook — loads the Places script once per page
// --------------------------------------------------------------------------

function useGooglePlaces(apiKey: string | undefined) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!apiKey) return
    if (window.google?.maps?.places) {
      setReady(true)
      return
    }
    if (document.getElementById("google-places-script")) return

    window.initGooglePlacesCallback = () => setReady(true)

    const script = document.createElement("script")
    script.id = "google-places-script"
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGooglePlacesCallback`
    script.async = true
    script.defer = true
    document.head.appendChild(script)
  }, [apiKey])

  return ready
}

// --------------------------------------------------------------------------
// Component
// --------------------------------------------------------------------------

interface AddressSearchProps {
  /** Called when the user selects a valid address and triggers lookup */
  onLookup: (parsed: ParsedAddress) => void | Promise<void>
  isLoading?: boolean
  placeholder?: string
}

export function AddressSearch({
  onLookup,
  isLoading = false,
  placeholder = "Start typing an address in Chico, CA…",
}: AddressSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<ReturnType<typeof window.google.maps.places.Autocomplete.prototype.valueOf> | null>(null)
  const selectedRef = useRef<ParsedAddress | null>(null)

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY
  const placesReady = useGooglePlaces(apiKey)

  // Attach Autocomplete once the script is loaded
  useEffect(() => {
    if (!placesReady || !inputRef.current || autocompleteRef.current) return
    if (!window.google?.maps?.places) return

    const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
      types: ["address"],
      componentRestrictions: { country: "us" },
      fields: ["address_components", "formatted_address", "geometry"],
      // Bias strongly toward Butte County
      location: new window.google.maps.LatLng(BUTTE_COUNTY_CENTER.lat, BUTTE_COUNTY_CENTER.lng),
      radius: BUTTE_COUNTY_RADIUS_M,
      strictBounds: false,
    })

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace()
      const parsed = parsePlace(place)
      selectedRef.current = parsed
      if (parsed && inputRef.current) {
        // Show the canonical formatted address in the input
        inputRef.current.value = parsed.formatted_address
      }
    })

    autocompleteRef.current = autocomplete
  }, [placesReady])

  const handleSubmit = useCallback(async () => {
    const parsed = selectedRef.current
    if (!parsed) return
    await onLookup(parsed)
    // Reset after submit
    selectedRef.current = null
    if (inputRef.current) inputRef.current.value = ""
  }, [onLookup])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit],
  )

  const hasKey = Boolean(apiKey)

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            ref={inputRef}
            className="pl-9"
            placeholder={!hasKey ? "Add NEXT_PUBLIC_GOOGLE_PLACES_API_KEY to enable autocomplete" : placeholder}
            disabled={isLoading || !hasKey}
            onKeyDown={handleKeyDown}
            onChange={() => {
              // Clear selection if user starts re-typing
              selectedRef.current = null
            }}
            aria-label="Address search"
            autoComplete="off"
          />
        </div>
        <Button onClick={handleSubmit} disabled={isLoading || !hasKey}>
          {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
          Lookup
        </Button>
      </div>

      {!hasKey && (
        <p className="text-xs text-muted-foreground">
          Set <code className="font-mono bg-muted px-1 rounded">NEXT_PUBLIC_GOOGLE_PLACES_API_KEY</code> in your
          environment variables to enable proximity-aware address autocomplete.
        </p>
      )}
    </div>
  )
}
