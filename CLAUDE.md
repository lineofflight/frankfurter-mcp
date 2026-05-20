# frankfurter-mcp

Official [Model Context Protocol](https://modelcontextprotocol.io) server for
the [Frankfurter](https://frankfurter.dev) exchange-rate API. A thin, stateless
remote proxy over Frankfurter's public v2 API. It introduces no rate logic of
its own beyond deterministic conversion arithmetic. Relay the upstream
faithfully; do not editorialize, filter, or transform rates.

## Architecture

- TypeScript, Node 22 (ESM, `NodeNext`)
- `@modelcontextprotocol/sdk` — Streamable HTTP transport, **stateless** (a
  fresh server + transport per request)
- Express — serves the MCP endpoint at the **root path `/`** (POST), plus
  `GET /healthz`. There is no `/mcp` path.
- Vitest + a stubbed upstream boundary for tests; Biome for lint/format
- Docker image published to GHCR by CI

## Project Structure

```
src/
  index.ts          # Express app + Streamable HTTP transport (POST /, /healthz)
  server.ts         # createMcpServer(): assembles McpServer; reads version from package.json
  frankfurter.ts    # FrankfurterClient: the only outbound boundary (v2 API)
  tools/
    getRates.ts     # get_rates: schema + validation + handler
    convert.ts      # convert: schema + arithmetic + handler
    listCurrencies.ts # list_currencies: lists supported currency codes/names
    listProviders.ts # list_providers: lists data sources
  instructions.ts   # server-level MCP instructions string
  rounding.ts       # money rounding: ISO minor units / 8 sig-figs for metals
  types.ts          # shared types
test/               # Vitest specs (unit, server, integration, version, live smoke)
scripts/
  sync-server-json-version.mjs   # npm `version` hook: mirrors package.json -> server.json
server.json         # MCP registry manifest (remote server, root URL)
```

## Tools

- `get_rates` — blended reference rates. No date = latest; `date` = that day;
  `start`+`end` = time series (requires `quotes`). Optional `base`, `quotes`,
  and `provider` (single source key; omit for blended consensus).
- `convert` — convert an amount between two currencies. Returns a money object
  `{ amount, currency }` and nothing else; pass `date` for a historical rate.
  Rounded to the target's ISO minor units, or 8 significant figures for
  metals/unknown-precision codes.
- `list_currencies` — supported ISO 4217 currency codes and names as
  `{ code: name }`.
- `list_providers` — the available data sources as `{ key, name }`; use a key
  with `get_rates`' `provider` filter.

## Commands

```bash
npm install
npm run build      # tsc -> dist/
npm test           # vitest (live smoke skipped unless RUN_SMOKE=1)
npm run lint       # biome check
npm run format     # biome check --write
npm run dev        # tsx src/index.ts
npm start          # node dist/index.js  (listens on PORT, default 3000, POST /)
RUN_SMOKE=1 npx vitest run test/smoke.test.ts   # hits the live API
```

## Versioning (single canonical source)

**`package.json` `version` is the single source of truth.** Never hand-edit a
version anywhere else:

- `src/server.ts` reads `package.json` at runtime, so `serverInfo.version`
  always matches the release.
- `server.json` (the registry manifest) is a static file the registry reads;
  it is kept in lockstep by the npm `version` lifecycle script
  (`scripts/sync-server-json-version.mjs`).
- `test/version.test.ts` fails if `server.json` and `package.json` ever drift.

To release a new version, run **`npm version patch|minor|major`** — this bumps
`package.json`, syncs `server.json`, and tags. Do not edit versions manually.

## Release / MCP Registry

Published to the official registry as **`io.github.lineofflight/frankfurter`**
(remote server, root URL). `.github/workflows/publish-registry.yml` publishes
automatically via **GitHub Actions OIDC** whenever `server.json` changes on
`main` (or via manual `workflow_dispatch`). No interactive login, no stored
token, no secrets. The official registry auto-propagates to downstream
registries (e.g. GitHub's).

`server.json` constraints: it is a **remote** server (`remotes` array,
`type: streamable-http`) — no npm package / no `packages` block. `description`
must be ≤ 100 characters or the registry rejects it.

## CI

`.github/workflows/ci.yml` runs the test suite and publishes the Docker image
to `ghcr.io/lineofflight/frankfurter-mcp` on push.

## Deployment and secrets

Mirror the upstream Frankfurter project's convention: **the public repo
contains only generic code and a `Dockerfile`. All deployment topology — host,
ports, origin, CDN/routing — lives in the gitignored local deploy runbook at
`.agents/skills/deploying/` and gitignored `.env`/`.envrc`. Never commit host
names, IPs, routing, or credentials to this repo** (it is public).

- The server runs as a Docker container (`ghcr.io/lineofflight/frankfurter-mcp:latest`)
  behind a CDN; it serves MCP at the root path.
- **No credentials are required for normal development or for registry
  publishing** (OIDC handles publish). Routing (DNS + origin mapping for the
  public hostname) is a one-time, already-provisioned setup; normal operation
  needs no recurring CDN/API action.
- If a future change ever needs infrastructure API access (e.g. a CDN token)
  or host access (SSH), those credentials live only in the gitignored local
  env or the local runbook — same pattern as the parent project — never in a
  committed file.

## Development Notes

- Strict TypeScript; Biome (2-space, double quotes, 100-col)
- Tests assert real behavior through real transports; only the single outbound
  upstream boundary (`FrankfurterClient`) is stubbed
- Keep it thin: no caching, retries, auth, or rate logic beyond `rate × amount`
