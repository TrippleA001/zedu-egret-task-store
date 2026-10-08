import { NextResponse } from "next/server";
import { authUser, isAdminUser, serviceClient } from "@/lib/api-auth";

// GET /api/admin/submissions — every verified submission with member
// identity, newest first. Read-only console data (service role bypasses the
// owner-only submissions RLS policy).
export async function GET(request: Request) {
  try {
    const user = await authUser(request);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    if (!(await isAdminUser(user.id)))
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });

    const svc = serviceClient();
    const { data, error } = await svc
      .from("submissions")
      .select(
        "id, user_id, stage_number, todo_app_url, task_repo_url, values, verified_at, users(full_name, auth_email, workspace_email)"
      )
      .order("verified_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return NextResponse.json({ items: data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "submissions fetch failed" }, { status: 500 });
  }
}
