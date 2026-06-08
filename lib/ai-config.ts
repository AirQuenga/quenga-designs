/**
 * lib/ai-config.ts
 *
 * Central Model Registry for Quenga Copilot.
 * All AI model selection flows through here — add a new model by
 * adding one entry to MODEL_REGISTRY. No other file needs to change.
 *
 * All models are routed through the Vercel AI Gateway using the
 * AI_GATEWAY_API_KEY environment variable. Individual provider API
 * keys (ANTHROPIC_API_KEY, OPENAI_API_KEY, etc.) are never needed
 * on the client — they stay server-side inside the gateway.
 */

// ─── Tiers ────────────────────────────────────────────────────────────────────
// "fast"    Low-latency, low-cost. Use for autocomplete, quick Q&A.
// "balanced" Mid-tier. Good quality at reasonable cost.
// "smart"   Frontier-quality. Use only for complex reasoning tasks.

export type ModelTier = "fast" | "balanced" | "smart"
export type ModelProvider = "openai" | "anthropic" | "google" | "xai" | "meta"

export interface ModelEntry {
  /** Unique key used in the UI and sent in request bodies */
  id: string
  /** Human-readable label shown in the selector */
  label: string
  /** Short descriptor shown as a badge or subtitle */
  description: string
  /** AI SDK gateway model string: "<provider>/<model-id>" */
  gatewayModel: string
  provider: ModelProvider
  tier: ModelTier
  /** Approximate context window in tokens */
  contextWindow: number
  /** Whether this model supports vision / image input */
  vision: boolean
  /** Friendly cost indicator (not in $) */
  costIndicator: "$" | "$$" | "$$$"
}

// ─── Registry ─────────────────────────────────────────────────────────────────
// Hosted on Vercel AI Gateway — zero extra API keys required.

export const MODEL_REGISTRY: ModelEntry[] = [
  // ── Fast tier ──────────────────────────────────────────────────────────────
  {
    id: "gpt-4o-mini",
    label: "GPT-4o Mini",
    description: "Fast & cheap",
    gatewayModel: "openai/gpt-4o-mini",
    provider: "openai",
    tier: "fast",
    contextWindow: 128_000,
    vision: true,
    costIndicator: "$",
  },
  {
    id: "gpt-5-mini",
    label: "GPT-5 Mini",
    description: "Latest fast model",
    gatewayModel: "openai/gpt-5-mini",
    provider: "openai",
    tier: "fast",
    contextWindow: 128_000,
    vision: true,
    costIndicator: "$",
  },
  {
    id: "claude-haiku-3-5",
    label: "Claude Haiku 3.5",
    description: "Anthropic fast tier",
    gatewayModel: "anthropic/claude-haiku-3-5",
    provider: "anthropic",
    tier: "fast",
    contextWindow: 200_000,
    vision: true,
    costIndicator: "$",
  },
  {
    id: "gemini-3-flash",
    label: "Gemini 3 Flash",
    description: "Google fast tier",
    gatewayModel: "google/gemini-3-flash",
    provider: "google",
    tier: "fast",
    contextWindow: 1_000_000,
    vision: true,
    costIndicator: "$",
  },

  // ── Balanced tier ──────────────────────────────────────────────────────────
  {
    id: "gpt-4o",
    label: "GPT-4o",
    description: "Balanced reasoning",
    gatewayModel: "openai/gpt-4o",
    provider: "openai",
    tier: "balanced",
    contextWindow: 128_000,
    vision: true,
    costIndicator: "$$",
  },
  {
    id: "claude-3-5-sonnet",
    label: "Claude Sonnet 3.5",
    description: "Best for code",
    gatewayModel: "anthropic/claude-3-5-sonnet-20241022",
    provider: "anthropic",
    tier: "balanced",
    contextWindow: 200_000,
    vision: true,
    costIndicator: "$$",
  },
  {
    id: "gemini-3-pro",
    label: "Gemini 3 Pro",
    description: "Google balanced",
    gatewayModel: "google/gemini-3-pro",
    provider: "google",
    tier: "balanced",
    contextWindow: 2_000_000,
    vision: true,
    costIndicator: "$$",
  },

  // ── Smart tier ─────────────────────────────────────────────────────────────
  {
    id: "gpt-5",
    label: "GPT-5",
    description: "OpenAI frontier",
    gatewayModel: "openai/gpt-5",
    provider: "openai",
    tier: "smart",
    contextWindow: 128_000,
    vision: true,
    costIndicator: "$$$",
  },
  {
    id: "claude-opus-4",
    label: "Claude Opus 4",
    description: "Anthropic frontier",
    gatewayModel: "anthropic/claude-opus-4",
    provider: "anthropic",
    tier: "smart",
    contextWindow: 200_000,
    vision: true,
    costIndicator: "$$$",
  },
  {
    id: "grok-3",
    label: "Grok 3",
    description: "xAI reasoning",
    gatewayModel: "xai/grok-3",
    provider: "xai",
    tier: "smart",
    contextWindow: 131_072,
    vision: false,
    costIndicator: "$$$",
  },
] as const

// ─── Lookup helpers ────────────────────────────────────────────────────────────

/** Resolve a registry entry by `id`. Falls back to the default fast model. */
export function getModelEntry(id: string): ModelEntry {
  return MODEL_REGISTRY.find((m) => m.id === id) ?? DEFAULT_MODEL
}

/** Resolve the gateway model string from a registry `id`. */
export function resolveGatewayModel(id: string): string {
  return getModelEntry(id).gatewayModel
}

/** Models grouped by tier for rendering a tiered selector. */
export function getModelsByTier(): Record<ModelTier, ModelEntry[]> {
  const result: Record<ModelTier, ModelEntry[]> = { fast: [], balanced: [], smart: [] }
  for (const m of MODEL_REGISTRY) result[m.tier].push(m)
  return result
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

/** Default model when no preference is provided. */
export const DEFAULT_MODEL = MODEL_REGISTRY.find((m) => m.id === "gpt-5-mini")!

/** Default model ID as a string for use in type annotations. */
export const DEFAULT_MODEL_ID = DEFAULT_MODEL.id

/** All valid model IDs — useful for server-side validation. */
export const VALID_MODEL_IDS = new Set(MODEL_REGISTRY.map((m) => m.id))

// ─── Provider label map ───────────────────────────────────────────────────────

export const PROVIDER_LABELS: Record<ModelProvider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  xai: "xAI",
  meta: "Meta",
}

export const TIER_LABELS: Record<ModelTier, string> = {
  fast: "Fast",
  balanced: "Balanced",
  smart: "Smart",
}
