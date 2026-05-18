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
docker build -t frankfurter-mcp . && docker run -p 3000:3000 frankfurter-mcp
docker run -p 3000:3000 ghcr.io/lineofflight/frankfurter-mcp:latest
```

The prebuilt `ghcr.io/lineofflight/frankfurter-mcp` image is available once
package publishing is enabled for the repo; building from source always works.

Point any MCP client at `http://<host>:3000/mcp` (Streamable HTTP).

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
