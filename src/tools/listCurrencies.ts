import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { FrankfurterClient } from "../frankfurter.js";

export function registerListCurrencies(server: McpServer, client: FrankfurterClient): void {
  server.registerTool(
    "list_currencies",
    {
      title: "List currencies",
      description:
        "Find currency, metal and crypto codes by code or name. Returns {code:name}; omit query for all, including historical currencies.",
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: {
        query: z
          .string()
          .trim()
          .min(1)
          .optional()
          .describe("Code or name fragment, case-insensitive. Exact codes take priority."),
      },
    },
    async ({ query }) => {
      try {
        const currencies = await client.getCurrencies();
        const exact = currencies.find((c) => c.iso_code.toLowerCase() === query?.toLowerCase());
        const namesByCode = Object.fromEntries(
          (exact ? [exact] : currencies)
            .filter(
              ({ iso_code, name }) =>
                !query ||
                iso_code.toLowerCase().includes(query.toLowerCase()) ||
                name.toLowerCase().includes(query.toLowerCase()),
            )
            .map(({ iso_code, name }) => [iso_code, name]),
        );
        return { content: [{ type: "text" as const, text: JSON.stringify(namesByCode) }] };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true };
      }
    },
  );
}
