import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { runLua } from "../aseprite/runner.ts";
import { requireSpritePath } from "../aseprite/workspace.ts";
import { errorText, text } from "./result.ts";

async function openSave(name: string, body: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const spritePath = await requireSpritePath(name);
  const run = await runLua(
    `
    local s = app.open(MCP_ARGS.path)
    if not s then error("Could not open sprite: " .. MCP_ARGS.path) end
    ${body}
    if not s:saveAs(MCP_ARGS.path) then error("Failed to save sprite") end
    `,
    { path: spritePath, ...args },
  );
  if (!run.ok) throw new Error(run.error ?? "unknown error");
  return (run.result ?? {}) as Record<string, unknown>;
}

export async function createLayer(
  name: string,
  layerName: string,
  options: { visible?: boolean; locked?: boolean } = {},
): Promise<void> {
  await openSave(
    name,
    `
    if mcp.findLayer(s, MCP_ARGS.layerName) then error("Layer already exists: " .. MCP_ARGS.layerName) end
    local layer = s:newLayer()
    layer.name = MCP_ARGS.layerName
    if MCP_ARGS.visible ~= nil then layer.isVisible = MCP_ARGS.visible end
    if MCP_ARGS.locked ~= nil then layer.isEditable = not MCP_ARGS.locked end
    s:newCel(layer, 1)
    `,
    {
      layerName,
      visible: options.visible ?? null,
      locked: options.locked ?? null,
    },
  );
}

export async function updateLayer(
  name: string,
  layerName: string,
  changes: { name?: string; visible?: boolean; locked?: boolean; opacity?: number },
): Promise<void> {
  await openSave(
    name,
    `
    local layer = mcp.targetLayer(s, MCP_ARGS.layerName)
    if MCP_ARGS.newName ~= nil then layer.name = MCP_ARGS.newName end
    if MCP_ARGS.visible ~= nil then layer.isVisible = MCP_ARGS.visible end
    if MCP_ARGS.locked ~= nil then layer.isEditable = not MCP_ARGS.locked end
    if MCP_ARGS.opacity ~= nil then layer.opacity = MCP_ARGS.opacity end
    `,
    {
      layerName,
      newName: changes.name ?? null,
      visible: changes.visible ?? null,
      locked: changes.locked ?? null,
      opacity: changes.opacity ?? null,
    },
  );
}

export async function deleteLayer(name: string, layerName: string): Promise<void> {
  await openSave(
    name,
    `
    if #s.layers <= 1 then error("Cannot delete the only layer") end
    local layer = mcp.targetLayer(s, MCP_ARGS.layerName)
    s:deleteLayer(layer)
    `,
    { layerName },
  );
}

export async function duplicateLayer(name: string, layerName: string, newName?: string): Promise<void> {
  await openSave(
    name,
    `
    local src = mcp.targetLayer(s, MCP_ARGS.layerName)
    local dup = s:newLayer()
    dup.name = MCP_ARGS.newName or (src.name .. " copy")
    local srcCel = src:cel(1)
    if srcCel then
      local dstCel = s:newCel(dup, 1)
      dstCel.image:drawImage(srcCel.image, Point(0, 0))
    end
    `,
    { layerName, newName: newName ?? null },
  );
}

export function registerLayers(server: McpServer): void {
  server.registerTool(
    "create_layer",
    {
      title: "Create layer",
      description: "Add a new empty layer on top of the stack.",
      inputSchema: {
        name: z.string().describe("Sprite name."),
        layer: z.string().describe("Name for the new layer."),
        visible: z.boolean().optional(),
        locked: z.boolean().optional(),
      },
    },
    async ({ name, layer, visible, locked }) => {
      try {
        await createLayer(name, layer, { visible, locked });
        return text(`Created layer "${layer}" on ${name}.aseprite.`);
      } catch (err) {
        return errorText((err as Error).message);
      }
    },
  );

  server.registerTool(
    "update_layer",
    {
      title: "Update layer",
      description: "Change a layer's name, visibility, locked state, or opacity.",
      inputSchema: {
        name: z.string().describe("Sprite name."),
        layer: z.string().describe("Current layer name."),
        newName: z.string().optional().describe("Rename the layer."),
        visible: z.boolean().optional(),
        locked: z.boolean().optional(),
        opacity: z.number().int().min(0).max(255).optional(),
      },
    },
    async ({ name, layer, newName, visible, locked, opacity }) => {
      try {
        await updateLayer(name, layer, { name: newName, visible, locked, opacity });
        return text(`Updated layer "${layer}" on ${name}.aseprite.`);
      } catch (err) {
        return errorText((err as Error).message);
      }
    },
  );

  server.registerTool(
    "delete_layer",
    {
      title: "Delete layer",
      description: "Remove a layer. Refuses to delete the last remaining layer.",
      inputSchema: {
        name: z.string().describe("Sprite name."),
        layer: z.string().describe("Layer to delete."),
      },
    },
    async ({ name, layer }) => {
      try {
        await deleteLayer(name, layer);
        return text(`Deleted layer "${layer}" from ${name}.aseprite.`);
      } catch (err) {
        return errorText((err as Error).message);
      }
    },
  );

  server.registerTool(
    "duplicate_layer",
    {
      title: "Duplicate layer",
      description: "Copy a layer (with its first-frame pixels) into a new layer.",
      inputSchema: {
        name: z.string().describe("Sprite name."),
        layer: z.string().describe("Layer to copy."),
        newName: z.string().optional().describe('Defaults to "<layer> copy".'),
      },
    },
    async ({ name, layer, newName }) => {
      try {
        await duplicateLayer(name, layer, newName);
        return text(`Duplicated layer "${layer}" on ${name}.aseprite.`);
      } catch (err) {
        return errorText((err as Error).message);
      }
    },
  );
}
