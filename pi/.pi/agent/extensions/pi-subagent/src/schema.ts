import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import { LABEL_MAX_LENGTH, MAX_TASKS, TASK_TEXT_MAX_LENGTH } from "./limits.ts";
import { AGENT_NAMES, type AgentName, type SubagentResult } from "./types.ts";

export const TaskItem = Type.Object({
  agent: StringEnum(AGENT_NAMES, {
    description: "Subagent role to run. Use explorer for codebase discovery and general for focused analysis/review.",
  }),
  task: Type.String({
    minLength: 1,
    maxLength: TASK_TEXT_MAX_LENGTH,
    description: "Self-contained task for this subagent.",
  }),
  label: Type.Optional(Type.String({
    maxLength: LABEL_MAX_LENGTH,
    description: "Short label for this task, useful in parallel review runs.",
  })),
  cwd: Type.Optional(Type.String({ description: "Optional working directory for this subagent process." })),
});

export const SubagentParams = Type.Object({
  agent: Type.Optional(StringEnum(AGENT_NAMES, {
    description: "Subagent role for single-task mode.",
  })),
  task: Type.Optional(Type.String({
    minLength: 1,
    maxLength: TASK_TEXT_MAX_LENGTH,
    description: "Task for single-task mode.",
  })),
  tasks: Type.Optional(Type.Array(TaskItem, {
    minItems: 1,
    maxItems: MAX_TASKS,
    description: "Parallel mode: independent subagent tasks. All tasks run with bounded concurrency and the tool waits for all results.",
  })),
  cwd: Type.Optional(Type.String({ description: "Optional working directory for single-task mode." })),
});

// Keep the public TypeBox schema and TypeScript input type side by side. Using a
// hand-written interface avoids very deep conditional types from TypeBox while
// preserving the exact runtime schema pi validates.
export interface TaskItemInput {
  agent: AgentName;
  task: string;
  label?: string;
  cwd?: string;
}

export interface SubagentParamsInput {
  agent?: AgentName;
  task?: string;
  tasks?: TaskItemInput[];
  cwd?: string;
}

export interface SubagentDetails {
  mode: "single" | "parallel";
  results: SubagentResult[];
}
