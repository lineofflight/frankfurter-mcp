# Focus the MCP on Conversion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `convert` the headline of the frankfurter-mcp server, trim `get_rates` to single-snapshot lookups, remove the `list_providers` tool, and redirect bulk/series/provider queries to the REST API — shipped as 0.4.0.

**Architecture:** A thin, stateless MCP proxy over Frankfurter's v2 API. Tools register against an `McpServer`; the single outbound boundary is `FrankfurterClient`. We narrow the tool surface (4 → 3 tools) and the client to match, then reframe the server `instructions` string to nudge non-conversion needs to `https://api.frankfurter.dev/v2`.

**Tech Stack:** TypeScript (Node 22, ESM/NodeNext), `@modelcontextprotocol/sdk`, Express, Zod. Tests: Vitest with the upstream stubbed at the `FrankfurterClient` boundary (and `msw` for the client's own unit tests). Lint/format: Biome. Build: `tsc`.

**Conventions for every task below:**
- `npm test` runs Vitest (the live smoke test is skipped unless `RUN_SMOKE=1`). Vitest does **not** typecheck (esbuild strips types), so type-level changes are verified with `npm run build` (tsc).
- Run targeted specs with `npx vitest run test/<file>.test.ts`.
- Keep each task green: build, test, and lint all pass before committing.

---

### Task 1: Remove the `list_providers` tool and the `getProviders` client method

`list_providers` only existed to feed `get_rates`' `provider` filter, which Task 2 removes. Drop the tool, its client method, its type, and its test; update the tool-roster test.

**Files:**
- Delete: `src/tools/listProviders.ts`
- Delete: `test/listProviders.test.ts`
- Modify: `src/server.ts:8,22`
- Modify: `src/frankfurter.ts:1,41-50` (remove `getProviders` + `Provider` import)
- Modify: `src/types.ts:8-11` (remove `Provider`)
- Modify: `test/server.test.ts:19`

- [ ] **Step 1: Update the tool-roster test to the new 3-tool surface**

In `test/server.test.ts`, change the expectation on line 19 from:

```ts
  expect(names).toEqual(["convert", "get_rates", "list_currencies", "list_providers"]);
```

to:

```ts
  expect(names).toEqual(["convert", "get_rates", "list_currencies"]);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/server.test.ts`
Expected: FAIL — the roster still includes `"list_providers"`, so `toEqual` reports an extra element.

- [ ] **Step 3: Delete the `list_providers` tool and its registration**

Delete the file `src/tools/listProviders.ts`.

In `src/server.ts`, remove the import line:

```ts
import { registerListProviders } from "./tools/listProviders.js";
```

and remove the registration call inside `createMcpServer`:

```ts
  registerListProviders(server, client);
```

- [ ] **Step 4: Remove `getProviders` from the client and the `Provider` type**

In `src/frankfurter.ts`, change the imports line from:

```ts
import type { Currency, GetRatesParams, Provider, RateRecord } from "./types.js";
```

to:

```ts
import type { Currency, GetRatesParams, RateRecord } from "./types.js";
```

and delete the entire `getProviders` method (the whole block):

```ts
  async getProviders(): Promise<Provider[]> {
    const url = new URL("/v2/providers", this.baseUrl);
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Frankfurter API ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = (await res.json()) as Array<{ key: string; name: string }>;
    return data.map(({ key, name }) => ({ key, name }));
  }
```

In `src/types.ts`, delete the `Provider` interface:

```ts
export interface Provider {
  key: string;
  name: string;
}
```

- [ ] **Step 5: Delete the obsolete provider test**

Delete the file `test/listProviders.test.ts`.

- [ ] **Step 6: Verify the roster test passes, the build is clean, and lint passes**

Run: `npx vitest run test/server.test.ts`
Expected: PASS.

Run: `npm run build`
Expected: exits 0, no type errors (confirms nothing still references `Provider` or `getProviders`).

Run: `npm test`
Expected: all suites PASS (smoke skipped).

Run: `npm run lint`
Expected: "Checked N files" with no errors.

- [ ] **Step 7: Commit**

```bash
git add src/server.ts src/frankfurter.ts src/types.ts test/server.test.ts
git rm src/tools/listProviders.ts test/listProviders.test.ts
git commit -m "refactor: remove list_providers tool and getProviders client method"
```

---

### Task 2: Trim `get_rates` to single-snapshot lookups

Drop `start`/`end` (time series) and `provider` from the `get_rates` tool, delete the now-dead `validateGetRates`, and narrow `GetRatesParams` and the client's query serialization to `base`/`date`/`quotes`. Rewrite `get_rates`' description to redirect series/provider queries to REST.

**Files:**
- Rewrite: `test/getRates.test.ts`
- Modify: `src/tools/getRates.ts` (full rewrite of the module)
- Modify: `src/types.ts` (`GetRatesParams`)
- Modify: `src/frankfurter.ts` (`getRates` query building)
- Modify: `test/frankfurter.test.ts` (drop `providers` + the range test)
- Delete: `test/fixtures/range.json` (orphaned once the series path is gone)

- [ ] **Step 1: Replace `test/getRates.test.ts` with contract + behavior tests**

The old file tested `validateGetRates`, which is being deleted. Replace the entire contents of `test/getRates.test.ts` with:

```ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { expect, test, vi } from "vitest";
import { FrankfurterClient } from "../src/frankfurter.js";
import { createMcpServer } from "../src/server.js";

async function connect(fc: FrankfurterClient): Promise<Client> {
  const server = createMcpServer(fc);
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "t", version: "0" });
  await Promise.all([server.connect(serverT), client.connect(clientT)]);
  return client;
}

test("get_rates input accepts only base, date, quotes", async () => {
  const fc = new FrankfurterClient("https://api.test");
  vi.spyOn(fc, "getRates").mockResolvedValue([]);
  const client = await connect(fc);

  const { tools } = await client.listTools();
  const getRates = tools.find((t) => t.name === "get_rates");
  const props = Object.keys(getRates?.inputSchema.properties ?? {}).sort();
  expect(props).toEqual(["base", "date", "quotes"]);
});

test("get_rates relays the records for a single date", async () => {
  const fc = new FrankfurterClient("https://api.test");
  const spy = vi
    .spyOn(fc, "getRates")
    .mockResolvedValue([{ date: "2024-03-15", base: "EUR", quote: "USD", rate: 1.08 }]);
  const client = await connect(fc);

  const res = await client.callTool({ name: "get_rates", arguments: { date: "2024-03-15" } });
  const text = (res.content as Array<{ type: string; text: string }>)[0].text;
  expect(JSON.parse(text)).toEqual([{ date: "2024-03-15", base: "EUR", quote: "USD", rate: 1.08 }]);
  expect(spy).toHaveBeenCalledWith({ base: undefined, date: "2024-03-15", quotes: undefined });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/getRates.test.ts`
Expected: FAIL — the first test reports `props` includes `"end"`, `"provider"`, `"start"` (the tool still advertises them).

- [ ] **Step 3: Rewrite `src/tools/getRates.ts` to the trimmed contract**

Replace the entire contents of `src/tools/getRates.ts` with:

```ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { FrankfurterClient } from "../frankfurter.js";

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

export const getRatesShape = {
  base: z.string().length(3).optional().describe("ISO 4217 base currency. Default EUR."),
  date: DATE.optional().describe("Single day YYYY-MM-DD. Omit for the latest rates."),
  quotes: z
    .array(z.string().length(3))
    .optional()
    .describe("ISO 4217 quote codes to return; omit for all."),
};

export interface GetRatesArgs {
  base?: string;
  date?: string;
  quotes?: string[];
}

export function registerGetRates(server: McpServer, client: FrankfurterClient): void {
  server.registerTool(
    "get_rates",
    {
      description:
        "Latest or a single day's blended multi-source reference exchange rates. No date = latest; `date` = that day. Optional `base` and `quotes`. The raw-rate companion to `convert`. For a time series, a historical range, or a single provider's rates, call the REST API at https://api.frankfurter.dev/v2 directly — it's faster and keeps large payloads out of the model's context.",
      inputSchema: getRatesShape,
    },
    async (args: GetRatesArgs) => {
      try {
        const records = await client.getRates({
          base: args.base,
          date: args.date,
          quotes: args.quotes,
        });
        return { content: [{ type: "text" as const, text: JSON.stringify(records, null, 2) }] };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true };
      }
    },
  );
}
```

- [ ] **Step 4: Narrow `GetRatesParams`**

In `src/types.ts`, replace the `GetRatesParams` interface with:

```ts
export interface GetRatesParams {
  base?: string;
  date?: string;
  quotes?: string[];
}
```

- [ ] **Step 5: Narrow the client's query serialization**

In `src/frankfurter.ts`, replace the body of `getRates` (the URL-building lines) so it only sets `base`, `date`, and `quotes`. The method becomes:

```ts
  async getRates(params: GetRatesParams): Promise<RateRecord[]> {
    const url = new URL("/v2/rates", this.baseUrl);
    if (params.base) url.searchParams.set("base", params.base);
    if (params.date) url.searchParams.set("date", params.date);
    if (params.quotes?.length) url.searchParams.set("quotes", params.quotes.join(","));

    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Frankfurter API ${res.status}: ${body.slice(0, 200)}`);
    }
    return (await res.json()) as RateRecord[];
  }
