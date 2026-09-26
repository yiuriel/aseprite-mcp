import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { runLua } from "../aseprite/runner.ts";
import { requireSpritePath } from "../aseprite/workspace.ts";
import { errorText, text } from "./result.ts";

async function openSave(
  name: string,
  body: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const spritePath = await requireSpritePath(name);
  const run = await runLua(
    `
    local s = app.open(MCP_ARGS.path)
    if not s then error("Could not open sprite: " .. MCP_ARGS.path) end
    local __result = {}
    ${body}
    if not s:saveAs(MCP_ARGS.path) then error("Failed to save sprite") end
    return __result
    `,
    { path: spritePath, ...args },
  );
  if (!run.ok) throw new Error(run.error ?? "unknown error");
  return (run.result ?? {}) as Record<string, unknown>;
}

export async function addFrame(
  name: string,
  options: { count?: number; durationMs?: number } = {},
): Promise<number> {
  const count = options.count ?? 1;
  const result = await openSave(
    name,
    `
    for _ = 1, MCP_ARGS.count do
      local frame = s:newFrame()
      if MCP_ARGS.durationMs ~= nil then frame.duration = MCP_ARGS.durationMs / 1000 end
    end
    __result.frames = #s.frames
    `,
    { count, durationMs: options.durationMs ?? null },
  );
  return result.frames as number;
}

export async function setFrameDuration(name: string, frame: number, durationMs: number): Promise<void> {
  await openSave(
    name,
    `
    if MCP_ARGS.frame < 1 or MCP_ARGS.frame > #s.frames then error("Frame out of range") end
    s.frames[MCP_ARGS.frame].duration = MCP_ARGS.durationMs / 1000
    `,
    { frame, durationMs },
  );
}

export async function deleteFrame(name: string, frame: number): Promise<void> {
  await openSave(
    name,
    `
    if #s.frames <= 1 then error("Cannot delete the only frame") end
    if MCP_ARGS.frame < 1 or MCP_ARGS.frame > #s.frames then error("Frame out of range") end
    s:deleteFrame(MCP_ARGS.frame)
    `,
    { frame },
  );
}

export function registerFrames(server: McpServer): void {
  server.registerTool(
    "add_frame",
    {
      title: "Add frame",
      description: "Append one or more empty frames to the end of the sprite.",
      inputSchema: {
        name: z.string().describe("Sprite name."),
        count: z.number().int().min(1).max(240).optional().describe("Number of frames to add. Defaults to 1."),
        durationMs: z.number().int().min(1).max(65535).optional().describe("Frame duration in ms for the new frames."),
      },
    },
    async ({ name, count, durationMs }) => {
      try {
        const frames = await addFrame(name, { count, durationMs });
        return text(`Sprite now has ${frames} frame(s) on ${name}.aseprite.`);
      } catch (err) {
        return errorText((err as Error).message);
      }
    },
  );

  server.registerTool(
    "set_frame_duration",
    {
      title: "Set frame duration",
      description: "Set a frame's duration in milliseconds (used for animation timing).",
      inputSchema: {
        name: z.string().describe("Sprite name."),
        frame: z.number().int().min(1).describe("Frame number (1-based)."),
        durationMs: z.number().int().min(1).max(65535).describe("Duration in milliseconds."),
      },
    },
    async ({ name, frame, durationMs }) => {
      try {
        await setFrameDuration(name, frame, durationMs);
        return text(`Set frame ${frame} duration to ${durationMs}ms on ${name}.aseprite.`);
      } catch (err) {
        return errorText((err as Error).message);
      }
    },
  );

  server.registerTool(
    "delete_frame",
    {
      title: "Delete frame",
      description: "Remove a frame. Refuses to delete the last remaining frame.",
      inputSchema: {
        name: z.string().describe("Sprite name."),
        frame: z.number().int().min(1).describe("Frame number (1-based)."),
      },
    },
    async ({ name, frame }) => {
      try {
        await deleteFrame(name, frame);
        return text(`Deleted frame ${frame} from ${name}.aseprite.`);
      } catch (err) {
        return errorText((err as Error).message);
      }
    },
  );
}
