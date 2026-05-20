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
  vi.spyOn(FrankfurterClient.prototype, "getRates").mockImplementation(async () => {
    await new Promise((resolve) => setTimeout(resolve, 25));
    return latest;
  });
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

async function callGetRatesOverHttp(clientName: string): Promise<unknown> {
  const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/`));
  const client = new Client({ name: clientName, version: "0" });
  let connected = false;

  try {
    await client.connect(transport);
    connected = true;
    const res = await client.callTool({ name: "get_rates", arguments: {} });
    const text = (res.content as Array<{ type: string; text: string }>)[0].text;
    return JSON.parse(text);
  } finally {
    if (connected) {
      await transport.close();
    }
  }
}

test("MCP client can call get_rates over HTTP", async () => {
  expect(await callGetRatesOverHttp("it")).toEqual(latest);
});

test("concurrent MCP clients can call get_rates over HTTP", async () => {
  await expect(
    Promise.all([callGetRatesOverHttp("it-1"), callGetRatesOverHttp("it-2")]),
  ).resolves.toEqual([latest, latest]);
});
