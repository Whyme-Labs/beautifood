// MCP endpoint (Streamable HTTP, stateless). Customer agents need no auth; merchant agents send a PAT.
import { api } from "../src/server/http";
import { handleMcp } from "../src/server/mcp";

export const POST = api((c) => handleMcp(c));
export const GET = api((c) => c.json({ error: "This MCP server is stateless; use POST with JSON-RPC." }, 405));
