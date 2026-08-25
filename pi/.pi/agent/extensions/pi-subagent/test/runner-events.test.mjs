import test from "node:test";
import assert from "node:assert/strict";
import { MAX_MESSAGES, STORED_OUTPUT_CAP } from "../src/limits.ts";
import { createInitialResult, getFinalAssistantText, processPiJsonEvent } from "../src/runner-events.ts";

test("extracts final assistant text from message_end events", () => {
  const result = createInitialResult({ id: "x", agent: "explorer", task: "find x" });
  const changed = processPiJsonEvent(result, {
    type: "message_end",
    message: {
      role: "assistant",
      content: [{ type: "text", text: "final answer" }],
      usage: { input: 10, output: 5, cost: { total: 0.01 }, totalTokens: 20 },
      model: "provider/model",
    },
  });
  assert.equal(changed, true);
  assert.equal(result.output, "final answer");
  assert.equal(getFinalAssistantText(result.messages), "final answer");
  assert.equal(result.usage.input, 10);
  assert.equal(result.usage.output, 5);
  assert.equal(result.usage.cost, 0.01);
  assert.equal(result.usage.contextTokens, 20);
  assert.equal(result.usage.turns, 1);
  assert.equal(result.model, "provider/model");
});

test("extracts assistant metadata from agent_end-only fallback", () => {
  const result = createInitialResult({ id: "x", agent: "general", task: "json mode fallback" });
  const changed = processPiJsonEvent(result, {
    type: "agent_end",
    messages: [
      { role: "user", content: "question" },
      {
        role: "assistant",
        content: [{ type: "text", text: "final from agent_end" }],
        usage: { inputTokens: 12, outputTokens: 7, cacheReadInputTokens: 3, cacheCreationInputTokens: 2, cost: { total: 0.02 }, contextTokens: 24 },
        model: "provider/json-mode-model",
        stopReason: "stop",
        errorMessage: "warning text",
      },
    ],
  });

  assert.equal(changed, true);
  assert.equal(result.output, "final from agent_end");
  assert.equal(result.messages.length, 2);
  assert.equal(result.usage.input, 12);
  assert.equal(result.usage.output, 7);
  assert.equal(result.usage.cacheRead, 3);
  assert.equal(result.usage.cacheWrite, 2);
  assert.equal(result.usage.cost, 0.02);
  assert.equal(result.usage.contextTokens, 24);
  assert.equal(result.usage.turns, 1);
  assert.equal(result.model, "provider/json-mode-model");
  assert.equal(result.stopReason, "stop");
  assert.equal(result.errorMessage, "warning text");
});

test("caps stored messages and assistant output", () => {
  const result = createInitialResult({ id: "x", agent: "general", task: "review" });
  const largeText = "x".repeat(STORED_OUTPUT_CAP + 1024);

  for (let i = 0; i < MAX_MESSAGES + 5; i++) {
    processPiJsonEvent(result, {
      type: "message_end",
      message: {
        role: "assistant",
        content: [{ type: "text", text: i === MAX_MESSAGES + 4 ? largeText : `answer ${i}` }],
      },
    });
  }

  assert.equal(result.messages.length, MAX_MESSAGES);
  assert.ok(Buffer.byteLength(result.output, "utf8") <= STORED_OUTPUT_CAP);
  assert.match(result.output, /subagent output truncated/);
});

test("ignores non-json-shape events", () => {
  const result = createInitialResult({ id: "x", agent: "general", task: "review" });
  assert.equal(processPiJsonEvent(result, { type: "queue_update" }), false);
  assert.equal(result.messages.length, 0);
});
