import Link from "next/link";
import { parseGithubPr, parseGithubRepo } from "@/lib/validation";

export const dynamic = "force-dynamic";

/*
 * Deliberately NOT using @supabase/supabase-js here: createClient() eagerly
 * builds a RealtimeClient, which throws "Node.js detected but native WebSocket
 * not found" on runtimes without a global WebSocket (Node < 22, some Vercel
 * runtimes). This page only needs REST, so a plain fetch call is enough and
 * works on any Node version. It also surfaces a clear message when the env
 * vars are missing on the deployed host.
 */
type SubmissionRow = {
  stage_number: number;
  values: Record<string, unknown> | null;
  users:
    | { full_name?: string; github_url?: string }
    | Array<{ full_name?: string; github_url?: string }>
    | null;
};

type Contributor = { name: string; handle: string | null };

type PageData = {
  contributors: Contributor[];
  projects: number;
  prs: number;
  issues: number;
  error: string | null;
};

async function loadData(): Promise<PageData> {
  const empty = { contributors: [] as Contributor[], projects: 0, prs: 0, issues: 0 };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return { ...empty, error: "Contributor list is not configured on this deployment." };
  }

  const endpoint = `${url}/rest/v1/submissions?select=stage_number,values,users!inner(full_name,github_url)&order=verified_at.asc`;
  try {
    const res = await fetch(endpoint, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      return { ...empty, error: `Supabase returned ${res.status}.` };
    }
    const rows: SubmissionRow[] = await res.json();

    // Cards list Task 1 passers; stats aggregate verified submission values
    // across all tasks (repos + merged PRs parsed, issue-keyed values counted
    // until the upcoming task gives them a dedicated type).
    const contributors: Contributor[] = [];
    const seen = new Set<string>();
    const repos = new Set<string>();
    const prs = new Set<string>();
    const issues = new Set<string>();
    for (const r of rows || []) {
      const u = Array.isArray(r.users) ? r.users[0] : r.users;
      const name = String(u?.full_name || "").trim();
      if (r.stage_number === 1 && name && !seen.has(name)) {
        seen.add(name);
        let handle: string | null = null;
        try {
          handle =
            new URL(String(u?.github_url || "")).pathname.split("/").filter(Boolean)[0] || null;
        } catch {
          handle = null;
        }
        contributors.push({ name, handle });
      }
      for (const [k, raw] of Object.entries(r.values || {})) {
        const v = String(raw ?? "").trim();
        if (!v) continue;
        const pr = parseGithubPr(v);
        if (pr) {
          prs.add(`${pr.owner}/${pr.repo}#${pr.number}`.toLowerCase());
          continue;
        }
        const repo = parseGithubRepo(v);
        if (repo) {
          repos.add(`${repo.owner}/${repo.repo}`.toLowerCase());
          continue;
        }
        if (/issue/i.test(k)) issues.add(v.toLowerCase().replace(/\/+$/, ""));
      }
    }
    return { contributors, projects: repos.size, prs: prs.size, issues: issues.size, error: null };
  } catch (e: any) {
    return { ...empty, error: e?.message || "Could not load contributors." };
  }
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0] ? parts[0].charAt(0) : "";
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
  return (first + last).toUpperCase() || "?";
}

function GithubMark() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-3.5 w-3.5 shrink-0">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12Z" />
    </svg>
  );
}

export default async function ContributorsPage() {
  const { contributors, projects, prs, issues, error } = await loadData();
  const total = contributors.length;
  const stats = [
    { amount: String(total), text: "Contributors" },
    { amount: String(projects), text: "Personal projects" },
    { amount: String(prs), text: "Approved PRs" },
    { amount: String(issues), text: "Approved issues" },
    { amount: "HNG 15", text: "Internship" },
  ];

  return (
    <section className="relative isolate flex w-full flex-col items-center gap-4 overflow-hidden px-4 py-10 text-center sm:gap-6 sm:px-8 sm:py-16 lg:gap-8 lg:px-12">
      <h1 className="text-center text-2xl font-semibold leading-tight text-ink sm:text-4xl md:text-5xl">
        Zedu <span className="text-brand">Egret</span> Contributors
      </h1>
      <p className="max-w-[95%] text-xs text-muted sm:max-w-[90%] sm:text-base md:max-w-[65%] lg:max-w-[45%] lg:text-lg">
        Everyone who has completed Task 1 verification for Team Egret.
      </p>

      {/* Stats — mirrors the generated egrets page hero metrics grid */}
      <div className="grid w-full max-w-4xl grid-cols-2 place-items-center gap-1.5 sm:grid-cols-3 sm:gap-6 md:gap-10 lg:grid-cols-5">
        {stats.map((s, i) => (
          <div
            key={i}
            className="flex w-full max-w-[260px] flex-col items-center justify-center gap-1 px-1.5 py-1 sm:px-4 sm:py-3"
          >
            <p className="text-lg font-semibold text-ink sm:text-3xl">{s.amount}</p>
            <p className="text-[10px] leading-tight text-muted sm:text-sm">{s.text}</p>
          </div>
        ))}
      </div>

      {error && (
        <p className="mt-4 w-full max-w-4xl rounded-2xl border border-line bg-canvas px-6 py-6 text-center text-sm text-muted">
          Contributor list is temporarily unavailable ({error}). Try again shortly.
        </p>
      )}

      {!error && total === 0 && (
        <div className="mt-4 w-full max-w-4xl rounded-2xl bg-brand-tint px-6 py-10 text-center">
          <p className="text-sm text-muted">
            No contributors yet. Complete Task 1 to be the first on this list.
          </p>
        </div>
      )}

      {total > 0 && (
        <ol className="mt-4 grid w-full max-w-7xl grid-cols-1 gap-4 text-left sm:grid-cols-2 lg:grid-cols-3">
          {contributors.map((c, i) => {
            const card = (
              <>
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-tint text-sm font-bold text-brand-deep">
                  {initialsOf(c.name)}
                </span>
                <span className="block truncate text-base font-semibold text-ink">{c.name}</span>
                <span className="inline-flex items-center gap-1.5 text-xs text-muted transition-colors group-hover:text-brand-deep">
                  <GithubMark />
                  <span className="truncate">
                    {c.handle ? `@${c.handle}` : "Team Egret contributor"}
                  </span>
                </span>
              </>
            );
            const cls =
              "group flex h-full w-full flex-col gap-3 rounded-2xl bg-white px-5 py-5 shadow-sm drop-shadow-md transition duration-200 hover:-translate-y-0.5";
            return (
              <li key={`${c.name}-${i}`}>
                {c.handle ? (
                  <a
                    href={`https://github.com/${c.handle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${cls} hover:no-underline`}
                  >
                    {card}
                  </a>
                ) : (
                  <div className={cls}>{card}</div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      <Link
        href="/"
        className="group mt-6 inline-flex items-center gap-3 rounded-full bg-brand px-6 py-3 font-medium text-white shadow-sm transition-colors duration-200 hover:bg-brand-hover hover:no-underline"
      >
        Back to catalog
        <span className="transition-transform duration-300 ease-out group-hover:translate-x-1" aria-hidden>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 12h14M12 5l7 7-7 7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </Link>
    </section>
  );
}
