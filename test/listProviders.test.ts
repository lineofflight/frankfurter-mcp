import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { expect, test, vi } from "vitest";
import { FrankfurterClient } from "../src/frankfurter.js";
import { createMcpServer } from "../src/server.js";

test("list_providers returns key+name only", async () => {
  const fc = new FrankfurterClient("https://api.test");
  vi.spyOn(fc, "getProviders").mockResolvedValue([
    { key: "ECB", name: "European Central Bank" },
    { key: "BAM", name: "Bank Al-Maghrib" },
  ]);
  const server = createMcpServer(fc);

  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "t", version: "0" });
  await Promise.all([server.connect(serverT), client.connect(clientT)]);

  const res = await client.callTool({ name: "list_providers", arguments: {} });
  const text = (res.content as Array<{ type: string; text: string }>)[0].text;
  expect(JSON.parse(text)).toEqual([
    { key: "ECB", name: "European Central Bank" },
    { key: "BAM", name: "Bank Al-Maghrib" },
  ]);
});
