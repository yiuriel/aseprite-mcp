import { runLua } from "../aseprite/runner.ts";
import { requireSpritePath } from "../aseprite/workspace.ts";

export async function drawOnSprite(
  name: string,
  layer: string | undefined,
  inner: string,
  args: Record<string, unknown>,
  frame?: number,
): Promise<Record<string, unknown>> {
  const spritePath = await requireSpritePath(name);

  const run = await runLua(
    `
    local s = app.open(MCP_ARGS.path)
    if not s then error("Could not open sprite: " .. MCP_ARGS.path) end
    local layer, img = mcp.target(s, MCP_ARGS.layer, MCP_ARGS.frame)
    local w, h = s.width, s.height
    local extra = (function()
    ${inner}
    end)()
    if type(extra) ~= "table" then extra = {} end
    extra.width = w
    extra.height = h
    if not s:saveAs(MCP_ARGS.path) then error("Failed to save sprite") end
    return extra
    `,
    { path: spritePath, layer: layer ?? "", frame: frame ?? 1, ...args },
  );

  if (!run.ok) throw new Error(run.error ?? "unknown error");
  return (run.result ?? {}) as Record<string, unknown>;
}
