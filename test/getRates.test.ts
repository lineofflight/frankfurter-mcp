import { expect, test } from "vitest";
import { validateGetRates } from "../src/tools/getRates.js";

test("accepts latest (no args)", () => {
  expect(validateGetRates({})).toBeNull();
});

test("accepts single date", () => {
  expect(validateGetRates({ date: "2024-03-15" })).toBeNull();
});

test("rejects date combined with start/end", () => {
  expect(
    validateGetRates({
      date: "2024-03-15",
      start: "2024-01-01",
      end: "2024-02-01",
      quotes: ["USD"],
    }),
  ).toMatch(/mutually exclusive/i);
});

test("rejects half a range", () => {
  expect(validateGetRates({ start: "2024-01-01", quotes: ["USD"] })).toMatch(/both start and end/i);
});

test("rejects range without quotes", () => {
  expect(validateGetRates({ start: "2024-01-01", end: "2024-02-01" })).toMatch(/quotes.*required/i);
});

test("accepts a valid range", () => {
  expect(validateGetRates({ start: "2024-01-01", end: "2024-02-01", quotes: ["USD"] })).toBeNull();
});
