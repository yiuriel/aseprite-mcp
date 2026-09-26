import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const DEFAULT_DIR = path.join(os.homedir(), "aseprite-mcp", "sprites");
const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function resolveSpritesDir(): string {
  const override = process.env.ASEPRITE_MCP_DIR?.trim();
  return override ? path.resolve(override) : DEFAULT_DIR;
}

export function resolveSpritePath(name: string): string {
  if (!NAME_PATTERN.test(name)) {
    throw new Error(
      `Invalid sprite name "${name}". Use letters, digits, dot, underscore, or hyphen (no path separators).`,
    );
  }
  return path.join(resolveSpritesDir(), `${name}.aseprite`);
}

export async function ensureSpritesDir(): Promise<string> {
  const dir = resolveSpritesDir();
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function requireSpritePath(name: string): Promise<string> {
  const spritePath = resolveSpritePath(name);
  const exists = await fs
    .access(spritePath)
    .then(() => true)
    .catch(() => false);
  if (!exists) {
    throw new Error(
      `Sprite "${name}" not found at ${spritePath}. Create it first with create_sprite.`,
    );
  }
  return spritePath;
}
