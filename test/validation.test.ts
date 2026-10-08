import test from "node:test";
import assert from "node:assert/strict";
import { parseGithubRepo, parseGithubPr, parseDriveUrl, isBlockedHost, isHttpsUrl, generateOrderNumber, normalizeEmail, normalizeTelegram, telegramError } from "../lib/validation";

test("parseGithubRepo accepts full URL and short form", () => {
  assert.deepEqual(parseGithubRepo("https://github.com/octocat/hello-world"), { owner: "octocat", repo: "hello-world" });
  assert.deepEqual(parseGithubRepo("octocat/hello-world"), { owner: "octocat", repo: "hello-world" });
  assert.equal(parseGithubRepo("https://example.com/x/y"), null);
});

test("parseGithubPr accepts full URL and short form", () => {
  assert.deepEqual(parseGithubPr("https://github.com/octocat/hello-world/pull/42"), { owner: "octocat", repo: "hello-world", number: 42 });
  assert.deepEqual(parseGithubPr("octocat/hello-world#7"), { owner: "octocat", repo: "hello-world", number: 7 });
  assert.deepEqual(parseGithubPr("https://github.com/octocat/hello-world/pull/42/files"), { owner: "octocat", repo: "hello-world", number: 42 });
  assert.equal(parseGithubPr("https://github.com/octocat/hello-world/issues/42"), null);
  assert.equal(parseGithubPr("https://example.com/x/y"), null);
});

test("parseDriveUrl accepts Drive links only", () => {
  assert.equal(parseDriveUrl("https://drive.google.com/file/d/abc123/view"), "drive.google.com");
  assert.equal(parseDriveUrl("https://docs.google.com/document/d/abc123/edit"), "docs.google.com");
  assert.equal(parseDriveUrl("https://example.com/file"), null);
  assert.equal(parseDriveUrl("not a url"), null);
});

test("blocked hosts rejected", () => {
  assert.equal(isBlockedHost("localhost"), true);
  assert.equal(isBlockedHost("127.0.0.1"), true);
  assert.equal(isBlockedHost("10.0.0.5"), true);
  assert.equal(isBlockedHost("myshop.vercel.app"), false);
});

test("https only", () => {
  assert.equal(isHttpsUrl("https://a.com"), true);
  assert.equal(isHttpsUrl("http://a.com"), false);
});

test("order number format", () => {
  const n = generateOrderNumber();
  assert.match(n, /^ZE-2026-[A-Z2-9]{4}$/);
});

test("email normalize", () => {
  assert.equal(normalizeEmail("  Foo@Bar.COM "), "foo@bar.com");
});

test("telegram: display names accepted (spaces allowed)", () => {
  assert.equal(telegramError("A Data Scientist"), null);
  assert.equal(normalizeTelegram("  A   Data   Scientist  "), "A Data Scientist");
  assert.ok((telegramError("") || "").includes("display name"));
  assert.ok((telegramError("A") || "").includes("too short"));
});
