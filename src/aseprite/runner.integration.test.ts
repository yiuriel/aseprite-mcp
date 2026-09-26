import assert from "node:assert/strict";
import test from "node:test";
import { runLua } from "./runner.ts";

const enabled = process.env.ASEPRITE_MCP_INTEGRATION === "1";
const options = { skip: enabled ? false : "set ASEPRITE_MCP_INTEGRATION=1 to run" };

test("runLua draws and returns structured data", options, async () => {
  const run = await runLua(`
    local s = Sprite(4, 4, ColorMode.RGB)
    local cel = s:newCel(s.layers[1], 1)
    cel.image:putPixel(1, 2, Color{r=10, g=20, b=30, a=255})
    local pc = app.pixelColor
    local p = cel.image:getPixel(1, 2)
    return { r = pc.rgbaR(p), g = pc.rgbaG(p), b = pc.rgbaB(p), a = pc.rgbaA(p) }
  `);
  assert.equal(run.ok, true, run.error ?? "runLua failed");
  assert.deepEqual(run.result, { r: 10, g: 20, b: 30, a: 255 });
});

test("runLua surfaces lua errors", options, async () => {
  const run = await runLua('error("boom")');
  assert.equal(run.ok, false);
  assert.match(run.error ?? "", /boom/);
});
