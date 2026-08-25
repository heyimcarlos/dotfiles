import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { ERROR_MESSAGE_CAP, STDERR_CAP, STDOUT_LINE_CAP, UPDATE_THROTTLE_MS } from "./limits.ts";
import { resolvePiSpawn, type PiSpawnResolver } from "./pi-spawn.ts";
import { createInitialResult, processPiJsonEvent } from "./runner-events.ts";
import { appendCappedUtf8, capUtf8String } from "./text-utils.ts";
import type { AgentRunConfig, SubagentResult } from "./types.ts";

const SIGKILL_TIMEOUT_MS = 5000;
const TASK_ARG_LIMIT = 8000;
const NON_JSON_STDOUT_SAMPLE_CAP = 500;

const CHILD_ENV_ALLOWLIST = new Set([
  "HOME",
  "PATH",
  "TMPDIR",
  "TEMP",
  "TMP",
  "LANG",
  "LC_ALL",
  "TERM",
  "NO_COLOR",
  "FORCE_COLOR",
  "SSL_CERT_FILE",
  "SSL_CERT_DIR",
  "NODE_EXTRA_CA_CERTS",
  "PI_CODING_AGENT_DIR",
  "PI_CODING_AGENT_SESSION_DIR",
  "PI_PACKAGE_DIR",
  "PI_OFFLINE",
  "PI_SKIP_VERSION_CHECK",
  "PI_TELEMETRY",
  "PI_CACHE_RETENTION",
  "PI_SHARE_VIEWER_URL",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "NO_PROXY",
  "http_proxy",
  "https_proxy",
  "no_proxy",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_OAUTH_TOKEN",
  "GOOGLE_API_KEY",
  "GOOGLE_APPLICATION_CREDENTIALS",
  "GEMINI_API_KEY",
  "GROQ_API_KEY",
  "OPENROUTER_API_KEY",
  "DEEPSEEK_API_KEY",
  "MOONSHOT_API_KEY",
  "MISTRAL_API_KEY",
  "COHERE_API_KEY",
  "XAI_API_KEY",
  "CEREBRAS_API_KEY",
  "CLOUDFLARE_API_KEY",
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_GATEWAY_ID",
  "AI_GATEWAY_API_KEY",
  "ZAI_API_KEY",
  "OPENCODE_API_KEY",
  "FIREWORKS_API_KEY",
  "TOGETHER_API_KEY",
  "KIMI_API_KEY",
  "MINIMAX_API_KEY",
  "MINIMAX_CN_API_KEY",
  "XIAOMI_API_KEY",
  "XIAOMI_TOKEN_PLAN_CN_API_KEY",
  "XIAOMI_TOKEN_PLAN_AMS_API_KEY",
  "XIAOMI_TOKEN_PLAN_SGP_API_KEY",
  "OLLAMA_HOST",
  "OLLAMA_API_KEY",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_SESSION_TOKEN",
  "AWS_BEARER_TOKEN_BEDROCK",
  "AWS_REGION",
  "AWS_DEFAULT_REGION",
  "AWS_PROFILE",
  "AZURE_OPENAI_API_KEY",
  "AZURE_OPENAI_ENDPOINT",
  "AZURE_OPENAI_BASE_URL",
  "AZURE_OPENAI_RESOURCE_NAME",
  "AZURE_OPENAI_API_VERSION",
  "AZURE_OPENAI_DEPLOYMENT_NAME_MAP",
]);

export interface CurrentModelReference {
  provider: string;
  id: string;
}

export interface RunSubagentInput {
  id: string;
  agent: AgentRunConfig;
  label?: string;
  task: string;
  cwd?: string;
  currentModel?: CurrentModelReference;
  signal?: AbortSignal;
  onUpdate?: (result: SubagentResult) => void;
  spawnResolver?: PiSpawnResolver;
}

export function buildTaskPrompt(task: string): string {
  return `Task: ${task}`;
}

export function buildChildEnv(source: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const key of CHILD_ENV_ALLOWLIST) {
    const value = source[key];
    if (value !== undefined) env[key] = value;
  }
  env.PI_SUBAGENT_CHILD = "1";
  return env;
}

function safeStem(value: string): string {
  return value.replace(/[^\w.-]+/g, "_").slice(0, 80) || "subagent";
}

function writeTempFile(dir: string, name: string, content: string): string {
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, content, { encoding: "utf8", mode: 0o600 });
  return filePath;
}

