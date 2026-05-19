import { expect, test, vi } from "vitest";
import type { FrankfurterClient } from "../src/frankfurter.js";
import { runConvert } from "../src/tools/convert.js";

function clientReturning(rate: number, quote = "EUR", date = "2024-01-15") {
  return {
    getRates: vi.fn(async () => [{ date, base: "USD", quote, rate }]),
  } as unknown as FrankfurterClient;
}

test("returns a money object {amount, currency}, rounded to the target currency", async () => {
  const out = await runConvert({ amount: 100, from: "USD", to: "EUR" }, clientReturning(0.92137));
  expect(out).toEqual({ amount: 92.14, currency: "EUR" });
});

test("same currency short-circuits without an upstream call", async () => {
  const client = clientReturning(999);
  const out = await runConvert({ amount: 50, from: "USD", to: "USD" }, client);
  expect(out).toEqual({ amount: 50, currency: "USD" });
  expect(client.getRates).not.toHaveBeenCalled();
});

test("passes date through for historical conversion; does not return it", async () => {
  const client = clientReturning(0.9, "EUR", "2022-06-01");
  const out = await runConvert({ amount: 10, from: "USD", to: "EUR", date: "2022-06-01" }, client);
  expect(client.getRates).toHaveBeenCalledWith(
    expect.objectContaining({ base: "USD", quotes: ["EUR"], date: "2022-06-01" }),
  );
  expect(out).toEqual({ amount: 9, currency: "EUR" });
});

test("metal target: 8 significant figures, no float noise", async () => {
  const client = clientReturning(0.00022, "XAU");
  const out = await runConvert({ amount: 100, from: "USD", to: "XAU" }, client);
  // 100 * 0.00022 = 0.022000000000000002 (IEEE-754); clamped to 0.022.
  expect(out).toEqual({ amount: 0.022, currency: "XAU" });
});
