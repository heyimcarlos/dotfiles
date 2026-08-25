export const DEFAULT_MAX_CONCURRENCY = 5;
export const MAX_CONCURRENCY_ENV = "PI_SUBAGENT_MAX_CONCURRENCY";

export function getMaxConcurrency(env: NodeJS.ProcessEnv = process.env): number {
  const value = env[MAX_CONCURRENCY_ENV];
  if (value === undefined || value.trim() === "") return DEFAULT_MAX_CONCURRENCY;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return DEFAULT_MAX_CONCURRENCY;

  return parsed;
}
