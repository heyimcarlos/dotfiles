import test from "node:test";
import assert from "node:assert/strict";
import { loadBuiltInAgents, describeAgents } from "../src/agents.ts";

test("loads built-in explorer and general agents", () => {
  const agents = loadBuiltInAgents();
  assert.equal(agents.size, 2);
  assert.equal(agents.get("explorer")?.name, "explorer");
  assert.equal(agents.get("general")?.name, "general");
  assert.deepEqual(agents.get("explorer")?.tools, ["read", "grep", "find", "ls"]);
  assert.deepEqual(agents.get("general")?.tools, ["read", "grep", "find", "ls"]);
  assert.match(agents.get("explorer")?.systemPrompt ?? "", /read-only codebase exploration agent/);
  assert.match(agents.get("general")?.systemPrompt ?? "", /focused general-purpose analysis agent/);
});

test("describes built-in agents", () => {
  const agents = loadBuiltInAgents();
  const text = describeAgents(agents);
  assert.match(text, /explorer:/);
  assert.match(text, /general:/);
});
