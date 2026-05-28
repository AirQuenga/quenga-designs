"use server"

import { createClient } from "@/lib/supabase/server"

interface DiffBlock {
  filePath: string
  hunkHeader: string
  additions: string[]
  deletions: string[]
  contextLines: { line: string; lineNum: number }[]
}

/**
 * Parse a unified diff format and return structured data.
 * Expected format:
 * ```diff
 * --- a/path/to/file.tsx
 * +++ b/path/to/file.tsx
 * @@ -10,3 +10,5 @@
 *  context line
 * -deleted line
 * +added line
 * ```
 */
function parseDiff(diffText: string): DiffBlock[] {
  const lines = diffText.split("\n")
  const blocks: DiffBlock[] = []
  let currentBlock: DiffBlock | null = null
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Detect file path
    if (line.startsWith("--- a/")) {
      const filePath = line.slice(6)
      // Skip the +++ line
      i += 2

      // Parse hunks for this file
      while (i < lines.length && !lines[i].startsWith("--- a/")) {
        if (lines[i].startsWith("@@")) {
          currentBlock = {
            filePath,
            hunkHeader: lines[i],
            additions: [],
            deletions: [],
            contextLines: [],
          }
          blocks.push(currentBlock)
          i++

          // Parse hunk lines
          while (i < lines.length && !lines[i].startsWith("@@") && !lines[i].startsWith("--- a/")) {
            const hunkLine = lines[i]
            if (hunkLine.startsWith("+") && !hunkLine.startsWith("+++")) {
              currentBlock.additions.push(hunkLine.slice(1))
            } else if (hunkLine.startsWith("-") && !hunkLine.startsWith("---")) {
              currentBlock.deletions.push(hunkLine.slice(1))
            } else if (hunkLine.startsWith(" ")) {
              currentBlock.contextLines.push({ line: hunkLine.slice(1), lineNum: i })
            }
            i++
          }
        } else {
          i++
        }
      }
    } else {
      i++
    }
  }

  return blocks
}

/**
 * Apply a unified diff to a file.
 * Reads the file, finds the hunk location, applies changes, and writes back.
 */
export async function applyDiff(diffText: string, branch: string = "main") {
  const supabase = createClient()
  const blocks = parseDiff(diffText)

  const results: { filePath: string; success: boolean; error?: string }[] = []

  for (const block of blocks) {
    try {
      // Read the file from GitHub (via our GitHub actions)
      const { data: fileData, error: readError } = await supabase.functions.invoke(
        "read-github-file",
        {
          body: {
            filePath: block.filePath,
            branch,
          },
        },
      )

      if (readError) {
        results.push({ filePath: block.filePath, success: false, error: readError.message })
        continue
      }

      let fileContent = fileData.content || ""
      const lines = fileContent.split("\n")

      // Find where to apply the hunk (simple line-based matching)
      let startLineIndex = -1
      if (block.contextLines.length > 0) {
        const firstContextLine = block.contextLines[0].line
        for (let i = 0; i < lines.length; i++) {
          if (lines[i] === firstContextLine) {
            startLineIndex = i
            break
          }
        }
      }

      if (startLineIndex === -1 && block.deletions.length > 0) {
        // Fallback: find first deletion line
        for (let i = 0; i < lines.length; i++) {
          if (lines[i] === block.deletions[0]) {
            startLineIndex = i
            break
          }
        }
      }

      if (startLineIndex === -1) {
        results.push({ filePath: block.filePath, success: false, error: "Could not locate hunk in file" })
        continue
      }

      // Apply deletions and additions
      let deleteCount = block.deletions.length
      lines.splice(startLineIndex, deleteCount, ...block.additions)

      fileContent = lines.join("\n")

      // Write back to GitHub (you would need a write-github-file edge function)
      const { error: writeError } = await supabase.functions.invoke("write-github-file", {
        body: {
          filePath: block.filePath,
          content: fileContent,
          branch,
          message: `[Copilot] Applied diff to ${block.filePath}`,
        },
      })

      if (writeError) {
        results.push({ filePath: block.filePath, success: false, error: writeError.message })
      } else {
        results.push({ filePath: block.filePath, success: true })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      results.push({ filePath: block.filePath, success: false, error: message })
    }
  }

  return results
}
