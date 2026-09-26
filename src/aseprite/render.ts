import { runLua } from "./runner.ts";
import { requireSpritePath } from "./workspace.ts";

export interface RenderOptions {
  scale?: number;
  hideGuides?: boolean;
  frame?: number;
}

export interface RenderResult {
  width: number;
  height: number;
  outputWidth: number;
  outputHeight: number;
}

export function autoScale(width: number, height: number, target = 192, max = 16): number {
  const largest = Math.max(width, height);
  if (largest <= 0) return 1;
  return Math.max(1, Math.min(max, Math.floor(target / largest)));
}

export async function renderPng(
  name: string,
  outPath: string,
  options: RenderOptions = {},
): Promise<RenderResult> {
  const spritePath = await requireSpritePath(name);
  const scale = options.scale ?? 1;
  const hideGuides = options.hideGuides ?? true;
  const frame = options.frame ?? 1;

  const run = await runLua(
    `
    local s = app.open(MCP_ARGS.spritePath)
    if not s then error("Could not open sprite: " .. MCP_ARGS.spritePath) end
    if MCP_ARGS.hideGuides then mcp.hideGuides(s) end
    if MCP_ARGS.frame < 1 or MCP_ARGS.frame > #s.frames then error("Frame out of range") end
    app.activeFrame = s.frames[MCP_ARGS.frame]
    local srcW, srcH = s.width, s.height
    if MCP_ARGS.scale ~= 1 then s:resize(srcW * MCP_ARGS.scale, srcH * MCP_ARGS.scale) end
    app.command.ExportSpriteSheet{
      ui = false,
      type = "horizontal",
      frameRange = tostring(MCP_ARGS.frame),
      textureFilename = MCP_ARGS.outPath,
      targetSprite = s,
    }
    local f = io.open(MCP_ARGS.outPath, "r")
    if not f then error("Failed to export png") end
    f:close()
    return { width = srcW, height = srcH, outputWidth = s.width, outputHeight = s.height }
    `,
    { spritePath, outPath, scale, hideGuides, frame },
  );

  if (!run.ok || run.result === null) {
    throw new Error(run.error ?? "unknown error");
  }
  return run.result as RenderResult;
}
