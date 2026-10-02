import path from "node:path";
import fs from "node:fs";
import { config as dotenv } from "dotenv";
import { buildArtifacts, joinRepoPath, encodeRepoPath, renderHtmlPreview } from "./lib/contributors";
import { fetchContributorNames } from "./lib/fetch-names";
import { publishFile } from "./lib/github-contents";

// Publish the contributors page into the staging frontend repo
// (default: HNG-ZEDU-EGRET/zedu-fe -> src/app/(homepage)/contributors).
//
// Usage:
//   npx tsx scripts/publish-contributors.ts --dry-run
//   npx tsx scripts/publish-contributors.ts
//
// Env:
//   CONTRIBUTORS_REPO        owner/repo           (default HNG-ZEDU-EGRET/zedu-fe)
//   CONTRIBUTORS_REPO_BRANCH branch               (default dev)
//   CONTRIBUTORS_REPO_DIR    directory inside repo (default src/app/(homepage)/contributors)
//   CONTRIBUTORS_REPO_TOKEN  fine-grained PAT with Contents: Read and write
//   NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY

const DEFAULT_REPO = "HNG-ZEDU-EGRET/zedu-fe";
const DEFAULT_BRANCH = "dev";
const DEFAULT_DIR = "src/app/(homepage)/contributors";
const COMMIT_MESSAGE = "chore: rebuild contributors directory [skip ci]";

async function main() {
  dotenv({ path: ".env.local" });
  dotenv();

  const dryRun = process.argv.includes("--dry-run");
  const repo = process.env.CONTRIBUTORS_REPO || DEFAULT_REPO;
  const branch = process.env.CONTRIBUTORS_REPO_BRANCH || DEFAULT_BRANCH;
  const dir = process.env.CONTRIBUTORS_REPO_DIR || DEFAULT_DIR;
  const token = process.env.CONTRIBUTORS_REPO_TOKEN || "";

  console.log(`Target: ${repo}@${branch} :: ${dir}${dryRun ? "  [dry-run]" : ""}`);

  const names = await fetchContributorNames();
  console.log(`Found ${names.length} Stage 1 contributor(s).`);

  const artifacts = buildArtifacts(names);

  // Always refresh the local preview so `build-contributors` stays useful.
  const previewDir = path.join(process.cwd(), "public", "contributors", "zedu-egret");
  fs.mkdirSync(previewDir, { recursive: true });
  fs.writeFileSync(path.join(previewDir, "index.html"), renderHtmlPreview(names));

  if (dryRun) {
    for (const [file, content] of Object.entries(artifacts)) {
      console.log(`\n--- ${joinRepoPath(dir, file)} (${content.length} bytes) ---`);
      console.log(content.split("\n").slice(0, 12).join("\n"));
      console.log("...");
    }
    console.log("\nDry run complete — nothing was published.");
    return;
  }

  if (!token) {
    throw new Error("Missing CONTRIBUTORS_REPO_TOKEN (fine-grained PAT, Contents: Read and write)");
  }

  const results = [];
  for (const [file, content] of Object.entries(artifacts)) {
    const filePath = encodeRepoPath(joinRepoPath(dir, file));
    const result = await publishFile(repo, filePath, content, {
      message: COMMIT_MESSAGE,
      branch,
      token,
    });
    results.push(result);
    console.log(
      `${result.status.toUpperCase().padEnd(9)} ${joinRepoPath(dir, file)}` +
        (result.commit ? `  commit ${result.commit.slice(0, 7)}` : "")
    );
  }

  const changed = results.filter((r) => r.status !== "unchanged").length;
  console.log(
    changed === 0
      ? "No content changes — nothing to deploy."
      : `Published ${changed} file(s). Coolify will redeploy the staging site.`
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});