import fs from "node:fs/promises";
import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { runLua } from "../aseprite/runner.ts";
import { type RenderResult, renderPng } from "../aseprite/render.ts";
import { requireSpritePath, resolveSpritesDir } from "../aseprite/workspace.ts";
import { errorText, text } from "./result.ts";

export interface ExportResult extends RenderResult {
  path: string;
}

export async function exportPng(
  name: string,
  options: { outputPath?: string; scale?: number; hideGuides?: boolean } = {},
): Promise<ExportResult> {
  const outPath = options.outputPath
    ? path.resolve(options.outputPath)
    : path.join(resolveSpritesDir(), `${name}.png`);

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  const rendered = await renderPng(name, outPath, {
    scale: options.scale ?? 1,
    hideGuides: options.hideGuides ?? true,
  });
  return { path: outPath, ...rendered };
}

export async function exportGif(
  name: string,
  options: { outputPath?: string; scale?: number; hideGuides?: boolean } = {},
): Promise<ExportResult> {
  const outPath = options.outputPath
    ? path.resolve(options.outputPath)
    : path.join(resolveSpritesDir(), `${name}.gif`);
  const spritePath = await requireSpritePath(name);
  const scale = options.scale ?? 1;

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  const run = await runLua(
    `
    local s = app.open(MCP_ARGS.spritePath)
    if not s then error("Could not open sprite: " .. MCP_ARGS.spritePath) end
    if MCP_ARGS.hideGuides then mcp.hideGuides(s) end
    local srcW, srcH = s.width, s.height
    if MCP_ARGS.scale ~= 1 then s:resize(srcW * MCP_ARGS.scale, srcH * MCP_ARGS.scale) end
    if not s:saveCopyAs(MCP_ARGS.outPath) then error("Failed to export gif") end
    local f = io.open(MCP_ARGS.outPath, "r")
    if not f then error("Failed to export gif") end
    f:close()
    return { width = srcW, height = srcH, outputWidth = s.width, outputHeight = s.height }
    `,
    { spritePath, outPath, scale, hideGuides: options.hideGuides ?? true },
  );
  if (!run.ok || run.result === null) throw new Error(run.error ?? "unknown error");
  return { path: outPath, ...(run.result as RenderResult) };
}

export function registerExport(server: McpServer): void {
  server.registerTool(
    "export_png",
    {
      title: "Export PNG",
      description:
        "Export the sprite as a flattened PNG (nearest-neighbor scaled). Guide layers are hidden by default. Defaults to <workspace>/<name>.png.",
      inputSchema: {
        name: z.string().describe("Sprite name."),
        outputPath: z.string().optional().describe("Destination PNG path. Defaults to the workspace."),
        scale: z.number().int().min(1).max(32).optional().describe("Integer upscale factor. Defaults to 1."),
        hideGuides: z.boolean().optional().describe("Hide guide layers. Defaults to true."),
      },
    },
    async ({ name, outputPath, scale, hideGuides }) => {
      try {
        const result = await exportPng(name, { outputPath, scale, hideGuides });
        return text(
          `Exported ${result.outputWidth}x${result.outputHeight} PNG to ${result.path} (source ${result.width}x${result.height}).`,
        );
      } catch (err) {
        return errorText((err as Error).message);
      }
    },
  );

  server.registerTool(
    "export_gif",
    {
      title: "Export GIF",
      description:
        "Export all frames as an animated GIF (nearest-neighbor scaled). Guide layers are hidden by default. Defaults to <workspace>/<name>.gif.",
      inputSchema: {
        name: z.string().describe("Sprite name."),
        outputPath: z.string().optional().describe("Destination GIF path. Defaults to the workspace."),
        scale: z.number().int().min(1).max(32).optional().describe("Integer upscale factor. Defaults to 1."),
        hideGuides: z.boolean().optional().describe("Hide guide layers. Defaults to true."),
      },
    },
    async ({ name, outputPath, scale, hideGuides }) => {
      try {
        const result = await exportGif(name, { outputPath, scale, hideGuides });
        return text(
          `Exported ${result.outputWidth}x${result.outputHeight} animated GIF to ${result.path}.`,
        );
      } catch (err) {
        return errorText((err as Error).message);
      }
    },
  );
}
