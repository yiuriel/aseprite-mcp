#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { asepriteBinaryPath } from "./config.ts";
import { registerCreateSprite } from "./tools/create-sprite.ts";
import { registerSetPixels } from "./tools/set-pixels.ts";

const server = new McpServer({
  name: "aseprite-mcp",
  version: "0.1.0",
});

registerCreateSprite(server);
registerSetPixels(server);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`aseprite-mcp: connected (aseprite=${asepriteBinaryPath})`);
