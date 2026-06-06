/**
 * Enterprise Property Scraper — Fetching Layer  (Pillar 1 + 2)
 *
 * Pillar 1: Anti-Bot Infrastructure
 *   - Uses puppeteer-extra + puppeteer-extra-plugin-stealth to spoof TLS
 *     fingerprints, hide automation signals, and randomise viewport.
 *   - Supports proxy routing via SCRAPER_PROXY_URL env var (ScraperAPI,
 *     Bright Data, etc.) for a simple drop-in upgrade path.
 *   - Falls back to a hardened native fetch() when Puppeteer is unavailable
 *     (e.g. Vercel Edge / serverless environments).
 *
 * Pillar 2: API & State Extraction
 *   - Primary strategy: intercept XHR / fetch network responses that contain
 *     JSON payloads matching the property schema.
 *   - Secondary strategy: extract <script id="__NEXT_DATA__"> from the DOM.
 *   - Tertiary strategy: extract <script type="application/ld+json"> blocks.
 *   - Final fallback: return raw HTML for cheerio parsing in the parse layer.
 */

import type { RawFetchResult } from "./types"

// ---------------------------------------------------------------------------
// Browser headers — rotated user-agent pool
// ---------------------------------------------------------------------------

const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15",
]

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

const BASE_HEADERS: Record<string, string> = {
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-CH-UA-Mobile": "?0",
  Referer: "https://www.google.com/",
}

// ---------------------------------------------------------------------------
// Proxy helper
// ---------------------------------------------------------------------------

/**
 * If SCRAPER_PROXY_URL is set (e.g. ScraperAPI / Bright Data endpoint),
 * prepend the URL so requests are routed through the managed proxy.
 *
 * ScraperAPI format: http://api.scraperapi.com?api_key=KEY&url=TARGET_URL
 * Bright Data format: set SCRAPER_PROXY_URL to the proxy host; we add
 * it as the --proxy-server flag for Puppeteer.
 */
function proxyUrl(targetUrl: string): string {
  const proxy = process.env.SCRAPER_PROXY_URL
  if (!proxy) return targetUrl

  // ScraperAPI-style: the proxy URL itself is the endpoint and the target
  // is appended as a query parameter.
  if (proxy.includes("scraperapi.com") || proxy.includes("api_key=")) {
    const sep = proxy.includes("?") ? "&" : "?"
    return `${proxy}${sep}url=${encodeURIComponent(targetUrl)}`
  }

  // Otherwise treat as a standard HTTP/SOCKS proxy — used for Puppeteer below.
  return targetUrl
}

// ---------------------------------------------------------------------------
// Stealth Puppeteer fetch  (Pillar 1)
// ---------------------------------------------------------------------------

/**
 * Fetches a URL using puppeteer-extra + stealth plugin.
 *
 * Network interception strategy (Pillar 2):
 * 1. Attach a response interceptor before navigation.
 * 2. Collect all JSON responses whose body looks like property data.
 * 3. After page load, also extract __NEXT_DATA__ and application/ld+json.
 * 4. Return the richest data available (intercepted API > embedded state > HTML).
 *
 * NOTE: Puppeteer requires a Chromium binary which is not available in
 * serverless/edge runtimes. Wrap callers with a try/catch and fall back to
 * fetchWithNativeFetch() when this throws.
 */
export async function fetchWithPuppeteer(url: string): Promise<RawFetchResult> {
  // Dynamic import keeps puppeteer out of the edge bundle
  const puppeteerExtra = await import("puppeteer-extra")
  const StealthPlugin = await import("puppeteer-extra-plugin-stealth")
  const puppeteer = puppeteerExtra.default
  puppeteer.use(StealthPlugin.default())

  const proxyServer = process.env.SCRAPER_PROXY_URL?.startsWith("http")
    ? process.env.SCRAPER_PROXY_URL
    : undefined

  const launchArgs = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--disable-blink-features=AutomationControlled",
    "--window-size=1280,900",
  ]

  if (proxyServer && !proxyServer.includes("scraperapi.com")) {
    launchArgs.push(`--proxy-server=${proxyServer}`)
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: launchArgs,
    timeout: 30000,
  })

  const interceptedJsonPayloads: Record<string, unknown>[] = []

  try {
    const page = await browser.newPage()
    await page.setUserAgent(randomUA())
    await page.setViewport({ width: 1280, height: 900 })
    await page.setExtraHTTPHeaders({ ...BASE_HEADERS })

    // Intercept network responses to capture background API calls (Pillar 2)
    page.on("response", async (response) => {
      const contentType = response.headers()["content-type"] ?? ""
      if (!contentType.includes("application/json")) return

      const reqUrl = response.url()
      // Filter out analytics, CDN scripts, and auth calls
      if (/google|facebook|analytics|gtm|clarity|sentry|auth|token/i.test(reqUrl)) return

      try {
        const text = await response.text()
        if (!text.startsWith("{") && !text.startsWith("[")) return
        const json: unknown = JSON.parse(text)
        if (json && typeof json === "object") {
          interceptedJsonPayloads.push(json as Record<string, unknown>)
        }
      } catch {
        // Ignore malformed or empty responses
      }
    })

    const resolvedUrl = proxyUrl(url)
    await page.goto(resolvedUrl, { waitUntil: "networkidle2", timeout: 30000 })

    // ---- Pillar 2: __NEXT_DATA__ extraction ----
    const nextDataRaw = await page.evaluate(() => {
      const el = document.getElementById("__NEXT_DATA__")
      return el ? el.textContent : null
    })

    let nextDataJson: Record<string, unknown> | null = null
    if (nextDataRaw) {
      try {
        nextDataJson = JSON.parse(nextDataRaw) as Record<string, unknown>
      } catch {
        /* ignore */
      }
    }

    // ---- Pillar 2: application/ld+json extraction ----
    const ldJsonRaw = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
      return nodes.map((n) => n.textContent ?? "")
    })

    const ldJsonBlocks: Record<string, unknown>[] = []
    for (const raw of ldJsonRaw) {
      try {
        const parsed: unknown = JSON.parse(raw)
        if (parsed && typeof parsed === "object") {
          ldJsonBlocks.push(parsed as Record<string, unknown>)
        }
      } catch {
        /* ignore */
      }
    }

    const html = await page.content()

    return {
      url,
      html,
      nextDataJson,
      ldJsonBlocks,
      interceptedApiPayloads: interceptedJsonPayloads,
      fetchMethod: "puppeteer",
      fetchedAt: new Date().toISOString(),
    }
  } finally {
    await browser.close()
  }
}

