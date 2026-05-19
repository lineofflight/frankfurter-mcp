import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { expect, test, vi } from "vitest";
import pkg from "../package.json" with { type: "json" };
import { FrankfurterClient } from "../src/frankfurter.js";
import { createMcpServer } from "../src/server.js";

test("server exposes get_rates and convert", async () => {
  const fc = new FrankfurterClient("https://api.test");
  vi.spyOn(fc, "getRates").mockResolvedValue([]);
  const server = createMcpServer(fc);

  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "t", version: "0" });
  await Promise.all([server.connect(serverT), client.connect(clientT)]);

  const tools = await client.listTools();
  const names = tools.tools.map((t) => t.name).sort();
  expect(names).toEqual(["convert", "get_rates"]);

  const caps = client.getServerVersion();
  expect(caps?.name).toBe("frankfurter");
  expect(caps?.version).toBe(pkg.version);
});
