import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

const enabled = process.env.ASEPRITE_MCP_INTEGRATION === "1";
const options = { skip: enabled ? false : "set ASEPRITE_MCP_INTEGRATION=1 to run" };

async function withClient(fn: (client: Client, dir: string) => Promise<void>): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "aseprite-mcp-e2e-"));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.resolve("src/index.ts")],
    env: { ...process.env, ASEPRITE_MCP_DIR: dir } as Record<string, string>,
    stderr: "ignore",
  });
  const client = new Client({ name: "e2e", version: "1.0.0" });
  await client.connect(transport);
  try {
    await fn(client, dir);
  } finally {
    await client.close();
    await fs.rm(dir, { recursive: true, force: true });
  }
}

function textOf(result: CallToolResult): string {
  return result.content
    .filter((item): item is { type: "text"; text: string } => item.type === "text")
    .map((item) => item.text)
    .join("\n");
}

async function call(
  client: Client,
  name: string,
  args: Record<string, unknown>,
): Promise<CallToolResult> {
  return (await client.callTool({ name, arguments: args })) as CallToolResult;
}

test("isometric workflow end to end", options, async () => {
  await withClient(async (client, dir) => {
    const { tools } = await client.listTools();
    const names = new Set(tools.map((tool) => tool.name));
    for (const expected of [
      "create_sprite",
      "set_pixels",
      "preview",
      "get_sprite_info",
      "get_pixels",
      "create_layer",
      "update_layer",
      "delete_layer",
      "duplicate_layer",
      "draw_line",
      "fill_rect",
      "fill_polygon",
      "flood_fill",
      "draw_iso_tile",
      "draw_iso_cube",
      "create_iso_guide",
      "get_palette",
      "set_palette",
      "export_png",
    ]) {
      assert.ok(names.has(expected), `missing tool ${expected}`);
    }

    let res = await call(client, "create_sprite", {
      name: "iso",
      width: 64,
      height: 64,
      background: "#202020",
    });
    assert.ok(!res.isError, textOf(res));

    res = await call(client, "create_iso_guide", { name: "iso" });
    assert.ok(!res.isError, textOf(res));

    res = await call(client, "get_sprite_info", { name: "iso" });
    const info = JSON.parse(textOf(res));
    assert.equal(info.width, 64);
    const guide = info.layers.find((layer: { isGuide: boolean }) => layer.isGuide);
    assert.ok(guide, "guide layer exists");
    assert.equal(guide.locked, true);

    res = await call(client, "create_layer", { name: "iso", layer: "art" });
    assert.ok(!res.isError, textOf(res));

    res = await call(client, "draw_iso_cube", {
      name: "iso",
      x: 0,
      y: 0,
      topColor: "#00ff00",
      leftColor: "#008800",
      rightColor: "#004400",
      outlineColor: "#000000",
      layer: "art",
    });
    assert.ok(!res.isError, textOf(res));

    for (const [x, y, expected] of [
      [15, 8, "#00ff00ff"],
      [7, 16, "#008800ff"],
      [24, 16, "#004400ff"],
    ] as const) {
      const pixel = await call(client, "get_pixels", { name: "iso", x, y, width: 1, height: 1, layer: "art" });
      assert.ok(textOf(pixel).includes(expected), `expected ${expected} at ${x},${y}: ${textOf(pixel)}`);
    }

    res = await call(client, "draw_line", {
      name: "iso",
      x0: 0,
      y0: 0,
      x1: 10,
      y1: 10,
      color: "#ffffff",
      layer: "art",
    });
    assert.ok(!res.isError, textOf(res));

    res = await call(client, "flood_fill", { name: "iso", x: 15, y: 8, color: "#ffff00", layer: "art" });
    assert.ok(!res.isError, textOf(res));

    res = await call(client, "set_palette", {
      name: "iso",
      ramp: { from: "#ff0000", to: "#0000ff", steps: 5, space: "hsl" },
    });
    assert.ok(!res.isError, textOf(res));

    res = await call(client, "get_palette", { name: "iso" });
    const palette = JSON.parse(textOf(res));
    assert.equal(palette.count, 5);
    assert.equal(palette.colors[0].slice(0, 7), "#ff0000");
    assert.equal(palette.colors[4].slice(0, 7), "#0000ff");

    res = await call(client, "preview", { name: "iso", scale: 2, showGuides: false });
    const image = res.content.find(
      (item): item is { type: "image"; data: string; mimeType: string } => item.type === "image",
    );
    assert.ok(image && image.data.length > 0, "preview returns image data");
    assert.equal(image.mimeType, "image/png");

    res = await call(client, "export_png", { name: "iso", scale: 2 });
    assert.ok(!res.isError, textOf(res));
    const exported = await fs.readFile(path.join(dir, "iso.png"));
    assert.ok(exported.length > 0, "png file written");
    assert.equal(exported.subarray(1, 4).toString("ascii"), "PNG");

    res = await call(client, "update_layer", { name: "iso", layer: "art", opacity: 200 });
    assert.ok(!res.isError, textOf(res));

    res = await call(client, "duplicate_layer", { name: "iso", layer: "art", newName: "art copy" });
    assert.ok(!res.isError, textOf(res));

    res = await call(client, "delete_layer", { name: "iso", layer: "art copy" });
    assert.ok(!res.isError, textOf(res));

    res = await call(client, "delete_layer", { name: "iso", layer: "x" });
    assert.ok(res.isError, "deleting a missing layer errors");
  });
});
