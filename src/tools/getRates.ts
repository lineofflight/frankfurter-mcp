import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { FrankfurterClient } from "../frankfurter.js";

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

export const getRatesShape = {
  base: z.string().length(3).optional().describe("ISO 4217 base currency. Default EUR."),
  date: DATE.optional().describe("Single day YYYY-MM-DD. Omit for the latest rates."),
  // Models often send a lone code as a bare string; wrap it rather than reject.
  quotes: z
    .preprocess((v) => (typeof v === "string" ? [v] : v), z.array(z.string().length(3)))
    .optional()
    .describe("ISO 4217 quote codes to return; omit for all."),
  provider: z
    .preprocess((v) => (typeof v === "string" ? [v] : v), z.array(z.string().min(2).max(8)))
    .optional()
    .describe(
      "Provider key or keys, e.g. ECB or ['ECB', 'HMRC']. Serves published rates instead of the blend; a date inside a weekly, monthly or quarterly provider's period returns the rate in force. Keys at https://frankfurter.dev/providers/.",
    ),
  providers: z
    .preprocess((v) => (typeof v === "string" ? [v] : v), z.array(z.string().min(2).max(8)))
    .optional()
    .describe("Alias for `provider` accepting multiple provider keys."),
};

export interface GetRatesArgs {
  base?: string;
  date?: string;
  quotes?: string[];
  provider?: string[];
  providers?: string[];
}

export function registerGetRates(server: McpServer, client: FrankfurterClient): void {
  server.registerTool(
    "get_rates",
    {
      title: "Get exchange rates",
      description:
        "Latest or a single day's exchange rates. The raw-rate companion to `convert`. With `provider`, published rates from one or more institutions: on its own base the digits are as published, with the date they took effect.",
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: getRatesShape,
    },
    async (args: GetRatesArgs) => {
      try {
        const rawProviders = args.providers ?? args.provider;
        if (!rawProviders || rawProviders.length === 0) {
          const records = await client.getRates({
            base: args.base,
            date: args.date,
            quotes: args.quotes,
            provider: undefined,
          });
          return { content: [{ type: "text" as const, text: JSON.stringify(records, null, 2) }] };
        }

        const allRecords = await Promise.all(
          rawProviders.map(async (p) => {
            const records = await client.getRates({
              base: args.base,
              date: args.date,
              quotes: args.quotes,
              provider: p,
            });
            return records.map((r) => ({ ...r, provider: p.toUpperCase() }));
          }),
        );
        return {
          content: [{ type: "text" as const, text: JSON.stringify(allRecords.flat(), null, 2) }],
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true };
      }
    },
  );
}