```

- [ ] **Step 6: Update the client unit tests**

In `test/frankfurter.test.ts`, replace the `"serializes all params to v2 query"` test with this `providers`-free version:

```ts
test("serializes base/date/quotes to v2 query", async () => {
  const c = new FrankfurterClient(BASE);
  await c.getRates({ base: "USD", date: "2024-03-15", quotes: ["EUR", "GBP"] });
  const u = new URL(lastUrl);
  expect(u.searchParams.get("base")).toBe("USD");
  expect(u.searchParams.get("date")).toBe("2024-03-15");
  expect(u.searchParams.get("quotes")).toBe("EUR,GBP");
});
```

and delete the entire `"maps from/to for ranges"` test:

```ts
test("maps from/to for ranges", async () => {
  const c = new FrankfurterClient(BASE);
  await c.getRates({ start: "2024-01-01", end: "2024-01-02", quotes: ["USD"] });
  const u = new URL(lastUrl);
  expect(u.searchParams.get("from")).toBe("2024-01-01");
  expect(u.searchParams.get("to")).toBe("2024-01-02");
});
```

- [ ] **Step 7: Delete the orphaned range fixture**

Delete `test/fixtures/range.json` (no remaining imports reference it).

- [ ] **Step 8: Verify everything passes, builds, and lints**

Run: `npx vitest run test/getRates.test.ts test/frankfurter.test.ts`
Expected: PASS.

Run: `npm run build`
Expected: exits 0 (confirms no remaining references to `start`/`end`/`providers`/`validateGetRates`).

Run: `npm test`
Expected: all suites PASS.

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/tools/getRates.ts src/types.ts src/frankfurter.ts test/getRates.test.ts test/frankfurter.test.ts
git rm test/fixtures/range.json
git commit -m "refactor: trim get_rates to single-snapshot lookups"
```

