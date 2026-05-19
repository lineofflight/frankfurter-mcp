import { expect, test } from "vitest";
import { roundMoney } from "../src/rounding.js";

test("rounds known currencies to their ISO minor units", () => {
  expect(roundMoney(12.3456, "USD")).toBe(12.35);
  expect(roundMoney(1234.56, "JPY")).toBe(1235);
  expect(roundMoney(1.23456, "BHD")).toBe(1.235);
});

test("metal/unknown: 8 significant figures, clamps float noise", () => {
  expect(roundMoney(0.022000000000000002, "XAU")).toBe(0.022);
});

test("metal/unknown: preserves precision across magnitudes", () => {
  expect(roundMoney(0.00022345678, "XAU")).toBe(0.00022345678);
  expect(roundMoney(3012.3456789, "XAU")).toBe(3012.3457);
});
