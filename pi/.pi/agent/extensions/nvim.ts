/**
 * /nvim — open Neovim in a herdr pane beside the current pi session.
 *
 * Usage:
 *   /nvim                 open nvim in a new pane (project cwd)
 *   /nvim src/foo.ts      open a file
 *   /nvim src/foo.ts:42   open a file at a line
 *
 * Requires running inside herdr (HERDR_ENV=1). The pane splits to the
 * right of the pi pane; jump back and forth with ctrl+h/l
 * (vim-herdr-navigation).
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export default function nvimPaneExtension(pi: ExtensionAPI) {
  pi.registerCommand("nvim", {
    description: "Open nvim in a herdr pane (usage: /nvim [file[:line]])",
    handler: async (args, ctx) => {
      if (process.env.HERDR_ENV !== "1" || !process.env.HERDR_PANE_ID) {
        ctx.ui.notify("/nvim requires running inside a herdr pane", "warning");
        return;
      }

      let target = args.trim();
      let line: string | undefined;
      const match = target.match(/^(.+):(\d+)$/);
      if (match?.[1] && match[2]) {
        target = match[1];
        line = match[2];
      }

      const command = ["nvim"];
      if (line) command.push(`+${line}`);
      if (target) command.push(shellQuote(target));

      try {
        const split = await exec("herdr", [
          "pane", "split", "--current", "--direction", "right",
          "--cwd", process.cwd(), "--focus",
        ]);
        const paneId: string | undefined =
          JSON.parse(split.stdout)?.result?.pane?.pane_id;
        if (!paneId) throw new Error("herdr did not return a pane id");

        await exec("herdr", ["pane", "run", paneId, command.join(" ")]);
        ctx.ui.notify(
          `nvim${target ? ` ${target}${line ? `:${line}` : ""}` : ""} → pane ${paneId}`,
          "info",
        );
      } catch (error) {
        ctx.ui.notify(
          `/nvim failed: ${error instanceof Error ? error.message : String(error)}`,
          "error",
        );
      }
    },
  });
}
