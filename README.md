# frankfurter-mcp

Official [Model Context Protocol](https://modelcontextprotocol.io) server for the
[Frankfurter](https://frankfurter.dev) exchange-rate API. A thin, stateless proxy
over Frankfurter's v2 blended multi-source reference rates.

## Tools

- **`convert`** — the primary tool. Convert an amount between two currencies;
  returns a money object `{ amount, currency }` rounded to the target's minor
  units. Pass `date` for a historical rate, `provider` for one institution's
  published rate (e.g. `UST`, the U.S. Treasury's quarterly reporting rate).
  Set `details: true` to include the rate, effective date, and selected provider
  in the same call. Same-currency conversions return rate 1 and date null.
  Conversion uses the direct API rate, including its precision for tiny rates.
- **`get_rates`** — blended reference rates for the latest day or a single
  `date`. Optional `base`, `quotes` and `provider` (one key or an array to compare
  institutions). Supply `quotes` whenever the requested currencies are known. The raw-rate companion to `convert`; with `provider`
  and the provider's own base, the digits are as published, with the date they
  took effect. Successful calls return an array; if a provider fails, the result
  is `{rates, errors}`, retaining successful rates and identifying failures by
  provider. Only a complete failure sets `isError`. Retry only failed providers.
  The legacy `providers` alias still works but cannot be combined with `provider`.
- **`list_currencies`** — supported currency, precious metal and crypto asset
  codes and names as `{ code: name }`. Optional `query` matches a code or name
  fragment, case-insensitively, including historical currencies.
- **`list_providers`** — the institutions relayed, with key, rate type,
  frequency and coverage dates, to pick a `provider`. Filter by `query` (key/name
  fragment), `country` (country code), or `currency` (supported code, including
  the provider's base). Filters combine and ignore case. A provider that
  publishes several series also lists its `datasets`; pass a dataset key such as
  `NBP.B` as `provider` to select one.

Exact currency codes and provider keys take priority over substring matches.

All results use compact JSON. Discovery without filters still returns the full catalogue;
use filters to keep agent context small. No matches returns `{}` for currencies or `[]`
for providers.

For time series, historical ranges, or bulk queries, use the REST API at
`https://api.frankfurter.dev/v2` directly.

Rates are daily reference rates, not real-time trading rates. Not financial advice.

## Run

```bash
npm install
npm run build
npm start            # listens on :3000, POST /
```

Docker:

```bash
docker build -t frankfurter-mcp . && docker run -p 3000:3000 frankfurter-mcp
docker run -p 3000:3000 ghcr.io/lineofflight/frankfurter-mcp:latest
```

The prebuilt `ghcr.io/lineofflight/frankfurter-mcp:latest` image is published
on each release; building from source also works.

Point any MCP client at `http://<host>:3000/` (Streamable HTTP). The hosted
server is at `https://mcp.frankfurter.dev/`.

## Configuration

- `PORT` — HTTP port (default `3000`).
- `FRANKFURTER_API_URL` — upstream API base (default `https://api.frankfurter.dev`).
  Set this to a self-hosted Frankfurter instance if desired. The value must be a
  host root: any path prefix in it is discarded (e.g. `https://example.com/api`
  resolves to `https://example.com/v2/rates`), so a self-hosted instance must be
  reachable at the host root.

## Development

```bash
npm test       # vitest
npm run lint   # biome
```

## License

MIT
