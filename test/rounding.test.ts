import { expect, test } from "vitest";
import { roundToCurrency } from "../src/rounding.js";

test("rounds USD to 2 decimals", () => {
  expect(roundToCurrency(12.3456, "USD")).toEqual({ value: 12.35, rounded: true });
});

test("rounds JPY to 0 decimals", () => {
  expect(roundToCurrency(1234.56, "JPY")).toEqual({ value: 1235, rounded: true });
});

test("rounds BHD to 3 decimals", () => {
  expect(roundToCurrency(1.23456, "BHD")).toEqual({ value: 1.235, rounded: true });
});

test("unknown currency returns unrounded, rounded=false", () => {
  expect(roundToCurrency(1.23456, "ZZZ")).toEqual({ value: 1.23456, rounded: false });
});
