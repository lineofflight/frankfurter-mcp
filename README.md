# frankfurter-mcp

Official [Model Context Protocol](https://modelcontextprotocol.io) server for the
[Frankfurter](https://frankfurter.dev) exchange-rate API. A thin, stateless proxy
over Frankfurter's v2 blended multi-source reference rates.

## Tools

- **`convert`** — the primary tool. Convert an amount between two currencies;
  returns a money object `{ amount, currency }` rounded to the target's minor
  units. Pass `date` for a historical rate, `provider` for one institution's
  published rate (e.g. `UST`, the U.S. Treasury's quarterly reporting rate).
- **`get_rates`** — blended reference rates for the latest day or a single
  `date`. Optional `base`, `quotes` and `provider`. The raw-rate companion to
  `convert`; with `provider` and the provider's own base, the digits are as
  published, with the date they took effect.
- **`list_currencies`** — supported ISO 4217 codes and names as `{ code: name }`.
- **`list_providers`** — the institutions relayed, with key, rate type,
  frequency and coverage dates, to pick a `provider`.

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
