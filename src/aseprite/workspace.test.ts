import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { ensureSpritesDir, resolveSpritePath, resolveSpritesDir } from "./workspace.ts";

function withEnv(dir: string, fn: () => void): void {
  const previous = process.env.ASEPRITE_MCP_DIR;
  process.env.ASEPRITE_MCP_DIR = dir;
  try {
    fn();
  } finally {
    if (previous === undefined) delete process.env.ASEPRITE_MCP_DIR;
    else process.env.ASEPRITE_MCP_DIR = previous;
  }
}

test("resolves sprite paths inside the configured directory", () => {
  withEnv("/tmp/aseprite-mcp-test", () => {
    assert.equal(resolveSpritesDir(), "/tmp/aseprite-mcp-test");
    assert.equal(
      resolveSpritePath("hero_01"),
      path.join("/tmp/aseprite-mcp-test", "hero_01.aseprite"),
    );
  });
});

test("defaults to the home workspace when unset", () => {
  const previous = process.env.ASEPRITE_MCP_DIR;
  delete process.env.ASEPRITE_MCP_DIR;
  try {
    assert.equal(resolveSpritesDir(), path.join(os.homedir(), "aseprite-mcp", "sprites"));
  } finally {
    if (previous !== undefined) process.env.ASEPRITE_MCP_DIR = previous;
  }
});

test("rejects names that could escape the workspace", () => {
  withEnv("/tmp/aseprite-mcp-test", () => {
    for (const bad of ["", "..", "../evil", "a/b", ".hidden", "has space", "x\\y"]) {
      assert.throws(() => resolveSpritePath(bad), /Invalid sprite name/, `should reject ${bad}`);
    }
  });
});

test("ensureSpritesDir creates the directory", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "aseprite-mcp-ws-"));
  const target = path.join(dir, "nested", "sprites");
  const previous = process.env.ASEPRITE_MCP_DIR;
  process.env.ASEPRITE_MCP_DIR = target;
  try {
    await ensureSpritesDir();
    const stat = await fs.stat(target);
    assert.ok(stat.isDirectory());
  } finally {
    if (previous === undefined) delete process.env.ASEPRITE_MCP_DIR;
    else process.env.ASEPRITE_MCP_DIR = previous;
    await fs.rm(dir, { recursive: true, force: true });
  }
});
