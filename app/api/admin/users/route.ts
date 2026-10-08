import { NextResponse } from "next/server";
import { authUser, isAdminUser, serviceClient } from "@/lib/api-auth";
import { sanitizeText, subTeamError } from "@/lib/validation";

async function guard(request: Request) {
  const user = await authUser(request);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await isAdminUser(user.id)))
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  return null;
}

// PATCH /api/admin/users — assign a member's sub-team (free text).
// Empty string clears the assignment (stored as null, matching onboarding).
export async function PATCH(request: Request) {
  const denied = await guard(request);
  if (denied) return denied;
  try {
    const body = await request.json();
    const userId = String(body?.user_id || "");
    if (!userId) return NextResponse.json({ error: "user_id is required" }, { status: 400 });
    if (body?.sub_team === undefined || typeof body.sub_team !== "string")
      return NextResponse.json({ error: "sub_team must be a string (empty clears the assignment)" }, { status: 400 });

    const value = sanitizeText(body.sub_team, 200);
    const err = subTeamError(value);
    if (err) return NextResponse.json({ error: err }, { status: 422 });

    const svc = serviceClient();
    const { data, error } = await svc
      .from("users")
      .update({ sub_team: value || null })
      .eq("id", userId)
      .select("id, full_name, sub_team")
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Member not found" }, { status: 404 });
    return NextResponse.json({ ok: true, member: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "sub-team update failed" }, { status: 500 });
  }
}
