#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { asepriteBinaryPath } from "./config.ts";
import { registerCreateSprite } from "./tools/create-sprite.ts";
import { registerExport } from "./tools/export.ts";
import { registerIso } from "./tools/iso.ts";
import { registerLayers } from "./tools/layers.ts";
import { registerPalette } from "./tools/palette.ts";
import { registerPreview } from "./tools/preview.ts";
import { registerPrimitives } from "./tools/primitives.ts";
import { registerSetPixels } from "./tools/set-pixels.ts";
import { registerSpriteInfo } from "./tools/sprite-info.ts";

const server = new McpServer({
  name: "aseprite-mcp",
  version: "0.1.0",
});

registerCreateSprite(server);
registerSetPixels(server);
registerPreview(server);
registerSpriteInfo(server);
registerLayers(server);
registerPrimitives(server);
registerIso(server);
registerPalette(server);
registerExport(server);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`aseprite-mcp: connected (aseprite=${asepriteBinaryPath})`);
