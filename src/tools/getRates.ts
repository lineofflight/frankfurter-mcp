import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { FrankfurterClient } from "../frankfurter.js";
import type { RateRecord } from "../types.js";

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");
// ISO 4217 codes are three letters; crypto asset codes run longer (USDT, AVAX).
const CODE = z.string().regex(/^[A-Za-z0-9]{3,5}$/, "expected a 3 to 5 character code");
const PROVIDERS = z.preprocess(
  (v) => (typeof v === "string" ? [v] : v),
  z.array(z.string().min(2).max(16)),
);

export const getRatesShape = {
  base: CODE.optional().describe("Base currency or asset code. Default EUR."),
  date: DATE.optional().describe("Single day YYYY-MM-DD. Omit for the latest rates."),
  // Models often send a lone code as a bare string; wrap it rather than reject.
  quotes: z
    .preprocess((v) => (typeof v === "string" ? [v] : v), z.array(CODE))
    .optional()
    .describe("Requested currency codes. Supply whenever known; omit only to request all."),
  provider: PROVIDERS.optional().describe(
    "Provider or dataset keys, e.g. ['ECB','NBP.B']; omit for blended rates.",
  ),
};

export interface GetRatesArgs {
  base?: string;
  date?: string;
  quotes?: string[];
  provider?: string[];
  providers?: unknown;
}

export function registerGetRates(server: McpServer, client: FrankfurterClient): void {
  server.registerTool(
    "get_rates",
    {
      title: "Get exchange rates",
      description:
        "Latest or dated reference rates. Provider rates retain published digits on their own base. Returns rate records; if any provider fails, returns {rates,errors} preserving successes. Retry only failed providers.",
      annotations: { readOnlyHint: true, openWorldHint: true },
      // Retain the legacy providers argument at runtime without advertising two
      // names for the same choice. Validate it explicitly below.
      inputSchema: z.object(getRatesShape).passthrough(),
    },
    async (args: GetRatesArgs) => {
      try {
        const unknown = Object.keys(args).filter(
          (key) => !Object.hasOwn(getRatesShape, key) && key !== "providers",
        );
        if (unknown.length) {
          throw new Error(
            `Unknown argument(s): ${unknown.join(", ")}. Use base, date, quotes or provider.`,
          );
        }
        if (args.provider !== undefined && args.providers !== undefined) {
          throw new Error("Use provider or legacy providers, not both.");
        }
        const rawProviders =
          args.providers === undefined ? args.provider : PROVIDERS.parse(args.providers);
        if (!rawProviders || rawProviders.length === 0) {
          const records = await client.getRates({
            base: args.base,
            date: args.date,
            quotes: args.quotes,
            provider: undefined,
          });
          return { content: [{ type: "text" as const, text: JSON.stringify(records) }] };
        }

        const providers = [...new Set(rawProviders.map((p) => p.toUpperCase()))];
        const results = await Promise.allSettled(
          providers.map(async (provider) => {
            const records = await client.getRates({
              base: args.base,
              date: args.date,
              quotes: args.quotes,
              provider,
            });
            return records.map((r) => ({ ...r, provider }));
          }),
        );
        const rates: RateRecord[] = [];
        const errors: { provider: string; message: string }[] = [];
        results.forEach((result, index) => {
          if (result.status === "fulfilled") rates.push(...result.value);
          else
            errors.push({
              provider: providers[index],
              message:
                result.reason instanceof Error ? result.reason.message : String(result.reason),
            });
        });
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(errors.length ? { rates, errors } : rates),
            },
          ],
          ...(errors.length === providers.length ? { isError: true } : {}),
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true };
      }
    },
  );
}
