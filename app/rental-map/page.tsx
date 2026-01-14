import { RentalAtlas } from "@/components/rental-atlas"
import { createClient } from "@/lib/supabase/server"

async function fetchPropertiesWithRetry(retries = 3, delay = 1000): Promise<any[]> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const supabase = await createClient()

      const { data: properties, error } = await supabase
        .from("properties")
        .select("*")
        .order("is_available", { ascending: false })
        .order("city", { ascending: true })

      if (error) {
        // Check if it's a rate limit error
        if (error.message?.includes("Too Many") || error.code === "429") {
          if (attempt < retries) {
            console.log(`[v0] Rate limited, retrying in ${delay}ms (attempt ${attempt}/${retries})`)
            await new Promise((resolve) => setTimeout(resolve, delay))
            delay *= 2 // Exponential backoff
            continue
          }
        }
        throw error
      }

      return properties || []
    } catch (err: any) {
      // Handle non-JSON responses (like "Too Many Requests" text)
      if (err?.message?.includes("Unexpected token") || err?.message?.includes("Too Many")) {
        if (attempt < retries) {
          console.log(`[v0] Rate limited (parse error), retrying in ${delay}ms (attempt ${attempt}/${retries})`)
          await new Promise((resolve) => setTimeout(resolve, delay))
          delay *= 2
          continue
        }
      }

      if (attempt === retries) {
        console.error("[v0] Failed to fetch properties after retries:", err)
        return []
      }
    }
  }

  return []
}

export default async function RentalMapPage() {
  const properties = await fetchPropertiesWithRetry()

  return <RentalAtlas initialProperties={properties} />
}
