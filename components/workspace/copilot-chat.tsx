"use client"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, Send, Copy, Check, ChevronDown } from "lucide-react"
import { applyDiff } from "@/app/actions/apply-diff"
import dynamic from "next/dynamic"

const SyntaxHighlighter = dynamic(() => import("react-syntax-highlighter").then((m) => m.default), {
  ssr: false,
})

interface CopilotChatProps {
  activeFilePath?: string
  activeFileContent?: string
  branch?: string
}

type SupportedModel = "gpt-4o" | "claude-3.5-sonnet" | "gpt-5-mini"

interface ExtractedDiff {
  id: string
  code: string
}

function extractDiffs(content: string): ExtractedDiff[] {
  const diffRegex = /```diff\n([\s\S]*?)```/g
  const diffs: ExtractedDiff[] = []
  let match: RegExpExecArray | null

  while ((match = diffRegex.exec(content)) !== null) {
    diffs.push({ id: `diff-${content.indexOf(match[0])}`, code: match[1] })
  }

  return diffs
}

export function CopilotChat({ activeFilePath, activeFileContent, branch = "main" }: CopilotChatProps) {
  const [selectedModel, setSelectedModel] = useState<SupportedModel>("gpt-5-mini")
  const [expandedDiff, setExpandedDiff] = useState<string | null>(null)
  const [appliedDiffs, setAppliedDiffs] = useState<Set<string>>(new Set())
  const [copying, setCopying] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState("")

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/copilot",
      prepareSendMessagesRequest: ({ messages: msgs, id }) => ({
        body: JSON.stringify({
          id,
          messages: msgs,
          activeFilePath,
          activeFileContent,
          branch,
          model: selectedModel,
        }),
        headers: { "Content-Type": "application/json" },
      }),
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

  const handleApplyDiff = async (diffCode: string, diffId: string) => {
    try {
      const results = await applyDiff(diffCode, branch)
      if (results.every((r) => r.success)) {
        setAppliedDiffs((prev) => new Set([...prev, diffId]))
      }
    } catch {
      // Silently surface — user sees no change in applied state
    }
  }

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text)
    setCopying(id)
    setTimeout(() => setCopying(null), 2000)
  }

  return (
    <div className="flex h-full flex-col border-l border-slate-200 bg-white">
      {/* Header with Model Selector */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 p-4">
        <h3 className="text-sm font-semibold text-slate-900">Quenga Copilot</h3>

        <Select value={selectedModel} onValueChange={(v) => setSelectedModel(v as SupportedModel)}>
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="gpt-5-mini">GPT-5 Mini (Fast)</SelectItem>
            <SelectItem value="gpt-4o">GPT-4o (Balanced)</SelectItem>
            <SelectItem value="claude-3.5-sonnet">Claude 3.5 (Smart)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message, idx) => {
            // AI SDK 6: message content lives in parts, not .content string
            const textParts = message.parts
              .filter((p) => p.type === "text")
              .map((p) => (p as { type: "text"; text: string }).text)
              .join("\n")

            return (
              <div
                key={idx}
                className={`flex gap-3 text-sm ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    message.role === "user"
                      ? "bg-primary text-white"
                      : "border border-slate-200 bg-slate-100 text-slate-900"
                  }`}
                >
                  {textParts.split("\n").map((line, i) => {
                    if (line.includes("```diff")) return null
                    return (
                      <p key={i} className="whitespace-pre-wrap">
                        {line}
                      </p>
                    )
                  })}

                  {/* Rendered diffs */}
                  <div className="mt-3 space-y-2">
                    {extractDiffs(textParts).map((diff) => (
                      <div key={diff.id} className="overflow-hidden rounded-md border border-slate-300">
                        <button
                          type="button"
                          onClick={() => setExpandedDiff(expandedDiff === diff.id ? null : diff.id)}
                          className="flex w-full items-center justify-between gap-2 bg-slate-100 px-3 py-2 text-xs font-mono hover:bg-slate-200"
                        >
                          <span className="text-slate-700">Unified Diff</span>
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${expandedDiff === diff.id ? "rotate-180" : ""}`}
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
                                {appliedDiffs.has(diff.id) ? "Applied" : "Apply"}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}

          {isLoading && (
            <div className="flex justify-start gap-3">
              <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin" /> Thinking...
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t border-slate-200 bg-slate-50 p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask me to fix, refactor, or explain code..."
            className="flex-1 text-sm"
            disabled={isLoading}
          />
          <Button type="submit" disabled={isLoading || !inputValue.trim()} size="sm" className="gap-2">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>
    </div>
  )
}
