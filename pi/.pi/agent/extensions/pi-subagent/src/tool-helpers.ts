import { FINAL_TEXT_OUTPUT_CAP, LABEL_MAX_LENGTH, MAX_TASKS, TASK_TEXT_MAX_LENGTH } from "./limits.ts";
import { capUtf8String } from "./text-utils.ts";
import { isResultError, type SubagentResult } from "./types.ts";
import type { SubagentParamsInput } from "./schema.ts";

export function truncateOutput(output: string, cap = FINAL_TEXT_OUTPUT_CAP): string {
  return capUtf8String(output, cap, "\n\n[Subagent output truncated. Stored details are also size-limited.]").text;
}

export function resultText(result: Pick<SubagentResult, "output" | "stderr" | "errorMessage">): string {
  return result.output || result.errorMessage || result.stderr || "(no output)";
}

export function formatFinalText(results: readonly SubagentResult[]): string {
  const succeeded = results.filter((result) => !isResultError(result)).length;

  // The final text is intentionally self-contained for JSON/print modes and for
  // transcript readers that do not replay the custom renderer details.
  const sections = results.map((result) => {
    const label = result.label ? ` ${result.label}` : "";
    const status = isResultError(result) ? `failed${result.errorMessage ? `: ${result.errorMessage}` : ""}` : "completed";
    return `## ${result.agent}${label} — ${status}\n\n${truncateOutput(resultText(result))}`;
  });
  return `Subagents completed: ${succeeded}/${results.length} succeeded\n\n${sections.join("\n\n---\n\n")}`;
}

function validTaskText(task: string | undefined): boolean {
  const length = task?.trim().length ?? 0;
  return length > 0 && length <= TASK_TEXT_MAX_LENGTH;
}

export function validateMode(params: SubagentParamsInput): string | undefined {
  const hasSingle = Boolean(params.agent || params.task !== undefined);
  const hasParallel = Array.isArray(params.tasks) && params.tasks.length > 0;
  if (hasSingle && hasParallel) return "Provide either agent+task or tasks[], not both.";
  if (!hasSingle && !hasParallel) return "Provide either agent+task or tasks[].";
  if (hasSingle && (!params.agent || params.task === undefined)) return "Single mode requires both agent and task.";
  if (hasSingle && !validTaskText(params.task)) return `Task must be non-empty and at most ${TASK_TEXT_MAX_LENGTH} characters.`;
  if (hasParallel && (params.tasks?.length ?? 0) > MAX_TASKS) return `Too many tasks (${params.tasks?.length ?? 0}). Maximum is ${MAX_TASKS}.`;

  if (hasParallel) {
    const invalidIndex = params.tasks?.findIndex((task) => !validTaskText(task.task)) ?? -1;
    if (invalidIndex !== -1) return `Task ${invalidIndex + 1} must be non-empty and at most ${TASK_TEXT_MAX_LENGTH} characters.`;
    const longLabelIndex = params.tasks?.findIndex((task) => (task.label?.length ?? 0) > LABEL_MAX_LENGTH) ?? -1;
    if (longLabelIndex !== -1) return `Task ${longLabelIndex + 1} label must be at most ${LABEL_MAX_LENGTH} characters.`;
  }

  return undefined;
}
