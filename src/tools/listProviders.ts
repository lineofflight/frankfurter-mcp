import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
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
        "Find rate providers with keys, rate types, base currencies, frequency and coverage dates. Filters combine; omit for all. Use a key as provider in convert or get_rates.",
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: {
        query: z
          .string()
          .trim()
          .min(1)
          .optional()
          .describe("Key or name fragment, case-insensitive. Exact keys take priority."),
        country: z
          .string()
          .trim()
          .regex(/^[A-Za-z]{2}$/)
          .optional()
          .describe("Country code, e.g. US."),
        currency: z
          .string()
          .trim()
          .regex(/^[A-Za-z0-9]{3,5}$/)
          .optional()
          .describe("Supported currency code, including the provider's base."),
      },
    },
    async ({ query, country, currency }) => {
      try {
        const providers = await client.getProviders();
        const exact = providers.find((p) => p.key.toLowerCase() === query?.toLowerCase());
        const matches = (exact ? [exact] : providers).filter(
          (p) =>
            (!query ||
              p.key.toLowerCase().includes(query.toLowerCase()) ||
              p.name.toLowerCase().includes(query.toLowerCase())) &&
            (!country || p.country_code?.toUpperCase() === country.toUpperCase()) &&
            (!currency ||
              p.pivot_currency?.toUpperCase() === currency.toUpperCase() ||
              p.currencies.some((code) => code.toUpperCase() === currency.toUpperCase())),
        );
        return {
          content: [{ type: "text" as const, text: JSON.stringify(summarize(matches)) }],
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true };
      }
    },
  );
}