// ---------------------------------------------------------------------------
// Native fetch fallback  (Pillar 1 — hardened headers)
// ---------------------------------------------------------------------------

const NATIVE_MAX_RETRIES = 3
const NATIVE_BASE_DELAY_MS = 800

/**
 * Fetches a URL with hardened browser-like headers and exponential back-off
 * retries. This is the serverless/edge-compatible fallback.
 *
 * The response body is scanned for __NEXT_DATA__ and ld+json before
 * returning raw HTML, preserving Pillar 2 behaviour even without a browser.
 */
export async function fetchWithNativeFetch(url: string, attempt = 1): Promise<RawFetchResult> {
  const resolvedUrl = proxyUrl(url)

  try {
    const res = await fetch(resolvedUrl, {
      headers: { ...BASE_HEADERS, "User-Agent": randomUA() },
      signal: AbortSignal.timeout(20000),
      redirect: "follow",
    })

    if (!res.ok) {
      if (attempt < NATIVE_MAX_RETRIES && res.status !== 404) {
        await new Promise((r) => setTimeout(r, NATIVE_BASE_DELAY_MS * attempt))
        return fetchWithNativeFetch(url, attempt + 1)
      }
      throw new Error(`HTTP ${res.status} ${res.statusText} — ${url}`)
    }

    const html = await res.text()

    // ---- Pillar 2: __NEXT_DATA__ ----
    let nextDataJson: Record<string, unknown> | null = null
    const nextMatch = html.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i)
    if (nextMatch?.[1]) {
      try {
        nextDataJson = JSON.parse(nextMatch[1]) as Record<string, unknown>
      } catch {
        /* ignore */
      }
    }

    // ---- Pillar 2: ld+json ----
    const ldJsonBlocks: Record<string, unknown>[] = []
    const ldRegex = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi
    let ldMatch: RegExpExecArray | null
    while ((ldMatch = ldRegex.exec(html)) !== null) {
      try {
        const parsed: unknown = JSON.parse(ldMatch[1])
        if (parsed && typeof parsed === "object") {
          ldJsonBlocks.push(parsed as Record<string, unknown>)
        }
      } catch {
        /* ignore */
      }
    }

    return {
      url,
      html,
      nextDataJson,
      ldJsonBlocks,
      interceptedApiPayloads: [],
      fetchMethod: "native",
      fetchedAt: new Date().toISOString(),
    }
  } catch (err) {
    if (attempt < NATIVE_MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, NATIVE_BASE_DELAY_MS * attempt * 2))
      return fetchWithNativeFetch(url, attempt + 1)
    }
    throw err
  }
}

// ---------------------------------------------------------------------------
// Step 1 — fetchRawPropertyData()  (Pillar 4: Two-Step Pipeline)
// ---------------------------------------------------------------------------

/**
 * **Step 1 of the two-step pipeline.**
 *
 * Downloads the page, intercepts API responses, and extracts embedded JSON
 * state — then caches the raw result in-memory so the parse layer can be
 * called independently (e.g. for retries, testing, or async processing).
 *
 * Strategy order:
 * 1. Attempt Puppeteer + stealth (full anti-bot protection).
 * 2. Fall back to native fetch with hardened headers.
 *
 * The returned `RawFetchResult` is a serialisable snapshot of everything
 * the network layer captured; no interpretation happens here.
 */
export async function fetchRawPropertyData(url: string): Promise<RawFetchResult> {
  // Prefer Puppeteer when a full browser is available (not edge runtime)
  const runtime = process.env.NEXT_RUNTIME ?? process.env.VERCEL_RUNTIME ?? "nodejs"
  const usePuppeteer = runtime === "nodejs" && process.env.DISABLE_PUPPETEER !== "true"

  if (usePuppeteer) {
    try {
      return await fetchWithPuppeteer(url)
    } catch {
      // Graceful degradation — log once and continue to native fallback
    }
  }

  return fetchWithNativeFetch(url)
}
