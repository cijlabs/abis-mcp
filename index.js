import 'dotenv/config';
import { createServer as createHttpServer } from 'http';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { connectDB } from './db.js';

// Import all 13 tools (10 original + 3 Layer 3 interceptor)
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
import driftGate from './tools/driftGate.js';
import observe from './tools/observe.js';
import simulate from './tools/simulate.js';

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
  driftGate,           // 11. Layer 3 pre-response drift interceptor
  observe,             // 12. Layer 3 post-response observer
  simulate,            // 13. Layer 3 correction simulator
];

// Build tool registry
const toolRegistry = {};
tools.forEach(tool => { toolRegistry[tool.name] = tool; });

// Track active transports
const activeTransports = new Map();

function createMCPServer() {
  const server = new Server(
    { name: 'abis-mcp', version: '3.1.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  }));

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
      return await tool.execute(args || {}, { sessionId: `mcp-${Date.now()}` });
    } catch (err) {
      console.error(`[ABIS] Tool ${name} error:`, err.message);
      return {
        content: [{ type: 'text', text: `ABIS tool error (${name}): ${err.message}` }],
        isError: true,
      };
    }
  });

  return server;
}

// ─── SSE mode (default) — uses raw Node http (zero Express issues) ──
async function startSSE() {
  await connectDB();

  const PORT = parseInt(process.env.PORT || '3100', 10);

  const httpServer = createHttpServer(async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url, `http://localhost:${PORT}`);

    // Health check
    if (req.method === 'GET' && url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        server: 'abis-mcp',
        version: '3.1.0',
        tools: tools.length,
        transport: 'sse',
        sessions: activeTransports.size,
      }));
      return;
    }

    // SSE endpoint — client connects here
    if (req.method === 'GET' && url.pathname === '/sse') {
      console.log('[ABIS MCP] New SSE connection');
      try {
        const mcpServer = createMCPServer();
        const transport = new SSEServerTransport('/messages', res);
        const sessionId = transport.sessionId;
        activeTransports.set(sessionId, transport);

        res.on('close', () => {
          console.log(`[ABIS MCP] SSE closed: ${sessionId}`);
          activeTransports.delete(sessionId);
          mcpServer.close().catch(() => {});
        });

        await mcpServer.connect(transport);
      } catch (err) {
        console.error('[ABIS MCP] SSE error:', err);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      }
      return;
    }

    // Message endpoint — client POSTs JSON-RPC here
    if (req.method === 'POST' && url.pathname === '/messages') {
      const sessionId = url.searchParams.get('sessionId');
      const transport = activeTransports.get(sessionId);

      if (!transport) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No active SSE session' }));
        return;
      }

      try {
        await transport.handlePostMessage(req, res);
      } catch (err) {
        console.error('[ABIS MCP] POST error:', err);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      }
      return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found', routes: ['/health', '/sse', '/messages'] }));
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`ABIS MCP server v3.1.0 running on http://0.0.0.0:${PORT}/sse — 13 tools`);
  });
}

// ─── Stdio mode (fallback for terminal) ────────────────────
async function startStdio() {
  const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
  await connectDB();

  const server = createMCPServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('ABIS MCP server v3.1.0 running on stdio — 13 tools registered');
}

// ─── Entrypoint ────────────────────────────────────────────
const mode = process.argv.includes('--stdio') ? 'stdio' : 'sse';

if (mode === 'stdio') {
  startStdio().catch(err => { console.error('Fatal:', err); process.exit(1); });
} else {
  startSSE().catch(err => { console.error('Fatal:', err); process.exit(1); });
}
