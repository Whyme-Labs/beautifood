// A stand-in for `qloo mcp` in tests: the same stdio MCP shape, canned envelopes, and a count of
// how often each tool was really called (to prove the cache works).
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const calls = {};

// answers shaped like Qloo's, so the app's end-to-end tests read something realistic
function canned(tool, args) {
  if (tool === "qloo_find_tags") return [{ id: "urn:tag:genre:place:restaurant:malaysian", name: "Malaysian" }];
  if (tool === "qloo_describe") return [];
  if (args.target_type === "place" && Array.isArray(args.signals))
    return [
      { entity_id: "K1", name: "Chicken Hof", tags: [{ name: "Korean Fried Chicken" }] },
      { entity_id: "K2", name: "Tealive", tags: [{ name: "Bubble Tea" }, { name: "Milk Tea" }] },
    ];
  if (args.target_type === "place")
    return [
      { entity_id: "P1", name: "Nasi Kandar Pelita", tags: [{ id: "urn:tag:genre:place:restaurant:indian_muslim", name: "Indian Muslim" }, { id: "urn:tag:amenity:place:late_night", name: "Late night" }] },
      { entity_id: "P2", name: "Village Park Restaurant", tags: [{ id: "urn:tag:genre:place:restaurant:nasi_lemak", name: "Nasi Lemak" }, { id: "urn:tag:genre:place:restaurant:indian_muslim", name: "Indian Muslim" }, { id: "urn:tag:amenity:place:late_night", name: "Late night" }] },
    ];
  if (args.target_type === "artist") return [{ entity_id: "A1", name: "Yuna" }, { entity_id: "A2", name: "Siti Nurhaliza" }];
  if (args.target_type === "tv_show") return [{ entity_id: "T1", name: "Upin & Ipin" }];
  return [{ name: "Fake" }];
}
const server = new Server({ name: "fake-qloo", version: "0.0.0" }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: ["qloo_capabilities", "qloo_recommend", "qloo_find_tags", "qloo_describe", "qloo_entity_tags"].map((name) => ({ name, inputSchema: { type: "object" } })),
}));
server.setRequestHandler(CallToolRequestSchema, async ({ params }) => {
  calls[params.name] = (calls[params.name] ?? 0) + 1;
  const envelope =
    params.name === "qloo_capabilities"
      ? { adapter: { ready: true } }
      : params.arguments?.query === "boom"
        ? { status: "error", summary: "bad", error: { code: "QLOO_AUTH", retryable: false, recovery: "" } }
        : { status: "ok", summary: "fine", results: canned(params.name, params.arguments ?? {}).map((r) => ({ ...r, calls: calls[params.name] })), result_count: 1 };
  return { content: [{ type: "text", text: JSON.stringify(envelope) }], structuredContent: envelope };
});
await server.connect(new StdioServerTransport());
