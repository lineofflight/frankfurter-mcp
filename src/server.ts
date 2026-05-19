import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { FrankfurterClient } from "./frankfurter.js";
import { INSTRUCTIONS } from "./instructions.js";
import { registerConvert } from "./tools/convert.js";
import { registerGetRates } from "./tools/getRates.js";
import { registerListProviders } from "./tools/listProviders.js";

// Single source of truth: serverInfo.version mirrors package.json so it can
// never drift from the released/registry version. package.json sits one
// directory up from this module in both dev (src/) and the built image (dist/).
const { version } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { version: string };

export function createMcpServer(client: FrankfurterClient = new FrankfurterClient()): McpServer {
  const server = new McpServer({ name: "frankfurter", version }, { instructions: INSTRUCTIONS });
  registerGetRates(server, client);
  registerConvert(server, client);
  registerListProviders(server, client);
  return server;
}
