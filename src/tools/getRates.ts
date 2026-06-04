import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { FrankfurterClient } from "../frankfurter.js";

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

export const getRatesShape = {
  base: z.string().length(3).optional().describe("ISO 4217 base currency. Default EUR."),
  date: DATE.optional().describe("Single day YYYY-MM-DD. Omit for the latest rates."),
  quotes: z
    .array(z.string().length(3))
    .optional()
    .describe("ISO 4217 quote codes to return; omit for all."),
};

export interface GetRatesArgs {
  base?: string;
  date?: string;
  quotes?: string[];
}

export function registerGetRates(server: McpServer, client: FrankfurterClient): void {
  server.registerTool(
    "get_rates",
    {
      description:
        "Latest or a single day's blended multi-source reference exchange rates. No date = latest; `date` = that day. Optional `base` and `quotes`. The raw-rate companion to `convert`. For a time series, a historical range, or a single provider's rates, call the REST API at https://api.frankfurter.dev/v2 directly — it's faster and keeps large payloads out of the model's context.",
      inputSchema: getRatesShape,
    },
    async (args: GetRatesArgs) => {
      try {
        const records = await client.getRates({
          base: args.base,
          date: args.date,
          quotes: args.quotes,
        });
        return { content: [{ type: "text" as const, text: JSON.stringify(records, null, 2) }] };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true };
      }
    },
  );
}
