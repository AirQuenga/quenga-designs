"use server"

/**
 * Web-Search Audit (AI-driven Self-Healing) — v3
 *
 * For each property in `public.properties`, this action:
 *   1) Reads the row from Supabase (batched at 25 rows per invocation).
 *   2) Asks `openai/gpt-4o-mini` to perform a live `web_search_preview` for
 *      matching rental listings on Zillow, Apartments.com, Trulia, Rent.com,
 *      etc. and extract 12 specific fields as a structured object.
 *   3) Persists any non-null field that's currently missing on the row.
 *   4) Emits one `[FIXED]` / `[WARN]` / `[ERROR]` log line per record.
 *
 * Field set per spec: Address, City, State, Zip, APN, Bedrooms, Bathrooms,
 * Square_Feet, Rent, Available_Date, Management_Company, Notes.
 *
 * Runs through the Vercel AI Gateway (zero-config for OpenAI). Each AI call
 * has its own try/catch, so one rate-limit or parse error never aborts the
 * batch — execution continues with the next row.
 */

import { generateText, Output } from "ai"
import { openai } from "@ai-sdk/openai"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import type { AuditLogLine, AuditBatchResult } from "./audit-db"

/* ---------------- target row type (12 fields) ---------------- */

interface PropertyRowWide {
  id: string
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  apn: string | null
  bedrooms: number | null
  bathrooms: number | null
  square_feet: number | null
  rent: number | null
  available_date: string | null
  management_company: string | null
  notes: string | null
  property_name: string | null
}

/* ---------------- AI extraction schema ---------------- */

const ExtractedSchema = z.object({
  address: z.string().nullable().describe("Full street address with number, e.g. '123 Main St'"),
  city: z.string().nullable(),
  state: z.string().nullable().describe("Two-letter state code, e.g. 'CA'"),
  zip: z.string().nullable().describe("Five-digit US ZIP code"),
  apn: z.string().nullable().describe("Assessor's Parcel Number, if visible on a public listing"),
  bedrooms: z.number().nullable(),
  bathrooms: z.number().nullable(),
  square_feet: z.number().nullable(),
  rent: z.number().nullable().describe("Monthly rent in USD as a plain number, no commas/$"),
  available_date: z
    .string()
    .nullable()
    .describe("ISO date string YYYY-MM-DD when the unit becomes available"),
  management_company: z.string().nullable(),
  notes: z.string().nullable().describe("One-sentence summary of distinguishing features"),
  source_url: z.string().nullable().describe("The single best source URL the data came from"),
  confidence: z
    .enum(["high", "medium", "low", "none"])
    .describe("How confident the extraction is in the match"),
})

type Extracted = z.infer<typeof ExtractedSchema>

/* ---------------- AI search-and-extract helper ---------------- */

async function webSearchExtract(row: PropertyRowWide): Promise<Extracted | null> {
  const queryAddress = [row.address, row.city, row.state, row.zip_code]
    .filter(Boolean)
    .join(", ")
  if (!queryAddress) return null

  const propertyHint = row.property_name ? ` (also known as "${row.property_name}")` : ""

  try {
    const { experimental_output } = await generateText({
      model: openai.responses("gpt-4o-mini"),
      tools: { web_search_preview: openai.tools.webSearchPreview({ searchContextSize: "low" }) },
      experimental_output: Output.object({ schema: ExtractedSchema }),
      // Cap the agent to a couple of tool turns so latency stays predictable.
      stopWhen: ({ steps }: { steps: unknown[] }) => steps.length >= 3,
      prompt: [
        `You are auditing rental property records. Search the live web for the following address`,
        `and extract structured details from the BEST matching rental listing (Zillow,`,
        `Apartments.com, Trulia, Rent.com, Realtor.com, Craigslist, Zumper, etc.).`,
        ``,
        `Property: ${queryAddress}${propertyHint}`,
        ``,
        `Rules:`,
        `- Use the web_search_preview tool to find the listing — do NOT guess.`,
        `- If you cannot find a confident match, set confidence to "none" and return null fields.`,
        `- Never invent values. Prefer null over fabrication.`,
        `- Rent must be a plain number (no '$', no '/mo').`,
        `- Available date must be YYYY-MM-DD or null.`,
      ].join("\n"),
    })

    return experimental_output as Extracted
  } catch {
    return null
  }
}

