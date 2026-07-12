import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildServer } from "./server.js";
import { createStore } from "../db/database.js";

export async function serveStdio(): Promise<void> {
  const server = buildServer(await createStore());
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stdio transport owns stdout; all logging must go to stderr
  console.error("superpower MCP server running on stdio");
}
