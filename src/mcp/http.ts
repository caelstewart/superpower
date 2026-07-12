/**
 * Remote mode: Streamable HTTP transport, stateless (per 2026-07-28 MCP spec
 * direction — no sessions, load-balancer friendly). Auth: bearer key(s) from
 * SUPERPOWER_API_KEYS (comma-separated). OAuth 2.1 resource-server support is
 * the hosted-SaaS milestone; bearer keys are the v0 path (same as Jasper's
 * X-API-KEY fallback).
 */
import { createServer } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { buildServer } from "./server.js";
import { createStore } from "../db/database.js";

export async function serveHttp(port: number): Promise<void> {
  const store = await createStore();
  const keys = (process.env.SUPERPOWER_API_KEYS ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  const httpServer = createServer(async (req, res) => {
    if (req.url !== "/mcp") {
      res.writeHead(404).end();
      return;
    }
    if (keys.length > 0) {
      const auth = req.headers.authorization ?? "";
      const token = auth.replace(/^Bearer\s+/i, "");
      if (!keys.includes(token)) {
        res.writeHead(401, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "unauthorized" }));
        return;
      }
    }
    // Stateless: fresh server+transport per request; no session ids.
    const server = buildServer(store);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res);
  });

  await new Promise<void>((resolve) => httpServer.listen(port, resolve));
  console.error(
    `superpower MCP server on http://localhost:${port}/mcp (${keys.length > 0 ? "bearer auth" : "NO AUTH — dev only"})`
  );
}
