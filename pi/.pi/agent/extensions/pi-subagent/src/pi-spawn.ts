import * as fs from "node:fs";
import * as path from "node:path";

export interface PiSpawnInvocation {
  command: string;
  prefixArgs: string[];
}

export type PiSpawnResolver = () => PiSpawnInvocation;

function findExecutableOnPath(name: string, env = process.env): string | undefined {
  const pathValue = env.PATH;
  if (!pathValue) return undefined;
  const extensions = process.platform === "win32" ? (env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM").split(";") : [""];
  for (const dir of pathValue.split(path.delimiter)) {
    if (!dir) continue;
    for (const extension of extensions) {
      const candidate = path.join(dir, `${name}${extension}`);
      try {
        fs.accessSync(candidate, fs.constants.X_OK);
        return fs.realpathSync(candidate);
      } catch {
        // Keep searching PATH.
      }
    }
  }
  return undefined;
}

export function resolvePiSpawn(argv = process.argv, execPath = process.execPath): PiSpawnInvocation {
  const entry = argv[1];
  const isBunVirtualScript = entry?.startsWith("/$bunfs/root/");
  if (entry && !isBunVirtualScript) {
    try {
      const realEntry = fs.realpathSync(entry);
      if (/\.(?:mjs|cjs|js|ts|mts|cts)$/i.test(realEntry)) {
        // Development installs often run `node path/to/pi.js`; preserve that exact
        // entrypoint so child runs use the same checkout instead of global `pi`.
        return { command: execPath, prefixArgs: [realEntry] };
      }
    } catch {
      // Fall back to PATH resolution below.
    }
  }

  const execName = path.basename(execPath).toLowerCase();
  const isGenericRuntime = /^(node|bun)(?:\.exe)?$/.test(execName);
  if (!isGenericRuntime) {
    // Bun compiled binaries and other packaged launchers can re-exec themselves
    // directly; argv[1] may be virtual or unavailable in those environments.
    return { command: execPath, prefixArgs: [] };
  }

  return { command: findExecutableOnPath("pi") ?? "pi", prefixArgs: [] };
}
