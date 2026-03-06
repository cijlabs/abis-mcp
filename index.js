require('dotenv').config();
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');

// Load all tools
const tools = [
  require('./tools/getHealth'),
  require('./tools/getDriftScores'),
  require('./tools/getModelScorecard'),
  require('./tools/runBenchmark'),
  require('./tools/generateReport'),
  require('./tools/getBenchmarkHistory'),
];

// Build tool registry
const toolRegistry = {};
tools.forEach(tool => { toolRegistry[tool.name] = tool; });

// Create MCP server
const server = new Server(
  {
    name: 'abis-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  };
});

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const tool = toolRegistry[name];

  if (!tool) {
    return {
      content: [{ type: 'text', text: `Unknown tool: ${name}` }],
      isError: true,
    };
  }

  try {
    return await tool.execute(args || {});
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Tool error: ${err.message}` }],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('ABIS MCP server running on stdio');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
