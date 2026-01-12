import { createBrowserClient } from "@supabase/ssr"

let supabaseClient: ReturnType<typeof createBrowserClient> | null = null

/**
 * Creates a single Supabase client instance and reuses it.
 * Uses module-level singleton to prevent multiple GoTrueClient instances.
 */
export function createClient() {
  if (supabaseClient) {
    return supabaseClient
  }

  supabaseClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  return supabaseClient
}

/**
 * Force clear the client (useful for testing or logout)
 */
export function resetClient() {
  supabaseClient = null
}
