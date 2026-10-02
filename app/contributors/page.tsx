import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

async function loadContributors(): Promise<{ names: string[]; error: string | null }> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return { names: [], error: "Database not configured." };
    const sb = createClient(url, key);
    const { data, error } = await sb
      .from("submissions")
      .select("stage_number, users!inner(full_name)")
      .eq("stage_number", 1)
      .order("verified_at", { ascending: true });
    if (error) return { names: [], error: error.message };
    const names = (data || [])
      .map((r: any) => {
        const u = r?.users;
        const one = Array.isArray(u) ? u[0] : u;
        return String(one?.full_name || "").trim();
      })
      .filter(Boolean);
    return { names, error: null };
  } catch (e: any) {
    return { names: [], error: e?.message || "Could not load contributors." };
  }
}

export default async function ContributorsPage() {
  const { names, error } = await loadContributors();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <nav className="text-[13px] font-medium text-muted" aria-label="Breadcrumb">
        <Link href="/">Catalog</Link> <span aria-hidden>/</span> <span className="text-ink">Contributors</span>
      </nav>
      <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-brand">Zedu Egret</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">Contributors</h1>
      <p className="mt-1 text-sm text-muted">
        Everyone who has completed Stage 1 verification. {names.length} contributor{names.length === 1 ? "" : "s"} so far.
      </p>

      {error && (
        <p className="mt-6 rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-muted">
          Contributor list is temporarily unavailable ({error}). Try again shortly.
        </p>
      )}

      {!error && names.length === 0 && (
        <p className="mt-6 rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-muted">
          No contributors yet. Complete Stage 1 to be the first on this list.
        </p>
      )}

      {names.length > 0 && (
        <ol className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {names.map((n, i) => (
            <li key={`${n}-${i}`} className="flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3 shadow-sm">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-tint text-[12px] font-bold text-brand-deep">
                {i + 1}
              </span>
              <span className="truncate text-sm font-semibold text-ink">{n}</span>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-8">
        <Link href="/" className="inline-flex items-center justify-center rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink shadow-sm transition hover:bg-canvas hover:no-underline">
          Back to catalog
        </Link>
      </div>
    </div>
  );
}