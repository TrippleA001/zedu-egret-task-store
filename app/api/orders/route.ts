import { NextResponse } from "next/server";
import { authUserId, serviceClient } from "@/lib/api-auth";
import { activeOrgId } from "@/lib/org";

export async function GET(request: Request) {
  try {
    const userId = await authUserId(request);
    if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const svc = serviceClient();
    const orgId = await activeOrgId(userId);
    const { data: orders } = await svc.from("orders").select("*, products(title, stage_number)").eq("user_id", userId).eq("org_id", orgId).order("created_at", { ascending: false });
    const { data: subs } = await svc.from("submissions").select("stage_number").eq("user_id", userId).eq("org_id", orgId);
    return NextResponse.json({ orders: orders || [], stages: (subs || []).map((s: any) => s.stage_number) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "failed" }, { status: 500 });
  }
}
