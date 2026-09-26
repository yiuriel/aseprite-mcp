export const RESULT_SENTINEL = "__ASEPRITE_MCP_RESULT__";
export const ERROR_SENTINEL = "__ASEPRITE_MCP_ERROR__";

export function luaString(value: string): string {
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

export function buildWrappedScript(body: string, argsPath: string): string {
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

export function filterStderr(stderr: string): string {
  return stderr
    .split(/\r?\n/)
    .filter((line) => !/Aseprite\/extensions\/.*\.lua:\d+:/.test(line))
    .join("\n")
    .trim();
}

export interface ParsedLuaOutput {
  kind: "result" | "error" | "none";
  value?: unknown;
  error?: string;
  parseError?: string;
}

export function parseLuaOutput(stdout: string): ParsedLuaOutput {
  const lines = stdout.split(/\r?\n/);
  const resultLine = lines.find((line) => line.startsWith(RESULT_SENTINEL));
  const errorLine = lines.find((line) => line.startsWith(ERROR_SENTINEL));

  if (errorLine) {
    return { kind: "error", error: errorLine.slice(ERROR_SENTINEL.length) };
  }

  if (resultLine) {
    try {
      return { kind: "result", value: JSON.parse(resultLine.slice(RESULT_SENTINEL.length)) };
    } catch (err) {
      return { kind: "result", parseError: (err as Error).message };
    }
  }

  return { kind: "none" };
}
