import { streamText, convertToModelMessages, type UIMessage } from "ai"

export const maxDuration = 60

interface CopilotBody {
  messages: UIMessage[]
  activeFilePath?: string
  activeFileContent?: string
  branch?: string
  model?: "gpt-4o" | "claude-3.5-sonnet" | "gpt-5-mini"
}

// Map user-friendly model names to AI SDK model strings
const MODEL_MAP = {
  "gpt-4o": "openai/gpt-4o",
  "claude-3.5-sonnet": "anthropic/claude-3-5-sonnet-20241022",
  "gpt-5-mini": "openai/gpt-5-mini",
} as const

export async function POST(req: Request) {
  const body = (await req.json()) as CopilotBody
  const { messages, activeFilePath, activeFileContent, branch, model = "gpt-5-mini" } = body

  // Validate model selection
  const selectedModel = MODEL_MAP[model as keyof typeof MODEL_MAP] || "openai/gpt-5-mini"

  // Cap the file context attached to the system prompt to keep tokens reasonable.
  const fileSnippet = activeFileContent
    ? activeFileContent.length > 12_000
      ? activeFileContent.slice(0, 12_000) + "\n\n/* …truncated… */"
      : activeFileContent
    : null

  const system = [
    "You are the Quenga IDE Copilot — a senior Next.js, TypeScript, React, and Tailwind engineer.",
    "You operate inside a private workspace bound to the AirQuenga/quenga-designs repository.",
    "CRITICAL: When proposing code changes, format them as unified diffs (starting with '--- a/' and '+++ b/'). Example:",
    `\`\`\`diff
--- a/components/example.tsx
+++ b/components/example.tsx
@@ -10,3 +10,5 @@
 export function Example() {
   return <div>Old</div>
+  // New change here
+  const x = 1
\`\`\``,
    "Be concise and decisive. When proposing edits, return clean fenced code blocks with diffs inside.",
    "Never invent files that the user has not opened. If you need a file you cannot see, ask for it by path.",
    `Active branch: ${branch ?? "main"}.`,
    activeFilePath
      ? `The user is currently viewing: ${activeFilePath}\n\n--- BEGIN ACTIVE FILE ---\n${fileSnippet ?? "(empty)"}\n--- END ACTIVE FILE ---`
      : "No file is currently open.",
  ].join("\n\n")

  const result = streamText({
    model: selectedModel,
    system,
    messages: await convertToModelMessages(messages),
  })

  return result.toUIMessageStreamResponse()
}
