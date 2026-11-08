import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { FrankfurterClient } from "../frankfurter.js";
import { roundMoney } from "../rounding.js";

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");
// ISO 4217 codes are three letters; crypto asset codes run longer (USDT, AVAX).
const CODE = z.string().regex(/^[A-Za-z0-9]{3,5}$/, "expected a 3 to 5 character code");

export const convertShape = {
  amount: z
    .number()
    .describe("Numeric amount in the source currency; normalize localized input first."),
  from: CODE.describe("Source currency or asset code, e.g. USD, XAU or BTC."),
  to: CODE.describe("Target currency or asset code."),
  date: DATE.optional().describe("Date YYYY-MM-DD for a past rate; omit for latest."),
  provider: z
    .string()
    .min(2)
    .max(8)
    .optional()
    .describe("Institution's key, e.g. ECB or UST; omit for blended rates."),
  details: z
    .boolean()
    .optional()
    .describe("Include rate, effective date and provider if selected. Default false."),
};

export interface ConvertArgs {
  amount: number;
  from: string;
  to: string;
  date?: string;
  provider?: string;
  details?: boolean;
}

// Metadata is opt-in so ordinary conversions keep their small response.
export interface ConvertResult {
  amount: number;
  currency: string;
  rate?: number;
  date?: string | null;
  provider?: string;
}

export async function runConvert(
  args: ConvertArgs,
  client: FrankfurterClient,
): Promise<ConvertResult> {
  const from = args.from.toUpperCase();
  const to = args.to.toUpperCase();

  if (from === to) {
    return {
      amount: roundMoney(args.amount, to),
      currency: to,
      ...(args.details ? { rate: 1, date: null } : {}),
    };
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
  return {
    amount: roundMoney(args.amount * record.rate, to),
    currency: to,
    ...(args.details
      ? {
          rate: record.rate,
          date: record.date,
          ...(args.provider ? { provider: args.provider.toUpperCase() } : {}),
        }
      : {}),
  };
}

export function registerConvert(server: McpServer, client: FrankfurterClient): void {
  server.registerTool(
    "convert",
    {
      title: "Convert currency",
      description:
        "Convert money using a reference rate. Returns {amount,currency}, rounded to the target's minor units (8 significant figures for metals/crypto). Set details for the rate and effective date too; identity conversions have rate 1 and date null.",
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: convertShape,
    },
    async (args: ConvertArgs) => {
      try {
        const out = await runConvert(args, client);
        return { content: [{ type: "text" as const, text: JSON.stringify(out) }] };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true };
      }
    },
  );
}