---

### Task 3: Reframe the server instructions around `convert`

Center the connect-time `instructions` string on `convert`, describe `get_rates`/`list_currencies` as supporting tools, and redirect bulk/series/provider needs to REST. Add a small guard test.

**Files:**
- Create: `test/instructions.test.ts`
- Modify: `src/instructions.ts`

- [ ] **Step 1: Write the guard test**

Create `test/instructions.test.ts`:

```ts
import { expect, test } from "vitest";
import { INSTRUCTIONS } from "../src/instructions.js";

test("instructions center on convert and nudge bulk queries to the REST API", () => {
  expect(INSTRUCTIONS).toMatch(/`convert` is the primary tool/);
  expect(INSTRUCTIONS).toContain("https://api.frankfurter.dev/v2");
});

test("instructions no longer reference the removed list_providers tool", () => {
  expect(INSTRUCTIONS).not.toMatch(/list_providers/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/instructions.test.ts`
Expected: FAIL — the current instructions do not contain "`convert` is the primary tool".

- [ ] **Step 3: Rewrite `src/instructions.ts`**

Replace the entire contents of `src/instructions.ts` with:

```ts
export const INSTRUCTIONS = [
  "Frankfurter provides blended exchange rates aggregated from 50+ institutional",
  "sources (central banks, the IMF, the Federal Reserve). Rates are daily reference",
  "rates, not real-time trading rates, and this is not financial advice.",
  "",
  "`convert` is the primary tool: it turns an amount from one currency into another,",
  "rounded to the target's minor units. Use `get_rates` when you need the raw rate",
  "behind a conversion or a single day's snapshot, and `list_currencies` to check",
  "valid ISO 4217 codes.",
  "",
  "For time series, historical ranges, provider-specific rates, or any bulk query,",
  "call the REST API at https://api.frankfurter.dev/v2 directly — it's faster and",
  "keeps large payloads out of the model's context.",
].join("\n");
```

- [ ] **Step 4: Verify the test passes and lint is clean**

Run: `npx vitest run test/instructions.test.ts`
Expected: PASS.

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/instructions.ts test/instructions.test.ts
git commit -m "refactor: center server instructions on convert, nudge bulk to REST"
```

---

### Task 4: Update CLAUDE.md to the new tool surface

Documentation only — bring `CLAUDE.md` in line with the 3-tool, conversion-first design.

**Files:**
- Modify: `CLAUDE.md` (the `## Project Structure` and `## Tools` sections)

