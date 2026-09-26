import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export function text(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }] };
}

export function errorText(message: string): CallToolResult {
  return { isError: true, content: [{ type: "text", text: message }] };
}

export function json(value: unknown): CallToolResult {
  return text(JSON.stringify(value, null, 2));
}
