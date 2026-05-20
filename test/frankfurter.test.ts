import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, expect, test } from "vitest";
import { FrankfurterClient } from "../src/frankfurter.js";
import dated from "./fixtures/dated.json" with { type: "json" };
import latest from "./fixtures/latest.json" with { type: "json" };

const BASE = "https://api.test";
let lastUrl = "";

const server = setupServer(
  http.get(`${BASE}/v2/rates`, ({ request }) => {
    lastUrl = request.url;
    const u = new URL(request.url);
    if (u.searchParams.get("date") === "2024-03-15") return HttpResponse.json(dated);
    return HttpResponse.json(latest);
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test("fetches latest rates", async () => {
  const c = new FrankfurterClient(BASE);
  const out = await c.getRates({});
  expect(out).toEqual(latest);
});

test("serializes all params to v2 query", async () => {
  const c = new FrankfurterClient(BASE);
  await c.getRates({
    base: "USD",
    date: "2024-03-15",
    quotes: ["EUR", "GBP"],
    providers: ["ecb", "tcmb"],
  });
  const u = new URL(lastUrl);
  expect(u.searchParams.get("base")).toBe("USD");
  expect(u.searchParams.get("date")).toBe("2024-03-15");
  expect(u.searchParams.get("quotes")).toBe("EUR,GBP");
  expect(u.searchParams.get("providers")).toBe("ecb,tcmb");
});

test("maps from/to for ranges", async () => {
  const c = new FrankfurterClient(BASE);
  await c.getRates({ start: "2024-01-01", end: "2024-01-02", quotes: ["USD"] });
  const u = new URL(lastUrl);
  expect(u.searchParams.get("from")).toBe("2024-01-01");
  expect(u.searchParams.get("to")).toBe("2024-01-02");
});

test("throws with status and body on non-2xx", async () => {
  server.use(http.get(`${BASE}/v2/rates`, () => HttpResponse.text("not found", { status: 404 })));
  const c = new FrankfurterClient(BASE);
  await expect(c.getRates({})).rejects.toThrow(/404/);
});
