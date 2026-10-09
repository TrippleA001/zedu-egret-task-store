import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseNoStore } from "@/lib/supabase-server";

// GET /api/roster/emails?q=&limit= — secret/privileged key only (server-side).
// Returns unclaimed roster emails for the Step-1 dropdown. Never leaks zedu_id.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim().toLowerCase();
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10) || 50, 100);

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!,
      supabaseNoStore
    );
    let query = sb
      .from("roster")
      .select("email, full_name")
      .is("claimed_by", null)
      .order("email")
      .limit(limit);
    if (q) query = query.ilike("email", `%${q}%`);
    const { data, error } = await query;
    if (error) throw error;
    // Mask full name to first name + initial to reduce PII while helping recognition
    const items = (data || []).map((r: any) => ({
      email: r.email,
      hint: typeof r.full_name === "string" && r.full_name.trim()
        ? r.full_name.trim().split(/\s+/).map((w: string, i: number) => (i === 0 ? w : w[0] + ".")).join(" ")
        : "",
    }));
    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "failed" }, { status: 500 });
  }
}
