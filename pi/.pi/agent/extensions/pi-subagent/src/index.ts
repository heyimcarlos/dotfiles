import type { AgentToolResult, AgentToolUpdateCallback, ExtensionAPI, ToolDefinition } from "@earendil-works/pi-coding-agent";
import { loadBuiltInAgents, describeAgents } from "./agents.ts";
import { getMaxConcurrency } from "./config.ts";
import { mapConcurrent } from "./concurrency.ts";
import { renderCall, renderResult } from "./render.ts";
import { runSubagent } from "./runner.ts";
import { SubagentParams, type SubagentDetails, type SubagentParamsInput } from "./schema.ts";
import { createPendingResult, isResultError, type SubagentResult } from "./types.ts";
import { formatFinalText, resultText, validateMode } from "./tool-helpers.ts";

type SubagentToolResult = AgentToolResult<SubagentDetails> & { isError?: boolean };
type SubagentUpdate = AgentToolUpdateCallback<SubagentDetails>;

function makeId(index: number): string {
  return `sg_${Date.now().toString(36)}_${index.toString(36)}`;
}

function makeDetails(mode: SubagentDetails["mode"], results: SubagentResult[]): SubagentDetails {
  return { mode, results };
}

function makeUpdateResult(result: SubagentResult): SubagentResult {
  return {
    ...result,
    task: "",
    messages: [],
    output: "",
    stderr: "",
    usage: { ...result.usage },
  };
}

function makeUpdateDetails(mode: SubagentDetails["mode"], results: SubagentResult[]): SubagentDetails {
  return makeDetails(mode, results.map(makeUpdateResult));
}

function makeUpdateText(result: Pick<SubagentResult, "agent" | "label" | "status">): string {
  const label = result.label ? ` ${result.label}` : "";
  return `${result.agent}${label} ${result.status}...`;
}

export default function registerSubagent(pi: ExtensionAPI): void {
  // Fork change: children load extensions (including this one), so block the
  // tool in child processes to prevent unbounded subagent nesting.
  if (process.env.PI_SUBAGENT_CHILD === "1") return;

  const agents = loadBuiltInAgents();

  const tool: ToolDefinition<typeof SubagentParams, SubagentDetails> = {
    name: "subagent",
    label: "Subagent",
    description: [
      "Run focused subagents in isolated child Pi processes and wait for their results.",
      `Available roles: ${describeAgents(agents)}.`,
      "Use subagent for independent, context-heavy exploration or parallel evidence-backed analysis.",
      "Do not use subagent for simple direct reads, trivial edits, or tasks needing frequent user interaction.",
      "For parallel review, pass tasks[] with clear labels and independent perspectives such as security, performance, and conventions.",
      "Subagents are not authoritative by themselves; synthesize their evidence before reporting conclusions.",
    ].join(" "),
    promptSnippet: "Delegate independent exploration or analysis to explorer/general subagents",
    promptGuidelines: [
      "Use subagent only when the delegated work is independent, context-heavy, or benefits from parallel evidence gathering.",
      "Do not call subagent for simple file reads, exact grep lookups, typo fixes, or work the main agent can do directly in a few tool calls.",
      "When using subagent with tasks[], make each task self-contained and assign a distinct perspective or scope.",
      "After subagent returns, synthesize evidence yourself; do not blindly forward or majority-vote subagent opinions.",
    ],
    parameters: SubagentParams,
    renderCall,
    renderResult,

    async execute(_toolCallId, params: SubagentParamsInput, signal, onUpdate: SubagentUpdate | undefined, ctx): Promise<SubagentToolResult> {
      const modeError = validateMode(params);
      if (modeError) {
        throw new Error(modeError);
      }

      if (params.agent && params.task) {
        const agent = agents.get(params.agent);
        if (!agent) throw new Error(`Unknown subagent: ${params.agent}`);
        const id = makeId(0);
        const pending = createPendingResult({ id, agent: params.agent, task: params.task });
        onUpdate?.({
          content: [{ type: "text", text: `Running ${params.agent}...` }],
          details: makeDetails("single", [pending]),
        });
        const result = await runSubagent({
          id,
          agent,
          task: params.task,
          cwd: params.cwd ?? ctx.cwd,
          currentModel: ctx.model,
          signal,
          onUpdate: (updated) => onUpdate?.({
            content: [{ type: "text", text: makeUpdateText(updated) }],
            details: makeUpdateDetails("single", [updated]),
          }),
        });
        const details = makeDetails("single", [result]);
        if (isResultError(result)) {
          return {
            content: [{ type: "text", text: `Subagent ${result.agent} failed: ${resultText(result)}` }],
            details,
            isError: true,
          };
        }
        return {
          content: [{ type: "text", text: resultText(result) }],
          details,
        };
      }

      const taskItems = params.tasks ?? [];

      // Pre-seed details in input order so progress updates do not jump around
      // while bounded-concurrency workers finish at different times.
      const results = taskItems.map((task, index) => createPendingResult({
        id: makeId(index),
        agent: task.agent,
        label: task.label,
        task: task.task,
      }));

      const emitParallelUpdate = (): void => {
        const done = results.filter((result) => result.status === "completed" || result.status === "failed" || result.status === "aborted").length;
        onUpdate?.({
          content: [{ type: "text", text: `Subagents: ${done}/${results.length} finished.` }],
          details: makeUpdateDetails("parallel", results),
        });
      };
      emitParallelUpdate();

      const completed = await mapConcurrent(taskItems, getMaxConcurrency(), async (task, index) => {
        const agent = agents.get(task.agent);
        if (!agent) {
          const failed: SubagentResult = {
            ...results[index],
            status: "failed",
            exitCode: 1,
            errorMessage: `Unknown subagent: ${task.agent}`,
            completedAt: Date.now(),
          };
          results[index] = failed;
          emitParallelUpdate();
          return failed;
        }

        results[index] = { ...results[index], status: "running", startedAt: Date.now() };
        emitParallelUpdate();
        const result = await runSubagent({
          id: results[index].id,
          agent,
          label: task.label,
          task: task.task,
          cwd: task.cwd ?? ctx.cwd,
          currentModel: ctx.model,
          signal,
          onUpdate: (updated) => {
            results[index] = updated;
            emitParallelUpdate();
          },
        });
        results[index] = result;
        emitParallelUpdate();
        return result;
      });

      const details = makeDetails("parallel", completed);
      return {
        content: [{ type: "text", text: formatFinalText(completed) }],
        details,
        isError: completed.some(isResultError),
      };
    },
  };

  pi.registerTool(tool);
}
