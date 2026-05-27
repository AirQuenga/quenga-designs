"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import {
  ArrowLeft,
  ChevronRight,
  ChevronDown,
  File as FileIcon,
  Folder,
  FolderOpen,
  GitBranch,
  Loader2,
  RefreshCw,
  Search,
  Send,
  Sparkles,
} from "lucide-react"
import SiteHeader from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CodeViewer } from "@/components/workspace/code-viewer"
import {
  getFileContent,
  getRepoTree,
  type BranchInfo,
  type FileContent,
  type RepoMeta,
  type TreeEntry,
} from "@/app/actions/github-workspace"

interface Props {
  meta: RepoMeta
  initialBranches: BranchInfo[]
  initialTree: TreeEntry[]
}

interface TreeNode {
  name: string
  path: string
  type: "blob" | "tree"
  children: TreeNode[]
}

function buildTree(entries: TreeEntry[]): TreeNode {
  const root: TreeNode = { name: "", path: "", type: "tree", children: [] }
  const map = new Map<string, TreeNode>()
  map.set("", root)

  for (const entry of entries) {
    const segments = entry.path.split("/")
    let parentPath = ""
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]
      const path = parentPath ? `${parentPath}/${seg}` : seg
      if (!map.has(path)) {
        const isLeaf = i === segments.length - 1
        const node: TreeNode = {
          name: seg,
          path,
          type: isLeaf ? entry.type : "tree",
          children: [],
        }
        map.set(path, node)
        map.get(parentPath)!.children.push(node)
      }
      parentPath = path
    }
  }

  // Sort each level: folders first, then files, alpha
  const sortRec = (n: TreeNode) => {
    n.children.sort((a, b) => {
      if (a.type !== b.type) return a.type === "tree" ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    n.children.forEach(sortRec)
  }
  sortRec(root)
  return root
}

export function WorkspaceShell({ meta, initialBranches, initialTree }: Props) {
  const [branch, setBranch] = useState(meta.branch)
  const [tree, setTree] = useState(initialTree)
  const [branches] = useState(initialBranches)
  const [activeFile, setActiveFile] = useState<FileContent | null>(null)
  const [activePath, setActivePath] = useState<string | null>(null)
  const [filter, setFilter] = useState("")
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["app", "components"]))
  const [loadingFile, setLoadingFile] = useState(false)
  const [isPending, startTransition] = useTransition()

  const root = useMemo(() => buildTree(tree), [tree])

  // Filter — when there's a query, expand all matching ancestors automatically
  const matchingPaths = useMemo(() => {
    if (!filter.trim()) return null
    const q = filter.toLowerCase()
    const matches = new Set<string>()
    for (const e of tree) {
      if (e.path.toLowerCase().includes(q)) {
        matches.add(e.path)
        // Add ancestors
        const parts = e.path.split("/")
        for (let i = 1; i < parts.length; i++) {
          matches.add(parts.slice(0, i).join("/"))
        }
      }
    }
    return matches
  }, [filter, tree])

  function toggleFolder(path: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  async function openFile(path: string) {
    setActivePath(path)
    setLoadingFile(true)
    try {
      const file = await getFileContent(path, branch)
      setActiveFile(file)
    } finally {
      setLoadingFile(false)
    }
  }

  async function refreshTree(nextBranch?: string) {
    const target = nextBranch ?? branch
    startTransition(async () => {
      const fresh = await getRepoTree(target)
      setTree(fresh)
      if (nextBranch) setBranch(nextBranch)
      // Re-fetch active file on the new branch if applicable
      if (activePath) {
        const file = await getFileContent(activePath, target)
        setActiveFile(file)
      }
    })
  }

  /* -------- Copilot chat -------- */
  const [chatInput, setChatInput] = useState("")
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/copilot" }),
  })

  function submitChat(e: React.FormEvent) {
    e.preventDefault()
    if (!chatInput.trim() || status === "streaming") return
    sendMessage(
      { text: chatInput },
      {
        body: {
          activeFilePath: activePath,
          activeFileContent: activeFile?.encoding === "utf-8" ? activeFile.content : undefined,
          branch,
        },
      },
    )
    setChatInput("")
  }

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <SiteHeader />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-2 sm:gap-3 sm:px-4">
        <Link
          href="/admin"
          className="inline-flex items-center text-xs text-muted-foreground transition-colors hover:text-foreground sm:text-sm"
        >
          <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Admin
        </Link>
        <span className="text-muted-foreground/50">·</span>
        <h1 className="text-sm font-semibold tracking-tight sm:text-base">Quenga IDE Workspace</h1>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="hidden items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs text-muted-foreground sm:flex">
            <span className="font-mono">{meta.owner}/</span>
            <span className="font-mono font-semibold text-foreground">{meta.repo}</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1">
            <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={branch}
              onChange={(e) => refreshTree(e.target.value)}
              disabled={isPending}
              className="bg-transparent text-xs font-medium outline-none disabled:opacity-50"
            >
              {branches.map((b) => (
                <option key={b.name} value={b.name}>
                  {b.name}
                  {b.isDefault ? " (default)" : ""}
                </option>
              ))}
            </select>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refreshTree()}
            disabled={isPending}
            className="h-7 gap-1 px-2 text-xs"
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">Pull</span>
          </Button>
          <Badge
            variant={meta.authenticated ? "default" : "secondary"}
            className={
              meta.authenticated
                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400"
                : ""
            }
          >
            {meta.authenticated ? "Authenticated" : "Public · rate-limited"}
          </Badge>
        </div>
      </div>

      {/* Three-panel body */}
      <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[280px_minmax(0,1fr)_360px]">
        {/* LEFT — File Explorer */}
        <aside className="flex min-h-0 flex-col border-b border-border bg-card lg:border-b-0 lg:border-r">
          <div className="flex-shrink-0 border-b border-border p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter files…"
                className="h-8 pl-7 text-xs"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-1 lg:max-h-none" style={{ maxHeight: "40vh" }}>
            <FileTree
              node={root}
              depth={0}
              expanded={expanded}
              filter={matchingPaths}
              activePath={activePath}
              onToggle={toggleFolder}
              onOpen={openFile}
            />
          </div>
        </aside>

        {/* CENTER — Code Viewer */}
        <main className="flex min-h-0 flex-col bg-background">
          <div className="flex-shrink-0 border-b border-border bg-card px-3 py-2">
            {activePath ? (
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <FileIcon className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                  <span className="truncate font-mono text-xs sm:text-sm">{activePath}</span>
                </div>
                {activeFile && (
                  <span className="flex-shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {(activeFile.size / 1024).toFixed(1)} KB · {activeFile.encoding}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">No file open — pick one from the explorer.</span>
            )}
          </div>
          <div className="flex-1 overflow-auto">
            {loadingFile ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading {activePath}…
              </div>
            ) : activeFile ? (
              activeFile.encoding === "base64" ? (
                <div className="p-6 text-sm text-muted-foreground">
                  Binary file ({(activeFile.size / 1024).toFixed(1)} KB) — preview not supported.
                </div>
              ) : (
                <CodeViewer code={activeFile.content} path={activeFile.path} />
              )
            ) : (
              <EmptyEditorState />
            )}
          </div>
        </main>

        {/* RIGHT — AI Copilot */}
        <aside className="flex min-h-0 flex-col border-t border-border bg-card lg:border-t-0 lg:border-l">
          <div className="flex flex-shrink-0 items-center gap-2 border-b border-border px-3 py-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">AI Copilot</p>
              <p className="truncate text-[10px] text-muted-foreground">
                {activePath ? `Context: ${activePath}` : "No file context"}
              </p>
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-3" style={{ maxHeight: "50vh" }}>
            {messages.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                <p className="mb-1.5 font-semibold text-foreground">Ask the Copilot anything.</p>
                <ul className="ml-3 list-disc space-y-0.5">
                  <li>&quot;Explain this file&quot;</li>
                  <li>&quot;Refactor the loop on line 42&quot;</li>
                  <li>&quot;Convert this to a server component&quot;</li>
                </ul>
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={
                    m.role === "user"
                      ? "ml-4 rounded-lg bg-primary px-3 py-2 text-xs text-primary-foreground"
                      : "mr-4 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs"
                  }
                >
                  {m.parts
                    ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
                    .map((p, i) => (
                      <div key={i} className="whitespace-pre-wrap break-words font-mono leading-relaxed">
                        {p.text}
                      </div>
                    ))}
                </div>
              ))
            )}
            {status === "streaming" && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
              </div>
            )}
          </div>

          <form onSubmit={submitChat} className="flex-shrink-0 border-t border-border p-2">
            <div className="flex items-end gap-1.5">
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    submitChat(e)
                  }
                }}
                placeholder="Ask, refactor, generate…"
                rows={2}
                className="flex-1 resize-none rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
              />
              <Button
                type="submit"
                size="sm"
                disabled={!chatInput.trim() || status === "streaming"}
                className="h-9 w-9 flex-shrink-0 p-0"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </form>
        </aside>
      </div>
    </div>
  )
}

