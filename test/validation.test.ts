import test from "node:test";
import assert from "node:assert/strict";
import { parseGithubRepo, isBlockedHost, isHttpsUrl, generateOrderNumber, normalizeEmail } from "../lib/validation";

test("parseGithubRepo accepts full URL and short form", () => {
  assert.deepEqual(parseGithubRepo("https://github.com/octocat/hello-world"), { owner: "octocat", repo: "hello-world" });
  assert.deepEqual(parseGithubRepo("octocat/hello-world"), { owner: "octocat", repo: "hello-world" });
  assert.equal(parseGithubRepo("https://example.com/x/y"), null);
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
