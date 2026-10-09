import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseNoStore } from "@/lib/supabase-server";
import { normalizeEmail, normalizeZeduId } from "@/lib/validation";

// POST /api/onboarding/verify { workspace_email, zedu_id }
// Server-side pair check against roster. No claim yet.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = normalizeEmail(String(body?.workspace_email || ""));
    const zid = normalizeZeduId(String(body?.zedu_id || ""));
    if (!email || !zid)
      return NextResponse.json({ error: "Select your registered email and enter your Zedu ID." }, { status: 400 });

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!,
      supabaseNoStore
    );
    const { data, error } = await sb
      .from("roster")
      .select("email, zedu_id, full_name, github_url, claimed_by")
      .eq("email", email)
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "No registration found for that email — check the spelling." }, { status: 404 });
    if (data.claimed_by) return NextResponse.json({ error: "This email has already been claimed. Contact support." }, { status: 409 });
    if (normalizeZeduId(String(data.zedu_id)) !== zid)
      return NextResponse.json({ error: "That Zedu ID doesn't match this email. Check your registration email." }, { status: 403 });

    return NextResponse.json({
      ok: true,
      prefill: { full_name: data.full_name || "", github_url: data.github_url || "" },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "verify failed" }, { status: 500 });
  }
}
