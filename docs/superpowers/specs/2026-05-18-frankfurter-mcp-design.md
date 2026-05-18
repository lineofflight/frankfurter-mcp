# Frankfurter MCP Server — Design

Date: 2026-05-18

## Purpose

An official, open-source MCP server that exposes Frankfurter's blended
multi-source exchange rates to AI assistants and agent runtimes.

It exists to serve the surface that documentation and skills cannot reach:
chat assistants and non-coding agent runtimes (Claude Desktop, ChatGPT,
Cursor, agent frameworks) that have no generic HTTP tool and cannot call the
REST API directly. Several unofficial Frankfurter MCPs already exist; no
vendor-maintained MCP exists for any free FX reference-rate service. An
official one controls correctness, builds trust on a surface where the server
runs inside users' assistants, and makes Frankfurter the canonical reference.

It is a thin proxy over the public v2 API. It introduces no rate logic of its
own beyond deterministic conversion arithmetic.

## Imagined use cases

No usage data exists yet. These are hypotheses, in rough expected order:

1. In-conversation conversion — "how much is €250 in dollars?"
2. Embedded sub-task — assistant drafting an invoice, normalizing a pasted
   expense list, or budgeting a trip needs a rate mid-task. Likely the
   highest total volume because it is invisible plumbing.
3. Latest spot lookup — "what's EUR/USD today?"
4. Historical point lookup — "what was the rate on 2024-03-15?" Bookkeeping,
   expense reconciliation.
5. Light trend / series — "has the lira weakened vs the dollar this year?"
6. Provenance — "which institution does this rate come from?" Niche but
   reputationally distinctive; no toy server answers this.

Explicitly not for: intraday/real-time trading rates (Frankfurter is daily
reference data), transactional FX (not Wise), financial advice.

## Architecture

Standalone TypeScript server built on the official `@modelcontextprotocol/sdk`,
Streamable HTTP transport, stateless. Transport is decoupled from tool logic so
a stdio entrypoint is a cheap future add if a stdio-only client ever matters.

Deployed as its own small container on the production host, behind the CDN.
Because the server sits behind the cache (not as a worker in front of it),
repeated identical lookups are genuinely cache-served.

### Components (each independently testable)

- Transport — SDK Streamable HTTP server. No tool logic.
- Tool definitions — declarative: name, description, schema with per-parameter
  descriptions. No logic.
- Frankfurter client — the only module that talks outward. HTTP + parse
  against v2. Base URL configurable via env (default public origin; lets
  self-hosters and tests point elsewhere).
- Handlers — validated input → client → shaped MCP response.
- Server `instructions` — connection-time framing: blended multi-source
  institutional reference rates; not financial advice; optional provider
  filtering; for bulk/advanced queries the REST API at frankfurter.dev/v2
  offers more (a graceful pointer for coding agents, not a substitute).

## Tools

Two tools. A singular `get_rate` is deliberately omitted: a single-pair lookup
is `get_rates` reading one quote, and `convert` returns the rate explicitly. No
seventh use case would justify a third tool.

### `get_rates`

All parameters optional except as noted:

- `base` — ISO 4217, default EUR (mirrors Frankfurter's default).
- `date` — `YYYY-MM-DD`, single day. Mutually exclusive with `start`/`end`.
- `start` + `end` — `YYYY-MM-DD`, inclusive range (time series).
- `quotes` — list of ISO 4217 codes. Optional for single-date/latest;
  **required when `start`/`end` is set.** Mirrors v2's `quotes` param.
- `providers` — list of provider keys. Omit → blended (default).

`quotes` and `providers` are accepted as string arrays at the tool boundary
and serialized to v2's comma-separated query form by the client.

Behavior:

- No date → latest. `date` → that day. `start`/`end` → series.
- Maps directly onto v2 `/v2/rates` query parameters.
- Returns the v2 shape faithfully: an array of `{ date, base, quote, rate }`.

Rationale for required `quotes` on ranges: an unfiltered range returns every
currency for every day (a 1-year series ≈ 7,500 records), which buries the
answer and can exceed client response limits. Range queries in practice always
target one or two pairs, so the requirement matches real intent and guards
against context blowup. Single-date queries stay unfiltered — a ~30-row table
is small and "today's rates" is a legitimate intent.

The API is the source of truth for valid codes and dates. The server does not
maintain a local currency list; it surfaces the API's errors cleanly.

### `convert`

- `amount` — number, required.
- `from` — ISO 4217, required.
- `to` — ISO 4217, required.
- `date` — `YYYY-MM-DD`, optional → historical conversion.

Behavior: fetch the `from`→`to` rate (latest or for `date`), compute
`amount × rate`, round to the target currency's minor unit, and return
`{ amount, from, to, rate, date, result }`. The rate used is always included
so the arithmetic is transparent.

It is intentionally thin (`rate × amount`). Its justification is determinism
(LLMs slip on money math), currency-aware rounding, and transparency.

Minor-unit precision comes from a standard ISO 4217 source in the TS ecosystem.
If a code's precision is unknown, return the unrounded result alongside the
rate rather than guessing — transparency over false precision.

## Data flow and errors

Client → tool call → schema validation → Frankfurter client → v2 API →
normalize → MCP result. Stateless; caching is the CDN's job at the API edge.

Errors map to clear, actionable MCP tool errors: unknown code, future or
out-of-range date, malformed date, `date` combined with `start`/`end`, missing
`quotes` on a range, upstream unavailable. The server never fabricates or
interpolates missing data and relays weekend/holiday behavior exactly as the
API does (nearest prior). Transparent pipe — no editorializing.

## Testing

Unit tests covering input validation and parameter mapping, response shaping,
and `convert` arithmetic and rounding, against mocked v2 responses from
recorded fixtures. One live smoke test against the public API behind a flag. CI
on this repo: lint + test.

## Deployment and secrets

Mirror the upstream project's convention. The public repo contains only
generic code and a `Dockerfile`. All deployment topology (origin URL, CDN
routing, host specifics) lives in gitignored `.env`/`.envrc` and a gitignored
local deploy runbook under `.agents/skills/deploying/`. Never committed.
Public code, private deployment details.

## Out of scope (YAGNI)

- npm/stdio distribution (transport-decoupled so it is a cheap later add).
- `list_currencies` / `list_providers` tools (models know ISO 4217; provenance
  is the optional `providers` param plus server `instructions`).
- Resources and prompts.
- Auth (data is public).
- An MCP-side cache (the CDN handles it).
- Weekly/monthly rollups for long trends (add later only if needed).
