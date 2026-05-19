import { expect, test } from "vitest";
import pkg from "../package.json" with { type: "json" };
import serverJson from "../server.json" with { type: "json" };

// package.json is the single canonical version. server.ts reads it at runtime;
// server.json is kept in lockstep by the npm `version` lifecycle script. This
// guards against the two silently drifting again.
test("server.json version mirrors package.json", () => {
  expect(serverJson.version).toBe(pkg.version);
});