function modelReference(model: CurrentModelReference | undefined): string | undefined {
  if (!model?.provider.trim() || !model.id.trim()) return undefined;
  return `${model.provider}/${model.id}`;
}

export function buildPiArgs(agent: AgentRunConfig, task: string, tempDir: string, currentModel?: CurrentModelReference): string[] {
  // Fork change: children discover extensions (no --no-extensions) so that
  // provider auth registered by extensions (e.g. pi-anthropic-auth) works and
  // child usage bills as subscription. Nesting is prevented by the
  // PI_SUBAGENT_CHILD guard in index.ts instead.
  const args = ["--mode", "json", "-p", "--no-session"];

  const selectedModel = agent.model || modelReference(currentModel);
  if (selectedModel) args.push("--model", selectedModel);
  if (agent.thinking) args.push("--thinking", agent.thinking);
  if (agent.tools?.length) args.push("--tools", agent.tools.join(","));

  if (agent.systemPrompt?.trim()) {
    // Append role prompts so Pi keeps its default tool descriptions and
    // guidelines. Use a file so long prompts avoid argv limits and process lists.
    const promptPath = writeTempFile(tempDir, `prompt-${safeStem(agent.name)}.md`, agent.systemPrompt);
    args.push("--append-system-prompt", promptPath);
  }

  const taskPrompt = buildTaskPrompt(task);
  if (taskPrompt.length > TASK_ARG_LIMIT) {
    // Pi expands @file arguments before sending the prompt, so large delegated
    // tasks can use the same path-based input mechanism as normal CLI runs.
    const taskPath = writeTempFile(tempDir, "task.md", taskPrompt);
    args.push(`@${taskPath}`);
  } else {
    args.push(taskPrompt);
  }

  return args;
}

function snapshotResult(result: SubagentResult, includeMessages: boolean): SubagentResult {
  return {
    ...result,
    messages: includeMessages ? [...result.messages] : [],
    usage: { ...result.usage },
  };
}

