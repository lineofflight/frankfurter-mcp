import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { FrankfurterClient } from "../frankfurter.js";
import { roundMoney } from "../rounding.js";

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

export const convertShape = {
  amount: z
    .number()
    .describe(
      "Amount in the source currency. Normalize localized input first: '100,50' -> 100.5; German '1.000,50' -> 1000.5; English '1,000.50' -> 1000.5.",
    ),
  from: z.string().length(3).describe("ISO 4217 source currency."),
  to: z.string().length(3).describe("ISO 4217 target currency."),
  date: DATE.optional().describe("Date YYYY-MM-DD for a past rate; omit for latest."),
  provider: z
    .string()
    .min(2)
    .max(8)
    .optional()
    .describe(
      "Provider key, e.g. UST for U.S. Treasury reporting rates. Serves that institution's published rates instead of the blend; a date inside a monthly or quarterly provider's period returns the rate in force. Keys at https://frankfurter.dev/providers/.",
    ),
};

export interface ConvertArgs {
  amount: number;
  from: string;
  to: string;
  date?: string;
  provider?: string;
}

// A money object: the converted value and its currency. Nothing else — for the
// rate, date, or provenance, use get_rates.
export interface ConvertResult {
  amount: number;
  currency: string;
}

export async function runConvert(
  args: ConvertArgs,
  client: FrankfurterClient,
): Promise<ConvertResult> {
  const from = args.from.toUpperCase();
  const to = args.to.toUpperCase();

  if (from === to) {
    return { amount: roundMoney(args.amount, to), currency: to };
  }

  const records = await client.getRates({
    base: from,
    quotes: [to],
    date: args.date,
    provider: args.provider,
  });
  const record = records.find((r) => r.quote.toUpperCase() === to);
  if (!record) {
    const where = args.provider ? ` from ${args.provider.toUpperCase()}` : "";
    throw new Error(
      `No rate available for ${from}->${to}${where}${args.date ? ` on ${args.date}` : ""}.`,
    );
  }
  return { amount: roundMoney(args.amount * record.rate, to), currency: to };
}

export function registerConvert(server: McpServer, client: FrankfurterClient): void {
  server.registerTool(
    "convert",
    {
      title: "Convert currency",
      description:
        "Convert an amount from one currency to another. Returns {amount, currency} rounded to the target's minor units. Upstream rounds rates per direction; for low-value sources, flip via `get_rates` for more precision. Pass `provider` to use one institution's published rate, e.g. UST for a U.S. Treasury reporting rate.",
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: convertShape,
    },
    async (args: ConvertArgs) => {
      try {
        const out = await runConvert(args, client);
        return { content: [{ type: "text" as const, text: JSON.stringify(out, null, 2) }] };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true };
      }
    },
  );
}
