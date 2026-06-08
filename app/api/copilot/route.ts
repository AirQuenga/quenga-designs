import { streamText, convertToModelMessages, type UIMessage } from "ai"
import { resolveGatewayModel, getModelEntry, DEFAULT_MODEL_ID, VALID_MODEL_IDS } from "@/lib/ai-config"

export const maxDuration = 60

interface CopilotBody {
  messages: UIMessage[]
  activeFilePath?: string
  activeFileContent?: string
  branch?: string
  /** Any id from MODEL_REGISTRY — validated server-side */
  modelId?: string
}

export async function POST(req: Request) {
  const body = (await req.json()) as CopilotBody
  const { messages, activeFilePath, activeFileContent, branch, modelId } = body

  // Validate the incoming model ID against the registry.
  // Reject unknown IDs rather than silently falling back — this surfaces
  // client bugs immediately and prevents prompt-injection via the model field.
  const resolvedId = modelId && VALID_MODEL_IDS.has(modelId) ? modelId : DEFAULT_MODEL_ID
  const gatewayModel = resolveGatewayModel(resolvedId)
  const modelEntry = getModelEntry(resolvedId)

  // Cap file context to keep token usage reasonable.
  const fileSnippet = activeFileContent
    ? activeFileContent.length > 12_000
      ? activeFileContent.slice(0, 12_000) + "\n\n/* …truncated… */"
      : activeFileContent
    : null

  // Tier-aware system prompt — smarter models get a longer, more detailed prompt.
  const tierNote =
    modelEntry.tier === "fast"
      ? "Be concise. Prefer short, direct answers. Skip lengthy explanations."
      : modelEntry.tier === "balanced"
        ? "Balance thoroughness with brevity. Explain reasoning when it adds value."
        : "Be thorough. Reason step-by-step when the task is complex."

  const system = [
    "You are the Quenga IDE Copilot — a senior Next.js, TypeScript, React, and Tailwind engineer.",
    "You operate inside a private workspace bound to the AirQuenga/quenga-designs repository.",
    tierNote,
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
    "Never invent files that the user has not opened. If you need a file you cannot see, ask for it by path.",
    `Active branch: ${branch ?? "main"}.`,
    `Active model: ${modelEntry.label} (${modelEntry.provider}, ${modelEntry.tier} tier).`,
    activeFilePath
      ? `The user is currently viewing: ${activeFilePath}\n\n--- BEGIN ACTIVE FILE ---\n${fileSnippet ?? "(empty)"}\n--- END ACTIVE FILE ---`
      : "No file is currently open.",
  ].join("\n\n")

  const result = streamText({
    model: gatewayModel,
    system,
    messages: await convertToModelMessages(messages),
  })

  return result.toUIMessageStreamResponse()
}
