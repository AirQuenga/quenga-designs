/**
 * Shared internal types for the scraper pipeline.
 * Kept separate so schema.ts and fetcher.ts can import without circular deps.
 */

/** Everything the fetching layer captured from a single URL */
export interface RawFetchResult {
  /** Original (pre-proxy) URL */
  url: string

  /** Full HTML of the final page after JS execution (Puppeteer) or raw HTML (native fetch) */
  html: string

  /** Parsed contents of <script id="__NEXT_DATA__">, if present */
  nextDataJson: Record<string, unknown> | null

  /** Parsed contents of all <script type="application/ld+json"> blocks */
  ldJsonBlocks: Record<string, unknown>[]

  /**
   * JSON payloads captured from background XHR / fetch calls during
   * Puppeteer page navigation. Empty array for native fetch.
   */
  interceptedApiPayloads: Record<string, unknown>[]

  /** Which strategy was used */
  fetchMethod: "puppeteer" | "native"

  fetchedAt: string
}
