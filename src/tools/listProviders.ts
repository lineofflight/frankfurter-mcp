import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FrankfurterClient } from "../frankfurter.js";

export function registerListProviders(server: McpServer, client: FrankfurterClient): void {
  server.registerTool(
    "list_providers",
    {
      description:
        "List the available data providers (institutional sources) as {key, name}. Use a key with get_rates' `provider` filter to restrict to a single source.",
      inputSchema: {},
    },
    async () => {
      try {
        const providers = await client.getProviders();
        return { content: [{ type: "text" as const, text: JSON.stringify(providers, null, 2) }] };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true };
      }
    },
  );
}
