import fs from "node:fs/promises";
import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { type RenderResult, renderPng } from "../aseprite/render.ts";
import { resolveSpritesDir } from "../aseprite/workspace.ts";
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
}
