import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const workerUrl = (process.env.NEXT_PUBLIC_COUNTER_URL || "https://base31-directory-counter.sawyerbobk563.workers.dev").replace(/\/$/, "");

// Approval commits the community site's files into the repository, using the
// same public/sites/<slug>/ folder the hand-built sites live in. The token is
// a Vercel environment secret with repository Contents read/write permission;
// without it the button explains what is missing instead of failing silently.
const githubToken = process.env.GITHUB_TOKEN?.trim();
const githubRepo = (process.env.GITHUB_REPO || "NOTAM-bobk/base31").trim();
const githubBranch = (process.env.GITHUB_BRANCH || "main").trim();
const githubApi = `https://api.github.com/repos/${githubRepo}`;

const authorized = (request: Request) => {
  const expected = process.env.ADMIN_PANEL_PASSWORD;
  const supplied = request.headers.get("x-admin-password");
  return !!expected && !!supplied && supplied === expected;
};

const validSlug = (value: unknown): value is string =>
  typeof value === "string" && /^[a-z0-9][a-z0-9-]{0,63}$/.test(value);

// Uploads are sanitised by the Worker, but the route still checks before it
// hands a path to the GitHub API so no approval can write outside the folder.
const safeRepoPath = (value: unknown): value is string => {
  if (typeof value !== "string" || value.length === 0 || value.length > 200) return false;
  if (value.startsWith("/") || value.includes("\\")) return false;
  return value.split("/").every((part) => part !== "" && part !== "." && part !== "..");
};

type GithubError = { message?: unknown };

const githubRequest = async (path: string, init: RequestInit = {}) => {
  const response = await fetch(`${githubApi}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "base31-directory-admin",
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
    },
    cache: "no-store",
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown> & GithubError;
  if (!response.ok) {
    throw new Error(typeof body.message === "string" ? body.message : `GitHub returned ${response.status}.`);
  }
  return body;
};

/**
 * Commits every file of one community site to the repository in a single
 * commit. The files are read from the Worker's protected export endpoint so
 * the approval works for hidden sites too, and the commit is built with the
 * Git Data API: one blob per file, then one tree, one commit and one ref
 * update. Nothing is written to the branch until the final update.
 */
const commitSite = async (slug: string) => {
  if (!githubToken) {
    throw new Error("Set GITHUB_TOKEN in Vercel before approving sites.");
  }
  if (!process.env.ADMIN_PANEL_PASSWORD) {
    throw new Error("ADMIN_PANEL_PASSWORD is not configured.");
  }

  const exportedResponse = await fetch(`${workerUrl}/admin/sites/${encodeURIComponent(slug)}/export`, {
    headers: { Authorization: `Bearer ${process.env.ADMIN_PANEL_PASSWORD}` },
    cache: "no-store",
  });
  const exported = (await exportedResponse.json().catch(() => null)) as
    | { site?: { slug?: unknown; title?: unknown }; files?: { path?: unknown; data?: unknown }[]; error?: unknown }
    | null;
  if (!exportedResponse.ok) {
    throw new Error(typeof exported?.error === "string" ? exported.error : "Could not read that site from the Worker.");
  }
  if (!validSlug(exported?.site?.slug) || exported.site.slug !== slug) {
    throw new Error("The Worker returned a different site than the one being approved.");
  }

  const files = (Array.isArray(exported.files) ? exported.files : [])
    .filter((file) => safeRepoPath(file?.path) && typeof file.data === "string" && file.data.length > 0);
  if (files.length === 0) throw new Error("That site has no readable files to commit.");

  const title = typeof exported.site.title === "string" && exported.site.title.trim() ? exported.site.title.trim() : slug;

  const ref = await githubRequest(`/git/ref/heads/${githubBranch}`);
  const headSha = (ref.object as { sha?: unknown } | undefined)?.sha;
  if (typeof headSha !== "string") throw new Error("Could not read the branch head from GitHub.");

  const head = await githubRequest(`/git/commits/${headSha}`);
  const baseTree = (head.tree as { sha?: unknown } | undefined)?.sha;
  if (typeof baseTree !== "string") throw new Error("Could not read the branch tree from GitHub.");

  const tree = await Promise.all(
    files.map(async (file) => {
      const blob = await githubRequest("/git/blobs", {
        method: "POST",
        body: JSON.stringify({ content: file.data, encoding: "base64" }),
      });
      if (typeof blob.sha !== "string") throw new Error(`GitHub did not accept ${file.path}.`);
      return { path: `public/sites/${slug}/${file.path}`, mode: "100644", type: "blob", sha: blob.sha };
    }),
  );

  const createdTree = await githubRequest("/git/trees", {
    method: "POST",
    body: JSON.stringify({ base_tree: baseTree, tree }),
  });
  if (typeof createdTree.sha !== "string") throw new Error("GitHub did not create a tree for that site.");

  const commit = await githubRequest("/git/commits", {
    method: "POST",
    body: JSON.stringify({
      message: `Approve community site: ${title} (${slug})`,
      tree: createdTree.sha,
      parents: [headSha],
    }),
  });
  if (typeof commit.sha !== "string") throw new Error("GitHub did not create a commit for that site.");

  await githubRequest(`/git/refs/heads/${githubBranch}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: commit.sha, force: false }),
  });

  return {
    slug,
    files: tree.length,
    commitUrl: typeof commit.html_url === "string" ? commit.html_url : null,
  };
};

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Invalid admin password." }, { status: 401 });
  const response = await fetch(`${workerUrl}/admin/data`, {
    headers: { Authorization: `Bearer ${process.env.ADMIN_PANEL_PASSWORD}` },
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({ error: "Invalid Worker response." }));
  return NextResponse.json(body, { status: response.status });
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Invalid admin password." }, { status: 401 });
  let payload: { kind?: unknown; slug?: unknown };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (payload.kind !== "approve" || !validSlug(payload.slug)) {
    return NextResponse.json({ error: "Invalid approval request." }, { status: 400 });
  }

  try {
    const result = await commitSite(payload.slug);
    return NextResponse.json({ success: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not commit that site.";
    const missingToken = !githubToken;
    return NextResponse.json({ error: message }, { status: missingToken ? 503 : 502 });
  }
}

export async function DELETE(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Invalid admin password." }, { status: 401 });
  let payload: { kind?: unknown; id?: unknown };
  try { payload = await request.json() as typeof payload; } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  if ((payload.kind !== "site" && payload.kind !== "request" && payload.kind !== "dmca" && payload.kind !== "report") || typeof payload.id !== "string") {
    return NextResponse.json({ error: "Invalid delete request." }, { status: 400 });
  }
  const base = payload.kind === "site" ? "/admin/sites/" : payload.kind === "dmca" ? "/admin/dmca/" : payload.kind === "report" ? "/admin/reports/" : "/admin/requests/";
  const path = `${base}${encodeURIComponent(payload.id)}`;
  const response = await fetch(`${workerUrl}${path}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${process.env.ADMIN_PANEL_PASSWORD}` },
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({ error: "Invalid Worker response." }));
  return NextResponse.json(body, { status: response.status });
}
