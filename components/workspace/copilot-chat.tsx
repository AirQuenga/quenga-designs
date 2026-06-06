"use client"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, Send, Copy, Check, ChevronDown, Zap, Brain, Cpu } from "lucide-react"
import { applyDiff } from "@/app/actions/apply-diff"
import dynamic from "next/dynamic"
import {
  MODEL_REGISTRY,
  getModelsByTier,
  type ModelEntry,
  type ModelTier,
  DEFAULT_MODEL_ID,
  TIER_LABELS,
} from "@/lib/ai-config"

const SyntaxHighlighter = dynamic(() => import("react-syntax-highlighter").then((m) => m.default), {
  ssr: false,
})

// ─── Types ────────────────────────────────────────────────────────────────────

interface CopilotChatProps {
  activeFilePath?: string
  activeFileContent?: string
  branch?: string
}

interface ExtractedDiff {
  id: string
  code: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractDiffs(content: string): ExtractedDiff[] {
  const diffRegex = /```diff\n([\s\S]*?)```/g
  const diffs: ExtractedDiff[] = []
  let match: RegExpExecArray | null
  while ((match = diffRegex.exec(content)) !== null) {
    diffs.push({ id: `diff-${diffs.length}`, code: match[1] })
  }
  return diffs
}

const TIER_ICONS: Record<ModelTier, React.ElementType> = {
  fast: Zap,
  balanced: Cpu,
  smart: Brain,
}

const TIER_COLORS: Record<ModelTier, string> = {
  fast: "text-emerald-600",
  balanced: "text-blue-600",
  smart: "text-violet-600",
}

const TIER_BG: Record<ModelTier, string> = {
  fast: "bg-emerald-50 border-emerald-200",
  balanced: "bg-blue-50 border-blue-200",
  smart: "bg-violet-50 border-violet-200",
}

// ─── ModelSelector ────────────────────────────────────────────────────────────

interface ModelSelectorProps {
  selected: ModelEntry
  onSelect: (model: ModelEntry) => void
}

function ModelSelector({ selected, onSelect }: ModelSelectorProps) {
  const [open, setOpen] = useState(false)
  const byTier = getModelsByTier()

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-slate-100 ${TIER_BG[selected.tier]}`}
      >
        {(() => {
          const Icon = TIER_ICONS[selected.tier]
          return <Icon className={`h-3 w-3 ${TIER_COLORS[selected.tier]}`} />
        })()}
        <span className="max-w-[110px] truncate">{selected.label}</span>
        <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />

          {/* Dropdown */}
          <div className="absolute right-0 top-full z-20 mt-1.5 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
            {(["fast", "balanced", "smart"] as ModelTier[]).map((tier) => (
              <div key={tier}>
                <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-3 py-1.5">
                  {(() => {
                    const Icon = TIER_ICONS[tier]
                    return <Icon className={`h-3 w-3 ${TIER_COLORS[tier]}`} />
                  })()}
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {TIER_LABELS[tier]}
                  </span>
                </div>
                {byTier[tier].map((model) => (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => {
                      onSelect(model)
                      setOpen(false)
                    }}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50 ${
                      model.id === selected.id ? "bg-slate-50 font-medium" : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{model.label}</p>
                      <p className="text-xs text-slate-500">{model.description}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="text-xs text-slate-400">{model.costIndicator}</span>
                      {model.id === selected.id && (
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Inner chat (keyed by modelId to reset transport on model change) ─────────

interface ChatInnerProps extends CopilotChatProps {
  modelId: string
}

function ChatInner({ activeFilePath, activeFileContent, branch, modelId }: ChatInnerProps) {
  const [expandedDiff, setExpandedDiff] = useState<string | null>(null)
  const [appliedDiffs, setAppliedDiffs] = useState<Set<string>>(new Set())
  const [copying, setCopying] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState("")

  // Keying the outer component on modelId means this hook is always instantiated
  // with the correct modelId — no stale-closure / stale-transport bug possible.
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/copilot",
      body: { activeFilePath, activeFileContent, branch, modelId },
    }),
  })

  const isLoading = status === "streaming" || status === "submitted"

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const text = inputValue.trim()
    if (!text || isLoading) return
    sendMessage({ role: "user", parts: [{ type: "text", text }] })
    setInputValue("")
  }

  const handleApplyDiff = useCallback(async (diffCode: string, diffId: string) => {
    try {
      const results = await applyDiff(diffCode, branch ?? "main")
      if (results.every((r) => r.success)) {
        setAppliedDiffs((prev) => new Set([...prev, diffId]))
      }
    } catch {
      // User sees no change in applied state — they can retry
    }
  }, [branch])

  const handleCopy = useCallback(async (text: string, id: string) => {
    await navigator.clipboard.writeText(text)
    setCopying(id)
    setTimeout(() => setCopying(null), 2000)
  }, [])

  return (
    <>
      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-400">
              Ask me to fix, refactor, or explain anything in your codebase.
            </p>
          )}

          {messages.map((message, idx) => {
            const textParts = message.parts
              .filter((p) => p.type === "text")
              .map((p) => (p as { type: "text"; text: string }).text)
              .join("\n")

            const isUser = message.role === "user"
            const diffs = !isUser ? extractDiffs(textParts) : []

            // Strip the raw diff fences from prose output
            const prose = textParts.replace(/```diff[\s\S]*?```/g, "").trim()

            return (
              <div
                key={idx}
                className={`flex gap-3 text-sm ${isUser ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] space-y-2 rounded-xl px-4 py-3 ${
                    isUser
                      ? "bg-primary text-white"
                      : "border border-slate-200 bg-slate-50 text-slate-900"
                  }`}
                >
                  {prose && (
                    <div className="space-y-1">
                      {prose.split("\n").map((line, i) => (
                        <p key={i} className="whitespace-pre-wrap leading-relaxed">
                          {line}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Rendered diffs */}
                  {diffs.map((diff) => (
                    <div key={diff.id} className="overflow-hidden rounded-lg border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setExpandedDiff(expandedDiff === diff.id ? null : diff.id)}
                        className="flex w-full items-center justify-between gap-2 bg-slate-100 px-3 py-2 text-xs font-mono hover:bg-slate-200"
                      >
                        <span className="text-slate-700">Unified diff</span>
                        <ChevronDown
                          className={`h-3.5 w-3.5 transition-transform ${expandedDiff === diff.id ? "rotate-180" : ""}`}
                        />
                      </button>

                      {expandedDiff === diff.id && (
                        <div className="space-y-2 bg-white p-3">
                          {SyntaxHighlighter ? (
                            <SyntaxHighlighter
                              language="diff"
                              customStyle={{
                                fontSize: "11px",
                                borderRadius: "4px",
                                maxHeight: "300px",
                                overflow: "auto",
                                backgroundColor: "#f5f5f5",
                                padding: "12px",
                              }}
                            >
                              {diff.code}
                            </SyntaxHighlighter>
                          ) : (
                            <pre className="overflow-x-auto rounded bg-slate-100 p-2 text-xs">{diff.code}</pre>
                          )}

                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCopy(diff.code, diff.id)}
                              className="flex-1 text-xs"
                            >
                              {copying === diff.id ? (
                                <><Check className="mr-1 h-3 w-3" />Copied</>
                              ) : (
                                <><Copy className="mr-1 h-3 w-3" />Copy</>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleApplyDiff(diff.code, diff.id)}
                              disabled={appliedDiffs.has(diff.id)}
                              className="flex-1 text-xs"
                            >
                              {appliedDiffs.has(diff.id) ? "Applied" : "Apply diff"}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          {isLoading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Thinking...
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-slate-200 bg-white p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask me to fix, refactor, or explain code..."
            className="flex-1 text-sm"
            disabled={isLoading}
          />
          <Button type="submit" disabled={isLoading || !inputValue.trim()} size="sm">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>
    </>
  )
}

// ─── Public component ─────────────────────────────────────────────────────────

export function CopilotChat({ activeFilePath, activeFileContent, branch = "main" }: CopilotChatProps) {
  const defaultModel = MODEL_REGISTRY.find((m) => m.id === DEFAULT_MODEL_ID)!
  const [selectedModel, setSelectedModel] = useState<ModelEntry>(defaultModel)

  return (
    <div className="flex h-full flex-col border-l border-slate-200 bg-white">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">Quenga Copilot</p>
          <p className="truncate text-xs text-slate-400">
            {activeFilePath ?? "No file open"}
          </p>
        </div>
        <ModelSelector selected={selectedModel} onSelect={setSelectedModel} />
      </div>

      {/* Key on modelId so useChat + DefaultChatTransport are fully remounted
          when the model changes — this is the correct fix for the transport bug. */}
      <ChatInner
        key={selectedModel.id}
        activeFilePath={activeFilePath}
        activeFileContent={activeFileContent}
        branch={branch}
        modelId={selectedModel.id}
      />
    </div>
  )
}
