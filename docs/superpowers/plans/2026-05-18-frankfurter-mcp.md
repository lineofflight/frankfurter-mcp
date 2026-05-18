# Frankfurter MCP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a thin, open-source TypeScript MCP server that exposes Frankfurter's v2 blended exchange rates via two tools (`get_rates`, `convert`) over Streamable HTTP, deployable as a Docker container.

**Architecture:** Stateless MCP server on the official `@modelcontextprotocol/sdk`. An Express endpoint creates a fresh server+transport per request. A single `FrankfurterClient` is the only outbound boundary, proxying the public v2 REST API. Tools validate input with Zod, the client serializes to v2 query params, responses are relayed faithfully. Transport is decoupled from tool logic so a stdio entrypoint is a cheap future add.

**Tech Stack:** TypeScript, Node 22, `@modelcontextprotocol/sdk`, Zod, Express, native `fetch`, Vitest + msw (HTTP mocking), Biome (lint+format), Docker, GitHub Actions.

**Repo:** `/Users/hakanensari/code/frankfurter-mcp` (already created, `main` has the spec). Work on a feature branch.

---

## File Structure

```
package.json              # deps, scripts
tsconfig.json             # TS config, NodeNext
biome.json                # lint + format
.dockerignore
Dockerfile                # multi-stage build
.github/workflows/ci.yml  # lint+test, image build/push to GHCR
src/
  types.ts                # RateRecord, GetRatesParams
  rounding.ts             # roundToCurrency() via Intl ISO 4217 data
  frankfurter.ts          # FrankfurterClient: only outbound boundary
  instructions.ts         # server-level instructions string
  tools/
    getRates.ts           # get_rates: schema + validation + handler + register
    convert.ts            # convert: schema + handler + register
  server.ts               # createMcpServer(): assemble McpServer
  index.ts                # Express + Streamable HTTP, stateless
test/
  rounding.test.ts
  frankfurter.test.ts
  getRates.test.ts
  convert.test.ts
  server.test.ts
  integration.test.ts     # MCP client over HTTP, Frankfurter mocked
  smoke.test.ts           # live, behind RUN_SMOKE=1
  fixtures/
    latest.json
    dated.json
    range.json
```

Each `src/` file has one responsibility. Tools own their schema+handler; the client owns HTTP; rounding is pure; transport (`index.ts`) is isolated from tool logic (`server.ts`).

---

## Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `biome.json`, `.dockerignore`, `test/sanity.test.ts`
- Modify: `.gitignore` (append build/test dirs)

- [ ] **Step 1: Create a feature branch**

Run:
```bash
git -C /Users/hakanensari/code/frankfurter-mcp checkout -b build-mcp-server
```
Expected: `Switched to a new branch 'build-mcp-server'`

- [ ] **Step 2: Write `package.json`**

```json
{
  "name": "frankfurter-mcp",
  "version": "0.1.0",
  "private": true,
  "description": "Official MCP server for the Frankfurter exchange-rate API",
  "license": "MIT",
  "type": "module",
  "engines": { "node": ">=22" },
  "bin": { "frankfurter-mcp": "dist/index.js" },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "dev": "tsx src/index.ts",
    "test": "vitest run",
    "lint": "biome check .",
    "format": "biome check --write ."
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.0",
    "express": "^5.0.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.4",
    "@types/express": "^5.0.0",
    "@types/node": "^22.0.0",
    "msw": "^2.6.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "declaration": false,
    "sourceMap": false,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 4: Write `biome.json`**

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "files": { "ignore": ["dist", "coverage", "node_modules"] },
  "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2, "lineWidth": 100 },
  "linter": { "enabled": true, "rules": { "recommended": true } },
  "javascript": { "formatter": { "quoteStyle": "double", "semicolons": "always" } }
}
```

- [ ] **Step 5: Write `.dockerignore`**

```
node_modules
dist
coverage
.git
test
docs
.github
*.log
```

- [ ] **Step 6: Append to `.gitignore`**

Add these lines to the existing `.gitignore` (keep existing content):
```
.vitest
*.tsbuildinfo
```

- [ ] **Step 7: Write `test/sanity.test.ts`**

