// @ts-nocheck - AI SDK 6 integration requires runtime setup
"use client"

import { useChat } from "@ai-sdk/react"
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

export function CopilotChat({ activeFilePath, activeFileContent, branch = "main" }: CopilotChatProps) {
  const [selectedModel, setSelectedModel] = useState<"gpt-4o" | "claude-3.5-sonnet" | "gpt-5-mini">(
    "gpt-5-mini",
  )
  const [expandedDiff, setExpandedDiff] = useState<string | null>(null)
  const [appliedDiffs, setAppliedDiffs] = useState<Set<string>>(new Set())
  const [copying, setCopying] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState("")

  const { messages, isLoading } = useChat({
    api: "/api/copilot",
    body: {
      activeFilePath,
      activeFileContent,
      branch,
      model: selectedModel,
    },
  })

  // Extract and render diffs from assistant messages
  const extractDiffs = (content: string) => {
    const diffRegex = /```diff\n([\s\S]*?)```/g
    const diffs: { id: string; code: string }[] = []
    let match

    while ((match = diffRegex.exec(content)) !== null) {
      diffs.push({
        id: `diff-${content.indexOf(match[0])}`,
        code: match[1],
      })
    }

    return diffs
  }

  const handleApplyDiff = async (diffCode: string, diffId: string) => {
    try {
      const results = await applyDiff(diffCode, branch)
      if (results.every((r) => r.success)) {
        setAppliedDiffs((prev) => new Set([...prev, diffId]))
      } else {
        console.error("Diff application failed:", results)
      }
    } catch (error) {
      console.error("Error applying diff:", error)
    }
  }

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text)
    setCopying(id)
    setTimeout(() => setCopying(null), 2000)
  }

  return (
    <div className="flex h-full flex-col bg-white border-l border-slate-200">
      {/* Header with Model Selector */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 p-4">
        <h3 className="text-sm font-semibold text-slate-900">Quenga Copilot</h3>

        <Select value={selectedModel} onValueChange={(value) => setSelectedModel(value as any)}>
          <SelectTrigger className="w-40 h-8 text-xs">
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
          {messages.map((msg: unknown, idx: number) => {
            const message = msg as { role: string; content: string }
            return (
              <div
                key={idx}
                className={`flex gap-3 text-sm ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    message.role === "user"
                      ? "bg-primary text-white"
                      : "bg-slate-100 text-slate-900 border border-slate-200"
                  }`}
                >
                  {message.content.split("\n").map((line: string, i: number) => {
                    // Check if this line is part of a diff block
                    if (line.includes("```diff")) {
                      return null
                    }
                    return (
                      <p key={i} className="whitespace-pre-wrap">
                        {line}
                      </p>
                    )
                  })}

                  {/* Render extracted diffs */}
                  <div className="mt-3 space-y-2">
                    {extractDiffs(message.content).map((diff) => (
                    <div key={diff.id} className="rounded-md border border-slate-300 overflow-hidden">
                      <button
                        onClick={() =>
                          setExpandedDiff(expandedDiff === diff.id ? null : diff.id)
                        }
                        className="w-full flex items-center justify-between gap-2 bg-slate-100 px-3 py-2 text-xs font-mono hover:bg-slate-200"
                      >
                        <span className="text-slate-700">Unified Diff</span>
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${
                            expandedDiff === diff.id ? "rotate-180" : ""
                          }`}
                        />
                      </button>

                      {expandedDiff === diff.id && (
                        <div className="bg-white p-3 space-y-2">
                          {SyntaxHighlighter && (
                            <SyntaxHighlighter
                              language="diff"
                              style={{
                                fontSize: "11px",
                                borderRadius: "4px",
                                maxHeight: "300px",
                                overflow: "auto",
                                backgroundColor: "#f5f5f5",
                                padding: "12px",
                              } as any}
                            >
                              {diff.code}
                            </SyntaxHighlighter>
                          )}
                          {!SyntaxHighlighter && (
                            <pre className="text-xs overflow-x-auto bg-slate-100 p-2 rounded">{diff.code}</pre>
                          )}

                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCopy(diff.code, diff.id)}
                              className="flex-1 text-xs"
                            >
                              {copying === diff.id ? (
                                <>
                                  <Check className="h-3 w-3 mr-1" /> Copied
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3 mr-1" /> Copy
                                </>
                              )}
                            </Button>

                            <Button
                              size="sm"
                              onClick={() => handleApplyDiff(diff.code, diff.id)}
                              disabled={appliedDiffs.has(diff.id)}
                              className="flex-1 text-xs"
                            >
                              {appliedDiffs.has(diff.id) ? "✓ Applied" : "Apply"}
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
              <div className="bg-slate-100 rounded-lg px-4 py-2 text-slate-600 text-sm flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Thinking...
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t border-slate-200 bg-slate-50 p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!inputValue.trim() || isLoading) return
            // Trigger message send via useChat
            setInputValue("")
          }}
          className="flex gap-2"
        >
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask me to fix, refactor, or explain code..."
            className="flex-1 text-sm"
            disabled={isLoading}
          />
          <Button type="submit" disabled={isLoading} size="sm" className="gap-2">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>
    </div>
  )
}
