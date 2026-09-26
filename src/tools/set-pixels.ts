import fs from "node:fs/promises";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { type ColorInput, type Rgba, parseColor } from "../aseprite/color.ts";
import { runLua } from "../aseprite/runner.ts";
import { resolveSpritePath } from "../aseprite/workspace.ts";
import { colorSchema } from "./color-schema.ts";

export interface PixelInput {
  x: number;
  y: number;
  color: ColorInput;
}

export interface Pixel {
  x: number;
  y: number;
  color: Rgba;
}

export interface SetPixelsSummary {
  path: string;
  width: number;
  height: number;
  count: number;
}

export function normalizePixels(pixels: PixelInput[]): Pixel[] {
  return pixels.map((pixel, index) => {
    if (!Number.isInteger(pixel.x) || !Number.isInteger(pixel.y)) {
      throw new Error(`pixel[${index}] x and y must be integers`);
    }
    try {
      return { x: pixel.x, y: pixel.y, color: parseColor(pixel.color) };
    } catch (err) {
      throw new Error(`pixel[${index}] color: ${(err as Error).message}`);
    }
  });
}

function buildBody(): string {
  return `
    local s = app.open(MCP_ARGS.path)
    if not s then error("Could not open sprite: " .. MCP_ARGS.path) end
    local cel = s.cels[1]
    if not cel then error("Sprite has no drawable cel") end
    local img = cel.image
    local w, h = s.width, s.height

    local outOfBounds = {}
    for _, p in ipairs(MCP_ARGS.pixels) do
      if p.x < 0 or p.y < 0 or p.x >= w or p.y >= h then
        outOfBounds[#outOfBounds + 1] = string.format("(%d,%d)", p.x, p.y)
      end
    end
    if #outOfBounds > 0 then
      error("Out of bounds for " .. w .. "x" .. h .. ": " .. table.concat(outOfBounds, ", "))
    end

    for _, p in ipairs(MCP_ARGS.pixels) do
      img:putPixel(p.x, p.y, Color{r = p.color.r, g = p.color.g, b = p.color.b, a = p.color.a})
    end

    if not s:saveAs(MCP_ARGS.path) then error("Failed to save sprite") end
    return { width = w, height = h, count = #MCP_ARGS.pixels }
  `;
}

export async function applyPixels(name: string, pixels: Pixel[]): Promise<SetPixelsSummary> {
  const outPath = resolveSpritePath(name);

  const exists = await fs
    .access(outPath)
    .then(() => true)
    .catch(() => false);
  if (!exists) {
    throw new Error(`Sprite "${name}" not found at ${outPath}. Create it first with create_sprite.`);
  }

  const run = await runLua(buildBody(), { path: outPath, pixels });
  if (!run.ok) {
    throw new Error(run.error ?? "unknown error");
  }

  const result = run.result as { width: number; height: number; count: number };
  return { path: outPath, width: result.width, height: result.height, count: result.count };
}

export function registerSetPixels(server: McpServer): void {
  server.registerTool(
    "set_pixels",
    {
      title: "Set pixels",
      description:
        "Draw pixels onto an existing sprite and save it. Targets the first layer and frame. All pixels are validated first: if any coordinate is outside the canvas, nothing is written.",
      inputSchema: {
        name: z.string().describe("Sprite name previously passed to create_sprite."),
        pixels: z
          .array(
            z.object({
              x: z.number().int().describe("X coordinate (0-based, from the left)."),
              y: z.number().int().describe("Y coordinate (0-based, from the top)."),
              color: colorSchema,
            }),
          )
          .min(1)
          .describe("Pixels to write. Later entries win if coordinates repeat."),
      },
    },
    async ({ name, pixels }) => {
      try {
        const summary = await applyPixels(name, normalizePixels(pixels as PixelInput[]));
        return {
          content: [
            {
              type: "text",
              text: `Set ${summary.count} pixel(s) on ${name}.aseprite (${summary.width}x${summary.height}).`,
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: (err as Error).message }],
        };
      }
    },
  );
}
