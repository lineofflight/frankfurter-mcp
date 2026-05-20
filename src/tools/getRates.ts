import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { FrankfurterClient } from "../frankfurter.js";

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

export const getRatesShape = {
  base: z.string().length(3).optional().describe("ISO 4217 base currency. Default EUR."),
  date: DATE.optional().describe("Single day YYYY-MM-DD. Mutually exclusive with start/end."),
  start: DATE.optional().describe("Range start YYYY-MM-DD (inclusive). Requires end and quotes."),
  end: DATE.optional().describe("Range end YYYY-MM-DD (inclusive). Requires start and quotes."),
  quotes: z
    .array(z.string().length(3))
    .optional()
    .describe("ISO 4217 quote codes. Required when start/end is set."),
  provider: z
    .string()
    .optional()
    .describe(
      "Single data-provider key to use exclusively (e.g. ECB). Omit for blended consensus across all sources. Call list_providers for valid keys.",
    ),
};

export interface GetRatesArgs {
  base?: string;
  date?: string;
  start?: string;
  end?: string;
  quotes?: string[];
  provider?: string;
}

export function validateGetRates(a: GetRatesArgs): string | null {
  const hasRange = Boolean(a.start) || Boolean(a.end);
  if (a.date && hasRange) {
    return "`date` and `start`/`end` are mutually exclusive.";
  }
  if (hasRange && !(a.start && a.end)) {
    return "A range requires both start and end dates.";
  }
  if (a.start && a.end && !(a.quotes && a.quotes.length > 0)) {
    return "`quotes` is required for a date range to avoid oversized responses.";
  }
  return null;
}

export function registerGetRates(server: McpServer, client: FrankfurterClient): void {
  server.registerTool(
    "get_rates",
    {
      description:
        "Blended multi-source reference exchange rates. No date = latest; `date` = that day; `start`+`end` = time series (requires `quotes`). Optional `provider` returns a single source instead of the blend.",
      inputSchema: getRatesShape,
    },
    async (args: GetRatesArgs) => {
      const err = validateGetRates(args);
      if (err) {
        return { content: [{ type: "text" as const, text: `Error: ${err}` }], isError: true };
      }
      try {
        const records = await client.getRates({
          base: args.base,
          date: args.date,
          start: args.start,
          end: args.end,
          quotes: args.quotes,
          providers: args.provider ? [args.provider] : undefined,
        });
        return { content: [{ type: "text" as const, text: JSON.stringify(records, null, 2) }] };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true };
      }
    },
  );
}
