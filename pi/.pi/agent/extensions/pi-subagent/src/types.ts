export const AGENT_NAMES = ["explorer", "general"] as const;

export type AgentName = (typeof AGENT_NAMES)[number];

/** Runtime configuration loaded from an agent markdown file. */
export interface AgentRunConfig {
  name: string;
  description?: string;
  tools?: string[];
  model?: string;
  thinking?: string;
  systemPrompt?: string;
  filePath?: string;
}

/** Built-in roles are fixed at compile time; only their prompts live in markdown. */
export interface BuiltInAgent extends AgentRunConfig {
  name: AgentName;
  description: string;
  tools: string[];
  systemPrompt: string;
  filePath: string;
}

/** Token/cost counters aggregated from child pi JSON events when available. */
export interface UsageStats {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cost: number;
  contextTokens: number;
  turns: number;
}

export type SubagentStatus = "pending" | "running" | "completed" | "failed" | "aborted";

/**
 * Minimal shape consumed from pi JSON-mode messages.
 *
 * The child process owns the full message schema. The extension keeps this loose
 * so older/newer pi versions can add fields without breaking result parsing.
 */
export interface PiMessageLike {
  role?: string;
  content?: unknown;
  usage?: unknown;
  model?: unknown;
  stopReason?: unknown;
  errorMessage?: unknown;
  [key: string]: unknown;
}

/**
 * Stable details object stored on tool updates and final tool results.
 *
 * Renderers use this for the compact status view, while the text content remains
 * safe to show in transcript/export modes that do not render custom components.
 */
export interface SubagentResult {
  id: string;
  agent: string;
  label?: string;
  task: string;
  status: SubagentStatus;
  exitCode: number;
  messages: PiMessageLike[];
  output: string;
  stderr: string;
  ignoredStdoutBytes?: number;
  usage: UsageStats;
  startedAt: number;
  completedAt?: number;
  model?: string;
  stopReason?: string;
  errorMessage?: string;
}

export interface CreateResultInput {
  id: string;
  agent: string;
  label?: string;
  task: string;
  startedAt?: number;
}

export function emptyUsage(): UsageStats {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    cost: 0,
    contextTokens: 0,
    turns: 0,
  };
}

export function createPendingResult({ id, agent, label, task, startedAt = Date.now() }: CreateResultInput): SubagentResult {
  return {
    id,
    agent,
    label,
    task,
    status: "pending",
    exitCode: -1,
    messages: [],
    output: "",
    stderr: "",
    usage: emptyUsage(),
    startedAt,
    completedAt: undefined,
  };
}

export function isResultError(result: { status?: SubagentStatus; exitCode?: number }): boolean {
  return result.status === "failed" || result.status === "aborted" || result.exitCode !== 0;
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "0ms";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return `${minutes}m${seconds}s`;
}

export function formatTokens(count: number): string {
  if (!count) return "0";
  if (count < 1000) return String(count);
  if (count < 10_000) return `${(count / 1000).toFixed(1)}k`;
  if (count < 1_000_000) return `${Math.round(count / 1000)}k`;
  return `${(count / 1_000_000).toFixed(1)}M`;
}
