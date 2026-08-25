import test from "node:test";
import assert from "node:assert/strict";
import { formatFinalText, validateMode } from "../src/tool-helpers.ts";
import { emptyUsage } from "../src/types.ts";

test("validateMode enforces exactly one mode", () => {
  assert.equal(validateMode({}), "Provide either agent+task or tasks[].");
  assert.equal(validateMode({ agent: "explorer" }), "Single mode requires both agent and task.");
  assert.equal(validateMode({ task: "x" }), "Single mode requires both agent and task.");
  assert.equal(validateMode({ agent: "explorer", task: "x", tasks: [{ agent: "general", task: "y" }] }), "Provide either agent+task or tasks[], not both.");
  assert.equal(validateMode({ agent: "explorer", task: "x" }), undefined);
  assert.equal(validateMode({ tasks: [{ agent: "general", task: "x" }] }), undefined);
});

test("validateMode rejects empty delegated tasks", () => {
  assert.match(validateMode({ agent: "explorer", task: "   " }) ?? "", /Task must be non-empty/);
  assert.match(validateMode({ tasks: [{ agent: "general", task: "" }] }) ?? "", /Task 1 must be non-empty/);
});

test("formatFinalText summarizes results", () => {
  const text = formatFinalText([
    { id: "security", agent: "general", label: "security", task: "review security", status: "completed", exitCode: 0, output: "ok", messages: [], usage: emptyUsage(), stderr: "", startedAt: Date.now() },
    { id: "perf", agent: "general", label: "perf", task: "review performance", status: "failed", exitCode: 1, output: "", errorMessage: "boom", messages: [], usage: emptyUsage(), stderr: "", startedAt: Date.now() },
  ]);
  assert.match(text, /Subagents completed: 1\/2 succeeded/);
  assert.match(text, /general security — completed/);
  assert.match(text, /general perf — failed: boom/);
});
