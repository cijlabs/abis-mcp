import 'dotenv/config';
import { v4 as uuidv4 } from 'uuid';
import { createServer as createHttpServer } from 'http';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { connectDB } from './db.js';

// Import all 37 tools (13 original + 20 Phase 2 + 2 Phase 5 + 2 Phase 6)
// ── Original 13 ──
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

// ── Group A: Memory (4) ──
import memoryProfile from './tools/memoryProfile.js';
import memoryTrend from './tools/memoryTrend.js';
import memoryVersions from './tools/memoryVersions.js';
import memoryCompare from './tools/memoryCompare.js';

// ── Group B: Immune System (2) ──
import immuneScan from './tools/immuneScan.js';
import immuneAssess from './tools/immuneAssess.js';

// ── Group C: Baseline & Monitoring (4) ──
import baselineRecalibrate from './tools/baselineRecalibrate.js';
import monitoringConfig from './tools/monitoringConfig.js';
import monitoringPhase from './tools/monitoringPhase.js';
import costReport from './tools/costReport.js';

// ── Group D: Nervous System & Notifications (3) ──
import nervousStatus from './tools/nervousStatus.js';
import notificationConfig from './tools/notificationConfig.js';
import notificationHistory from './tools/notificationHistory.js';

// ── Group E: Ears, Versions, Patterns (4) ──
import earsStatus from './tools/earsStatus.js';
import earsCorrelations from './tools/earsCorrelations.js';
import versionChanges from './tools/versionChanges.js';
import historicalDrift from './tools/historicalDrift.js';

// ── Group F: SDK, Pipeline, Training (3) ──
import sdkSessions from './tools/sdkSessions.js';
import pipelineStats from './tools/pipelineStats.js';
import trainingStatus from './tools/trainingStatus.js';

// ── Group G: Phase 5 Advanced (2) ──
import correctorStrategies from './tools/correctorStrategies.js';
import stressBenchmark from './tools/stressBenchmark.js';

// ── Group H: Phase 6 Fixes (2) ──
import correctorHistory from './tools/correctorHistory.js';
import casTrends from './tools/casTrends.js';

// ─── All 37 tools (master list) ───────────────────────────────────────────
const ALL_TOOLS = [
  // Original 13
  ambientStatus,       // 1.  Session start + drift snapshot
  getDriftScores,      // 2.  Live drift for all models
  getScorecard,        // 3.  Full 9-score behavioral scorecard
  whisper,             // 4.  Ambient whisper injection
  driftGate,           // 5.  Layer 3 pre-response drift interceptor
  observe,             // 6.  Layer 3 post-response observer
  historicalDrift,     // 7.  Drift time-series by model or date
  versionChanges,      // 8.  All detected version changes across models
  memoryVersions,      // 9.  Silent version change detection history
  memoryCompare,       // 10. Cross-model stability ranking
  correctorStrategies, // 11. List all 8 correction strategies
  nervousStatus,       // 12. Event bus health
  monitoringConfig,    // 13. Get monitoring config
  earsStatus,          // 14. EARS integration status
  generateReport,      // 15. NLG report generation (5 types)

  // Pro additions (tools 16-27)
  scoreMessage,        // 16. Core ambient scoring
  conversationHistory, // 17. Query scored conversation logs
  memoryProfile,       // 18. Full behavioral memory profile
  memoryTrend,         // 19. Score time-series trend
  immuneAssess,        // 20. Real-time threat assessment
  immuneScan,          // 21. Historical immune scan
  simulate,            // 22. Layer 3 correction simulator
  correctorHistory,    // 23. Correction strategy effectiveness
  casTrends,           // 24. CAS contributor trends
  costReport,          // 25. Monthly cost report
  costVsDrift,         // 26. 30-day cost vs drift matrix
  runBenchmark,        // 27. Single/full benchmark

  // Admin additions (tools 28-37)
  costAnalysis,        // 28. 7-day API cost analysis by model
  earsCorrelations,    // 29. Drift-business correlations
  sdkSessions,         // 30. SDK customer sessions
  notificationHistory, // 31. Notification delivery log
  notificationConfig,  // 32. Get/set notification preferences
  pipelineStats,       // 33. Pipeline ingestion stats
  trainingStatus,      // 34. Training pipeline status
  baselineRecalibrate, // 35. Recalibrate drift baselines
  monitoringPhase,     // 36. Change monitoring phase
  stressBenchmark,     // 37. Run stress benchmark
];

