import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { expect, test, vi } from "vitest";
import { FrankfurterClient } from "../src/frankfurter.js";
import { createMcpServer } from "../src/server.js";

test("list_providers returns a trimmed summary per provider", async () => {
  const fc = new FrankfurterClient("https://api.test");
  vi.spyOn(fc, "getProviders").mockResolvedValue([
    {
      key: "UST",
      name: "U.S. Department of the Treasury",
      country_code: "US",
      rate_type: "reporting rate",
      pivot_currency: "USD",
      data_url: "https://fiscaldata.treasury.gov",
      terms_url: null,
      start_date: "2001-03-31",
      end_date: "2026-08-31",
      publish_cadence: "quarterly",
      frequency: "quarterly",
      publishes_missed: 0,
      currencies: ["EUR", "GBP", "JPY"],
    },
  ]);
  const server = createMcpServer(fc);

  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "t", version: "0" });
  await Promise.all([server.connect(serverT), client.connect(clientT)]);

  const res = await client.callTool({ name: "list_providers", arguments: {} });
  const text = (res.content as Array<{ type: string; text: string }>)[0].text;
  expect(JSON.parse(text)).toEqual([
    {
      key: "UST",
      name: "U.S. Department of the Treasury",
      country_code: "US",
      rate_type: "reporting rate",
      pivot_currency: "USD",
      frequency: "quarterly",
      start_date: "2001-03-31",
      end_date: "2026-08-31",
      currencies: 3,
    },
  ]);
});
