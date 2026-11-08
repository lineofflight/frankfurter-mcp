import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, expect, test, vi } from "vitest";
import { FrankfurterClient } from "../src/frankfurter.js";
import { createMcpServer } from "../src/server.js";

const connections: Client[] = [];
afterEach(async () => {
  await Promise.all(connections.splice(0).map((client) => client.close()));
  vi.restoreAllMocks();
});

async function connect() {
  const fc = new FrankfurterClient("https://api.test");
  vi.spyOn(fc, "getCurrencies").mockResolvedValue([
    { iso_code: "USD", name: "United States Dollar" },
    { iso_code: "CAD", name: "Canadian Dollar" },
    { iso_code: "EUR", name: "Euro" },
    { iso_code: "DEM", name: "Deutsche Mark", end_date: "2002-02-28" },
  ]);
  vi.spyOn(fc, "getProviders").mockResolvedValue([
    {
      key: "UST",
      name: "U.S. Department of the Treasury",
      country_code: "US",
      pivot_currency: "USD",
      currencies: ["EUR", "GBP"],
    },
    {
      key: "ECB",
      name: "European Central Bank",
      country_code: null,
      pivot_currency: "EUR",
      currencies: ["USD", "GBP"],
    },
    {
      key: "BOC",
      name: "Bank of Canada",
      country_code: "CA",
      pivot_currency: "CAD",
      currencies: ["USD"],
    },
  ]);
  vi.spyOn(fc, "getRates").mockImplementation(
    async ({ base = "EUR", quotes = ["USD"], provider }) => {
      if (provider === "BAD") throw new Error("unknown provider: BAD");
      return quotes.map((quote) => ({ base, quote, date: "2026-11-06", rate: 1.08 }));
    },
  );
  const server = createMcpServer(fc);
  const client = new Client({ name: "agent-experience", version: "0" });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(ct), server.connect(st)]);
  connections.push(client);
  return { client, fc };
}

async function call(client: Client, name: string, args: Record<string, unknown> = {}) {
  const result = await client.callTool({ name, arguments: args });
  const text = (result.content as Array<{ type: "text"; text: string }>)[0].text;
  return { result, text };
}

test.each([
  [" usd ", { USD: "United States Dollar" }],
  ["dollar", { USD: "United States Dollar", CAD: "Canadian Dollar" }],
  ["deutsche", { DEM: "Deutsche Mark" }],
  ["nonexistent", {}],
])("currency discovery filters code or name: %s", async (query, expected) => {
  const { client } = await connect();
  const { text } = await call(client, "list_currencies", { query });
  expect(JSON.parse(text)).toEqual(expected);
});

test.each([
  [{ query: " ust " }, ["UST"]],
  [{ query: "bank" }, ["ECB", "BOC"]],
  [{ country: "us" }, ["UST"]],
  [{ currency: "gbp" }, ["UST", "ECB"]],
  [{ country: "ca", currency: "cad" }, ["BOC"]],
  [{ query: "bank", currency: "gbp" }, ["ECB"]],
  [{ country: "CA", currency: "GBP" }, []],
])("provider discovery combines filters: %j", async (args, expected) => {
  const { client } = await connect();
  const { text } = await call(client, "list_providers", args);
  expect(JSON.parse(text).map((p: { key: string }) => p.key)).toEqual(expected);
});

test.each(["convert", "get_rates", "list_currencies", "list_providers"])(
  "%s emits compact JSON",
  async (name) => {
    const { client } = await connect();
    const args = name === "convert" ? { amount: 100, from: "EUR", to: "USD" } : {};
    const { text } = await call(client, name, args);
    expect(text).not.toContain("\n");
    expect(JSON.parse(text)).toBeTruthy();
  },
);

test("conversion details use the actual observation date and provider", async () => {
  const { client } = await connect();
  const { text } = await call(client, "convert", {
    amount: 100,
    from: "EUR",
    to: "USD",
    date: "2026-11-08",
    provider: "ecb",
    details: true,
  });
  expect(JSON.parse(text)).toEqual({
    amount: 108,
    currency: "USD",
    rate: 1.08,
    date: "2026-11-06",
    provider: "ECB",
  });
});

test("conversion details omit a provider for the blend", async () => {
  const { client } = await connect();
  const { text } = await call(client, "convert", {
    amount: 100,
    from: "EUR",
    to: "USD",
    details: true,
  });
  expect(JSON.parse(text)).toEqual({
    amount: 108,
    currency: "USD",
    rate: 1.08,
    date: "2026-11-06",
  });
});

