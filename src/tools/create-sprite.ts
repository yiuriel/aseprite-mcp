import fs from "node:fs/promises";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { colorToLua, parseColor } from "../aseprite/color.ts";
import { runLua } from "../aseprite/runner.ts";
import { ensureSpritesDir, resolveSpritePath } from "../aseprite/workspace.ts";
import { COLOR_DESCRIPTION, colorSchema } from "./color-schema.ts";

const COLOR_MODES = {
  rgb: "ColorMode.RGB",
  grayscale: "ColorMode.GRAYSCALE",
  indexed: "ColorMode.INDEXED",
} as const;

type ColorMode = keyof typeof COLOR_MODES;

export function registerCreateSprite(server: McpServer): void {
  server.registerTool(
    "create_sprite",
    {
      title: "Create sprite",
      description:
        "Create a new blank .aseprite file in the sprite workspace. Returns the absolute path used by the other sprite tools. Fails if the file already exists unless overwrite is true.",
      inputSchema: {
        name: z
          .string()
          .describe("Short sprite name; the file is written as <name>.aseprite."),
        width: z.number().int().min(1).max(4096).describe("Canvas width in pixels."),
        height: z.number().int().min(1).max(4096).describe("Canvas height in pixels."),
        colorMode: z
          .enum(["rgb", "grayscale", "indexed"])
          .optional()
          .describe("Pixel color mode. Defaults to rgb."),
        background: colorSchema
          .optional()
          .describe(`Optional fill color. ${COLOR_DESCRIPTION} Omit for a transparent canvas.`),
        overwrite: z
          .boolean()
          .optional()
          .describe("Replace the file if it already exists. Defaults to false."),
      },
    },
    async ({ name, width, height, colorMode, background, overwrite }) => {
      const mode = (colorMode ?? "rgb") as ColorMode;
      const outPath = resolveSpritePath(name);

      if (!overwrite) {
        const exists = await fs
          .access(outPath)
          .then(() => true)
          .catch(() => false);
        if (exists) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Sprite "${name}" already exists at ${outPath}. Pass overwrite: true to replace it.`,
              },
            ],
          };
        }
      }

      let fillColor = "";
      if (background !== undefined) {
        try {
          fillColor = `cel.image:clear(${colorToLua(parseColor(background))})`;
        } catch (err) {
          return {
            isError: true,
            content: [{ type: "text", text: (err as Error).message }],
          };
        }
      }

      await ensureSpritesDir();

      const run = await runLua(
        `
        local s = Sprite(MCP_ARGS.width, MCP_ARGS.height, ${COLOR_MODES[mode]})
        local cel = s:newCel(s.layers[1], 1)
        ${fillColor}
        local saved = s:saveAs(MCP_ARGS.outPath)
        if not saved then error("Aseprite failed to save the sprite") end
        return {
          path = MCP_ARGS.outPath,
          width = s.width,
          height = s.height,
          colorMode = MCP_ARGS.colorMode,
        }
        `,
        { width, height, outPath, colorMode: mode },
      );

      if (!run.ok || run.result === null) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Failed to create sprite: ${run.error ?? "unknown error"}`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `Created ${name}.aseprite (${width}x${height}, ${mode}) at ${outPath}`,
          },
        ],
      };
    },
  );
}
