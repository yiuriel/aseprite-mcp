import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runLua } from "../aseprite/runner.ts";
import { applyPixels, normalizePixels } from "./set-pixels.ts";

const enabled = process.env.ASEPRITE_MCP_INTEGRATION === "1";
const options = { skip: enabled ? false : "set ASEPRITE_MCP_INTEGRATION=1 to run" };

async function withWorkspace(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "aseprite-mcp-pix-"));
  const previous = process.env.ASEPRITE_MCP_DIR;
  process.env.ASEPRITE_MCP_DIR = dir;
  try {
    await fn(dir);
  } finally {
    if (previous === undefined) delete process.env.ASEPRITE_MCP_DIR;
    else process.env.ASEPRITE_MCP_DIR = previous;
    await fs.rm(dir, { recursive: true, force: true });
  }
}

async function createSprite(dir: string, name: string, size: number): Promise<string> {
  const target = path.join(dir, `${name}.aseprite`);
  const run = await runLua(
    `
    local s = Sprite(MCP_ARGS.size, MCP_ARGS.size, ColorMode.RGB)
    s:newCel(s.layers[1], 1)
    if not s:saveAs(MCP_ARGS.target) then error("save failed") end
    return { ok = true }
    `,
    { size, target },
  );
  assert.equal(run.ok, true, run.error ?? "create failed");
  return target;
}

function readPixels(target: string, points: { x: number; y: number }[]) {
  return runLua(
    `
    local s = app.open(MCP_ARGS.target)
    local img = s.cels[1].image
    local pc = app.pixelColor
    local out = {}
    for _, p in ipairs(MCP_ARGS.points) do
      local c = img:getPixel(p.x, p.y)
      out[#out + 1] = { pc.rgbaR(c), pc.rgbaG(c), pc.rgbaB(c), pc.rgbaA(c) }
    end
    return { pixels = out }
    `,
    { target, points },
  );
}

test("applyPixels writes colors and persists them", options, async () => {
  await withWorkspace(async (dir) => {
    const target = await createSprite(dir, "hero", 4);

    const summary = await applyPixels(
      "hero",
      normalizePixels([
        { x: 0, y: 0, color: "#ff0000" },
        { x: 3, y: 3, color: { r: 10, g: 20, b: 30, a: 128 } },
      ]),
    );
    assert.equal(summary.count, 2);
    assert.equal(summary.width, 4);
    assert.equal(summary.height, 4);

    const read = await readPixels(target, [
      { x: 0, y: 0 },
      { x: 3, y: 3 },
      { x: 1, y: 1 },
    ]);
    assert.equal(read.ok, true, read.error ?? "read failed");
    assert.deepEqual(read.result, {
      pixels: [
        [255, 0, 0, 255],
        [10, 20, 30, 128],
        [0, 0, 0, 0],
      ],
    });
  });
});

test("applyPixels rejects out-of-bounds batches without writing", options, async () => {
  await withWorkspace(async (dir) => {
    const target = await createSprite(dir, "hero", 4);
    await applyPixels("hero", normalizePixels([{ x: 1, y: 1, color: "#00ff00" }]));

    await assert.rejects(
      () =>
        applyPixels(
          "hero",
          normalizePixels([
            { x: 2, y: 2, color: "#0000ff" },
            { x: 9, y: 9, color: "#0000ff" },
          ]),
        ),
      /Out of bounds/,
    );

    const read = await readPixels(target, [
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ]);
    assert.deepEqual(read.result, {
      pixels: [
        [0, 255, 0, 255],
        [0, 0, 0, 0],
      ],
    });
  });
});

test("applyPixels errors when the sprite is missing", options, async () => {
  await withWorkspace(async () => {
    await assert.rejects(
      () => applyPixels("nope", normalizePixels([{ x: 0, y: 0, color: "#fff" }])),
      /not found/,
    );
  });
});
