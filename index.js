import 'dotenv/config';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { connectDB } from './db.js';

// Import all 10 tools
import ambientStatus from './tools/ambientStatus.js';
import scoreMessage from './tools/scoreMessage.js';
import getDriftScores from './tools/getDriftScores.js';
import getScorecard from './tools/getScorecard.js';
import costAnalysis from './tools/costAnalysis.js';
import runBenchmark from './tools/runBenchmark.js';
import conversationHistory from './tools/conversationHistory.js';
import generateReport from './tools/generateReport.js';
import whisper from './tools/whisper.js';
import costVsDrift from './tools/costVsDrift.js';
import nervousStatus from './tools/nervousStatus.js';

const tools = [
  ambientStatus,       // 1. Session start + drift snapshot
  scoreMessage,        // 2. Core ambient scoring
  getDriftScores,      // 3. Live drift for all models
  getScorecard,        // 4. Full 9-score behavioral scorecard
  costAnalysis,        // 5. 7-day API cost analysis
  runBenchmark,        // 6. Single/full benchmark
  conversationHistory, // 7. Query scored conversation logs
  generateReport,      // 8. NLG report generation
  whisper,             // 9. Ambient whisper injection
  costVsDrift,         // 10. 30-day cost vs drift matrix
  nervousStatus,       // 11. Nervous system event bus health
];

// Build tool registry
const toolRegistry = {};
tools.forEach(tool => { toolRegistry[tool.name] = tool; });

// Create MCP server
const server = new Server(
  {
    name: 'abis-mcp',
    version: '2.0.0',
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

// Call tool handler — passes sessionCtx to tools that need it
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
    // Some tools accept a second sessionCtx argument
    return await tool.execute(args || {}, { sessionId: `mcp-${Date.now()}` });
  } catch (err) {
    console.error(`[ABIS] Tool ${name} error:`, err.message);
    return {
      content: [{ type: 'text', text: `ABIS tool error (${name}): ${err.message}` }],
      isError: true,
    };
  }
});

// Start server
async function main() {
  // Connect to MongoDB (non-blocking — server works without it)
  await connectDB();

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('ABIS MCP server v2.0.0 running on stdio — 11 tools registered');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