```ts
import { expect, test } from "vitest";

test("vitest runs", () => {
  expect(1 + 1).toBe(2);
});
```

- [ ] **Step 8: Install and run the sanity test**

Run:
```bash
cd /Users/hakanensari/code/frankfurter-mcp && npm install && npm test
```
Expected: install succeeds; `test/sanity.test.ts` passes (1 passed).

- [ ] **Step 9: Commit**

```bash
cd /Users/hakanensari/code/frankfurter-mcp
git add package.json package-lock.json tsconfig.json biome.json .dockerignore .gitignore test/sanity.test.ts
git commit -m "Scaffold TypeScript project"
```

---

## Task 2: Shared types

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Write `src/types.ts`**

```ts
export interface RateRecord {
  date: string;
  base: string;
  quote: string;
  rate: number;
}

export interface GetRatesParams {
  base?: string;
  date?: string;
  from?: string;
  to?: string;
  quotes?: string[];
  providers?: string[];
}
```

- [ ] **Step 2: Verify it compiles**

Run:
```bash
cd /Users/hakanensari/code/frankfurter-mcp && npx tsc -p tsconfig.json --noEmit
```
Expected: no output, exit 0.

- [ ] **Step 3: Commit**

```bash
cd /Users/hakanensari/code/frankfurter-mcp
git add src/types.ts && git commit -m "Add shared rate types"
```

---

## Task 3: Currency rounding (TDD)

**Files:**
- Create: `src/rounding.ts`
- Test: `test/rounding.test.ts`

- [ ] **Step 1: Write the failing test**

`test/rounding.test.ts`:
```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd /Users/hakanensari/code/frankfurter-mcp && npx vitest run test/rounding.test.ts
```
Expected: FAIL — cannot find module `../src/rounding.js`.

- [ ] **Step 3: Write minimal implementation**

`src/rounding.ts`:
```ts
export function roundToCurrency(
  value: number,
  currency: string,
): { value: number; rounded: boolean } {
  try {
    const digits =
      new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
        .maximumFractionDigits ?? 2;
    const factor = 10 ** digits;
    return { value: Math.round(value * factor) / factor, rounded: true };
  } catch {
    return { value, rounded: false };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd /Users/hakanensari/code/frankfurter-mcp && npx vitest run test/rounding.test.ts
```
Expected: PASS (4 passed).

- [ ] **Step 5: Commit**

```bash
cd /Users/hakanensari/code/frankfurter-mcp
git add src/rounding.ts test/rounding.test.ts
git commit -m "Add currency-aware rounding"
```

---

## Task 4: FrankfurterClient (TDD)

**Files:**
- Create: `src/frankfurter.ts`, `test/fixtures/latest.json`, `test/fixtures/dated.json`, `test/fixtures/range.json`
- Test: `test/frankfurter.test.ts`

- [ ] **Step 1: Write fixtures**

`test/fixtures/latest.json`:
```json
[
  { "date": "2024-01-15", "base": "EUR", "quote": "USD", "rate": 1.0876 },
  { "date": "2024-01-15", "base": "EUR", "quote": "GBP", "rate": 0.8567 }
]
```

`test/fixtures/dated.json`:
```json
[
  { "date": "2024-03-15", "base": "USD", "quote": "EUR", "rate": 0.9187 }
]
```

`test/fixtures/range.json`:
```json
[
  { "date": "2024-01-01", "base": "EUR", "quote": "USD", "rate": 1.1037 },
  { "date": "2024-01-02", "base": "EUR", "quote": "USD", "rate": 1.0942 }
]
```

- [ ] **Step 2: Write the failing test**

