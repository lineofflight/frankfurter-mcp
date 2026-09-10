import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FrankfurterClient } from "../frankfurter.js";
import type { Provider } from "../types.js";

// What an agent needs to pick a provider: who, what kind of rate, how often a
// value stands, and the span covered. The per-provider currency list is left
// out: it is the bulk of the upstream payload and rarely decides the choice.
export type ProviderSummary = Pick<
  Provider,
  | "key"
  | "name"
  | "country_code"
  | "rate_type"
  | "pivot_currency"
  | "frequency"
  | "start_date"
  | "end_date"
> & { currencies: number };

export function summarize(providers: Provider[]): ProviderSummary[] {
  return providers.map((p) => ({
    key: p.key,
    name: p.name,
    country_code: p.country_code ?? null,
    rate_type: p.rate_type ?? null,
    pivot_currency: p.pivot_currency ?? null,
    frequency: p.frequency ?? "daily",
    start_date: p.start_date ?? null,
    end_date: p.end_date ?? null,
    currencies: p.currencies.length,
  }));
}

export function registerListProviders(server: McpServer, client: FrankfurterClient): void {
  server.registerTool(
    "list_providers",
    {
      title: "List providers",
      description:
        "List the institutions whose rates Frankfurter relays, with key, rate type, frequency (daily, monthly or quarterly) and coverage dates. Use a key as `provider` in `convert` or `get_rates` for that institution's published rates instead of the blend.",
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: {},
    },
    async () => {
      try {
        const providers = await client.getProviders();
        return {
          content: [{ type: "text" as const, text: JSON.stringify(summarize(providers), null, 2) }],
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true };
      }
    },
  );
}
