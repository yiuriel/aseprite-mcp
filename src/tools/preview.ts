import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { type RenderResult, autoScale, renderPng } from "../aseprite/render.ts";
import { errorText } from "./result.ts";
import { readSpriteInfo } from "./sprite-info.ts";

export interface PreviewOptions {
  scale?: number;
  showGuides?: boolean;
  frame?: number;
}

export interface PreviewResult extends RenderResult {
  pngBase64: string;
}

export async function renderPreview(
  name: string,
  options: PreviewOptions = {},
): Promise<PreviewResult> {
  let scale = options.scale;
  if (scale === undefined) {
    const info = await readSpriteInfo(name);
    scale = autoScale(info.width, info.height);
  }

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "aseprite-mcp-preview-"));
  const file = path.join(dir, "preview.png");
  try {
    const rendered = await renderPng(name, file, {
      scale,
      hideGuides: !options.showGuides,
      frame: options.frame,
    });
    const png = await fs.readFile(file);
    return { ...rendered, pngBase64: png.toString("base64") };
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

export function registerPreview(server: McpServer): void {
  server.registerTool(
    "preview",
    {
      title: "Preview sprite",
      description:
        "Render the sprite to a PNG image (nearest-neighbor upscaled) and return it so it can be seen. Guide layers (names starting with '_' or 'symmetrical guides') are hidden unless showGuides is true.",
      inputSchema: {
        name: z.string().describe("Sprite name."),
        scale: z
          .number()
          .int()
          .min(1)
          .max(32)
          .optional()
          .describe("Integer upscale factor. Defaults to a size that fits about 192px."),
        showGuides: z.boolean().optional().describe("Include guide layers. Defaults to false."),
        frame: z.number().int().min(1).optional().describe("Frame to show (1-based). Defaults to 1."),
      },
    },
    async ({ name, scale, showGuides, frame }) => {
      try {
        const preview = await renderPreview(name, { scale, showGuides, frame });
        return {
          content: [
            {
              type: "text",
              text: `Preview of ${name}.aseprite frame ${frame ?? 1} (${preview.width}x${preview.height}, shown at ${preview.outputWidth}x${preview.outputHeight}).`,
            },
            { type: "image", data: preview.pngBase64, mimeType: "image/png" },
          ],
        };
      } catch (err) {
        return errorText((err as Error).message);
      }
    },
  );
}
