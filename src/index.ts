import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express, { type Express } from "express";
import { createMcpServer } from "./server.js";

export function createApp(): Express {
  const app = express();

  app.get("/healthz", (_req, res) => {
    res.json({ ok: true });
  });

  // Note: no body-parser on the MCP route. On @modelcontextprotocol/sdk >=1.13
  // the Streamable HTTP server transport reads the raw request stream itself
  // (via its Hono-based web-standard adapter). Pre-parsing the body with
  // express.json() drains that stream and the request hangs, so the transport
  // owns body parsing for this route.
  app.post("/", async (req, res) => {
    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res);
  });

  const methodNotAllowed = (_req: express.Request, res: express.Response) => {
    res
      .status(405)
      .json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed." }, id: null });
  };
  app.get("/", methodNotAllowed);
  app.delete("/", methodNotAllowed);

  return app;
}

function main(): void {
  const port = Number(process.env.PORT ?? 3000);
  createApp().listen(port, () => {
    console.log(`frankfurter-mcp listening on :${port}`);
  });
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main();
}
