import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { FrankfurterClient } from "./frankfurter.js";
import { INSTRUCTIONS } from "./instructions.js";
import { registerConvert } from "./tools/convert.js";
import { registerGetRates } from "./tools/getRates.js";

export function createMcpServer(client: FrankfurterClient = new FrankfurterClient()): McpServer {
  const server = new McpServer(
    { name: "frankfurter", version: "0.1.0" },
    { instructions: INSTRUCTIONS },
  );
  registerGetRates(server, client);
  registerConvert(server, client);
  return server;
}
