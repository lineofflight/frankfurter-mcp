import { expect, test } from "vitest";
import { FrankfurterClient } from "../src/frankfurter.js";

const run = process.env.RUN_SMOKE === "1";

test.skipIf(!run)(
  "live: latest rates include USD",
  async () => {
    const c = new FrankfurterClient("https://api.frankfurter.dev");
    const rows = await c.getRates({ base: "EUR", quotes: ["USD"] });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].quote).toBe("USD");
    expect(typeof rows[0].rate).toBe("number");
  },
  15000,
);
