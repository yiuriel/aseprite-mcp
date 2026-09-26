import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { parseColor } from "../aseprite/color.ts";
import { colorSchema } from "./color-schema.ts";
import { drawOnSprite } from "./drawing.ts";
import { errorText, text } from "./result.ts";

const pointSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
});

const layerParam = z.string().optional().describe("Target layer. Defaults to the first non-guide layer.");
const nameParam = z.string().describe("Sprite name.");
const colorParam = colorSchema;

export function registerPrimitives(server: McpServer): void {
  server.registerTool(
    "draw_line",
    {
      title: "Draw line",
      description: "Draw a 1px line between two points.",
      inputSchema: {
        name: nameParam,
        x0: z.number().int(),
        y0: z.number().int(),
        x1: z.number().int(),
        y1: z.number().int(),
        color: colorParam,
        layer: layerParam,
      },
    },
    async ({ name, x0, y0, x1, y1, color, layer }) => {
      try {
        await drawOnSprite(
          name,
          layer,
          `mcp.drawLine(img, MCP_ARGS.x0, MCP_ARGS.y0, MCP_ARGS.x1, MCP_ARGS.y1, mcp.color(MCP_ARGS.color))`,
          { x0, y0, x1, y1, color: parseColor(color) },
        );
        return text(`Drew line on ${name}.aseprite.`);
      } catch (err) {
        return errorText((err as Error).message);
      }
    },
  );

  server.registerTool(
    "draw_rect",
    {
      title: "Draw rectangle",
      description: "Draw a 1px rectangle outline.",
      inputSchema: {
        name: nameParam,
        x: z.number().int(),
        y: z.number().int(),
        width: z.number().int().min(1),
        height: z.number().int().min(1),
        color: colorParam,
        layer: layerParam,
      },
    },
    async ({ name, x, y, width, height, color, layer }) => {
      try {
        await drawOnSprite(
          name,
          layer,
          `mcp.drawRect(img, MCP_ARGS.x, MCP_ARGS.y, MCP_ARGS.width, MCP_ARGS.height, mcp.color(MCP_ARGS.color))`,
          { x, y, width, height, color: parseColor(color) },
        );
        return text(`Drew rectangle on ${name}.aseprite.`);
      } catch (err) {
        return errorText((err as Error).message);
      }
    },
  );

  server.registerTool(
    "fill_rect",
    {
      title: "Fill rectangle",
      description: "Fill a rectangle with a color.",
      inputSchema: {
        name: nameParam,
        x: z.number().int(),
        y: z.number().int(),
        width: z.number().int().min(1),
        height: z.number().int().min(1),
        color: colorParam,
        layer: layerParam,
      },
    },
    async ({ name, x, y, width, height, color, layer }) => {
      try {
        await drawOnSprite(
          name,
          layer,
          `mcp.fillRect(img, MCP_ARGS.x, MCP_ARGS.y, MCP_ARGS.width, MCP_ARGS.height, mcp.color(MCP_ARGS.color))`,
          { x, y, width, height, color: parseColor(color) },
        );
        return text(`Filled rectangle on ${name}.aseprite.`);
      } catch (err) {
        return errorText((err as Error).message);
      }
    },
  );

  server.registerTool(
    "draw_polyline",
    {
      title: "Draw polyline",
      description: "Draw connected 1px segments through a list of points.",
      inputSchema: {
        name: nameParam,
        points: z.array(pointSchema).min(2),
        color: colorParam,
        layer: layerParam,
      },
    },
    async ({ name, points, color, layer }) => {
      try {
        await drawOnSprite(name, layer, `mcp.drawPolyline(img, MCP_ARGS.points, mcp.color(MCP_ARGS.color))`, {
          points,
          color: parseColor(color),
        });
        return text(`Drew polyline on ${name}.aseprite.`);
      } catch (err) {
        return errorText((err as Error).message);
      }
    },
  );

  server.registerTool(
    "draw_polygon",
    {
      title: "Draw polygon",
      description: "Draw a closed 1px polygon outline through a list of points.",
      inputSchema: {
        name: nameParam,
        points: z.array(pointSchema).min(3),
        color: colorParam,
        layer: layerParam,
      },
    },
    async ({ name, points, color, layer }) => {
      try {
        await drawOnSprite(
          name,
          layer,
          `mcp.drawPolyline(img, MCP_ARGS.points, mcp.color(MCP_ARGS.color))
           mcp.drawLine(img, MCP_ARGS.points[#MCP_ARGS.points].x, MCP_ARGS.points[#MCP_ARGS.points].y, MCP_ARGS.points[1].x, MCP_ARGS.points[1].y, mcp.color(MCP_ARGS.color))`,
          { points, color: parseColor(color) },
        );
        return text(`Drew polygon on ${name}.aseprite.`);
      } catch (err) {
        return errorText((err as Error).message);
      }
    },
  );

  server.registerTool(
    "fill_polygon",
    {
      title: "Fill polygon",
      description: "Fill a polygon (even-odd rule) through a list of points.",
      inputSchema: {
        name: nameParam,
        points: z.array(pointSchema).min(3),
        color: colorParam,
        layer: layerParam,
      },
    },
    async ({ name, points, color, layer }) => {
      try {
        await drawOnSprite(name, layer, `mcp.fillPolygon(img, MCP_ARGS.points, mcp.color(MCP_ARGS.color))`, {
          points,
          color: parseColor(color),
        });
        return text(`Filled polygon on ${name}.aseprite.`);
      } catch (err) {
        return errorText((err as Error).message);
      }
    },
  );

  server.registerTool(
    "flood_fill",
    {
      title: "Flood fill",
      description: "Fill a connected region of matching pixels (4-way). RGB sprites only.",
      inputSchema: {
        name: nameParam,
        x: z.number().int(),
        y: z.number().int(),
        color: colorParam,
        layer: layerParam,
      },
    },
    async ({ name, x, y, color, layer }) => {
      try {
        const result = await drawOnSprite(
          name,
          layer,
          `return { filled = mcp.floodFill(img, MCP_ARGS.x, MCP_ARGS.y, mcp.color(MCP_ARGS.color)) }`,
          { x, y, color: parseColor(color) },
        );
        return text(`Filled ${result.filled} pixel(s) on ${name}.aseprite.`);
      } catch (err) {
        return errorText((err as Error).message);
      }
    },
  );
}