/* ---------- File Tree ---------- */

function FileTree({
  node,
  depth,
  expanded,
  filter,
  activePath,
  onToggle,
  onOpen,
}: {
  node: TreeNode
  depth: number
  expanded: Set<string>
  filter: Set<string> | null
  activePath: string | null
  onToggle: (p: string) => void
  onOpen: (p: string) => void
}) {
  return (
    <ul className="text-xs">
      {node.children.map((child) => {
        if (filter && !filter.has(child.path)) return null
        const isOpen = filter ? true : expanded.has(child.path)
        if (child.type === "tree") {
          return (
            <li key={child.path}>
              <button
                onClick={() => onToggle(child.path)}
                className="flex w-full items-center gap-1 rounded px-1.5 py-1 text-left transition-colors hover:bg-muted"
                style={{ paddingLeft: `${depth * 10 + 6}px` }}
              >
                {isOpen ? (
                  <ChevronDown className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                )}
                {isOpen ? (
                  <FolderOpen className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
                ) : (
                  <Folder className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
                )}
                <span className="truncate font-medium">{child.name}</span>
              </button>
              {isOpen && (
                <FileTree
                  node={child}
                  depth={depth + 1}
                  expanded={expanded}
                  filter={filter}
                  activePath={activePath}
                  onToggle={onToggle}
                  onOpen={onOpen}
                />
              )}
            </li>
          )
        }
        const active = activePath === child.path
        return (
          <li key={child.path}>
            <button
              onClick={() => onOpen(child.path)}
              className={`flex w-full items-center gap-1 rounded px-1.5 py-1 text-left transition-colors ${
                active ? "bg-primary/10 text-primary" : "hover:bg-muted"
              }`}
              style={{ paddingLeft: `${depth * 10 + 22}px` }}
            >
              <FileIcon className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
              <span className="truncate">{child.name}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function EmptyEditorState() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
        <FileIcon className="h-6 w-6 text-primary" />
      </div>
      <h3 className="mb-1 text-base font-semibold">Open a file to begin</h3>
      <p className="max-w-xs text-xs text-muted-foreground">
        Select any file from the explorer on the left. The Copilot on the right will read it as context.
      </p>
    </div>
  )
}
