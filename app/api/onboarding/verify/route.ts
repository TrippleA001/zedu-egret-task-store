import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseNoStore } from "@/lib/supabase-server";
import { normalizeZeduId } from "@/lib/validation";
import { resolveRosterIdentity } from "@/lib/roster";

// POST /api/onboarding/verify { workspace_email, zedu_id }
// Server-side pair check against roster. Accepts the masked abcd***@domain
// form shown by the dropdown — it is resolved against the Zedu ID and the
// raw address never leaves the server. No claim yet.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawEmail = String(body?.workspace_email || "");
    const zid = normalizeZeduId(String(body?.zedu_id || ""));
    if (!rawEmail.trim() || !zid)
      return NextResponse.json({ error: "Select your registered email and enter your Zedu ID." }, { status: 400 });

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!,
      supabaseNoStore
    );
    const resolved = await resolveRosterIdentity(sb, rawEmail, zid);
    if ("error" in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });

    return NextResponse.json({
      ok: true,
      prefill: { full_name: resolved.row.full_name || "", github_url: resolved.row.github_url || "" },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "verify failed" }, { status: 500 });
  }
}
