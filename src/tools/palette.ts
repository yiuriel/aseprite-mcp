import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { type RampSpace, type Rgba, interpolateRamp, parseColor } from "../aseprite/color.ts";
import { runLua } from "../aseprite/runner.ts";
import { requireSpritePath } from "../aseprite/workspace.ts";
import { colorSchema } from "./color-schema.ts";
import { errorText, json, text } from "./result.ts";

export interface PaletteResult {
  count: number;
  colors: string[];
}

export async function readPalette(name: string): Promise<PaletteResult> {
  const spritePath = await requireSpritePath(name);
  const run = await runLua(
    `
    local s = app.open(MCP_ARGS.path)
    if not s then error("Could not open sprite: " .. MCP_ARGS.path) end
    local pal = s.palettes[1]
    local colors = {}
    for i = 0, #pal - 1 do
      local c = pal:getColor(i)
      colors[#colors + 1] = string.format("#%02x%02x%02x%02x", c.red, c.green, c.blue, c.alpha)
    end
    return { count = #pal, colors = colors }
    `,
    { path: spritePath },
  );

  if (!run.ok || run.result === null) throw new Error(run.error ?? "unknown error");
  return run.result as PaletteResult;
}

export async function applyPalette(
  name: string,
  colors: Rgba[],
  mode: "replace" | "append" = "replace",
): Promise<number> {
  if (colors.length === 0) throw new Error("Palette must contain at least one color.");
  const spritePath = await requireSpritePath(name);

  const run = await runLua(
    `
    local s = app.open(MCP_ARGS.path)
    if not s then error("Could not open sprite: " .. MCP_ARGS.path) end
    local pal = s.palettes[1]
    local colors = MCP_ARGS.colors
    if MCP_ARGS.mode == "append" then
      local base = #pal
      pal:resize(base + #colors)
      for i, c in ipairs(colors) do pal:setColor(base + i - 1, mcp.color(c)) end
    else
      pal:resize(#colors)
      for i, c in ipairs(colors) do pal:setColor(i - 1, mcp.color(c)) end
    end
    s:setPalette(pal)
    if not s:saveAs(MCP_ARGS.path) then error("Failed to save sprite") end
    return { count = #pal }
    `,
    { path: spritePath, colors, mode },
  );

  if (!run.ok || run.result === null) throw new Error(run.error ?? "unknown error");
  return (run.result as { count: number }).count;
}

export function registerPalette(server: McpServer): void {
  server.registerTool(
    "get_palette",
    {
      title: "Get palette",
      description: "Return the sprite's palette as #rrggbbaa hex strings.",
      inputSchema: {
        name: z.string().describe("Sprite name."),
      },
    },
    async ({ name }) => {
      try {
        return json(await readPalette(name));
      } catch (err) {
        return errorText((err as Error).message);
      }
    },
  );

  server.registerTool(
    "set_palette",
    {
      title: "Set palette",
      description:
        "Replace or append palette colors. Provide either an explicit list of colors or a ramp (from/to/steps/space) to generate one.",
      inputSchema: {
        name: z.string().describe("Sprite name."),
        mode: z.enum(["replace", "append"]).optional().describe("Defaults to replace."),
        colors: z.array(colorSchema).min(1).optional().describe("Explicit palette colors."),
        ramp: z
          .object({
            from: colorSchema,
            to: colorSchema,
            steps: z.number().int().min(2).max(256),
            space: z.enum(["rgb", "hsl", "hsv"]).optional().describe("Defaults to rgb."),
          })
          .optional()
          .describe("Generate a ramp instead of passing colors."),
      },
    },
    async ({ name, mode, colors, ramp }) => {
      try {
        let resolved: Rgba[];
        if (ramp) {
          resolved = interpolateRamp(
            parseColor(ramp.from),
            parseColor(ramp.to),
            ramp.steps,
            (ramp.space ?? "rgb") as RampSpace,
          );
        } else if (colors) {
          resolved = colors.map((color) => parseColor(color));
        } else {
          return errorText("Provide either `colors` or a `ramp`.");
        }

        const count = await applyPalette(name, resolved, mode ?? "replace");
        return text(`Palette now has ${count} color(s) on ${name}.aseprite.`);
      } catch (err) {
        return errorText((err as Error).message);
      }
    },
  );
}
