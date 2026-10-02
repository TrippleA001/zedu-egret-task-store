import test from "node:test";
import assert from "node:assert/strict";
import {
  cleanName,
  tsString,
  encodeRepoPath,
  joinRepoPath,
  renderIndexTs,
  renderPageTsx,
  buildArtifacts,
} from "../scripts/lib/contributors";

test("cleanName collapses whitespace and strips control chars", () => {
  assert.equal(cleanName("  A   Data \t Scientist \n"), "A Data Scientist");
  assert.equal(cleanName(null), "");
  assert.equal(cleanName(undefined), "");
  assert.equal(cleanName("x".repeat(200)).length, 120);
});

test("tsString escapes quotes and backslashes", () => {
  assert.equal(tsString('He said "hi"'), '"He said \\"hi\\""');
  assert.equal(tsString("C:\\path"), '"C:\\\\path"');
});

test("encodeRepoPath encodes parentheses but keeps separators", () => {
  assert.equal(
    encodeRepoPath("src/app/(homepage)/contributors"),
    "src/app/%28homepage%29/contributors"
  );
});

test("joinRepoPath handles trailing and leading slashes", () => {
  assert.equal(joinRepoPath("src/app/(homepage)/contributors/", "/index.ts"), "src/app/(homepage)/contributors/index.ts");
});

test("renderIndexTs emits data and excludes timestamps", () => {
  const out = renderIndexTs(["Ada Lovelace", "Grace Hopper"]);
  assert.match(out, /export const contributors: Contributor\[\] = \[/);
  assert.match(out, /\{ name: "Ada Lovelace" \},/);
  assert.match(out, /export const contributorCount = contributors.length;/);
  assert.match(out, /export default contributors;/);
  // Determinism: no dates anywhere (would cause churn commits).
  assert.doesNotMatch(out, /\d{4}-\d{2}-\d{2}/);
});

test("renderIndexTs is byte-identical for identical input", () => {
  assert.equal(renderIndexTs(["A", "B"]), renderIndexTs(["A", "B"]));
});

test("renderIndexTs handles an empty list", () => {
  const out = renderIndexTs([]);
  assert.match(out, /export const contributors: Contributor\[\] = \[\n\n\];/);
});

test("renderPageTsx is a valid App Router page with no extra deps", () => {
  const out = renderPageTsx();
  assert.match(out, /export const metadata: Metadata/);
  assert.match(out, /const ContributorsPage = \(\) => \{/);
  assert.match(out, /export default ContributorsPage;/);
  assert.match(out, /from "\.\/index"/);
  // Only next + the generated ./index may be imported.
  const imports = out.match(/from "[^"]+"/g) || [];
  assert.deepEqual(imports, ['from "next"', 'from "./index"']);
  assert.doesNotMatch(out, /\d{4}-\d{2}-\d{2}/);
});

test("buildArtifacts returns both published files", () => {
  const files = buildArtifacts(["Ada Lovelace"]);
  assert.deepEqual(Object.keys(files).sort(), ["index.ts", "page.tsx"]);
  assert.match(files["index.ts"], /Ada Lovelace/);
});