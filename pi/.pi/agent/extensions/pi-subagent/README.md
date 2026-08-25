# pi-subagent

Minimal Pi extension that adds a synchronous `subagent` tool with two built-in roles:

- `explorer` — read-only codebase exploration, similar to Claude Code `Explore`, Codex `explorer`, and opencode `explore`.
- `general` — read-only general analysis/review for independent perspectives such as security, performance, and conventions.

## Install / run locally

```bash
pi install npm:@smoose/pi-subagent
```

## Tool usage

Single subagent:

```json
{
  "agent": "explorer",
  "task": "Find where authentication middleware is registered. Return paths and line ranges."
}
```

Parallel subagents:

```json
{
  "tasks": [
    {
      "agent": "general",
      "label": "security",
      "task": "Review the current diff from a security perspective. Do not modify files. Return evidence."
    },
    {
      "agent": "general",
      "label": "performance",
      "task": "Review the current diff from a performance perspective. Do not modify files. Return evidence."
    },
    {
      "agent": "general",
      "label": "conventions",
      "task": "Review the current diff for code style, maintainability, and project conventions. Do not modify files. Return evidence."
    }
  ]
}
```

Parallel mode runs with bounded concurrency and waits for all results before returning to the main agent. The default max concurrency is `5`; override it with `PI_SUBAGENT_MAX_CONCURRENCY`.

## Design constraints

- Child runs use isolated `pi --mode json --no-session --no-extensions` processes.
- Because child runs disable extension discovery, subagents do not support providers registered by Pi extensions. Use built-in providers or providers configured in `~/.pi/agent/models.json` for subagent child models.
- Child roles are read-only (`read`, `grep`, `find`, `ls`).
- Results must include evidence according to each role prompt.
- The main agent remains responsible for synthesis and final judgment.
