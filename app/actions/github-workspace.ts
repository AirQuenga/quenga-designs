"use server"

/**
 * GitHub workspace server actions — read-only by default.
 * Reads GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH from env.
 * Falls back to public unauthenticated requests (rate-limited) when no token.
 */

const OWNER = process.env.GITHUB_OWNER ?? "AirQuenga"
const REPO = process.env.GITHUB_REPO ?? "quenga-designs"
const DEFAULT_BRANCH = process.env.GITHUB_BRANCH ?? "main"
const TOKEN = process.env.GITHUB_TOKEN

const API = "https://api.github.com"

function ghHeaders() {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  }
  if (TOKEN) h.Authorization = `Bearer ${TOKEN}`
  return h
}

export interface RepoMeta {
  owner: string
  repo: string
  branch: string
  authenticated: boolean
}

export interface TreeEntry {
  path: string
  type: "blob" | "tree"
  size?: number
  sha: string
}

export interface BranchInfo {
  name: string
  protected: boolean
  isDefault: boolean
}

export interface FileContent {
  path: string
  sha: string
  content: string
  encoding: "utf-8" | "base64"
  size: number
  truncated: boolean
}

export async function getRepoMeta(): Promise<RepoMeta> {
  return {
    owner: OWNER,
    repo: REPO,
    branch: DEFAULT_BRANCH,
    authenticated: !!TOKEN,
  }
}

export async function listBranches(): Promise<BranchInfo[]> {
  try {
    const res = await fetch(`${API}/repos/${OWNER}/${REPO}/branches?per_page=50`, {
      headers: ghHeaders(),
      next: { revalidate: 30 },
    })
    if (!res.ok) return [{ name: DEFAULT_BRANCH, protected: false, isDefault: true }]
    const data = (await res.json()) as Array<{ name: string; protected: boolean }>
    return data.map((b) => ({
      name: b.name,
      protected: b.protected,
      isDefault: b.name === DEFAULT_BRANCH,
    }))
  } catch {
    return [{ name: DEFAULT_BRANCH, protected: false, isDefault: true }]
  }
}

export async function getRepoTree(branch: string = DEFAULT_BRANCH): Promise<TreeEntry[]> {
  // Resolve branch -> commit -> tree SHA
  try {
    const branchRes = await fetch(`${API}/repos/${OWNER}/${REPO}/branches/${encodeURIComponent(branch)}`, {
      headers: ghHeaders(),
      next: { revalidate: 30 },
    })
    if (!branchRes.ok) {
      throw new Error(`Branch lookup failed: ${branchRes.status}`)
    }
    const branchData = (await branchRes.json()) as { commit: { sha: string; commit: { tree: { sha: string } } } }
    const treeSha = branchData.commit.commit.tree.sha

    const treeRes = await fetch(`${API}/repos/${OWNER}/${REPO}/git/trees/${treeSha}?recursive=1`, {
      headers: ghHeaders(),
      next: { revalidate: 30 },
    })
    if (!treeRes.ok) throw new Error(`Tree fetch failed: ${treeRes.status}`)
    const treeData = (await treeRes.json()) as {
      tree: Array<{ path: string; type: "blob" | "tree"; size?: number; sha: string }>
      truncated: boolean
    }

    return treeData.tree
      .filter((e) => e.type === "blob" || e.type === "tree")
      .map((e) => ({ path: e.path, type: e.type, size: e.size, sha: e.sha }))
      .sort((a, b) => {
        // Folders first, then alphabetical
        if (a.type !== b.type) return a.type === "tree" ? -1 : 1
        return a.path.localeCompare(b.path)
      })
  } catch (e) {
    console.error("[v0] getRepoTree error", e)
    return []
  }
}

export async function getFileContent(path: string, branch: string = DEFAULT_BRANCH): Promise<FileContent | null> {
  try {
    const url = `${API}/repos/${OWNER}/${REPO}/contents/${encodeURI(path)}?ref=${encodeURIComponent(branch)}`
    const res = await fetch(url, { headers: ghHeaders(), next: { revalidate: 10 } })
    if (!res.ok) return null
    const data = (await res.json()) as {
      sha: string
      size: number
      content?: string
      encoding?: string
      type?: string
    }
    if (data.type !== "file" || !data.content) return null

    // Decode base64 -> utf-8 (binary files stay base64)
    const buf = Buffer.from(data.content, "base64")
    const isUtf8 = isProbablyUtf8(buf)
    return {
      path,
      sha: data.sha,
      size: data.size,
      content: isUtf8 ? buf.toString("utf-8") : data.content,
      encoding: isUtf8 ? "utf-8" : "base64",
      truncated: data.size > 1_000_000,
    }
  } catch (e) {
    console.error("[v0] getFileContent error", path, e)
    return null
  }
}

function isProbablyUtf8(buf: Buffer): boolean {
  // Skip files larger than 1MB or containing null bytes
  if (buf.length > 1_000_000) return false
  for (let i = 0; i < Math.min(buf.length, 8000); i++) {
    if (buf[i] === 0) return false
  }
  return true
}
