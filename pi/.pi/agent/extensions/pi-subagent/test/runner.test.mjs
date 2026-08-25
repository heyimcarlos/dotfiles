import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { STDERR_CAP } from "../src/limits.ts";
import { buildChildEnv, buildPiArgs, buildTaskPrompt, runSubagent } from "../src/runner.ts";

test("buildTaskPrompt prefixes task", () => {
  assert.equal(buildTaskPrompt("hello"), "Task: hello");
});

test("buildChildEnv uses an allowlist", () => {
  const env = buildChildEnv({
    PATH: "/bin",
    HOME: "/tmp/home",
    OPENAI_API_KEY: "provider-key",
    ANTHROPIC_OAUTH_TOKEN: "oauth-token",
    AWS_BEARER_TOKEN_BEDROCK: "bedrock-token",
    AZURE_OPENAI_BASE_URL: "https://example.openai.azure.com",
    AZURE_OPENAI_RESOURCE_NAME: "example",
    AZURE_OPENAI_DEPLOYMENT_NAME_MAP: "gpt-4o=prod",
    MOONSHOT_API_KEY: "moonshot-key",
    PI_SHARE_VIEWER_URL: "https://share.example",
    SECRET_INTERNAL_TOKEN: "nope",
  });

  assert.equal(env.PATH, "/bin");
  assert.equal(env.HOME, "/tmp/home");
  assert.equal(env.OPENAI_API_KEY, "provider-key");
  assert.equal(env.ANTHROPIC_OAUTH_TOKEN, "oauth-token");
  assert.equal(env.AWS_BEARER_TOKEN_BEDROCK, "bedrock-token");
  assert.equal(env.AZURE_OPENAI_BASE_URL, "https://example.openai.azure.com");
  assert.equal(env.AZURE_OPENAI_RESOURCE_NAME, "example");
  assert.equal(env.AZURE_OPENAI_DEPLOYMENT_NAME_MAP, "gpt-4o=prod");
  assert.equal(env.MOONSHOT_API_KEY, "moonshot-key");
  assert.equal(env.PI_SHARE_VIEWER_URL, "https://share.example");
  assert.equal(env.PI_SUBAGENT_CHILD, "1");
  assert.equal(env.SECRET_INTERNAL_TOKEN, undefined);
});

test("buildPiArgs includes isolation flags, tools, prompt file, inherited model, and task", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pi-subagent-test-"));
  try {
    const args = buildPiArgs({
      name: "explorer",
      tools: ["read", "grep"],
      thinking: "low",
      systemPrompt: "You are explorer.",
    }, "Find auth", tmp, { provider: "anthropic", id: "claude-sonnet-4-5" });
    // Fork: no --no-extensions so children can use extension-registered auth.
    assert.deepEqual(args.slice(0, 4), ["--mode", "json", "-p", "--no-session"]);
    assert.ok(!args.includes("--no-extensions"));
    assert.ok(args.includes("--model"));
    assert.ok(args.includes("anthropic/claude-sonnet-4-5"));
    assert.ok(args.includes("--tools"));
    assert.ok(args.includes("read,grep"));
    assert.ok(args.includes("--thinking"));
    assert.ok(args.includes("low"));
    assert.ok(args.includes("--append-system-prompt"));
    assert.equal(args.at(-1), "Task: Find auth");
    const promptIndex = args.indexOf("--append-system-prompt") + 1;
    assert.equal(fs.readFileSync(args[promptIndex], "utf8"), "You are explorer.");
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("buildPiArgs lets agent model override inherited model", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pi-subagent-test-"));
  try {
    const args = buildPiArgs({
      name: "general",
      model: "openrouter/moonshotai/kimi-k2.6",
    }, "Review auth", tmp, { provider: "anthropic", id: "claude-sonnet-4-5" });
    const modelIndex = args.indexOf("--model") + 1;
    assert.equal(args[modelIndex], "openrouter/moonshotai/kimi-k2.6");
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("runSubagent reports spawn errors as failures", async () => {
  const result = await runSubagent({
    id: "spawn-error",
    agent: { name: "general" },
    task: "hello",
    spawnResolver: () => ({ command: "/definitely/not/pi", prefixArgs: [] }),
  });

  assert.equal(result.status, "failed");
  assert.equal(result.exitCode, 1);
  assert.match(result.errorMessage ?? "", /ENOENT|not\/pi/);
  assert.match(result.stderr, /ENOENT|not\/pi/);
});

test("runSubagent reports synchronous spawn throws as failures", async () => {
  const result = await runSubagent({
    id: "spawn-throw",
    agent: { name: "general" },
    task: "hello",
    cwd: `/tmp/${String.fromCharCode(0)}bad`,
    spawnResolver: () => ({ command: process.execPath, prefixArgs: [] }),
  });

  assert.equal(result.status, "failed");
  assert.equal(result.exitCode, 1);
  assert.match(result.errorMessage ?? "", /cwd|null bytes|ERR_INVALID_ARG_VALUE/);
  assert.match(result.stderr, /cwd|null bytes|ERR_INVALID_ARG_VALUE/);
});

test("runSubagent caps stderr from child processes", async () => {
  const result = await runSubagent({
    id: "stderr-cap",
    agent: { name: "general" },
    task: "hello",
    spawnResolver: () => ({
      command: process.execPath,
      prefixArgs: ["-e", `process.stderr.write("x".repeat(${STDERR_CAP + 1024})); process.exit(1);`, "--"],
    }),
  });

  assert.equal(result.status, "failed");
  assert.ok(Buffer.byteLength(result.stderr, "utf8") <= STDERR_CAP);
  assert.match(result.stderr, /stderr truncated/);
});

test("runSubagent fails when child emits non-JSON stdout", async () => {
  const result = await runSubagent({
    id: "non-json-stdout",
    agent: { name: "general" },
    task: "hello",
    spawnResolver: () => ({
      command: process.execPath,
      prefixArgs: ["-e", "process.stdout.write('not json\\n'); process.exit(0);", "--"],
    }),
  });

  assert.equal(result.status, "failed");
  assert.equal(result.exitCode, 0);
  assert.equal(result.stopReason, "error");
  assert.equal(result.ignoredStdoutBytes, Buffer.byteLength("not json\n"));
  assert.match(result.errorMessage ?? "", /child pi emitted non-JSON stdout output/i);
  assert.match(result.stderr, /child pi emitted non-JSON stdout output/i);
});

test("runSubagent fails when child exits successfully without assistant output", async () => {
  const result = await runSubagent({
    id: "no-assistant-output",
    agent: { name: "general" },
    task: "hello",
    spawnResolver: () => ({
      command: process.execPath,
      prefixArgs: ["-e", "process.exit(0);", "--"],
    }),
  });

  assert.equal(result.status, "failed");
  assert.equal(result.exitCode, 0);
  assert.equal(result.stopReason, "error");
  assert.match(result.errorMessage ?? "", /produced no assistant output/);
  assert.match(result.stderr, /produced no assistant output/);
});

test("runSubagent treats non-abort signal termination as failure", async () => {
  const result = await runSubagent({
    id: "signal-close",
    agent: { name: "general" },
    task: "hello",
    spawnResolver: () => ({
      command: process.execPath,
      prefixArgs: ["-e", "setTimeout(() => process.kill(process.pid, 'SIGTERM'), 10); setTimeout(() => {}, 10_000);", "--"],
    }),
  });

  assert.equal(result.status, "failed");
  assert.equal(result.exitCode, 1);
  assert.equal(result.errorMessage, "Child pi was terminated by signal SIGTERM.");
  assert.match(result.stderr, /SIGTERM/);
});