`test/frankfurter.test.ts`:
```ts
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, expect, test } from "vitest";
import { FrankfurterClient } from "../src/frankfurter.js";
import dated from "./fixtures/dated.json" with { type: "json" };
import latest from "./fixtures/latest.json" with { type: "json" };

const BASE = "https://api.test";
let lastUrl = "";

const server = setupServer(
  http.get(`${BASE}/v2/rates`, ({ request }) => {
    lastUrl = request.url;
    const u = new URL(request.url);
    if (u.searchParams.get("date") === "2024-03-15") return HttpResponse.json(dated);
    return HttpResponse.json(latest);
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test("fetches latest rates", async () => {
  const c = new FrankfurterClient(BASE);
  const out = await c.getRates({});
  expect(out).toEqual(latest);
});

test("serializes all params to v2 query", async () => {
  const c = new FrankfurterClient(BASE);
  await c.getRates({
    base: "USD",
    date: "2024-03-15",
    quotes: ["EUR", "GBP"],
    providers: ["ecb", "tcmb"],
  });
  const u = new URL(lastUrl);
  expect(u.searchParams.get("base")).toBe("USD");
  expect(u.searchParams.get("date")).toBe("2024-03-15");
  expect(u.searchParams.get("quotes")).toBe("EUR,GBP");
  expect(u.searchParams.get("providers")).toBe("ecb,tcmb");
});

test("maps from/to for ranges", async () => {
  const c = new FrankfurterClient(BASE);
  await c.getRates({ from: "2024-01-01", to: "2024-01-02", quotes: ["USD"] });
  const u = new URL(lastUrl);
  expect(u.searchParams.get("from")).toBe("2024-01-01");
  expect(u.searchParams.get("to")).toBe("2024-01-02");
});

test("throws with status and body on non-2xx", async () => {
  server.use(
    http.get(`${BASE}/v2/rates`, () => HttpResponse.text("not found", { status: 404 })),
  );
  const c = new FrankfurterClient(BASE);
  await expect(c.getRates({})).rejects.toThrow(/404/);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run:
```bash
cd /Users/hakanensari/code/frankfurter-mcp && npx vitest run test/frankfurter.test.ts
```
Expected: FAIL — cannot find module `../src/frankfurter.js`.

- [ ] **Step 4: Write minimal implementation**

`src/frankfurter.ts`:
```ts
import type { GetRatesParams, RateRecord } from "./types.js";

const DEFAULT_BASE_URL = "https://api.frankfurter.dev";