/* ---------------- public API ---------------- */

export async function getWebAuditTotal(): Promise<number> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true })
  if (error) return 0
  return count ?? 0
}

export async function auditWebSearchBatch(
  offset = 0,
  batchSize = 25,
): Promise<AuditBatchResult> {
  const supabase = await createClient()
  const logs: AuditLogLine[] = []
  let fixed = 0
  let failed = 0

  const { count: total } = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true })
  const totalRows = total ?? 0

  const { data, error } = await supabase
    .from("properties")
    .select(
      "id, address, city, state, zip_code, apn, bedrooms, bathrooms, square_feet, rent, available_date, management_company, notes, property_name",
    )
    .order("id", { ascending: true })
    .range(offset, offset + batchSize - 1)

  if (error) {
    return {
      scanned: 0,
      fixed: 0,
      failed: 0,
      nextOffset: null,
      total: totalRows,
      logs: [
        { level: "ERROR", message: `Batch query failed at offset ${offset}: ${error.message}` },
      ],
    }
  }

  const rows = (data ?? []) as PropertyRowWide[]
  const scanned = rows.length

  for (const row of rows) {
    const label = row.address || row.property_name || `record ${row.id.slice(0, 8)}`

    try {
      const extracted = await webSearchExtract(row)

      if (!extracted || extracted.confidence === "none") {
        logs.push({
          level: "WARN",
          message: `No confident match found via web search for ${label}`,
        })
        continue
      }

      // Build the patch: only fill fields that are currently missing.
      const updates: Record<string, unknown> = {}
      const filled: string[] = []

      const setIfMissing = (
        col: keyof PropertyRowWide,
        value: unknown,
        prettyName: string,
      ): void => {
        const current = row[col]
        if (
          (current === null || current === undefined || current === "" || current === 0) &&
          value !== null &&
          value !== undefined &&
          value !== ""
        ) {
          updates[col as string] = value
          filled.push(prettyName)
        }
      }

      setIfMissing("address", extracted.address, "address")
      setIfMissing("city", extracted.city, "city")
      setIfMissing("state", extracted.state, "state")
      setIfMissing("zip_code", extracted.zip, "zip")
      setIfMissing("apn", extracted.apn, "APN")
      setIfMissing("bedrooms", extracted.bedrooms, "beds")
      setIfMissing("bathrooms", extracted.bathrooms, "baths")
      setIfMissing("square_feet", extracted.square_feet, "sqft")
      setIfMissing("rent", extracted.rent, "rent")
      setIfMissing("available_date", extracted.available_date, "available_date")
      setIfMissing("management_company", extracted.management_company, "management")
      setIfMissing("notes", extracted.notes, "notes")

      if (Object.keys(updates).length === 0) {
        logs.push({
          level: "INFO",
          message: `Verified ${label} — no missing fields needed filling (confidence: ${extracted.confidence})`,
        })
        continue
      }

      updates.updated_at = new Date().toISOString()

      const { error: updateError } = await supabase
        .from("properties")
        .update(updates)
        .eq("id", row.id)

      if (updateError) {
        failed++
        logs.push({
          level: "ERROR",
          message: `Database rejected update for ${label}: ${updateError.message.slice(0, 120)}`,
        })
      } else {
        fixed++
        const summary = filled.slice(0, 6).join(", ") + (filled.length > 6 ? `, +${filled.length - 6} more` : "")
        const sourceTag = extracted.source_url ? ` (source: ${extracted.source_url.slice(0, 60)})` : ""
        logs.push({
          level: "FIXED",
          message: `Found ${summary} for ${label} via web search${sourceTag}`,
        })
      }
    } catch (rowError) {
      failed++
      const msg = rowError instanceof Error ? rowError.message : "Unknown error"
      logs.push({
        level: "ERROR",
        message: `Web-search audit failed on ${label}: ${msg.slice(0, 140)}`,
      })
    }
  }

  const nextOffset = offset + scanned
  return {
    scanned,
    fixed,
    failed,
    nextOffset: scanned < batchSize ? null : nextOffset,
    total: totalRows,
    logs,
  }
}
