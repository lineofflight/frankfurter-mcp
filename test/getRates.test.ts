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

test("get_rates input accepts base, date, quotes and provider", async () => {
  const fc = new FrankfurterClient("https://api.test");
  vi.spyOn(fc, "getRates").mockResolvedValue([]);
  const client = await connect(fc);

  const { tools } = await client.listTools();
  const getRates = tools.find((t) => t.name === "get_rates");
  const props = Object.keys(getRates?.inputSchema.properties ?? {}).sort();
  expect(props).toEqual(["base", "date", "provider", "quotes"]);
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
  expect(spy).toHaveBeenCalledWith({
    base: undefined,
    date: "2024-03-15",
    quotes: undefined,
    provider: undefined,
  });
});

test("get_rates accepts a single quote code as a string", async () => {
  const fc = new FrankfurterClient("https://api.test");
  const spy = vi.spyOn(fc, "getRates").mockResolvedValue([]);
  const client = await connect(fc);

  const res = await client.callTool({ name: "get_rates", arguments: { quotes: "USD" } });
  expect(res.isError).toBeFalsy();
  expect(spy).toHaveBeenCalledWith(expect.objectContaining({ quotes: ["USD"] }));
});

test("get_rates passes provider through to the client", async () => {
  const fc = new FrankfurterClient("https://api.test");
  const spy = vi
    .spyOn(fc, "getRates")
    .mockResolvedValue([{ date: "2026-06-30", base: "USD", quote: "EUR", rate: 0.877 }]);
  const client = await connect(fc);

  await client.callTool({ name: "get_rates", arguments: { provider: "UST", base: "USD" } });
  expect(spy).toHaveBeenCalledWith(expect.objectContaining({ provider: "UST", base: "USD" }));
});
