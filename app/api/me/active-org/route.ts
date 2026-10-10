import { NextResponse } from "next/server";
import { authUser, serviceClient } from "@/lib/api-auth";

// Switching only changes which org's data the caller views — never their
// records — so it is instant, with no admin approval step.
export async function PATCH(request: Request) {
  const user = await authUser(request);
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  let orgId = "";
  try {
    const body = await request.json();
    orgId = typeof body?.org_id === "string" ? body.org_id.trim() : "";
  } catch {
    orgId = "";
  }
  if (!orgId) {
    return NextResponse.json({ error: "org_id is required" }, { status: 400 });
  }

  const svc = serviceClient();
  const { data: member } = await svc
    .from("user_orgs")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!member) {
    return NextResponse.json(
      { error: "You are not a member of that organization" },
      { status: 403 }
    );
  }

  const { error } = await svc
    .from("users")
    .update({ active_org_id: orgId })
    .eq("id", user.id);
  if (error) {
    return NextResponse.json({ error: "Could not switch organization" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, org_id: orgId });
}
