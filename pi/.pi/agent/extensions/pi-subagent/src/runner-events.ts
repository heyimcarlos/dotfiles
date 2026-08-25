import { emptyUsage, type PiMessageLike, type SubagentResult } from "./types.ts";
import { ERROR_MESSAGE_CAP, MAX_MESSAGES, MESSAGE_TEXT_CAP, STORED_OUTPUT_CAP } from "./limits.ts";
import { capUtf8String } from "./text-utils.ts";

interface TextLikeContentPart {
  type?: unknown;
  text?: unknown;
}

/** Usage fields have changed names across providers and pi versions. */
interface UsageLike {
  input?: unknown;
  inputTokens?: unknown;
  output?: unknown;
  outputTokens?: unknown;
  cacheRead?: unknown;
  cacheReadInputTokens?: unknown;
  cacheWrite?: unknown;
  cacheCreationInputTokens?: unknown;
  cost?: unknown;
  totalTokens?: unknown;
  contextTokens?: unknown;
}

interface PiJsonEvent {
  type?: unknown;
  message?: PiMessageLike;
  messages?: PiMessageLike[];
  isError?: unknown;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? value as Record<string, unknown> : undefined;
}

export function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part: unknown) => {
      if (typeof part === "string") return part;
      const item = part as TextLikeContentPart | null;
      if (item && typeof item === "object" && item.type === "text" && typeof item.text === "string") return item.text;
      return "";
    })
    .join("");
}

export function getFinalAssistantText(messages: readonly PiMessageLike[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg?.role !== "assistant") continue;
    const text = extractText(msg.content).trim();
    if (text) return text;
  }
  return "";
}

function usageNumber(value: unknown): number {
  return Number(value) || 0;
}

function capped(value: string, cap: number, label: string): string {
  return capUtf8String(value, cap, `\n[${label} truncated]`).text;
}

function capTextContent(value: string): string {
  return capped(value, MESSAGE_TEXT_CAP, "message text");
}

function sanitizeContent(content: unknown): unknown {
  if (typeof content === "string") return capTextContent(content);
  if (!Array.isArray(content)) return undefined;

  return content.slice(0, 20).map((part: unknown) => {
    if (typeof part === "string") return capTextContent(part);
    const item = asRecord(part);
    if (!item) return {};
    const type = typeof item.type === "string" ? item.type : undefined;
    if (type === "text" && typeof item.text === "string") return { type, text: capTextContent(item.text) };
    return type ? { type } : {};
  });
}

function compactUsage(usage: unknown): UsageLike | undefined {
  const item = asRecord(usage) as UsageLike | undefined;
  if (!item) return undefined;
  const cost = asRecord(item.cost);
  return {
    input: usageNumber(item.input ?? item.inputTokens),
    output: usageNumber(item.output ?? item.outputTokens),
    cacheRead: usageNumber(item.cacheRead ?? item.cacheReadInputTokens),
    cacheWrite: usageNumber(item.cacheWrite ?? item.cacheCreationInputTokens),
    cost: usageNumber(cost?.total ?? item.cost),
    contextTokens: usageNumber(item.totalTokens ?? item.contextTokens),
  };
}

function sanitizeMessage(message: PiMessageLike): PiMessageLike {
  const sanitized: PiMessageLike = {};
  if (typeof message.role === "string") sanitized.role = capped(message.role, 40, "role");
  const content = sanitizeContent(message.content);
  if (content !== undefined) sanitized.content = content;
  const usage = compactUsage(message.usage);
  if (usage) sanitized.usage = usage;
  if (typeof message.model === "string") sanitized.model = capped(message.model, 200, "model");
  if (typeof message.stopReason === "string") sanitized.stopReason = capped(message.stopReason, 80, "stop reason");
  if (typeof message.errorMessage === "string") sanitized.errorMessage = capped(message.errorMessage, ERROR_MESSAGE_CAP, "error message");
  return sanitized;
}

function pushMessage(result: SubagentResult, message: PiMessageLike): void {
  result.messages.push(sanitizeMessage(message));
  if (result.messages.length > MAX_MESSAGES) result.messages.splice(0, result.messages.length - MAX_MESSAGES);
}

function addUsage(result: SubagentResult, message: PiMessageLike): void {
  const usage = asRecord(message.usage) as UsageLike | undefined;
  if (!usage) return;
  const cost = asRecord(usage.cost);

  // Accept both compact names from pi internals and token-style names from
  // provider payloads. Missing fields are normal for aborted or failed streams.
  result.usage.input += usageNumber(usage.input ?? usage.inputTokens);
  result.usage.output += usageNumber(usage.output ?? usage.outputTokens);
  result.usage.cacheRead += usageNumber(usage.cacheRead ?? usage.cacheReadInputTokens);
  result.usage.cacheWrite += usageNumber(usage.cacheWrite ?? usage.cacheCreationInputTokens);
  result.usage.cost += usageNumber(cost?.total ?? usage.cost);
  result.usage.contextTokens = usageNumber(usage.totalTokens ?? usage.contextTokens ?? result.usage.contextTokens) || result.usage.contextTokens;
}

function addAssistantMessageMetadata(result: SubagentResult, message: PiMessageLike): void {
  result.usage.turns += 1;
  addUsage(result, message);
  if (!result.model && typeof message.model === "string") result.model = capped(message.model, 200, "model");
  if (typeof message.stopReason === "string") result.stopReason = capped(message.stopReason, 80, "stop reason");
  if (typeof message.errorMessage === "string") result.errorMessage = capped(message.errorMessage, ERROR_MESSAGE_CAP, "error message");

  const text = extractText(message.content).trim();
  if (text) result.output = capped(text, STORED_OUTPUT_CAP, "subagent output");
}

export function processPiJsonEvent(result: SubagentResult, event: unknown): boolean {
  const item = asRecord(event) as PiJsonEvent | undefined;
  if (!item) return false;

  if (item.type === "message_end" && item.message) {
    const message = item.message;
    pushMessage(result, message);
    if (message.role === "assistant") addAssistantMessageMetadata(result, message);
    return true;
  }

  if (item.type === "agent_end" && Array.isArray(item.messages)) {
    // Some JSON-mode versions only include final messages on agent_end. Prefer
    // message_end events when present because they carry incremental usage too.
    if (result.messages.length === 0) {
      for (const message of item.messages) {
        pushMessage(result, message);
        if (message.role === "assistant") addAssistantMessageMetadata(result, message);
      }
    }
    return true;
  }

  if (item.type === "tool_execution_end" && item.isError) {
    result.stopReason = result.stopReason ?? "tool_error";
    return true;
  }

  return false;
}

export function createInitialResult({ id, agent, label, task }: {
  id: string;
  agent: string;
  label?: string;
  task: string;
}): SubagentResult {
  return {
    id,
    agent,
    label,
    task,
    status: "running",
    exitCode: -1,
    messages: [],
    output: "",
    stderr: "",
    usage: emptyUsage(),
    startedAt: Date.now(),
    completedAt: undefined,
  };
}