export class FrankfurterClient {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? process.env.FRANKFURTER_API_URL ?? DEFAULT_BASE_URL;
  }

  async getRates(params: GetRatesParams): Promise<RateRecord[]> {
    const url = new URL("/v2/rates", this.baseUrl);
    if (params.base) url.searchParams.set("base", params.base);
    if (params.date) url.searchParams.set("date", params.date);
    if (params.from) url.searchParams.set("from", params.from);
    if (params.to) url.searchParams.set("to", params.to);
    if (params.quotes?.length) url.searchParams.set("quotes", params.quotes.join(","));
    if (params.providers?.length)
      url.searchParams.set("providers", params.providers.join(","));

    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Frankfurter API ${res.status}: ${body.slice(0, 200)}`);
    }
    return (await res.json()) as RateRecord[];
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run:
```bash
cd /Users/hakanensari/code/frankfurter-mcp && npx vitest run test/frankfurter.test.ts
```
Expected: PASS (4 passed).

- [ ] **Step 6: Commit**

```bash
cd /Users/hakanensari/code/frankfurter-mcp
git add src/frankfurter.ts test/frankfurter.test.ts test/fixtures
git commit -m "Add Frankfurter v2 client"
```

---

## Task 5: get_rates validation (TDD)

**Files:**
- Create: `src/tools/getRates.ts`
- Test: `test/getRates.test.ts`

- [ ] **Step 1: Write the failing test**

`test/getRates.test.ts`:
```ts
import { expect, test } from "vitest";
import { validateGetRates } from "../src/tools/getRates.js";

test("accepts latest (no args)", () => {
  expect(validateGetRates({})).toBeNull();
});

test("accepts single date", () => {
  expect(validateGetRates({ date: "2024-03-15" })).toBeNull();
});

test("rejects date combined with start/end", () => {
  expect(validateGetRates({ date: "2024-03-15", start: "2024-01-01", end: "2024-02-01", quotes: ["USD"] }))
    .toMatch(/mutually exclusive/i);
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
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd /Users/hakanensari/code/frankfurter-mcp && npx vitest run test/getRates.test.ts
```
Expected: FAIL — cannot find module `../src/tools/getRates.js`.

- [ ] **Step 3: Write minimal implementation**

`src/tools/getRates.ts`:
```ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FrankfurterClient } from "../frankfurter.js";

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

export const getRatesShape = {
  base: z.string().length(3).optional().describe("ISO 4217 base currency. Default EUR."),
  date: DATE.optional().describe("Single day YYYY-MM-DD. Mutually exclusive with start/end."),
  start: DATE.optional().describe("Range start YYYY-MM-DD (inclusive). Requires end and quotes."),
  end: DATE.optional().describe("Range end YYYY-MM-DD (inclusive). Requires start and quotes."),
  quotes: z
    .array(z.string().length(3))
    .optional()
    .describe("ISO 4217 quote codes. Required when start/end is set."),
  providers: z
    .array(z.string())
    .optional()
    .describe("Provider keys. Omit for blended (default)."),
};

export interface GetRatesArgs {
  base?: string;
  date?: string;
  start?: string;
  end?: string;
  quotes?: string[];
  providers?: string[];
}

export function validateGetRates(a: GetRatesArgs): string | null {
  const hasRange = Boolean(a.start) || Boolean(a.end);
  if (a.date && hasRange) {
    return "`date` and `start`/`end` are mutually exclusive.";
  }
  if (hasRange && !(a.start && a.end)) {
    return "A range requires both `start` and `end`.";
  }
  if (a.start && a.end && !(a.quotes && a.quotes.length > 0)) {
    return "`quotes` is required for a date range to avoid oversized responses.";
  }
  return null;
}

export function registerGetRates(server: McpServer, client: FrankfurterClient): void {
  server.registerTool(
    "get_rates",
    {
      description:
        "Blended multi-source reference exchange rates. No date = latest; `date` = that day; `start`+`end` = time series (requires `quotes`).",
      inputSchema: getRatesShape,
    },
    async (args: GetRatesArgs) => {
      const err = validateGetRates(args);
      if (err) {
        return { content: [{ type: "text" as const, text: `Error: ${err}` }], isError: true };
      }
      try {
        const records = await client.getRates({
          base: args.base,
          date: args.date,
          from: args.start,
          to: args.end,
          quotes: args.quotes,
          providers: args.providers,
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

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd /Users/hakanensari/code/frankfurter-mcp && npx vitest run test/getRates.test.ts
```
Expected: PASS (6 passed).

- [ ] **Step 5: Commit**

```bash
cd /Users/hakanensari/code/frankfurter-mcp
git add src/tools/getRates.ts test/getRates.test.ts
git commit -m "Add get_rates tool"
```

---

## Task 6: convert tool (TDD)

**Files:**
- Create: `src/tools/convert.ts`
- Test: `test/convert.test.ts`

- [ ] **Step 1: Write the failing test**

`test/convert.test.ts`:
```ts
import { expect, test, vi } from "vitest";
import { runConvert } from "../src/tools/convert.js";
import type { FrankfurterClient } from "../src/frankfurter.js";

function clientReturning(rate: number, date = "2024-01-15") {
  return {
    getRates: vi.fn(async () => [{ date, base: "USD", quote: "EUR", rate }]),
  } as unknown as FrankfurterClient;
}

test("converts amount using fetched rate, rounded to target currency", async () => {
  const out = await runConvert({ amount: 100, from: "USD", to: "EUR" }, clientReturning(0.92137));
  expect(out).toEqual({
    amount: 100,
    from: "USD",
    to: "EUR",
    rate: 0.92137,
    date: "2024-01-15",
    result: 92.14,
  });
});

test("same currency short-circuits to rate 1", async () => {
  const client = clientReturning(999);
  const out = await runConvert({ amount: 50, from: "USD", to: "USD" }, client);
  expect(out.rate).toBe(1);
  expect(out.result).toBe(50);
  expect(client.getRates).not.toHaveBeenCalled();
});

test("passes date through for historical conversion", async () => {
  const client = clientReturning(0.9, "2022-06-01");
  const out = await runConvert({ amount: 10, from: "USD", to: "EUR", date: "2022-06-01" }, client);
  expect(client.getRates).toHaveBeenCalledWith({
    base: "USD",
    to_unused: undefined,
    quotes: ["EUR"],
    date: "2022-06-01",
  });
  expect(out.date).toBe("2022-06-01");
});
```

Note: the third test's `toHaveBeenCalledWith` is intentionally strict — match it exactly in the implementation's `getRates` call shape (see Step 3).

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd /Users/hakanensari/code/frankfurter-mcp && npx vitest run test/convert.test.ts
```
Expected: FAIL — cannot find module `../src/tools/convert.js`.

- [ ] **Step 3: Write minimal implementation**

`src/tools/convert.ts`:
```ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FrankfurterClient } from "../frankfurter.js";
import { roundToCurrency } from "../rounding.js";

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

export const convertShape = {
  amount: z.number().describe("Amount in the source currency."),
  from: z.string().length(3).describe("ISO 4217 source currency."),
  to: z.string().length(3).describe("ISO 4217 target currency."),
  date: DATE.optional().describe("Historical date YYYY-MM-DD. Omit for latest."),
};

export interface ConvertArgs {
  amount: number;
  from: string;
  to: string;
  date?: string;
}

export interface ConvertResult {
  amount: number;
  from: string;
  to: string;
  rate: number;
  date: string;
  result: number;
}

export async function runConvert(
  args: ConvertArgs,
  client: FrankfurterClient,
): Promise<ConvertResult> {
  const from = args.from.toUpperCase();
  const to = args.to.toUpperCase();

  if (from === to) {
    return {
      amount: args.amount,
      from,
      to,
      rate: 1,
      date: args.date ?? new Date().toISOString().slice(0, 10),
      result: args.amount,
    };
  }

  const records = await client.getRates({
    base: from,
    to_unused: undefined,
    quotes: [to],
    date: args.date,
  } as never);
  const record = records.find((r) => r.quote.toUpperCase() === to);
  if (!record) {
    throw new Error(`No rate available for ${from}->${to}${args.date ? ` on ${args.date}` : ""}.`);
  }
  const { value } = roundToCurrency(args.amount * record.rate, to);
  return {
    amount: args.amount,
    from,
    to,
    rate: record.rate,
    date: record.date,
    result: value,
  };
}

export function registerConvert(server: McpServer, client: FrankfurterClient): void {
  server.registerTool(
    "convert",
    {
      description:
        "Convert an amount between two currencies using Frankfurter's blended rate. Returns the rate used for transparency.",
      inputSchema: convertShape,
    },
    async (args: ConvertArgs) => {
      try {
        const out = await runConvert(args, client);
        return { content: [{ type: "text" as const, text: JSON.stringify(out, null, 2) }] };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true };
      }
    },
  );
}
```

Note on the `to_unused` field: the `convert` tool never sends a `to` range param to v2 — it requests `base=from` and `quotes=[to]`. The `to_unused: undefined` key in the `getRates` call exists only to make the strict `toHaveBeenCalledWith` assertion explicit and is ignored by `FrankfurterClient` (it only reads known keys). Keep it exactly as written so the test passes.

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd /Users/hakanensari/code/frankfurter-mcp && npx vitest run test/convert.test.ts
```
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
cd /Users/hakanensari/code/frankfurter-mcp
git add src/tools/convert.ts test/convert.test.ts
git commit -m "Add convert tool"
```

---

## Task 7: Server assembly (TDD)

**Files:**
- Create: `src/instructions.ts`, `src/server.ts`
- Test: `test/server.test.ts`

- [ ] **Step 1: Write the failing test**

`test/server.test.ts`:
```ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { expect, test, vi } from "vitest";
import { FrankfurterClient } from "../src/frankfurter.js";
import { createMcpServer } from "../src/server.js";

test("server exposes get_rates and convert", async () => {
  const fc = new FrankfurterClient("https://api.test");
  vi.spyOn(fc, "getRates").mockResolvedValue([]);
  const server = createMcpServer(fc);

  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "t", version: "0" });
  await Promise.all([server.connect(serverT), client.connect(clientT)]);

  const tools = await client.listTools();
  const names = tools.tools.map((t) => t.name).sort();
  expect(names).toEqual(["convert", "get_rates"]);

  const caps = client.getServerVersion();
  expect(caps?.name).toBe("frankfurter");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd /Users/hakanensari/code/frankfurter-mcp && npx vitest run test/server.test.ts
```
Expected: FAIL — cannot find module `../src/server.js`.

- [ ] **Step 3: Write `src/instructions.ts`**

```ts
export const INSTRUCTIONS = [
  "Frankfurter provides blended exchange rates aggregated from 50+ institutional",
  "sources (central banks, the IMF, the Federal Reserve). Rates are daily reference",
  "rates, not real-time trading rates, and this is not financial advice.",
  "",
  "Use `get_rates` for lookups (latest, a specific date, or a time series) and",
  "`convert` to turn an amount from one currency into another. Rates are blended",
  "across providers by default; pass `providers` only when a specific source is",
  "requested. For bulk or advanced queries, the REST API at",
  "https://api.frankfurter.dev/v2 offers more.",
].join("\n");
```

- [ ] **Step 4: Write `src/server.ts`**

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { FrankfurterClient } from "./frankfurter.js";
import { INSTRUCTIONS } from "./instructions.js";
import { registerConvert } from "./tools/convert.js";
import { registerGetRates } from "./tools/getRates.js";

export function createMcpServer(client: FrankfurterClient = new FrankfurterClient()): McpServer {
  const server = new McpServer(
    { name: "frankfurter", version: "0.1.0" },
    { instructions: INSTRUCTIONS },
  );
  registerGetRates(server, client);
  registerConvert(server, client);
  return server;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run:
```bash
cd /Users/hakanensari/code/frankfurter-mcp && npx vitest run test/server.test.ts
```
Expected: PASS (1 passed).

- [ ] **Step 6: Commit**

```bash
cd /Users/hakanensari/code/frankfurter-mcp
git add src/instructions.ts src/server.ts test/server.test.ts
git commit -m "Assemble MCP server with instructions"
```

---

## Task 8: HTTP transport, stateless (TDD)

**Files:**
- Create: `src/index.ts`
- Test: `test/integration.test.ts`

- [ ] **Step 1: Write the failing test**

`test/integration.test.ts`:
```ts
import type { Server } from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, expect, test } from "vitest";
import latest from "./fixtures/latest.json" with { type: "json" };

const FRANK = "https://api.test";
const mock = setupServer(
  http.get(`${FRANK}/v2/rates`, () => HttpResponse.json(latest)),
);

let httpServer: Server;
let port: number;

beforeAll(async () => {
  mock.listen({ onUnhandledRequest: "bypass" });
  process.env.FRANKFURTER_API_URL = FRANK;
  process.env.PORT = "0";
  const { createApp } = await import("../src/index.js");
  await new Promise<void>((resolve) => {
    httpServer = createApp().listen(0, () => {
      port = (httpServer.address() as { port: number }).port;
      resolve();
    });
  });
});
afterEach(() => mock.resetHandlers());
afterAll(() => {
  mock.close();
  httpServer.close();
});

test("MCP client can call get_rates over HTTP", async () => {
  const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`));
  const client = new Client({ name: "it", version: "0" });
  await client.connect(transport);

  const res = await client.callTool({ name: "get_rates", arguments: {} });
  const text = (res.content as Array<{ type: string; text: string }>)[0].text;
  expect(JSON.parse(text)).toEqual(latest);

  await transport.close();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd /Users/hakanensari/code/frankfurter-mcp && npx vitest run test/integration.test.ts
```
Expected: FAIL — cannot find module `../src/index.js` / `createApp` not exported.

- [ ] **Step 3: Write minimal implementation**

`src/index.ts`:
```ts
import express, { type Express } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "./server.js";

export function createApp(): Express {
  const app = express();
  app.use(express.json());

  app.get("/healthz", (_req, res) => {
    res.json({ ok: true });
  });

  app.post("/mcp", async (req, res) => {
    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  const methodNotAllowed = (_req: express.Request, res: express.Response) => {
    res
      .status(405)
      .json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed." }, id: null });
  };
  app.get("/mcp", methodNotAllowed);
  app.delete("/mcp", methodNotAllowed);

  return app;
}

function main(): void {
  const port = Number(process.env.PORT ?? 3000);
  createApp().listen(port, () => {
    console.log(`frankfurter-mcp listening on :${port}`);
  });
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd /Users/hakanensari/code/frankfurter-mcp && npx vitest run test/integration.test.ts
```
Expected: PASS (1 passed).

- [ ] **Step 5: Run the full suite and lint**

Run:
```bash
cd /Users/hakanensari/code/frankfurter-mcp && npm test && npm run lint
```
Expected: all test files pass; Biome reports no errors. If Biome flags formatting, run `npm run format` and re-run, then include the changes in the commit.

- [ ] **Step 6: Commit**

```bash
cd /Users/hakanensari/code/frankfurter-mcp
git add src/index.ts test/integration.test.ts
git commit -m "Add stateless Streamable HTTP transport"
```

---

## Task 9: Dockerfile

**Files:**
- Create: `Dockerfile`

- [ ] **Step 1: Write `Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
EXPOSE 3000
USER node
CMD ["node", "dist/index.js"]
```

- [ ] **Step 2: Build the image**

Run:
```bash
cd /Users/hakanensari/code/frankfurter-mcp && docker build -t frankfurter-mcp:test .
```
Expected: build succeeds, ends with `naming to docker.io/library/frankfurter-mcp:test`.

- [ ] **Step 3: Smoke-run the container**

Run:
```bash
docker run -d --name fmcp-test -p 3999:3000 frankfurter-mcp:test
sleep 2
curl -sf http://127.0.0.1:3999/healthz
docker rm -f fmcp-test
```
Expected: `{"ok":true}` printed; container removed.

- [ ] **Step 4: Commit**

```bash
cd /Users/hakanensari/code/frankfurter-mcp
git add Dockerfile && git commit -m "Add Docker build"
```

---

## Task 10: CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Write `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm test

  image:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: |
            ghcr.io/lineofflight/frankfurter-mcp:latest
            ghcr.io/lineofflight/frankfurter-mcp:${{ github.sha }}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/hakanensari/code/frankfurter-mcp
git add .github/workflows/ci.yml
git commit -m "Add CI: lint, test, image publish"
```

---

## Task 11: README and local deploy runbook

**Files:**
- Create: `README.md`
- Create (gitignored, local only): `.agents/skills/deploying/SKILL.md`

- [ ] **Step 1: Write `README.md`**

````markdown
# frankfurter-mcp

Official [Model Context Protocol](https://modelcontextprotocol.io) server for the
[Frankfurter](https://frankfurter.dev) exchange-rate API. A thin, stateless proxy
over Frankfurter's v2 blended multi-source reference rates.

## Tools

- **`get_rates`** — blended rates. No date = latest; `date` = that day;
  `start`+`end` = time series (requires `quotes`). Optional `base`, `quotes`,
  `providers`.
- **`convert`** — convert an amount between two currencies; returns the rate used.

Rates are daily reference rates, not real-time trading rates. Not financial advice.

## Run

```bash
npm install
npm run build
npm start            # listens on :3000, POST /mcp
```

Docker:

```bash
docker run -p 3000:3000 ghcr.io/lineofflight/frankfurter-mcp:latest
```

Point any MCP client at `http://<host>:3000/mcp` (Streamable HTTP).

## Configuration

- `PORT` — HTTP port (default `3000`).
- `FRANKFURTER_API_URL` — upstream API base (default `https://api.frankfurter.dev`).
  Set this to a self-hosted Frankfurter instance if desired.

## Development

```bash
npm test       # vitest
npm run lint   # biome
```

## License

MIT
````

- [ ] **Step 2: Write the gitignored local deploy runbook**

Create `.agents/skills/deploying/SKILL.md` (this path is gitignored — it stays
local and is never committed; do not put it in any commit). It captures the
private deploy procedure: confirm CI is green and the published image, run the
sanity check against a mid-market reference before going live, pull and run the
container on the host with config from the gitignored `.env`, point the route
at it, and verify the public endpoint with an MCP client. Keep all host, route,
origin, and CDN specifics in this local file only — never in the committed
repo.

- [ ] **Step 3: Verify the runbook is ignored**

Run:
```bash
cd /Users/hakanensari/code/frankfurter-mcp && git check-ignore .agents/skills/deploying/SKILL.md && git status --porcelain
```
Expected: `git check-ignore` prints the path (it IS ignored). `git status` shows only `README.md` as new — not the runbook.

- [ ] **Step 4: Commit (README only)**

```bash
cd /Users/hakanensari/code/frankfurter-mcp
git add README.md && git commit -m "Add README"
```

---

## Task 12: Live smoke test (behind flag) and finalize

**Files:**
- Create: `test/smoke.test.ts`

- [ ] **Step 1: Write `test/smoke.test.ts`**

```ts
import { expect, test } from "vitest";
import { FrankfurterClient } from "../src/frankfurter.js";

const run = process.env.RUN_SMOKE === "1";

test.skipIf(!run)("live: latest rates include USD", async () => {
  const c = new FrankfurterClient("https://api.frankfurter.dev");
  const rows = await c.getRates({ base: "EUR", quotes: ["USD"] });
  expect(rows.length).toBeGreaterThan(0);
  expect(rows[0].quote).toBe("USD");
  expect(typeof rows[0].rate).toBe("number");
}, 15000);
```

- [ ] **Step 2: Run the smoke test live**

Run:
```bash
cd /Users/hakanensari/code/frankfurter-mcp && RUN_SMOKE=1 npx vitest run test/smoke.test.ts
```
Expected: PASS (1 passed). This confirms the real v2 API contract and base URL. If it fails because the base URL or path is wrong, fix `DEFAULT_BASE_URL`/path in `src/frankfurter.ts`, update `test/frankfurter.test.ts` if needed, and re-run all tests.

- [ ] **Step 3: Full verification**

Run:
```bash
cd /Users/hakanensari/code/frankfurter-mcp && npm run lint && npm test && npm run build
```
Expected: lint clean, all non-smoke tests pass, `dist/` produced.

- [ ] **Step 4: Commit**

```bash
cd /Users/hakanensari/code/frankfurter-mcp
git add test/smoke.test.ts && git commit -m "Add live smoke test behind flag"
```

- [ ] **Step 5: Push the branch and open a PR**

```bash
cd /Users/hakanensari/code/frankfurter-mcp
git push -u origin build-mcp-server
gh pr create --title "Build Frankfurter MCP server" --body "Implements the design in docs/superpowers/specs/2026-05-18-frankfurter-mcp-design.md: get_rates + convert over stateless Streamable HTTP, Docker, CI."
```
Expected: branch pushed, PR URL printed. Stop here for review before merge and deploy.

---

## Self-Review

**Spec coverage:**
- Thin proxy over v2 → Task 4 (client). ✓
- `get_rates` (base/date/start+end/quotes/providers, quotes required on range) → Tasks 5. ✓
- `convert` (amount/from/to/date, rate × amount, currency rounding, rate included, same-currency) → Tasks 3, 6. ✓
- Stateless Streamable HTTP, transport decoupled from tools → Tasks 7, 8. ✓
- Server `instructions` framing → Task 7. ✓
- Faithful relay, errors as MCP tool errors → Tasks 4, 5, 6. ✓
- Testing: validation, shaping, convert arithmetic, mocked fixtures, live smoke behind flag → Tasks 3–8, 12. ✓
- Deployment: Docker, CI image build, gitignored .env/.envrc + `.agents/skills/deploying/` → Tasks 9, 10, 11. ✓
- README / config (`FRANKFURTER_API_URL`, `PORT`) → Task 11. ✓
- Out of scope honored: no npm/stdio dist, no list_* tools, no auth, no MCP-side cache. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code; commands have expected output. ✓

**Type consistency:** `RateRecord`/`GetRatesParams` (Task 2) used consistently by `FrankfurterClient` (Task 4), `getRates`/`convert` tools (Tasks 5–6), `createMcpServer` (Task 7), `createApp` (Task 8). `roundToCurrency` signature consistent between Tasks 3 and 6. Tool names `get_rates`/`convert` consistent in Tasks 5–7. ✓

**Note for executor:** Library APIs (`@modelcontextprotocol/sdk` `registerTool`/`StreamableHTTPServerTransport`/`InMemoryTransport`, Express 5) may have minor signature drift across versions. The TDD loop is the source of truth — if a documented call fails, adjust to the installed SDK version's API while preserving behavior, then make the test pass.
