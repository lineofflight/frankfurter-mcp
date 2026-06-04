# Focus frankfurter-mcp on conversion (Approach A)

- **Date:** 2026-06-04
- **Status:** Approved design, pre-implementation
- **Target version:** 0.4.0 (breaking; pre-1.0 → minor bump)

## Problem

`convert` is the only thing this MCP does that the upstream REST API cannot:
client-side `rate × amount` plus ISO-minor-unit/metal rounding. The other tools
(`get_rates`, `list_currencies`, `list_providers`) relay data the API already
returns verbatim. Worse, the bulk-shaped paths — time series, full provider and
currency tables — are actively *better* served by the REST API directly: routing
large payloads through MCP re-tokenizes every byte into the model's context on
each call.

So the MCP should center on conversion, keep a thin fallback for a single raw
rate, and steer everything bulk or advanced to `https://api.frankfurter.dev/v2`.

## Decision

Adopt **Approach A — convert + thin rate fallback**, conservatively scoped for a
mixed/unknown client base (some clients can fetch REST themselves, some can't):

- `convert` stays the headline, contract unchanged.
- `get_rates` is trimmed to single snapshots (latest or one historical day) — the
  safety net for MCP-only clients that need a raw rate.
- `list_currencies` stays (cheapest way to prevent bad-ISO-code conversions).
- `list_providers`, the `get_rates` time-series path, and the `provider` filter
  are removed; the server instructions redirect those needs to REST.
- The `FrankfurterClient` is trimmed to match — no unreachable code in the only
  outbound boundary.

## Final tool surface

| Tool | Status | Shape |
|---|---|---|
| `convert` | headline, unchanged | `{amount, from, to, date?}` → `{amount, currency}` |
| `get_rates` | trimmed to single-snapshot | `{base?, quotes?, date?}` — latest or one historical day |
| `list_currencies` | kept | `{ code: name }`, code-validation helper |
| `list_providers` | **removed** | — |

Net: 4 → 3 tools.

## Changes by file

### `src/tools/getRates.ts`
- Remove `start`, `end`, and `provider` from `getRatesShape`; keep `base`, `date`,
  `quotes`.
- Update field descriptions: drop "Mutually exclusive with start/end" from `date`;
  reword `quotes` to "ISO 4217 quote codes to return; omit for all".
- Delete `validateGetRates` and its call — every rule in it concerns ranges, which
  no longer exist.
- Drop `start`/`end`/`provider` from `GetRatesArgs`.
- Rewrite the tool description: "latest or a single day's blended reference rates",
  plus a one-line redirect: for a time series, historical ranges, or
  provider-specific rates, call the REST API at `https://api.frankfurter.dev/v2`.
- Simplify the handler to `client.getRates({ base, date, quotes })`.

### `src/tools/listProviders.ts`
- Delete the file. Remove its import and registration from `src/server.ts`.

### `src/frankfurter.ts`
- `getRates()`: stop setting the `from`/`to`/`providers` query params; keep
  `base`/`date`/`quotes`.
- Delete `getProviders()`.
- Remove the now-unused `Provider` import.

### `src/types.ts`
- Delete the `Provider` interface.
- Trim `GetRatesParams` to `{ base?; date?; quotes?: string[] }`.

### `src/tools/convert.ts`
- No change. Still calls `getRates({ base: from, quotes: [to], date })` and returns
  `{ amount, currency }`. Its description already points to `get_rates` for the raw
  rate, which remains valid.

### `src/instructions.ts`
- Reposition: `convert` is primary; `get_rates` returns the raw rate behind a
  conversion or a single day's snapshot; `list_currencies` validates codes.
- Remove the "or a time series" and "pass providers only when a specific source is
  requested" guidance.
- Keep and sharpen the REST redirect: "For time series, historical ranges,
  provider-specific rates, or any bulk query, call the REST API at
  https://api.frankfurter.dev/v2 directly — it's faster and keeps large payloads
  out of the model's context."

## Versioning & compatibility

- Removing a tool and narrowing `get_rates` is breaking → `npm version minor`
  (0.3.1 → **0.4.0**). The version hook auto-syncs `server.json`.
- Optionally tighten `server.json`'s `description` to lead with conversion
  (must stay ≤ 100 chars).

## Testing

- Delete `list_providers` specs, `get_rates` time-series/provider specs, and any
  `validateGetRates` unit tests.
- Add a test asserting the `get_rates` input contract no longer accepts
  `start`/`end`/`provider`.
- `convert` and `list_currencies` specs unchanged.
- The `server.json` ↔ `package.json` version-drift test still applies.
- Only the `FrankfurterClient` boundary stays stubbed, per existing convention.

## Docs

- Update the `## Tools` section of `CLAUDE.md` to the 3-tool surface and the
  trimmed `get_rates`.

## Out of scope / deferred

- Shipping the REST recipe as an MCP **resource** or **prompt**. The instructions
  string carries the nudge; add a resource later only if it proves needed (YAGNI).
- Any caching, retries, or rate logic — still explicitly out, per project ethos.
