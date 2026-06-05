import { expect, test } from "vitest";
import { INSTRUCTIONS } from "../src/instructions.js";

test("instructions center on convert and nudge bulk queries to the docs", () => {
  expect(INSTRUCTIONS).toMatch(/`convert` is the primary tool/);
  expect(INSTRUCTIONS).toContain("https://frankfurter.dev/llms.txt");
});

test("instructions no longer reference the removed list_providers tool", () => {
  expect(INSTRUCTIONS).not.toMatch(/list_providers/);
});
