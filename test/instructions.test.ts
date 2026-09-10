import { expect, test } from "vitest";
import { INSTRUCTIONS } from "../src/instructions.js";

test("instructions center on convert and nudge bulk queries to the docs", () => {
  expect(INSTRUCTIONS).toMatch(/`convert` is the primary tool/);
  expect(INSTRUCTIONS).toContain("https://frankfurter.dev/llms.txt");
});

test("instructions point provider discovery at list_providers", () => {
  expect(INSTRUCTIONS).toMatch(/list_providers/);
});

test("instructions state the blended-provider provenance, not a single source", () => {
  expect(INSTRUCTIONS).toMatch(/blended across 96 central banks and official sources/);
});

test("instructions explain provider for published figures and name UST", () => {
  expect(INSTRUCTIONS).toMatch(/Pass `provider`/);
  expect(INSTRUCTIONS).toContain("UST");
  expect(INSTRUCTIONS).toContain("`list_providers`");
});
