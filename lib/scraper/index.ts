/**
 * Enterprise Property Scraper — Public API
 *
 * Import from "@/lib/scraper" in Server Actions and API routes.
 */

// Step 1: Fetch layer
export { fetchRawPropertyData, fetchWithNativeFetch, fetchWithPuppeteer } from "./fetcher"

// Step 2: Parse + Validate layer
export { parseAndValidateProperty } from "./parser"

// Schema + types
export {
  RawPropertySchema,
  PropertyStatusEnum,
  normalizeAddress,
  deriveSourceId,
} from "./schema"
export type {
  RawProperty,
  RawPropertyInput,
  ScrapedListingRow,
  PipelineResult,
  SweepResult,
} from "./schema"
export type { RawFetchResult } from "./types"

// Database layer
export {
  upsertScrapedListing,
  sweepInactiveListings,
  batchScrapeAndStore,
} from "./database"
export type { BatchScrapeOptions, BatchScrapeResult } from "./database"
