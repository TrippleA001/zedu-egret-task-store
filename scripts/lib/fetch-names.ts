import { createClient } from "@supabase/supabase-js";
import { cleanName } from "./contributors";

/**
 * Fetch the display names of everyone who completed Stage 1.
 * Uses the service key (server-side only, never shipped to the browser).
 */
export async function fetchContributorNames(env = process.env): Promise<string[]> {
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
    .select("stage_number, users!inner(full_name)")
    .eq("stage_number", 1)
    .order("verified_at", { ascending: true });
  if (error) throw error;

  const names = (data || [])
    .map((row: any) => {
      const u = row?.users;
      const one = Array.isArray(u) ? u[0] : u;
      return cleanName(one?.full_name);
    })
    .filter((n: string) => n.length > 0);

  // Stable, case-insensitive ordering so reruns without new submissions are
  // byte-identical (no churn commits / redundant deployments).
  return Array.from(new Set(names)).sort((a, b) =>
    a.localeCompare(b, "en", { sensitivity: "base" })
  );
}