# frankfurter-mcp

Official [Model Context Protocol](https://modelcontextprotocol.io) server for the
[Frankfurter](https://frankfurter.dev) exchange-rate API. A thin, stateless proxy
over Frankfurter's v2 blended multi-source reference rates.

## Tools

- **`get_rates`** — blended reference rates. No date = latest; `date` = that
  day; `start`+`end` = time series (requires `quotes`). Optional `base`,
  `quotes`, `provider` (single source; omit for blended).
- **`convert`** — convert an amount; returns a money object `{ amount, currency }`.
  Pass `date` for a historical rate.
- **`list_currencies`** — supported ISO 4217 codes and names as `{ code: name }`.
- **`list_providers`** — available data sources as `{ key, name }`.

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
