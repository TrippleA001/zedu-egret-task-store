import { NextResponse } from "next/server";
import { authUserId, serviceClient } from "@/lib/api-auth";

// GET /api/progress — cohort progress board (members + pass state per task).
// Members-only (requester must be onboarded). Returns names + passed stage
// numbers only — no emails, no submission URLs. Sorted deterministically
// (tasks passed desc, then name asc) so every client renders the same order.
export async function GET(request: Request) {
  try {
    const userId = await authUserId(request);
    if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const svc = serviceClient();

    const { data: me } = await svc.from("users").select("id").eq("id", userId).maybeSingle();
    if (!me) return NextResponse.json({ error: "Complete onboarding first" }, { status: 403 });

    const { data: products, error: pErr } = await svc
      .from("products")
      .select("stage_number, week_number, title")
      .eq("is_active", true)
      .order("stage_number");
    if (pErr) throw pErr;

    const { data: subs, error: sErr } = await svc
      .from("submissions")
      .select("user_id, stage_number");
    if (sErr) throw sErr;

    const { data: users, error: uErr } = await svc
      .from("users")
      .select("id, full_name");
    if (uErr) throw uErr;

    const passed = new Map<string, number[]>();
    for (const s of subs || []) {
      const list = passed.get(s.user_id) || [];
      list.push(Number(s.stage_number));
      passed.set(s.user_id, list);
    }

    const members = (users || [])
      .map((u: { id: string; full_name: string }) => ({
        name: u.full_name,
        stages: (passed.get(u.id) || []).sort((a, b) => a - b),
      }))
      .sort((a: { name: string; stages: number[] }, b: { name: string; stages: number[] }) =>
        b.stages.length - a.stages.length || a.name.localeCompare(b.name));

    return NextResponse.json({
      tasks: (products || []).map((p: { stage_number: number; week_number: number; title: string }) => ({
        stage_number: p.stage_number,
        week_number: p.week_number ?? 1,
        title: p.title,
      })),
      members,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "progress failed" }, { status: 500 });
  }
}
