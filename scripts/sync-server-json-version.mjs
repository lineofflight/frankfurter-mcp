// Run by the npm `version` lifecycle script (`npm version patch|minor|major`).
// package.json is the single canonical version; this mirrors it into
// server.json (the MCP registry manifest, which cannot read it at runtime) so
// the two never drift. server.ts reads package.json directly at runtime.
import { readFileSync, writeFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const pkg = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));
const serverUrl = new URL("server.json", root);
const server = JSON.parse(readFileSync(serverUrl, "utf8"));

if (server.version === pkg.version) {
  console.log(`server.json already at ${pkg.version}`);
} else {
  server.version = pkg.version;
  writeFileSync(serverUrl, `${JSON.stringify(server, null, 2)}\n`);
  console.log(`server.json version -> ${pkg.version}`);
}
