import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { expect, test, vi } from "vitest";
import { FrankfurterClient } from "../src/frankfurter.js";
import { createMcpServer } from "../src/server.js";

async function connect(fc: FrankfurterClient): Promise<Client> {
  const server = createMcpServer(fc);
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "t", version: "0" });
  await Promise.all([server.connect(serverT), client.connect(clientT)]);
  return client;
}

test("get_rates input accepts only base, date, quotes", async () => {
  const fc = new FrankfurterClient("https://api.test");
  vi.spyOn(fc, "getRates").mockResolvedValue([]);
  const client = await connect(fc);

  const { tools } = await client.listTools();
  const getRates = tools.find((t) => t.name === "get_rates");
  const props = Object.keys(getRates?.inputSchema.properties ?? {}).sort();
  expect(props).toEqual(["base", "date", "quotes"]);
});

test("get_rates relays the records for a single date", async () => {
  const fc = new FrankfurterClient("https://api.test");
  const spy = vi
    .spyOn(fc, "getRates")
    .mockResolvedValue([{ date: "2024-03-15", base: "EUR", quote: "USD", rate: 1.08 }]);
  const client = await connect(fc);

  const res = await client.callTool({ name: "get_rates", arguments: { date: "2024-03-15" } });
  const text = (res.content as Array<{ type: string; text: string }>)[0].text;
  expect(JSON.parse(text)).toEqual([{ date: "2024-03-15", base: "EUR", quote: "USD", rate: 1.08 }]);
  expect(spy).toHaveBeenCalledWith({ base: undefined, date: "2024-03-15", quotes: undefined });
});
