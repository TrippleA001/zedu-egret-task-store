import test from "node:test";
import assert from "node:assert/strict";
import {
  parsePrereqStages,
  prereqStagesError,
  attemptsPolicyError,
  requiredStages,
} from "../lib/policy";

test("prereq: empty input means default (null stages)", () => {
  for (const raw of [null, undefined, "", "   "]) {
    const r = parsePrereqStages(raw);
    assert.equal(r.stages, null);
    assert.equal(r.error, null);
  }
});

test("prereq: single number and comma list", () => {
  assert.deepEqual(parsePrereqStages("5").stages, [5]);
  assert.deepEqual(parsePrereqStages("1, 15, 26").stages, [1, 15, 26]);
});

test("prereq: ranges expand and merge with singles", () => {
  assert.deepEqual(parsePrereqStages("1-10, 15, 70-90").stages, [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79,
    80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90,
  ]);
});

test("prereq: duplicates dedupe, gaps tolerated, unordered sorted", () => {
  assert.deepEqual(parsePrereqStages("3, 1-3, 2").stages, [1, 2, 3]);
  assert.deepEqual(parsePrereqStages("9, 1").stages, [1, 9]);
});

test("prereq: empty parts tolerated", () => {
  assert.deepEqual(parsePrereqStages("1,,2").stages, [1, 2]);
  assert.deepEqual(parsePrereqStages(", ,").stages, null);
});

test("prereq: malformed input rejected", () => {
  for (const raw of ["abc", "1-2-3", "1:", "five", "1 -2.5"]) {
    assert.ok(parsePrereqStages(raw).error, `"${raw}" should fail`);
  }
});

test("prereq: bounds 1-99 enforced", () => {
  assert.ok(parsePrereqStages("0").error);
  assert.ok(parsePrereqStages("100").error);
  assert.ok(parsePrereqStages("1-100").error);
  assert.equal(parsePrereqStages("99").error, null);
});

test("prereq: backwards range rejected", () => {
  assert.match(parsePrereqStages("10-5").error!, /backwards/);
});

test("prereq: self-reference rejected for own stage", () => {
  assert.match(prereqStagesError("2, 3", 2)!, /cannot require itself/);
  assert.equal(prereqStagesError("2, 3", 4), null);
});

test("attempts policy: only single|multiple allowed, absent passes", () => {
  assert.equal(attemptsPolicyError(undefined), null);
  assert.equal(attemptsPolicyError(""), null);
  assert.equal(attemptsPolicyError("single"), null);
  assert.equal(attemptsPolicyError("multiple"), null);
  assert.ok(attemptsPolicyError("unlimited"));
  assert.ok(attemptsPolicyError(3));
});

test("requiredStages: default is N-1 (nothing for stage 1)", () => {
  assert.deepEqual(requiredStages(null, 1), []);
  assert.deepEqual(requiredStages("", 5), [4]);
});

test("requiredStages: explicit list overrides default", () => {
  assert.deepEqual(requiredStages("1-3", 7), [1, 2, 3]);
  assert.deepEqual(requiredStages("1", 2), [1]);
});
