// Minimal GitHub Contents API client (no dependencies — Node 18+ global fetch).

export type RepoFile = { sha: string; content: string } | null;

export type PublishResult = {
  path: string;
  status: "created" | "updated" | "unchanged";
  sha?: string;
  commit?: string;
};

const API = "https://api.github.com";

function headers(token: string) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "zedu-egret-publisher/1.0",
    "Content-Type": "application/json",
  };
}

/** Read a file from a repo. Returns null when the file does not exist yet. */
export async function getRepoFile(
  repo: string,
  path: string,
  ref: string,
  token: string
): Promise<RepoFile> {
  const url = `${API}/repos/${repo}/contents/${path}?ref=${encodeURIComponent(ref)}`;
  const res = await fetch(url, { headers: headers(token) });
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GET ${path} failed (${res.status}): ${body.slice(0, 300)}`);
  }
  const json: any = await res.json();
  if (Array.isArray(json)) throw new Error(`${path} is a directory, not a file`);
  const content = Buffer.from(String(json.content || ""), "base64").toString("utf8");
  return { sha: String(json.sha), content };
}

/** Create or update a single file. Returns the new commit sha. */
export async function putRepoFile(
  repo: string,
  path: string,
  content: string,
  opts: { message: string; branch: string; token: string; sha?: string }
): Promise<string> {
  const body: Record<string, unknown> = {
    message: opts.message,
    content: Buffer.from(content, "utf8").toString("base64"),
    branch: opts.branch,
    committer: {
      name: "zedu-egret-bot",
      email: "zedu-egret-bot@users.noreply.github.com",
    },
  };
  if (opts.sha) body.sha = opts.sha;

  const res = await fetch(`${API}/repos/${repo}/contents/${path}`, {
    method: "PUT",
    headers: headers(opts.token),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err: any = new Error(`PUT ${path} failed (${res.status}): ${text.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  const json: any = await res.json();
  return String(json?.commit?.sha || "");
}

/**
 * Publish content only when it actually changed, retrying on conflict.
 * A stale sha (409/422) is re-read and retried, which removes the
 * "Git merge lock collision" class of failures.
 */
export async function publishFile(
  repo: string,
  path: string,
  content: string,
  opts: { message: string; branch: string; token: string; attempts?: number }
): Promise<PublishResult> {
  const attempts = opts.attempts ?? 4;
  let lastErr: unknown = null;

  for (let i = 1; i <= attempts; i++) {
    try {
      const existing = await getRepoFile(repo, path, opts.branch, opts.token);

      if (existing && existing.content === content) {
        return { path, status: "unchanged", sha: existing.sha };
      }

      const commit = await putRepoFile(repo, path, content, {
        message: opts.message,
        branch: opts.branch,
        token: opts.token,
        sha: existing?.sha,
      });

      return {
        path,
        status: existing ? "updated" : "created",
        commit,
      };
    } catch (e: any) {
      lastErr = e;
      // Retry on conflict / rate limit only.
      if (e?.status !== 409 && e?.status !== 422 && e?.status !== 429) throw e;
      await new Promise((r) => setTimeout(r, 500 * i));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("publish failed");
}