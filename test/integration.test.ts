import type { Server } from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { FrankfurterClient } from "../src/frankfurter.js";
import latest from "./fixtures/latest.json" with { type: "json" };

// The upstream Frankfurter API is mocked at the FrankfurterClient boundary
// rather than with msw/node: @modelcontextprotocol/sdk's Streamable HTTP
// transport (>=1.13, Hono-based) is incompatible with msw's global HTTP
// interception over a loopback server, which deadlocks the MCP handshake.
// Stubbing the single outbound boundary keeps this test's intent intact —
// a real MCP client over HTTP, the upstream faithfully relayed.

let httpServer: Server;
let port: number;

beforeAll(async () => {
  vi.spyOn(FrankfurterClient.prototype, "getRates").mockResolvedValue(latest);
  const { createApp } = await import("../src/index.js");
  await new Promise<void>((resolve) => {
    httpServer = createApp().listen(0, () => {
      port = (httpServer.address() as { port: number }).port;
      resolve();
    });
  });
});
afterAll(() => {
  httpServer.close();
  vi.restoreAllMocks();
});

test("MCP client can call get_rates over HTTP", async () => {
  const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`));
  const client = new Client({ name: "it", version: "0" });
  await client.connect(transport);

  const res = await client.callTool({ name: "get_rates", arguments: {} });
  const text = (res.content as Array<{ type: string; text: string }>)[0].text;
  expect(JSON.parse(text)).toEqual(latest);

  await transport.close();
});
