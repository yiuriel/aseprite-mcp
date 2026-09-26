#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { asepriteBinaryPath } from "./config.ts";

const server = new McpServer({
  name: "aseprite-mcp",
  version: "0.1.0",
});

server.registerTool(
  "ping",
  {
    title: "Ping",
    description:
      "Health check. Confirms the server is running and reports the resolved Aseprite binary path.",
    inputSchema: {},
  },
  async () => ({
    content: [
      {
        type: "text",
        text: `aseprite-mcp alive\naseprite=${asepriteBinaryPath}`,
      },
    ],
  }),
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`aseprite-mcp: connected (aseprite=${asepriteBinaryPath})`);
