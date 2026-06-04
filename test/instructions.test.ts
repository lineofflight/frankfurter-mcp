import { expect, test } from "vitest";
import { INSTRUCTIONS } from "../src/instructions.js";

test("instructions center on convert and nudge bulk queries to the REST API", () => {
  expect(INSTRUCTIONS).toMatch(/`convert` is the primary tool/);
  expect(INSTRUCTIONS).toContain("https://api.frankfurter.dev/v2");
});

test("instructions no longer reference the removed list_providers tool", () => {
  expect(INSTRUCTIONS).not.toMatch(/list_providers/);
});
