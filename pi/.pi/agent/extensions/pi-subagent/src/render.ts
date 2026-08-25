import { Text } from "@earendil-works/pi-tui";
import type { AgentToolResult, ToolRenderResultOptions } from "@earendil-works/pi-coding-agent";
import { MAX_RENDER_OUTPUT_LINES } from "./limits.ts";
import type { SubagentDetails, SubagentParamsInput } from "./schema.ts";
import { firstLines, stripTerminalControl } from "./text-utils.ts";
import { formatDuration, formatTokens, isResultError, type SubagentResult } from "./types.ts";

type ThemeLike = {
  fg(color: "accent" | "dim" | "error" | "success" | "toolTitle" | "warning", text: string): string;
  bold(text: string): string;
};

function clean(value: string): string {
  return stripTerminalControl(value);
}

function summarizeArgs(args: SubagentParamsInput): string {
  if (Array.isArray(args?.tasks)) {
    const labels = args.tasks.map((task) => clean(task.label || task.agent)).join(", ");
    return `${args.tasks.length} tasks: ${labels}`;
  }
  if (args?.agent) return `${clean(args.agent)}: ${clean(String(args.task ?? "")).slice(0, 80)}`;
  return "subagent";
}

export function renderCall(args: SubagentParamsInput, theme: ThemeLike): Text {
  return new Text(`${theme.fg("toolTitle", theme.bold("subagent"))} ${theme.fg("dim", summarizeArgs(args))}`, 0, 0);
}

function renderResultLine(result: SubagentResult, theme: ThemeLike): string {
  const icon = result.status === "running" ? "▸" : isResultError(result) ? "✗" : "✓";
  const color = result.status === "running" ? "warning" : isResultError(result) ? "error" : "success";
  const label = result.label ? `${clean(result.label)} ` : "";
  const elapsed = (result.completedAt ?? Date.now()) - result.startedAt;
  const totalTokens = result.usage.input + result.usage.output + result.usage.cacheRead + result.usage.cacheWrite;
  const stats: string[] = [];
  if (elapsed > 0) stats.push(formatDuration(elapsed));
  if (totalTokens > 0) stats.push(`${formatTokens(totalTokens)} tok`);
  if (result.usage.cost > 0) stats.push(`$${result.usage.cost.toFixed(4)}`);
  return `${theme.fg(color, icon)} ${theme.bold(label + clean(result.agent))} ${theme.fg("dim", clean(result.status))}${stats.length ? theme.fg("dim", ` · ${stats.join(" · ")}`) : ""}`;
}

export function renderResult(
  result: AgentToolResult<SubagentDetails>,
  { expanded, isPartial }: ToolRenderResultOptions,
  theme: ThemeLike,
): Text {
  const details = result?.details;
  const results = Array.isArray(details?.results) ? details.results : [];
  if (results.length === 0) {
    return new Text(theme.fg(isPartial ? "warning" : "dim", isPartial ? "subagents running..." : "No subagent results."), 0, 0);
  }

  const lines = results.map((item) => renderResultLine(item, theme));
  if (expanded && !isPartial) {
    // Keep the default view compact during streaming. Full-ish outputs are only
    // shown after completion and only when the user explicitly expands the tool.
    for (const item of results) {
      const output = clean(item.output || item.errorMessage || item.stderr || "");
      if (!output.trim()) continue;
      lines.push("");
      lines.push(theme.fg("accent", `# ${clean(item.label || item.agent)}`));
      lines.push(...firstLines(output, MAX_RENDER_OUTPUT_LINES).map((line) => theme.fg("dim", line)));
    }
  }
  return new Text(lines.join("\n"), 0, 0);
}