// ─── Tier definitions ─────────────────────────────────────────────────────
//
//  FREE  (15 tools) — no API key required
//  PRO   (27 tools) — MCP_PRO_KEY env var
//  ADMIN (37 tools) — ABIS_ADMIN_KEY env var
//
// Tool names in the FREE set are also included in PRO; PRO names are also
// included in ADMIN. Tiers are additive.

const FREE_TOOL_NAMES = new Set([
  'abis_ambient_status',
  'abis_get_drift_scores',
  'abis_get_scorecard',
  'abis_whisper',
  'abis_drift_gate',
  'abis_observe',
  'abis_historical_drift',
  'abis_version_changes',
  'abis_memory_versions',
  'abis_memory_compare',
  'abis_corrector_strategies',
  'abis_nervous_status',
  'abis_monitoring_config',
  'abis_ears_status',
  'abis_generate_report',
]);

const PRO_TOOL_NAMES = new Set([
  ...FREE_TOOL_NAMES,
  'abis_score_message',
  'abis_conversation_history',
  'abis_memory_profile',
  'abis_memory_trend',
  'abis_immune_assess',
  'abis_immune_scan',
  'abis_simulate',
  'abis_corrector_history',
  'abis_cas_trends',
  'abis_cost_report',
  'abis_cost_vs_drift',
  'abis_run_benchmark',
]);

// Admin gets all tools (PRO_TOOL_NAMES + 10 more — no separate Set needed)

// ─── Auth + tier resolution ───────────────────────────────────────────────
const ADMIN_KEY = process.env.ABIS_ADMIN_KEY || '';
const PRO_KEY   = process.env.MCP_PRO_KEY || '';

function resolveTier(req) {
  const authHeader = req.headers['authorization'] || '';
  const urlObj = new URL(req.url, 'http://localhost');
  const queryToken = urlObj.searchParams.get('token') || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : queryToken;

  if (ADMIN_KEY && token === ADMIN_KEY) return 'admin';
  if (PRO_KEY   && token === PRO_KEY)   return 'pro';
  return 'free';
}

function getToolsForTier(tier) {
  if (tier === 'admin') return ALL_TOOLS;
  if (tier === 'pro')   return ALL_TOOLS.filter(t => PRO_TOOL_NAMES.has(t.name));
  return ALL_TOOLS.filter(t => FREE_TOOL_NAMES.has(t.name));
}

// ─── Rate limiting — 60 req/min per IP ────────────────────────────────────
const _rlStore = new Map();
const _RL_WINDOW = 60_000;
const _RL_MAX = 60;

function _checkRL(req) {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const e = _rlStore.get(ip) || { n: 0, t: now + _RL_WINDOW };
  if (now > e.t) { e.n = 0; e.t = now + _RL_WINDOW; }
  e.n++;
  _rlStore.set(ip, e);
  return e.n <= _RL_MAX;
}
setInterval(() => { const now = Date.now(); for (const [k,v] of _rlStore) { if (now > v.t) _rlStore.delete(k); } }, 300_000);

// ─── MCP server factory (tier-scoped) ─────────────────────────────────────
function createMCPServer(tierTools) {
  const tierRegistry = {};
  tierTools.forEach(tool => { tierRegistry[tool.name] = tool; });

  const server = new Server(
    { name: 'abis-mcp', version: '3.4.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tierTools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const tool = tierRegistry[name];

    if (!tool) {
      return {
        content: [{ type: 'text', text: `Tool '${name}' is not available on your current tier. Upgrade at abis.cijlabs.com/pricing` }],
        isError: true,
      };
    }

    try {
      return await tool.execute(args || {}, { sessionId: `mcp-${uuidv4()}` });
    } catch (err) {
      console.error(`[ABIS] Tool ${name} error:`, err.message);
      return {
        content: [{ type: 'text', text: `ABIS: ${name} encountered an error. Contact support if this persists.` }],
        isError: true,
      };
    }
  });

  return server;
}

