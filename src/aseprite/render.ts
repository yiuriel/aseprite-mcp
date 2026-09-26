import { runLua } from "./runner.ts";
import { requireSpritePath } from "./workspace.ts";

export interface RenderOptions {
  scale?: number;
  hideGuides?: boolean;
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

  const run = await runLua(
    `
    local s = app.open(MCP_ARGS.spritePath)
    if not s then error("Could not open sprite: " .. MCP_ARGS.spritePath) end
    if MCP_ARGS.hideGuides then mcp.hideGuides(s) end
    local srcW, srcH = s.width, s.height
    if MCP_ARGS.scale ~= 1 then s:resize(srcW * MCP_ARGS.scale, srcH * MCP_ARGS.scale) end
    if not s:saveCopyAs(MCP_ARGS.outPath) then error("Failed to export png") end
    return { width = srcW, height = srcH, outputWidth = s.width, outputHeight = s.height }
    `,
    { spritePath, outPath, scale, hideGuides },
  );

  if (!run.ok || run.result === null) {
    throw new Error(run.error ?? "unknown error");
  }
  return run.result as RenderResult;
}
