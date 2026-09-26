import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { runLua } from "../aseprite/runner.ts";
import { requireSpritePath } from "../aseprite/workspace.ts";
import { errorText, json } from "./result.ts";

export interface LayerInfo {
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  isGroup: boolean;
  isGuide: boolean;
}

export interface SpriteInfo {
  path: string;
  width: number;
  height: number;
  colorMode: string;
  frames: number;
  layers: LayerInfo[];
}

export async function readSpriteInfo(name: string): Promise<SpriteInfo> {
  const spritePath = await requireSpritePath(name);
  const run = await runLua(
    `
    local s = app.open(MCP_ARGS.path)
    if not s then error("Could not open sprite: " .. MCP_ARGS.path) end
    local mode = "unknown"
    if s.colorMode == ColorMode.RGB then mode = "rgb"
    elseif s.colorMode == ColorMode.GRAYSCALE then mode = "grayscale"
    elseif s.colorMode == ColorMode.INDEXED then mode = "indexed" end
    local layers = {}
    for _, layer in ipairs(s.layers) do
      layers[#layers + 1] = {
        name = layer.name,
        visible = layer.isVisible,
        locked = not layer.isEditable,
        opacity = layer.opacity,
        isGroup = layer.isGroup,
        isGuide = mcp.isGuideLayer(layer),
      }
    end
    return {
      path = MCP_ARGS.path,
      width = s.width,
      height = s.height,
      colorMode = mode,
      frames = #s.frames,
      layers = layers,
    }
    `,
    { path: spritePath },
  );

  if (!run.ok || run.result === null) {
    throw new Error(run.error ?? "unknown error");
  }
  return run.result as SpriteInfo;
}

export interface PixelsResult {
  x: number;
  y: number;
  width: number;
  height: number;
  rows: string[][];
}

export async function readPixels(
  name: string,
  rect: { x: number; y: number; width: number; height: number },
  layer?: string,
): Promise<PixelsResult> {
  const spritePath = await requireSpritePath(name);
  const run = await runLua(
    `
    local s = app.open(MCP_ARGS.path)
    if not s then error("Could not open sprite: " .. MCP_ARGS.path) end
    local img = mcp.celImage(s, mcp.targetLayer(s, MCP_ARGS.layer), 1)
    local pc = app.pixelColor
    local x0 = math.max(0, MCP_ARGS.x)
    local y0 = math.max(0, MCP_ARGS.y)
    local x1 = math.min(s.width - 1, MCP_ARGS.x + MCP_ARGS.width - 1)
    local y1 = math.min(s.height - 1, MCP_ARGS.y + MCP_ARGS.height - 1)
    local rows = {}
    for y = y0, y1 do
      local row = {}
      for x = x0, x1 do
        local c = img:getPixel(x, y)
        row[#row + 1] = string.format("#%02x%02x%02x%02x", pc.rgbaR(c), pc.rgbaG(c), pc.rgbaB(c), pc.rgbaA(c))
      end
      rows[#rows + 1] = row
    end
    return { x = x0, y = y0, width = (#rows > 0) and #rows[1] or 0, height = #rows, rows = rows }
    `,
    { path: spritePath, layer: layer ?? "", ...rect },
  );

  if (!run.ok || run.result === null) {
    throw new Error(run.error ?? "unknown error");
  }
  return run.result as PixelsResult;
}

export function registerSpriteInfo(server: McpServer): void {
  server.registerTool(
    "get_sprite_info",
    {
      title: "Get sprite info",
      description:
        "Report a sprite's dimensions, color mode, frame count, and layers (name, visibility, locked, opacity, guide flag).",
      inputSchema: {
        name: z.string().describe("Sprite name."),
      },
    },
    async ({ name }) => {
      try {
        return json(await readSpriteInfo(name));
      } catch (err) {
        return errorText((err as Error).message);
      }
    },
  );

  server.registerTool(
    "get_pixels",
    {
      title: "Get pixels",
      description:
        "Read a rectangular region as rows of #rrggbbaa hex strings. Useful to verify what was drawn. Clamps to the canvas.",
      inputSchema: {
        name: z.string().describe("Sprite name."),
        x: z.number().int().describe("Left edge (0-based)."),
        y: z.number().int().describe("Top edge (0-based)."),
        width: z.number().int().min(1).describe("Region width."),
        height: z.number().int().min(1).describe("Region height."),
        layer: z.string().optional().describe("Layer name. Defaults to the first non-guide layer."),
      },
    },
    async ({ name, x, y, width, height, layer }) => {
      try {
        return json(await readPixels(name, { x, y, width, height }, layer));
      } catch (err) {
        return errorText((err as Error).message);
      }
    },
  );
}
