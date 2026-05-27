import { streamText, convertToModelMessages, type UIMessage } from "ai"

export const maxDuration = 60

interface CopilotBody {
  messages: UIMessage[]
  activeFilePath?: string
  activeFileContent?: string
  branch?: string
}

export async function POST(req: Request) {
  const body = (await req.json()) as CopilotBody
  const { messages, activeFilePath, activeFileContent, branch } = body

  // Cap the file context attached to the system prompt to keep tokens reasonable.
  const fileSnippet = activeFileContent
    ? activeFileContent.length > 12_000
      ? activeFileContent.slice(0, 12_000) + "\n\n/* …truncated… */"
      : activeFileContent
    : null

  const system = [
    "You are the Quenga IDE Copilot — a senior Next.js, TypeScript, React, and Tailwind engineer.",
    "You operate inside a private workspace bound to the AirQuenga/quenga-designs repository.",
    "Be concise and decisive. When proposing edits, return clean fenced code blocks with the file path on the first line as a comment.",
    "Never invent files that the user has not opened. If you need a file you cannot see, ask for it by path.",
    `Active branch: ${branch ?? "main"}.`,
    activeFilePath
      ? `The user is currently viewing: ${activeFilePath}\n\n--- BEGIN ACTIVE FILE ---\n${fileSnippet ?? "(empty)"}\n--- END ACTIVE FILE ---`
      : "No file is currently open.",
  ].join("\n\n")

  const result = streamText({
    model: "openai/gpt-5-mini",
    system,
    messages: await convertToModelMessages(messages),
  })

  return result.toUIMessageStreamResponse()
}
