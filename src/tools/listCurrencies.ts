import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FrankfurterClient } from "../frankfurter.js";

export function registerListCurrencies(server: McpServer, client: FrankfurterClient): void {
  server.registerTool(
    "list_currencies",
    {
      description:
        "List all supported ISO 4217 currency codes and their full names (e.g. { 'USD': 'United States Dollar' }).",
      inputSchema: {},
    },
    async () => {
      try {
        const currencies = await client.getCurrencies();
        const namesByCode = Object.fromEntries(
          currencies.map(({ iso_code, name }) => [iso_code, name]),
        );
        return { content: [{ type: "text" as const, text: JSON.stringify(namesByCode, null, 2) }] };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true };
      }
    },
  );
}
