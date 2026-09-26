import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { asepriteBinaryPath } from "../config.ts";
import { buildWrappedScript, filterStderr, parseLuaOutput } from "./lua.ts";

export interface LuaRunResult {
  ok: boolean;
  result: unknown;
  error?: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
}

export interface RunLuaOptions {
  timeoutMs?: number;
  cwd?: string;
  keepTemp?: boolean;
}

const DEFAULT_TIMEOUT_MS = 20_000;

export class AsepriteError extends Error {
  detail?: string;

  constructor(message: string, detail?: string) {
    super(message);
    this.name = "AsepriteError";
    this.detail = detail;
  }
}

interface SpawnOutcome {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
}

function execute(scriptPath: string, timeoutMs: number, cwd?: string): Promise<SpawnOutcome> {
  return new Promise((resolve, reject) => {
    const child = spawn(asepriteBinaryPath, ["-b", "--script", scriptPath], { cwd });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(new AsepriteError(`Failed to launch Aseprite: ${err.message}`));
    });
    child.on("close", (exitCode) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, exitCode, timedOut });
    });
  });
}

export async function runLua(
  body: string,
  args: Record<string, unknown> = {},
  options: RunLuaOptions = {},
): Promise<LuaRunResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "aseprite-mcp-"));
  const argsPath = path.join(tempDir, "args.json");
  const scriptPath = path.join(tempDir, "script.lua");

  const startedAt = Date.now();
  try {
    await fs.writeFile(argsPath, JSON.stringify(args));
    await fs.writeFile(scriptPath, buildWrappedScript(body, argsPath));

    const run = await execute(scriptPath, timeoutMs, options.cwd);
    const durationMs = Date.now() - startedAt;
    const stderr = filterStderr(run.stderr);

    if (run.timedOut) {
      return {
        ok: false,
        result: null,
        error: `Aseprite timed out after ${timeoutMs}ms`,
        stdout: run.stdout,
        stderr,
        exitCode: run.exitCode,
        durationMs,
      };
    }

    const parsed = parseLuaOutput(run.stdout);

    if (parsed.kind === "error") {
      return {
        ok: false,
        result: null,
        error: parsed.error,
        stdout: run.stdout,
        stderr,
        exitCode: run.exitCode,
        durationMs,
      };
    }

    if (parsed.kind === "result") {
      if (parsed.parseError) {
        return {
          ok: false,
          result: null,
          error: `Failed to parse Lua result: ${parsed.parseError}`,
          stdout: run.stdout,
          stderr,
          exitCode: run.exitCode,
          durationMs,
        };
      }
      return {
        ok: true,
        result: parsed.value,
        stdout: run.stdout,
        stderr,
        exitCode: run.exitCode,
        durationMs,
      };
    }

    return {
      ok: run.exitCode === 0,
      result: null,
      error:
        run.exitCode === 0
          ? undefined
          : `Aseprite exited with code ${run.exitCode}${stderr ? `: ${stderr}` : ""}`,
      stdout: run.stdout,
      stderr,
      exitCode: run.exitCode,
      durationMs,
    };
  } finally {
    if (!options.keepTemp) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }
}