// ─── Active sessions: sessionId → { transport, tier } ─────────────────────
const activeSessions = new Map();

// ─── SSE mode (default) — uses raw Node http ──────────────────────────────
async function startSSE() {
  await connectDB();

  const PORT = parseInt(process.env.PORT || '3100', 10);

  const httpServer = createHttpServer(async (req, res) => {
    // CORS
    const _allowedOrigins = (process.env.MCP_ALLOWED_ORIGINS || 'https://abis.cijlabs.com').split(',').map(s => s.trim());
    const _origin = req.headers['origin'] || '';
    const _ao = _allowedOrigins.includes(_origin) ? _origin : _allowedOrigins[0];
    res.setHeader('Access-Control-Allow-Origin', _ao);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Rate limiting — applies to all routes
    if (!_checkRL(req)) {
      res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': '60' });
      res.end(JSON.stringify({ error: 'Rate limit exceeded. 60 req/min max.' }));
      return;
    }

    const url = new URL(req.url, `http://localhost:${PORT}`);

    // Health check
    if (req.method === 'GET' && url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        server: 'abis-mcp',
        version: '3.4.0',
        tiers: { free: 15, pro: 27, admin: 37 },
        transport: 'sse',
      }));
      return;
    }

    // SSE endpoint — client connects here, tier resolved from token
    if (req.method === 'GET' && url.pathname === '/sse') {
      const tier = resolveTier(req);
      const tierTools = getToolsForTier(tier);
      console.log(`[ABIS MCP] New SSE connection — tier: ${tier} (${tierTools.length} tools)`);
      try {
        const mcpServer = createMCPServer(tierTools);
        const transport = new SSEServerTransport('/messages', res);
        const sessionId = transport.sessionId;
        activeSessions.set(sessionId, { transport, tier });

        res.on('close', () => {
          console.log(`[ABIS MCP] SSE closed: ${sessionId} (${tier})`);
          activeSessions.delete(sessionId);
          mcpServer.close().catch(() => {});
        });

        await mcpServer.connect(transport);
      } catch (err) {
        console.error('[ABIS MCP] SSE error:', err);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal server error' }));
        }
      }
      return;
    }

    // Message endpoint — client POSTs JSON-RPC here
    if (req.method === 'POST' && url.pathname === '/messages') {
      const sessionId = url.searchParams.get('sessionId');
      const session = activeSessions.get(sessionId);

      if (!session) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No active SSE session' }));
        return;
      }

      try {
        await session.transport.handlePostMessage(req, res);
      } catch (err) {
        console.error('[ABIS MCP] POST error:', err);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal server error' }));
        }
      }
      return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found', routes: ['/health', '/sse', '/messages'] }));
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`ABIS MCP server v3.4.0 running on http://0.0.0.0:${PORT}/sse — 3 tiers (15/27/37 tools)`);
  });
}

// ─── Stdio mode (fallback for terminal) ────────────────────────────────────
async function startStdio() {
  const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
  await connectDB();

  // Stdio connections default to admin tier (local use only)
  const server = createMCPServer(ALL_TOOLS);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('ABIS MCP server v3.4.0 running on stdio — 37 tools (admin tier)');
}

// ─── Entrypoint ────────────────────────────────────────────────────────────
const mode = process.argv.includes('--stdio') ? 'stdio' : 'sse';

if (mode === 'stdio') {
  startStdio().catch(err => { console.error('Fatal:', err); process.exit(1); });
} else {
  startSSE().catch(err => { console.error('Fatal:', err); process.exit(1); });
}
