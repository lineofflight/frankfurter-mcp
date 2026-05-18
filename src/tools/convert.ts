import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { FrankfurterClient } from "../frankfurter.js";
import { roundToCurrency } from "../rounding.js";

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

export const convertShape = {
  amount: z.number().describe("Amount in the source currency."),
  from: z.string().length(3).describe("ISO 4217 source currency."),
  to: z.string().length(3).describe("ISO 4217 target currency."),
  date: DATE.optional().describe("Historical date YYYY-MM-DD. Omit for latest."),
};

export interface ConvertArgs {
  amount: number;
  from: string;
  to: string;
  date?: string;
}

export interface ConvertResult {
  amount: number;
  from: string;
  to: string;
  rate: number;
  date: string;
  result: number;
}

export async function runConvert(
  args: ConvertArgs,
  client: FrankfurterClient,
): Promise<ConvertResult> {
  const from = args.from.toUpperCase();
  const to = args.to.toUpperCase();

  if (from === to) {
    return {
      amount: args.amount,
      from,
      to,
      rate: 1,
      // No upstream record to echo for an identity conversion; use the server's current UTC date.
      date: args.date ?? new Date().toISOString().slice(0, 10),
      result: args.amount,
    };
  }

  const records = await client.getRates({ base: from, quotes: [to], date: args.date });
  const record = records.find((r) => r.quote.toUpperCase() === to);
  if (!record) {
    throw new Error(`No rate available for ${from}->${to}${args.date ? ` on ${args.date}` : ""}.`);
  }
  const { value } = roundToCurrency(args.amount * record.rate, to);
  return {
    amount: args.amount,
    from,
    to,
    rate: record.rate,
    date: record.date,
    result: value,
  };
}

export function registerConvert(server: McpServer, client: FrankfurterClient): void {
  server.registerTool(
    "convert",
    {
      description:
        "Convert an amount between two currencies using Frankfurter's blended rate. Returns the rate used for transparency.",
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
