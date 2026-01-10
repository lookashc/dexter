#!/usr/bin/env bun

// Load .env FIRST, before any other imports that might need env vars
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, "../../.env") });

// Dynamic import to ensure env vars are loaded first
async function main() {
  const { Server } = await import("@modelcontextprotocol/sdk/server/index.js");
  const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js");
  const {
    CallToolRequestSchema,
    ListToolsRequestSchema,
  } = await import("@modelcontextprotocol/sdk/types.js");
  const { z } = await import("zod");
  const { TOOLS } = await import("./tools/index.js");

  // Helper to convert tool schema to JSON Schema
  // Uses Zod v4's built-in toJSONSchema for proper conversion
  function getJsonSchema(schema: unknown): object {
    // Check if it's a Zod schema (has _zod property for v4)
    if (schema && typeof schema === "object" && "_zod" in schema) {
      // Use Zod v4's built-in JSON Schema conversion
      return z.toJSONSchema(schema as z.ZodType);
    }
    // Already a JSON schema or unknown format
    return (schema as object) || { type: "object", properties: {} };
  }

  // Create MCP server
  const server = new Server(
    {
      name: "dexter-financial",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: getJsonSchema(tool.schema),
    })),
  }));

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    const tool = TOOLS.find((t) => t.name === name);
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }

    try {
      const result = await tool.invoke(args || {});
      return {
        content: [
          {
            type: "text",
            text: typeof result === "string" ? result : JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: `Error: ${message}` }],
        isError: true,
      };
    }
  });

  // Start server
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Dexter MCP server running on stdio");
}

main().catch(console.error);
