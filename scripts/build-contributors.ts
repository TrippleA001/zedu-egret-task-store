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
    .select("stage_number, todo_app_url, task_repo_url, users!inner(full_name, github_url, telegram_handle, workspace_email, zedu_id, skill_rating)")
    .eq("stage_number", 1)
    .order("verified_at");
  if (error) throw error;

  const cards = (data || []).map((s: any) => {
    const u = s.users;
    const name = escapeHtml(String(u.full_name || ""));
    const gh = escapeHtml(String(u.github_url || ""));
    const tg = escapeHtml(String(u.telegram_handle || ""));
    const zid = escapeHtml(String(u.zedu_id || ""));
    const app = escapeHtml(String(s.todo_app_url || ""));
    const repo = escapeHtml(String(s.task_repo_url || ""));
    return `<article class="card">
      <h3>${name}</h3>
      <p class="muted">${zid} · <a href="https://t.me/${tg}" target="_blank" rel="noreferrer">@${tg}</a></p>
      <p><a href="${gh}" target="_blank" rel="noreferrer">GitHub</a> · <a href="${app}" target="_blank" rel="noreferrer">Live app</a> · <a href="${repo}" target="_blank" rel="noreferrer">Repo</a></p>
    </article>`;
  }).join("\n");

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Zedu Egret Contributors</title>
<style>body{font-family:system-ui,sans-serif;margin:0;background:#f7f7f8;color:#111}.wrap{max-width:960px;margin:0 auto;padding:24px}.grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fill,minmax(260px,1fr))}.card{background:#fff;border:1px solid #e5e5e5;border-radius:12px;padding:16px}.muted{color:#666;font-size:13px}</style>
</head><body><div class="wrap">
<h1>Zedu Egret Contributors (${(data || []).length})</h1>
<p class="muted">Auto-generated on ${new Date().toISOString()}. Static directory of verified Stage-1 interns.</p>
<div class="grid">\n${cards}\n</div>
</div></body></html>`;

  const outDir = path.join(process.cwd(), "public", "contributors", "zedu-egret");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "index.html"), html);
  console.log(`Wrote ${data?.length || 0} contributors to public/contributors/zedu-egret/index.html`);
}

main().catch((e) => { console.error(e); process.exit(1); });