export async function runSubagent({
  id,
  agent,
  label,
  task,
  cwd,
  currentModel,
  signal,
  onUpdate,
  spawnResolver = resolvePiSpawn,
}: RunSubagentInput): Promise<SubagentResult> {
  const result = createInitialResult({ id, agent: agent.name, label, task });
  let tempDir: string | undefined;
  let abortHandler: (() => void) | undefined;
  let killTimer: NodeJS.Timeout | undefined;
  let updateTimer: NodeJS.Timeout | undefined;
  let lastUpdateAt = 0;

  const emitUpdate = (options: { force?: boolean; includeMessages?: boolean } = {}): void => {
    if (!onUpdate) return;
    const send = (): void => {
      if (updateTimer) {
        clearTimeout(updateTimer);
        updateTimer = undefined;
      }
      lastUpdateAt = Date.now();
      onUpdate(snapshotResult(result, Boolean(options.includeMessages)));
    };

    if (options.force) {
      send();
      return;
    }

    const elapsed = Date.now() - lastUpdateAt;
    if (elapsed >= UPDATE_THROTTLE_MS) {
      send();
      return;
    }

    updateTimer ??= setTimeout(send, UPDATE_THROTTLE_MS - elapsed);
  };

  const appendError = (message: string): void => {
    const cappedMessage = capUtf8String(message, ERROR_MESSAGE_CAP, "\n[error message truncated]").text;
    result.errorMessage = cappedMessage;
    if (!result.stderr.includes(cappedMessage)) {
      result.stderr = appendCappedUtf8(result.stderr, cappedMessage, STDERR_CAP, "\n[stderr truncated]").text;
    }
  };

  try {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-subagent-"));
    const piArgs = buildPiArgs(agent, task, tempDir, currentModel);
    const invocation = spawnResolver();
    const child = spawn(invocation.command, [...invocation.prefixArgs, ...piArgs], {
      cwd,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      env: buildChildEnv(),
    });

    emitUpdate({ force: true });

    let stdoutBuffer = "";
    let ignoredStdoutBytes = 0;
    let ignoredStdoutSample = "";
    let closed = false;

    const terminateChild = (): void => {
      child.kill("SIGTERM");
      killTimer ??= setTimeout(() => {
        if (!closed) child.kill("SIGKILL");
      }, SIGKILL_TIMEOUT_MS);
    };

    const recordIgnoredStdout = (text: string): void => {
      const bytes = Buffer.byteLength(text, "utf8");
      ignoredStdoutBytes += bytes;
      result.ignoredStdoutBytes = ignoredStdoutBytes;
      if (ignoredStdoutSample.length < NON_JSON_STDOUT_SAMPLE_CAP) {
        ignoredStdoutSample = capUtf8String(ignoredStdoutSample + text, NON_JSON_STDOUT_SAMPLE_CAP, "").text;
      }
    };

    const hasAssistantOutputOrMessage = (): boolean => {
      return Boolean(result.output.trim()) || result.messages.some((message) => message.role === "assistant");
    };

    const nonJsonStdoutMessage = (): string => {
      const sample = ignoredStdoutSample ? ` First bytes: ${JSON.stringify(ignoredStdoutSample)}` : "";
      return `Child pi emitted non-JSON stdout output: ${ignoredStdoutBytes} bytes ignored.${sample}`;
    };

    const processLine = (line: string, rawText = line): void => {
      if (!line.trim()) return;
      let event: unknown;
      try {
        event = JSON.parse(line);
      } catch {
        recordIgnoredStdout(rawText);
        return;
      }
      if (processPiJsonEvent(result, event)) emitUpdate();
    };

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdoutBuffer += chunk.toString();

      let newlineIndex = stdoutBuffer.indexOf("\n");
      while (newlineIndex !== -1) {
        const line = stdoutBuffer.slice(0, newlineIndex);
        stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
        processLine(line, `${line}\n`);
        newlineIndex = stdoutBuffer.indexOf("\n");
      }

      if (Buffer.byteLength(stdoutBuffer, "utf8") > STDOUT_LINE_CAP) {
        result.stopReason = "error";
        appendError(`Child pi emitted a JSON line larger than ${STDOUT_LINE_CAP} bytes.`);
        stdoutBuffer = "";
        terminateChild();
        emitUpdate({ force: true });
      }
    });

    child.stderr.on("data", (chunk: Buffer | string) => {
      result.stderr = appendCappedUtf8(result.stderr, chunk.toString(), STDERR_CAP, "\n[stderr truncated]").text;
      emitUpdate();
    });

    const exitCode = await new Promise<number>((resolve) => {
      let settled = false;

      const finish = (code: number): void => {
        if (settled) return;
        settled = true;
        resolve(code);
      };

      child.on("error", (error: Error) => {
        appendError(error instanceof Error ? error.message : String(error));
        finish(1);
      });

      child.on("close", (code: number | null, signalName: NodeJS.Signals | null) => {
        closed = true;
        if (settled) return;

        // JSON streams can end without a trailing newline; process the final
        // buffered event before deriving status/output.
        if (stdoutBuffer.trim()) processLine(stdoutBuffer);

        if (code !== null) {
          finish(code);
          return;
        }

        if (result.status === "aborted") {
          finish(1);
          return;
        }

        if (!result.errorMessage) {
          appendError(
            signalName
              ? `Child pi was terminated by signal ${signalName}.`
              : "Child pi exited without an exit code.",
          );
        }
        finish(1);
      });

      abortHandler = () => {
        result.status = "aborted";
        result.stopReason = "aborted";
        result.errorMessage = "Subagent was aborted.";
        terminateChild();
        emitUpdate({ force: true });
      };

      if (signal?.aborted) abortHandler();
      else signal?.addEventListener("abort", abortHandler, { once: true });
    });

    result.exitCode = exitCode;
    result.completedAt = Date.now();
    if (result.status !== "aborted") {
      if (ignoredStdoutBytes > 0) {
        result.stopReason = "error";
        appendError(nonJsonStdoutMessage());
      }
      if (exitCode === 0 && result.stopReason !== "error" && !hasAssistantOutputOrMessage()) {
        result.stopReason = "error";
        appendError("Child pi exited successfully but produced no assistant output.");
      }
      result.status = exitCode === 0 && result.stopReason !== "error" ? "completed" : "failed";
      if (result.status === "failed" && !result.errorMessage) {
        result.errorMessage = capUtf8String(result.stderr.trim() || `Child pi exited with code ${exitCode}.`, ERROR_MESSAGE_CAP, "\n[error message truncated]").text;
      }
    }
    emitUpdate({ force: true, includeMessages: true });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result.status = result.status === "aborted" ? "aborted" : "failed";
    result.exitCode = 1;
    result.completedAt = Date.now();
    appendError(message);
    emitUpdate({ force: true, includeMessages: true });
    return result;
  } finally {
    if (abortHandler) signal?.removeEventListener("abort", abortHandler);
    if (killTimer) clearTimeout(killTimer);
    if (updateTimer) clearTimeout(updateTimer);
    if (tempDir) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // Best effort cleanup.
      }
    }
  }
}
