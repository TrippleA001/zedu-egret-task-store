import { createClient } from "@supabase/supabase-js";
import {
  cleanName,
  normalizeRepoUrl,
  properCase,
  type ContributorEntry,
} from "./contributors";

/**
 * Fetch every Stage 1 contributor: proper-cased name + normalised repo URL.
 * Uses the service key (server-side only, never shipped to the browser).
 */
export async function fetchContributors(env = process.env): Promise<ContributorEntry[]> {
  const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing Supabase env (need NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL + SUPABASE_SECRET_KEY)"
    );
  }

  const sb = createClient(url, key);
  const { data, error } = await sb
    .from("submissions")
    .select("stage_number, task_repo_url, users!inner(full_name)")
    .eq("stage_number", 1)
    .order("verified_at", { ascending: true });
  if (error) throw error;

  const entries: ContributorEntry[] = (data || [])
    .map((row: any) => {
      const u = row?.users;
      const one = Array.isArray(u) ? u[0] : u;
      return {
        name: properCase(cleanName(one?.full_name)),
        repo: normalizeRepoUrl(row?.task_repo_url),
      };
    })
    .filter((e: ContributorEntry) => e.name.length > 0);

  // Dedupe on name+repo, then deterministic sort: reruns without new
  // submissions are byte-identical (no churn commits / redundant deploys).
  const seen = new Set<string>();
  const unique: ContributorEntry[] = [];
  for (const e of entries) {
    const k = e.name + "\u0000" + e.repo;
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(e);
  }
  return unique.sort(
    (a, b) =>
      a.name.localeCompare(b.name, "en", { sensitivity: "base" }) ||
      a.repo.localeCompare(b.repo, "en")
  );
}