import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Never cache: the product list must reflect the DB immediately (new tasks,
// schema/label edits) — Next's fetch cache otherwise serves stale data
// across restarts.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
    );
    const { data, error } = await sb
      .from("products")
      .select("*")
      .eq("is_active", true)
      .order("stage_number");
    if (error) throw error;
    // no-store: without an explicit header the browser/CDN may heuristically
    // cache this GET, serving a stale catalog after admin edits
    return NextResponse.json({ items: data || [] }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "failed" }, { status: 500 });
  }
}