test("identity conversion details do not invent an observation or provider", async () => {
  const { client, fc } = await connect();
  vi.mocked(fc.getRates).mockRejectedValue(new Error("identity must not fetch rates"));
  const { text } = await call(client, "convert", {
    amount: 12.345,
    from: "USD",
    to: "USD",
    date: "2026-11-08",
    provider: "UST",
    details: true,
  });
  expect(JSON.parse(text)).toEqual({ amount: 12.35, currency: "USD", rate: 1, date: null });
});

test("tiny published rates retain their precision in conversion details", async () => {
  const { client, fc } = await connect();
  vi.mocked(fc.getRates).mockResolvedValue([
    { base: "IRR", quote: "USD", date: "2026-11-06", rate: 0.00000054321 },
  ]);
  const { text } = await call(client, "convert", {
    amount: 100_000_000,
    from: "IRR",
    to: "USD",
    details: true,
  });
  expect(JSON.parse(text)).toEqual({
    amount: 54.32,
    currency: "USD",
    rate: 0.00000054321,
    date: "2026-11-06",
  });
  expect(fc.getRates).toHaveBeenCalledTimes(1);
});

test("provider comparison retains successful rates and identifies failures", async () => {
  const { client } = await connect();
  const { result, text } = await call(client, "get_rates", {
    provider: ["ECB", "BAD"],
    quotes: ["USD"],
  });
  expect(result.isError).not.toBe(true);
  expect(JSON.parse(text)).toEqual({
    rates: [{ base: "EUR", quote: "USD", date: "2026-11-06", rate: 1.08, provider: "ECB" }],
    errors: [{ provider: "BAD", message: "unknown provider: BAD" }],
  });
});

test("all failed providers return an error with provider identities", async () => {
  const { client } = await connect();
  const { result, text } = await call(client, "get_rates", { provider: ["BAD"] });
  expect(result.isError).toBe(true);
  expect(JSON.parse(text)).toEqual({
    rates: [],
    errors: [{ provider: "BAD", message: "unknown provider: BAD" }],
  });
});

test("provider keys are case-normalized and deduplicated", async () => {
  const { client } = await connect();
  const { text } = await call(client, "get_rates", { provider: ["ecb", "ECB"] });
  expect(JSON.parse(text)).toEqual([
    { base: "EUR", quote: "USD", date: "2026-11-06", rate: 1.08, provider: "ECB" },
  ]);
});

test("legacy providers remains validated without advertising another parameter", async () => {
  const { client } = await connect();
  const { tools } = await client.listTools();
  expect(
    Object.keys(tools.find((t) => t.name === "get_rates")?.inputSchema.properties ?? {}),
  ).toEqual(["base", "date", "quotes", "provider"]);
  const { text } = await call(client, "get_rates", { providers: "ecb" });
  expect(JSON.parse(text)[0].provider).toBe("ECB");
  const invalid = await call(client, "get_rates", { providers: 42 });
  expect(invalid.result.isError).toBe(true);
});

test("simultaneous provider aliases fail instead of silently selecting one", async () => {
  const { client } = await connect();
  const { result, text } = await call(client, "get_rates", {
    provider: ["ECB"],
    providers: ["UST"],
  });
  expect(result.isError).toBe(true);
  expect(text).toContain("provider");
  expect(text).toContain("providers");
});

test("an exact currency code takes precedence over name and longer-code matches", async () => {
  const { client, fc } = await connect();
  vi.mocked(fc.getCurrencies).mockResolvedValue([
    { iso_code: "USD", name: "United States Dollar" },
    { iso_code: "USDT", name: "Tether USD" },
  ]);
  const { text } = await call(client, "list_currencies", { query: "usd" });
  expect(JSON.parse(text)).toEqual({ USD: "United States Dollar" });
});

test("an exact provider key takes precedence over institution-name fragments", async () => {
  const { client, fc } = await connect();
  vi.mocked(fc.getProviders).mockResolvedValue([
    { key: "UST", name: "U.S. Department of the Treasury", currencies: ["EUR"] },
    { key: "RBA", name: "Reserve Bank of Australia", currencies: ["USD"] },
  ]);
  const { text } = await call(client, "list_providers", { query: "ust" });
  expect(JSON.parse(text).map((p: { key: string }) => p.key)).toEqual(["UST"]);
});

test("unknown rate arguments cannot silently change the requested rate source", async () => {
  const { client, fc } = await connect();
  const { result, text } = await call(client, "get_rates", { provder: "ECB", quotes: ["USD"] });
  expect(result.isError).toBe(true);
  expect(text).toContain("provder");
  expect(fc.getRates).not.toHaveBeenCalled();
});
