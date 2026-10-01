import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import escapeHtml from "escape-html";

// Build script for GitHub Action: queries verified contributors, writes static HTML.
// Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... tsx scripts/build-contributors.ts
async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env (need URL + SUPABASE_SECRET_KEY)");
  const sb = createClient(url, key);
  const { data, error } = await sb
    .from("submissions")
    .select("stage_number, users!inner(full_name)")
    .eq("stage_number", 1)
    .order("verified_at");
  if (error) throw error;

  const items = (data || []).map((s: any) =>
    `      <li>${escapeHtml(String(s.users?.full_name || ""))}</li>`
  ).join("\n");

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Zedu Egret Contributors</title>
<style>body{font-family:system-ui,sans-serif;margin:0;background:#f7f7f8;color:#111}.wrap{max-width:960px;margin:0 auto;padding:24px}ul{columns:2;gap:24px;list-style:disc;padding-left:20px}li{margin:4px 0}</style>
</head><body><div class="wrap">
<h1>Zedu Egret Contributors (${(data || []).length})</h1>
<ul>
${items}
</ul>
</div></body></html>`;

  const outDir = path.join(process.cwd(), "public", "contributors", "zedu-egret");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "index.html"), html);
  console.log(`Wrote ${data?.length || 0} contributors to public/contributors/zedu-egret/index.html`);
}

main().catch((e) => { console.error(e); process.exit(1); });
