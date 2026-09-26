export const RESULT_SENTINEL = "__ASEPRITE_MCP_RESULT__";
export const ERROR_SENTINEL = "__ASEPRITE_MCP_ERROR__";

export const LUA_HELPERS = String.raw`
local mcp = {}

mcp.guideLayerName = "symmetrical guides"
mcp.guideLayerPrefix = "_"

function mcp.color(t)
  return Color{r = t.r, g = t.g, b = t.b, a = t.a}
end

function mcp.isGuideLayer(layer)
  local name = layer.name
  return name == mcp.guideLayerName or name:sub(1, 1) == mcp.guideLayerPrefix
end

function mcp.hideGuides(sprite)
  for _, layer in ipairs(sprite.layers) do
    if mcp.isGuideLayer(layer) then layer.isVisible = false end
  end
end

function mcp.findLayer(sprite, name)
  for _, layer in ipairs(sprite.layers) do
    if layer.name == name then return layer end
  end
  return nil
end

function mcp.defaultLayer(sprite)
  for _, layer in ipairs(sprite.layers) do
    if not mcp.isGuideLayer(layer) then return layer end
  end
  return sprite.layers[1]
end

function mcp.targetLayer(sprite, name)
  local layer
  if name and name ~= "" then
    layer = mcp.findLayer(sprite, name)
    if not layer then error("Layer not found: " .. name) end
  else
    layer = mcp.defaultLayer(sprite)
  end
  if not layer then error("Sprite has no layers") end
  return layer
end

function mcp.celImage(sprite, layer, frame)
  local cel = layer:cel(frame)
  if not cel then cel = sprite:newCel(layer, frame) end
  return cel.image
end

function mcp.target(sprite, layerName, frame)
  local layer = mcp.targetLayer(sprite, layerName)
  return layer, mcp.celImage(sprite, layer, frame or 1)
end

function mcp.drawLine(img, x0, y0, x1, y1, color)
  x0 = math.floor(x0 + 0.5)
  y0 = math.floor(y0 + 0.5)
  x1 = math.floor(x1 + 0.5)
  y1 = math.floor(y1 + 0.5)
  local dx = math.abs(x1 - x0)
  local dy = math.abs(y1 - y0)
  local sx = (x0 < x1) and 1 or -1
  local sy = (y0 < y1) and 1 or -1
  local err = dx - dy
  while true do
    img:drawPixel(x0, y0, color)
    if x0 == x1 and y0 == y1 then break end
    local e2 = 2 * err
    if e2 > -dy then err = err - dy; x0 = x0 + sx end
    if e2 < dx then err = err + dx; y0 = y0 + sy end
  end
end

function mcp.drawRect(img, x, y, w, h, color)
  if w <= 0 or h <= 0 then return end
  mcp.drawLine(img, x, y, x + w - 1, y, color)
  mcp.drawLine(img, x, y + h - 1, x + w - 1, y + h - 1, color)
  mcp.drawLine(img, x, y, x, y + h - 1, color)
  mcp.drawLine(img, x + w - 1, y, x + w - 1, y + h - 1, color)
end

function mcp.fillRect(img, x, y, w, h, color)
  for yy = y, y + h - 1 do
    for xx = x, x + w - 1 do
      img:drawPixel(xx, yy, color)
    end
  end
end

function mcp.drawPolyline(img, pts, color)
  for i = 1, #pts - 1 do
    mcp.drawLine(img, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, color)
  end
end

function mcp.fillPolygon(img, pts, color)
  local n = #pts
  if n < 3 then return end
  local minY, maxY = pts[1].y, pts[1].y
  for _, p in ipairs(pts) do
    if p.y < minY then minY = p.y end
    if p.y > maxY then maxY = p.y end
  end
  for y = math.floor(minY), math.ceil(maxY) do
    local nodes = {}
    local j = n
    for i = 1, n do
      local yi, yj = pts[i].y, pts[j].y
      local xi, xj = pts[i].x, pts[j].x
      if (yi < y and yj >= y) or (yj < y and yi >= y) then
        nodes[#nodes + 1] = xi + (y - yi) / (yj - yi) * (xj - xi)
      end
      j = i
    end
    table.sort(nodes)
    for k = 1, #nodes - 1, 2 do
      for px = math.floor(nodes[k] + 0.5), math.floor(nodes[k + 1] + 0.5) do
        img:drawPixel(px, y, color)
      end
    end
  end
end

function mcp.floodFill(img, x, y, color)
  local target = img:getPixel(x, y)
  local replacement = app.pixelColor.rgba(color.red, color.green, color.blue, color.alpha)
  if target == replacement then return 0 end
  local w, h = img.width, img.height
  local stack = { { x, y } }
  local filled = 0
  while #stack > 0 do
    local point = table.remove(stack)
    local px, py = point[1], point[2]
    if px >= 0 and py >= 0 and px < w and py < h and img:getPixel(px, py) == target then
      img:drawPixel(px, py, color)
      filled = filled + 1
      stack[#stack + 1] = { px + 1, py }
      stack[#stack + 1] = { px - 1, py }
      stack[#stack + 1] = { px, py + 1 }
      stack[#stack + 1] = { px, py - 1 }
    end
  end
  return filled
end
`;

export function luaString(value: string): string {
  return (
    '"' +
    value
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r") +
    '"'
  );
}

export function buildWrappedScript(body: string, argsPath: string): string {
  return `local function __mcp_read(p)
  local f = io.open(p, "r")
  if not f then return nil end
  local s = f:read("a")
  f:close()
  return s
end

local MCP_ARGS = json.decode(__mcp_read(${luaString(argsPath)}) or "{}") or {}
${LUA_HELPERS}
local function __mcp_main()
${body}
end

local __mcp_ok, __mcp_ret = pcall(__mcp_main)
if __mcp_ok then
  if type(__mcp_ret) ~= "table" then __mcp_ret = { value = __mcp_ret } end
  print("${RESULT_SENTINEL}" .. json.encode(__mcp_ret))
else
  print("${ERROR_SENTINEL}" .. tostring(__mcp_ret))
end
`;
}

export function filterStderr(stderr: string): string {
  return stderr
    .split(/\r?\n/)
    .filter((line) => !/Aseprite\/extensions\/.*\.lua:\d+:/.test(line))
    .join("\n")
    .trim();
}

export interface ParsedLuaOutput {
  kind: "result" | "error" | "none";
  value?: unknown;
  error?: string;
  parseError?: string;
}

export function parseLuaOutput(stdout: string): ParsedLuaOutput {
  const lines = stdout.split(/\r?\n/);
  const resultLine = lines.find((line) => line.startsWith(RESULT_SENTINEL));
  const errorLine = lines.find((line) => line.startsWith(ERROR_SENTINEL));

  if (errorLine) {
    return { kind: "error", error: errorLine.slice(ERROR_SENTINEL.length) };
  }

  if (resultLine) {
    try {
      return { kind: "result", value: JSON.parse(resultLine.slice(RESULT_SENTINEL.length)) };
    } catch (err) {
      return { kind: "result", parseError: (err as Error).message };
    }
  }

  return { kind: "none" };
}
