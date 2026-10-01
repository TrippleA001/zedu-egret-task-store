import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  normalizeEmail,
  normalizeTelegram,
  normalizeZeduId,
  sanitizeText,
  telegramError,
} from "@/lib/validation";

// POST /api/onboarding/complete — atomically claim roster row + insert users row.
export async function POST(request: Request) {
  try {
    // 1. Must be logged in via Google
    const jar = cookies();
    const authed = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => jar.getAll(), setAll: () => {} } }
    );
    const { data: { user } } = await authed.auth.getUser();
    if (!user?.id || !user?.email)
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const body = await request.json();
    const workspace_email = normalizeEmail(String(body?.workspace_email || ""));
    const zedu_id = normalizeZeduId(String(body?.zedu_id || ""));
    const full_name = sanitizeText(String(body?.full_name || ""));
    const github_url = sanitizeText(String(body?.github_url || ""), 500);
    const telegram = normalizeTelegram(String(body?.telegram_handle || ""));
    const skill_rating = Number(body?.skill_rating);
    const channels: string[] = Array.isArray(body?.channels) ? body.channels : [];

    if (!workspace_email || !zedu_id || !full_name || !github_url || !telegram)
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    const tgErr = telegramError(String(body?.telegram_handle || ""));
    if (tgErr) return NextResponse.json({ error: tgErr }, { status: 400 });
    if (![1, 2, 3, 4, 5].includes(skill_rating))
      return NextResponse.json({ error: "skill_rating must be 1-5" }, { status: 400 });
    const required = ["telegram_announcement", "telegram_chat", "zedu_announcement", "zedu_egret"];
    if (!required.every((k) => channels.includes(k)))
      return NextResponse.json({ error: "All 4 channels must be confirmed" }, { status: 400 });

    const svc = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
    );

    // Already onboarded?
    const { data: existing } = await svc.from("users").select("id").eq("id", user.id).maybeSingle();
    if (existing) return NextResponse.json({ error: "Already onboarded" }, { status: 409 });

    // Verify pair
    const { data: row, error: rErr } = await svc
      .from("roster")
      .select("email, zedu_id, claimed_by")
      .eq("email", workspace_email)
      .maybeSingle();
    if (rErr) throw rErr;
    if (!row) return NextResponse.json({ error: "Email not found in roster" }, { status: 404 });
    if (row.claimed_by) return NextResponse.json({ error: "This email has already been claimed" }, { status: 409 });
    if (normalizeZeduId(String(row.zedu_id)) !== zedu_id)
      return NextResponse.json({ error: "Zedu ID does not match this email" }, { status: 403 });

    // Atomic claim (fails if raced)
    const { data: claimed, error: cErr } = await svc
      .from("roster")
      .update({ claimed_by: user.id, claimed_at: new Date().toISOString() })
      .eq("email", workspace_email)
      .is("claimed_by", null)
      .select("email");
    if (cErr) throw cErr;
    if (!claimed || claimed.length === 0)
      return NextResponse.json({ error: "Someone just claimed this email. Contact support." }, { status: 409 });

    // Insert permanent user (denormalized — roster can be dropped later)
    const { error: uErr } = await svc.from("users").insert({
      id: user.id,
      auth_email: user.email,
      workspace_email,
      zedu_id,
      full_name,
      github_url,
      telegram_handle: telegram,
      sub_team: null, // greyed out — auto-assigned later
      skill_rating,
      channels_verified: true,
    });
    if (uErr) {
      // Roll back claim so the email stays claimable
      await svc.from("roster").update({ claimed_by: null, claimed_at: null }).eq("email", workspace_email);
      // Surface duplicate nicely
      if (String(uErr.message).includes("duplicate"))
        return NextResponse.json({ error: "This identity is already registered" }, { status: 409 });
      throw uErr;
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "complete failed" }, { status: 500 });
  }
}
