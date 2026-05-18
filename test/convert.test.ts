import { expect, test, vi } from "vitest";
import type { FrankfurterClient } from "../src/frankfurter.js";
import { runConvert } from "../src/tools/convert.js";

function clientReturning(rate: number, date = "2024-01-15") {
  return {
    getRates: vi.fn(async () => [{ date, base: "USD", quote: "EUR", rate }]),
  } as unknown as FrankfurterClient;
}

test("converts amount using fetched rate, rounded to target currency", async () => {
  const out = await runConvert({ amount: 100, from: "USD", to: "EUR" }, clientReturning(0.92137));
  expect(out).toEqual({
    amount: 100,
    from: "USD",
    to: "EUR",
    rate: 0.92137,
    date: "2024-01-15",
    result: 92.14,
  });
});

test("same currency short-circuits to rate 1", async () => {
  const client = clientReturning(999);
  const out = await runConvert({ amount: 50, from: "USD", to: "USD" }, client);
  expect(out.rate).toBe(1);
  expect(out.result).toBe(50);
  expect(client.getRates).not.toHaveBeenCalled();
});

test("passes date through for historical conversion", async () => {
  const client = clientReturning(0.9, "2022-06-01");
  const out = await runConvert({ amount: 10, from: "USD", to: "EUR", date: "2022-06-01" }, client);
  expect(client.getRates).toHaveBeenCalledWith(
    expect.objectContaining({ base: "USD", quotes: ["EUR"], date: "2022-06-01" }),
  );
  expect(out.date).toBe("2022-06-01");
});

test("converting into a metal returns the raw unrounded product", async () => {
  // XAU/XAG/XPT/XPD have no ISO 4217 minor unit, so roundToCurrency returns the
  // value unrounded (rounded:false): transparency over false precision.
  const client = {
    getRates: vi.fn(async () => [
      { date: "2024-01-15", base: "USD", quote: "XAU", rate: 0.000414 },
    ]),
  } as unknown as FrankfurterClient;
  const out = await runConvert({ amount: 2, from: "USD", to: "XAU" }, client);
  expect(out.result).toBe(2 * 0.000414);
  expect(out.rate).toBe(0.000414);
});