- [ ] **Step 1: Update the Project Structure tool list**

In `CLAUDE.md`, inside the `## Project Structure` code block, replace these lines:

```
    getRates.ts     # get_rates: schema + validation + handler
    convert.ts      # convert: schema + arithmetic + handler
    listCurrencies.ts # list_currencies: lists supported currency codes/names
    listProviders.ts # list_providers: lists data sources
```

with:

```
    convert.ts      # convert: schema + arithmetic + handler (primary tool)
    getRates.ts     # get_rates: schema + handler (latest / single-date snapshot)
    listCurrencies.ts # list_currencies: lists supported currency codes/names
```

- [ ] **Step 2: Rewrite the `## Tools` section**

Replace the entire `## Tools` section body with:

```
- `convert` — the primary tool. Convert an amount between two currencies.
  Returns a money object `{ amount, currency }` and nothing else; pass `date`
  for a historical rate. Rounded to the target's ISO minor units, or 8
  significant figures for metals/unknown-precision codes.
- `get_rates` — blended reference rates for the latest day or a single `date`.
  Optional `base` and `quotes`. The raw-rate companion behind a conversion.
- `list_currencies` — supported ISO 4217 currency codes and names as
  `{ code: name }`.

For time series, historical ranges, provider-specific rates, or bulk queries,
use the REST API at `https://api.frankfurter.dev/v2` directly.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update tool surface for conversion-focused MCP"
```

---

### Task 5: Tighten `server.json` description and release 0.4.0

Update the registry description (it still lists `list_providers` and is rates-first) to lead with conversion, then bump the version. `package.json` is the single source of truth; `npm version` runs the `version` hook that syncs `server.json`'s version and re-stages it, then commits and tags.

**Files:**
- Modify: `server.json:5` (description only — do **not** hand-edit `version`)

- [ ] **Step 1: Rewrite the description (must stay ≤ 100 characters)**

In `server.json`, change line 5 from:

```json
  "description": "Blended FX rates from 50+ institutions. Tools: get_rates, convert, list_currencies, list_providers.",
```

to:

```json
  "description": "Convert currencies and fetch blended FX rates from 50+ institutional sources.",
```

- [ ] **Step 2: Verify the description length**

Run: `node -e "const d=require('./server.json').description; console.log(d.length, d.length<=100)"`
Expected: `77 true` (any number ≤ 100 followed by `true` is acceptable; if `false`, shorten the description and re-run).

- [ ] **Step 3: Commit the description change**

`npm version` requires a clean working tree, so commit first.

```bash
git add server.json
git commit -m "docs: tighten server.json description to lead with conversion"
```

- [ ] **Step 4: Bump the version to 0.4.0**

First ensure the working tree is clean (`git status` reports nothing to commit, no untracked files) — `npm version` aborts on a dirty tree. This is breaking (a tool removed, `get_rates` narrowed); pre-1.0 convention is a minor bump.

Run: `npm version minor`
Expected: prints `v0.4.0`; creates a commit titled `0.4.0` and tag `v0.4.0`. The `version` hook syncs `server.json` to `0.4.0` and includes it in the commit.

- [ ] **Step 5: Verify the version is consistent and everything is green**

Run: `node -e "const p=require('./package.json'),s=require('./server.json'); console.log(p.version, s.version)"`
Expected: `0.4.0 0.4.0`.

Run: `npm test`
Expected: all suites PASS — including `test/version.test.ts` (asserts `server.json` ↔ `package.json` version match).

Run: `npm run build`
Expected: exits 0.

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 6: Confirm the final tool roster and commit history**

Run: `git log --oneline -8`
Expected (most recent first): `0.4.0`, the `server.json` description tweak, the CLAUDE.md docs update, the instructions reframe, the get_rates trim, the list_providers removal — preceded by the implementation-plan and design-spec doc commits at the base of the branch.

The MCP now exposes exactly `convert`, `get_rates`, `list_currencies`.

---

## Notes for the implementer

- **No new dependencies.** Everything uses the existing SDK, Zod, and Vitest.
- **Don't add caching, retries, or rate logic.** The project ethos is a thin, faithful relay; the only computation remains `rate × amount` plus rounding (untouched here).
- **Out of scope (do not build):** shipping the REST recipe as an MCP `resource`/`prompt`. The `instructions` string carries the nudge; revisit only if it proves insufficient.
- **Do not deploy or publish.** Releasing to the registry happens via CI/OIDC when `server.json` lands on `main`; this plan stops at a tagged commit on the `focus-on-conversion` branch.
