import fs from "node:fs";
import path from "node:path";
import { config as dotenv } from "dotenv";
import { renderHtmlPreview } from "./lib/contributors";
import { fetchContributorNames } from "./lib/fetch-names";

// Local preview only: writes public/contributors/zedu-egret/index.html.
// The real staging page is published by scripts/publish-contributors.ts.
// Usage: npx tsx scripts/build-contributors.ts
async function main() {
  dotenv({ path: ".env.local" });
  dotenv();

  const names = await fetchContributorNames();

  const outDir = path.join(process.cwd(), "public", "contributors", "zedu-egret");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "index.html"), renderHtmlPreview(names));
  console.log(`Wrote ${names.length} contributors to public/contributors/zedu-egret/index.html`);
}

main().catch((e) => { console.error(e); process.exit(1); });
