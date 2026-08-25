import test from "node:test";
import assert from "node:assert/strict";
import { getMaxConcurrency } from "../src/config.ts";

test("getMaxConcurrency defaults to 5", () => {
  assert.equal(getMaxConcurrency({}), 5);
  assert.equal(getMaxConcurrency({ PI_SUBAGENT_MAX_CONCURRENCY: "" }), 5);
});

test("getMaxConcurrency reads PI_SUBAGENT_MAX_CONCURRENCY", () => {
  assert.equal(getMaxConcurrency({ PI_SUBAGENT_MAX_CONCURRENCY: "2" }), 2);
  assert.equal(getMaxConcurrency({ PI_SUBAGENT_MAX_CONCURRENCY: "12" }), 12);
});

test("getMaxConcurrency ignores invalid values", () => {
  assert.equal(getMaxConcurrency({ PI_SUBAGENT_MAX_CONCURRENCY: "0" }), 5);
  assert.equal(getMaxConcurrency({ PI_SUBAGENT_MAX_CONCURRENCY: "-1" }), 5);
  assert.equal(getMaxConcurrency({ PI_SUBAGENT_MAX_CONCURRENCY: "2.5" }), 5);
  assert.equal(getMaxConcurrency({ PI_SUBAGENT_MAX_CONCURRENCY: "oops" }), 5);
});
