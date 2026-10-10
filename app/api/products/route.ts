import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseNoStore } from "@/lib/supabase-server";
import { authUser } from "@/lib/api-auth";
import { activeOrgId } from "@/lib/org";

// Never cache: the product list must reflect the DB immediately (new tasks,
// schema/label edits) — Next's fetch cache otherwise serves stale data
// across restarts.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!,
      supabaseNoStore
    );
    const user = await authUser(request);
    const orgId = await activeOrgId(user?.id);
    const { data, error } = await sb
      .from("products")
      .select("*")
      .eq("org_id", orgId)
      .eq("is_active", true)
      .order("stage_number");
    if (error) throw error;
    return NextResponse.json({ items: data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "failed" }, { status: 500 });
  }
}
