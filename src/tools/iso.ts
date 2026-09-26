import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { parseColor } from "../aseprite/color.ts";
import { GUIDE_COLOR, GUIDE_LAYER_NAME } from "../aseprite/guides.ts";
import { DEFAULT_TILE_WIDTH, isoCubeFaces, isoDiamondPoints, isoGuideDots } from "../aseprite/iso.ts";
import { runLua } from "../aseprite/runner.ts";
import { requireSpritePath } from "../aseprite/workspace.ts";
import { colorSchema } from "./color-schema.ts";
import { drawOnSprite } from "./drawing.ts";
import { errorText, text } from "./result.ts";
import { readSpriteInfo } from "./sprite-info.ts";

const layerParam = z.string().optional().describe("Target layer. Defaults to the first non-guide layer.");
const frameParam = z.number().int().min(1).optional().describe("Target frame (1-based). Defaults to 1.");

export async function createIsoGuide(
  name: string,
  options: { tileWidth?: number; color?: { r: number; g: number; b: number; a: number } } = {},
): Promise<number> {
  const tileWidth = options.tileWidth ?? DEFAULT_TILE_WIDTH;
  const color = options.color ?? GUIDE_COLOR;

  const info = await readSpriteInfo(name);
  const dots = isoGuideDots(info.width, info.height, tileWidth);
  const spritePath = await requireSpritePath(name);

  const run = await runLua(
    `
    local s = app.open(MCP_ARGS.path)
    if not s then error("Could not open sprite: " .. MCP_ARGS.path) end
    for i = #s.layers, 1, -1 do
      if s.layers[i].name == MCP_ARGS.guideName then s:deleteLayer(s.layers[i]) end
    end
    local layer = s:newLayer()
    layer.name = MCP_ARGS.guideName
    layer.isEditable = false
    layer.isVisible = true
    local cel = s:newCel(layer, 1)
    local color = mcp.color(MCP_ARGS.color)
    for _, p in ipairs(MCP_ARGS.dots) do cel.image:drawPixel(p.x, p.y, color) end
    if not s:saveAs(MCP_ARGS.path) then error("Failed to save sprite") end
    return { dots = #MCP_ARGS.dots }
    `,
    { path: spritePath, guideName: GUIDE_LAYER_NAME, color, dots },
  );

  if (!run.ok || run.result === null) throw new Error(run.error ?? "unknown error");
  return (run.result as { dots: number }).dots;
}

const outlineLua = `
local function outline(pts, color)
  for i = 1, #pts do
    local a = pts[i]
    local b = pts[i % #pts + 1]
    mcp.drawLine(img, a.x, a.y, b.x, b.y, color)
  end
end
`;

export function registerIso(server: McpServer): void {
  server.registerTool(
    "draw_iso_tile",
    {
      title: "Draw isometric tile",
      description:
        "Fill a 2:1 isometric floor diamond (default 32px wide) with an optional outline. Origin is the tile's top-left cell.",
      inputSchema: {
        name: z.string().describe("Sprite name."),
        x: z.number().int().describe("Cell left edge."),
        y: z.number().int().describe("Cell top edge."),
        tileWidth: z.number().int().min(4).optional().describe("Tile width in px (default 32)."),
        color: colorSchema,
        outlineColor: colorSchema.optional(),
        layer: layerParam,
        frame: frameParam,
      },
    },
    async ({ name, x, y, tileWidth, color, outlineColor, layer, frame }) => {
      try {
        const points = isoDiamondPoints(x, y, tileWidth ?? DEFAULT_TILE_WIDTH);
        await drawOnSprite(
          name,
          layer,
          `
          mcp.fillPolygon(img, MCP_ARGS.points, mcp.color(MCP_ARGS.color))
          ${outlineColor ? `${outlineLua} outline(MCP_ARGS.points, mcp.color(MCP_ARGS.outlineColor))` : ""}
          `,
          {
            points,
            color: parseColor(color),
            outlineColor: outlineColor === undefined ? null : parseColor(outlineColor),
          },
          frame,
        );
        return text(`Drew iso tile on ${name}.aseprite.`);
      } catch (err) {
        return errorText((err as Error).message);
      }
    },
  );

  server.registerTool(
    "draw_iso_cube",
    {
      title: "Draw isometric cube",
      description:
        "Fill an isometric cube (top + left + right faces) with optional outline. Origin is the cube's top-left cell.",
      inputSchema: {
        name: z.string().describe("Sprite name."),
        x: z.number().int().describe("Cell left edge."),
        y: z.number().int().describe("Cell top edge."),
        tileWidth: z.number().int().min(4).optional().describe("Tile width in px (default 32)."),
        bodyHeight: z.number().int().min(1).optional().describe("Cube side height in px (default tileWidth/2)."),
        topColor: colorSchema,
        leftColor: colorSchema,
        rightColor: colorSchema,
        outlineColor: colorSchema.optional(),
        layer: layerParam,
        frame: frameParam,
      },
    },
    async ({ name, x, y, tileWidth, bodyHeight, topColor, leftColor, rightColor, outlineColor, layer, frame }) => {
      try {
        const faces = isoCubeFaces(x, y, tileWidth ?? DEFAULT_TILE_WIDTH, bodyHeight);
        await drawOnSprite(
          name,
          layer,
          `
          mcp.fillPolygon(img, MCP_ARGS.faces.top, mcp.color(MCP_ARGS.topColor))
          mcp.fillPolygon(img, MCP_ARGS.faces.left, mcp.color(MCP_ARGS.leftColor))
          mcp.fillPolygon(img, MCP_ARGS.faces.right, mcp.color(MCP_ARGS.rightColor))
          if MCP_ARGS.outlineColor then
            ${outlineLua}
            local c = mcp.color(MCP_ARGS.outlineColor)
            outline(MCP_ARGS.faces.top, c)
            outline(MCP_ARGS.faces.left, c)
            outline(MCP_ARGS.faces.right, c)
          end
          `,
          {
            faces,
            topColor: parseColor(topColor),
            leftColor: parseColor(leftColor),
            rightColor: parseColor(rightColor),
            outlineColor: outlineColor === undefined ? null : parseColor(outlineColor),
          },
          frame,
        );
        return text(`Drew iso cube on ${name}.aseprite.`);
      } catch (err) {
        return errorText((err as Error).message);
      }
    },
  );

  server.registerTool(
    "create_iso_guide",
    {
      title: "Create isometric guide layer",
      description:
        "Replace the locked 'symmetrical guides' layer with magenta vertex dots marking the iso diamond/cube grid (matches the Aseprite iso_guide script).",
      inputSchema: {
        name: z.string().describe("Sprite name."),
        tileWidth: z.number().int().min(4).optional().describe("Grid tile width in px (default 32)."),
        color: colorSchema.optional().describe("Dot color. Defaults to magenta at alpha 120."),
      },
    },
    async ({ name, tileWidth, color }) => {
      try {
        const dots = await createIsoGuide(name, {
          tileWidth,
          color: color === undefined ? undefined : parseColor(color),
        });
        return text(`Created iso guide with ${dots} dot(s) on ${name}.aseprite.`);
      } catch (err) {
        return errorText((err as Error).message);
      }
    },
  );
}
