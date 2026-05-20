import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { expect, test, vi } from "vitest";
import { FrankfurterClient } from "../src/frankfurter.js";
import { createMcpServer } from "../src/server.js";

test("list_currencies returns code->name map", async () => {
  const fc = new FrankfurterClient("https://api.test");
  vi.spyOn(fc, "getCurrencies").mockResolvedValue([
    { iso_code: "USD", name: "United States Dollar" },
    { iso_code: "EUR", name: "Euro" },
  ]);
  const server = createMcpServer(fc);

  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "t", version: "0" });
  await Promise.all([server.connect(serverT), client.connect(clientT)]);

  const res = await client.callTool({ name: "list_currencies", arguments: {} });
  const text = (res.content as Array<{ type: string; text: string }>)[0].text;
  expect(JSON.parse(text)).toEqual({
    USD: "United States Dollar",
    EUR: "Euro",
  });
});
