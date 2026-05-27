import { getRepoMeta, getRepoTree, listBranches } from "@/app/actions/github-workspace"
import { WorkspaceShell } from "@/components/workspace/workspace-shell"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Quenga IDE Workspace",
  description: "Private GitHub-bound IDE workspace for the Quenga Designs codebase.",
}

export default async function WorkspacePage() {
  const meta = await getRepoMeta()
  const [branches, tree] = await Promise.all([listBranches(), getRepoTree(meta.branch)])

  return <WorkspaceShell meta={meta} initialBranches={branches} initialTree={tree} />
}
