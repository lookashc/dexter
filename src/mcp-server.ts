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

  // Import underlying tools directly (NOT meta-tools that use LLM routing)
  const {
    getIncomeStatements, getBalanceSheets, getCashFlowStatements, getAllFinancialStatements,
    getFilings, get10KFilingItems, get10QFilingItems, get8KFilingItems,
    getPriceSnapshot, getPrices,
    getKeyRatiosSnapshot, getKeyRatios,
    getNews, getAnalystEstimates, getSegmentedRevenues,
    getCryptoPriceSnapshot, getCryptoPrices, getCryptoTickers,
    getInsiderTrades,
    getCompanyFacts,
  } = await import("./tools/finance/index.js");
  const { exaSearch, perplexitySearch, tavilySearch } = await import("./tools/search/index.js");
  const { webFetchTool } = await import("./tools/fetch/index.js");
  const { isAuthError, extractApiName, extractStatusCode, sendAuthErrorAlert } = await import("./utils/api-alerts.js");

  // Build MCP tool array — underlying tools only, no LLM-routed meta-tools
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const MCP_TOOLS: any[] = [
    // Financial Statements
    getIncomeStatements, getBalanceSheets, getCashFlowStatements, getAllFinancialStatements,
    // SEC Filings
    getFilings, get10KFilingItems, get10QFilingItems, get8KFilingItems,
    // Prices
    getPriceSnapshot, getPrices,
    // Crypto
    getCryptoPriceSnapshot, getCryptoPrices, getCryptoTickers,
    // Key Ratios
    getKeyRatiosSnapshot, getKeyRatios,
    // Other
    getNews, getAnalystEstimates, getSegmentedRevenues, getInsiderTrades,
    // Company info
    getCompanyFacts,
    // Web content extraction
    webFetchTool,
    // Web search (priority: Exa > Perplexity > Tavily)
    ...(process.env.EXASEARCH_API_KEY ? [exaSearch]
      : process.env.PERPLEXITY_API_KEY ? [perplexitySearch]
      : process.env.TAVILY_API_KEY ? [tavilySearch]
      : []),
  ];

  // Helper to convert tool schema to JSON Schema
  // Uses Zod v4's built-in toJSONSchema for proper conversion
  function getJsonSchema(schema: unknown): object {
    // Check if it's a Zod schema (has _zod property for v4)
    if (schema && typeof schema === "object" && "_zod" in schema) {
      // Use Zod v4's built-in JSON Schema conversion
      return z.toJSONSchema(schema as any);
    }
    // Already a JSON schema or unknown format
    return (schema as object) || { type: "object", properties: {} };
  }

  // Create MCP server
  const server = new Server(
    {
      name: "dexter-financial",
      version: "2.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: MCP_TOOLS.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: getJsonSchema(tool.schema),
    })),
  }));

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    const tool = MCP_TOOLS.find((t) => t.name === name);
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

      // Detect auth/payment errors (401/402/403) and send Telegram alert
      if (isAuthError(message)) {
        const apiName = extractApiName(message);
        const statusCode = extractStatusCode(message);
        // Fire-and-forget — don't block the MCP response
        sendAuthErrorAlert(apiName, statusCode, name).catch(() => {});
      }

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
