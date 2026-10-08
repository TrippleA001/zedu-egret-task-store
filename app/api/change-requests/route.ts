import { NextResponse } from "next/server";
import { authUser, serviceClient } from "@/lib/api-auth";
import {
  CHANGE_FIELD_COLUMN,
  changeValueError,
  isChangeableField,
  normalizeTelegram,
  sanitizeText,
} from "@/lib/validation";

// POST /api/change-requests — queue a profile change for lead approval.
// Body: { field, new_value, note? }. The current value is read server-side
// (old_value is never taken from the client) and stored for the audit trail.
export async function POST(request: Request) {
  try {
    const user = await authUser(request);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const body = await request.json();
    const field = String(body?.field || "");
    if (!isChangeableField(field))
      return NextResponse.json({ error: "Unknown field" }, { status: 400 });

    const raw = String(body?.new_value ?? "");
    const valueError = changeValueError(field, raw);
    if (valueError) return NextResponse.json({ error: valueError }, { status: 422 });
    const note = sanitizeText(String(body?.note || ""), 500);

    // Normalize the same way onboarding does so comparisons are honest.
    const newValue =
      field === "telegram_handle" ? normalizeTelegram(raw)
      : field === "full_name" || field === "github_url" ? sanitizeText(raw, 500)
      : String(Number(raw));

    const svc = serviceClient();
    const column = CHANGE_FIELD_COLUMN[field];
    const { data: profileRow } = await svc.from("users").select(`id, ${column}`).eq("id", user.id).maybeSingle();
    const profile = profileRow as Record<string, any> | null;
    if (!profile) return NextResponse.json({ error: "Complete onboarding first" }, { status: 404 });

    const oldValue = String(profile[column] ?? "");
    if (oldValue === newValue)
      return NextResponse.json({ error: "That is already your current value" }, { status: 400 });

    const { data: pending } = await svc.from("change_requests").select("id")
      .eq("user_id", user.id).eq("field", field).eq("status", "pending").maybeSingle();
    if (pending)
      return NextResponse.json({ error: "You already have a pending request for this field" }, { status: 409 });

    const { data: created, error } = await svc.from("change_requests").insert({
      user_id: user.id, field, old_value: oldValue, new_value: newValue, note,
    }).select("id, field, old_value, new_value, note, status, created_at").single();
    if (error) throw error;

    return NextResponse.json({ ok: true, request: created });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "change request failed" }, { status: 500 });
  }
}
