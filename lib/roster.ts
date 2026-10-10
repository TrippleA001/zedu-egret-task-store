import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isMaskedEmail,
  maskedEmailLike,
  normalizeEmail,
  normalizeZeduId,
} from "@/lib/validation";

export type RosterRow = {
  email: string;
  zedu_id: string;
  full_name: string | null;
  github_url: string | null;
  claimed_by: string | null;
  org_id: string | null;
};

export type ResolvedRoster = { row: RosterRow } | { error: string; status: number };

const COLUMNS = "email, zedu_id, full_name, github_url, claimed_by, org_id";

// Resolve a registration email (full, or the abcd***@domain mask the
// onboarding dropdown shows) + Zedu ID pair to exactly one unclaimed roster
// row. Masked input can match several rows; the Zedu ID picks the right one.
export async function resolveRosterIdentity(
  svc: SupabaseClient,
  rawEmail: string,
  zid: string
): Promise<ResolvedRoster> {
  const zidNorm = normalizeZeduId(zid);
  let rows: RosterRow[];

  if (isMaskedEmail(rawEmail)) {
    const pattern = maskedEmailLike(rawEmail);
    if (!pattern)
      return { error: "Pick your registration email from the suggestions below the input.", status: 400 };
    const { data, error } = await svc.from("roster").select(COLUMNS).ilike("email", pattern);
    if (error) throw error;
    rows = (data || []) as RosterRow[];
  } else {
    const { data, error } = await svc
      .from("roster")
      .select(COLUMNS)
      .eq("email", normalizeEmail(rawEmail))
      .maybeSingle();
    if (error) throw error;
    rows = data ? [data as RosterRow] : [];
  }

  if (rows.length === 0)
    return { error: "No registration found for that email — check the spelling.", status: 404 };

  const zidMatches = rows.filter((r) => normalizeZeduId(String(r.zedu_id)) === zidNorm);
  if (zidMatches.length === 0)
    return { error: "That Zedu ID doesn't match this email. Check your registration email.", status: 403 };

  const unclaimed = zidMatches.find((r) => !r.claimed_by);
  if (!unclaimed)
    return { error: "This email has already been claimed. Contact support.", status: 409 };

  return { row: unclaimed };
}
