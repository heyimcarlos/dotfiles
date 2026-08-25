import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { resolvePiSpawn } from "../src/pi-spawn.ts";

test("resolvePiSpawn resolves fallback pi through PATH to an absolute executable", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pi-spawn-test-"));
  const previousPath = process.env.PATH;
  try {
    const executable = path.join(tmp, process.platform === "win32" ? "pi.cmd" : "pi");
    fs.writeFileSync(executable, "#!/bin/sh\nexit 0\n", { mode: 0o700 });
    process.env.PATH = tmp;

    const invocation = resolvePiSpawn(["node"], process.execPath);
    assert.equal(invocation.command, fs.realpathSync(executable));
    assert.deepEqual(invocation.prefixArgs, []);
  } finally {
    if (previousPath === undefined) delete process.env.PATH;
    else process.env.PATH = previousPath;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
