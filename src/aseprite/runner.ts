import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { asepriteBinaryPath } from "../config.ts";

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

const RESULT_SENTINEL = "__ASEPRITE_MCP_RESULT__";
const ERROR_SENTINEL = "__ASEPRITE_MCP_ERROR__";
const DEFAULT_TIMEOUT_MS = 20_000;

export class AsepriteError extends Error {
  detail?: string;

  constructor(message: string, detail?: string) {
    super(message);
    this.name = "AsepriteError";
    this.detail = detail;
  }
}

function luaString(value: string): string {
  return (
    '"' +
    value
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r") +
    '"'
  );
}

function buildWrappedScript(body: string, argsPath: string): string {
  return `local function __mcp_read(p)
  local f = io.open(p, "r")
  if not f then return nil end
  local s = f:read("a")
  f:close()
  return s
end

local MCP_ARGS = json.decode(__mcp_read(${luaString(argsPath)}) or "{}") or {}

local function __mcp_main()
${body}
end

local __mcp_ok, __mcp_ret = pcall(__mcp_main)
if __mcp_ok then
  if type(__mcp_ret) ~= "table" then __mcp_ret = { value = __mcp_ret } end
  print("${RESULT_SENTINEL}" .. json.encode(__mcp_ret))
else
  print("${ERROR_SENTINEL}" .. tostring(__mcp_ret))
end
`;
}

function filterStderr(stderr: string): string {
  return stderr
    .split(/\r?\n/)
    .filter((line) => !/Aseprite\/extensions\/.*\.lua:\d+:/.test(line))
    .join("\n")
    .trim();
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

    const run = await new Promise<{
      stdout: string;
      stderr: string;
      exitCode: number | null;
      timedOut: boolean;
    }>((resolve, reject) => {
      const child = spawn(asepriteBinaryPath, ["-b", "--script", scriptPath], {
        cwd: options.cwd,
      });

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

    const durationMs = Date.now() - startedAt;
    const stderr = filterStderr(run.stderr);
    const lines = run.stdout.split(/\r?\n/);
    const resultLine = lines.find((line) => line.startsWith(RESULT_SENTINEL));
    const errorLine = lines.find((line) => line.startsWith(ERROR_SENTINEL));

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

    if (errorLine) {
      return {
        ok: false,
        result: null,
        error: errorLine.slice(ERROR_SENTINEL.length),
        stdout: run.stdout,
        stderr,
        exitCode: run.exitCode,
        durationMs,
      };
    }

    if (resultLine) {
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(resultLine.slice(RESULT_SENTINEL.length));
      } catch (err) {
        return {
          ok: false,
          result: null,
          error: `Failed to parse Lua result: ${(err as Error).message}`,
          stdout: run.stdout,
          stderr,
          exitCode: run.exitCode,
          durationMs,
        };
      }
      return {
        ok: true,
        result: parsed,
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
