import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
  );
}

async function authedUserId() {
  const jar = cookies();
  const authed = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => jar.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await authed.auth.getUser();
  return user?.id ?? null;
}

// GET /api/notifications — inbox for the logged-in user.
export async function GET() {
  const uid = await authedUserId();
  if (!uid) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { data, error } = await svc()
    .from("notifications")
    .select("id, kind, title, body, order_number, read_at, created_at")
    .eq("user_id", uid)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const unread = (data || []).filter((n: any) => !n.read_at).length;
  return NextResponse.json({ items: data || [], unread });
}

// PATCH /api/notifications { ids?: string[] } — mark read (all if omitted).
export async function PATCH(request: Request) {
  const uid = await authedUserId();
  if (!uid) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const ids: string[] | undefined = Array.isArray(body?.ids) ? body.ids : undefined;
  let q = svc().from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", uid).is("read_at", null);
  if (ids && ids.length) q = q.in("id", ids);
  const { error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
