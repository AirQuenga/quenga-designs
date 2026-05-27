"use client"

import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism"

function langFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? ""
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "tsx",
    js: "javascript",
    jsx: "jsx",
    json: "json",
    md: "markdown",
    mdx: "markdown",
    css: "css",
    scss: "scss",
    html: "html",
    yml: "yaml",
    yaml: "yaml",
    sh: "bash",
    bash: "bash",
    sql: "sql",
    py: "python",
    go: "go",
    rs: "rust",
    toml: "toml",
    env: "bash",
  }
  return map[ext] ?? "text"
}

export function CodeViewer({ code, path }: { code: string; path: string }) {
  return (
    <SyntaxHighlighter
      language={langFromPath(path)}
      style={oneLight}
      showLineNumbers
      wrapLongLines={false}
      customStyle={{
        margin: 0,
        padding: "1rem",
        fontSize: "12.5px",
        lineHeight: "1.55",
        background: "hsl(var(--background))",
        height: "100%",
      }}
      lineNumberStyle={{
        minWidth: "2.4em",
        paddingRight: "1em",
        color: "hsl(var(--muted-foreground))",
        opacity: 0.6,
        userSelect: "none",
      }}
      codeTagProps={{
        style: { fontFamily: "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)" },
      }}
    >
      {code}
    </SyntaxHighlighter>
  )
}
