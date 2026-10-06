import { tierFromPlan, selectTools, isToolAllowed, rateLimitFor, deniedMessage } from './tiers.js';
import 'dotenv/config';
import { v4 as uuidv4 } from 'uuid';
import { createServer as createHttpServer } from 'http';
import { timingSafeEqual } from 'crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { connectDB, getCollection } from './db.js';

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

// ── Group A: Behavioral Memory (4) ──
import memoryProfile from './tools/memoryProfile.js';
import memoryTrend from './tools/memoryTrend.js';
import memoryVersions from './tools/memoryVersions.js';
import memoryCompare from './tools/memoryCompare.js';

// ── Group B: Threat Detection (2) ──
import immuneScan from './tools/immuneScan.js';
import immuneAssess from './tools/immuneAssess.js';

// ── Group C: Baseline & Monitoring (4) ──
import baselineRecalibrate from './tools/baselineRecalibrate.js';
import monitoringConfig from './tools/monitoringConfig.js';
import monitoringPhase from './tools/monitoringPhase.js';
import costReport from './tools/costReport.js';

// ── Group D: Event Bus & Notifications (3) ──
import nervousStatus from './tools/nervousStatus.js';
import notificationConfig from './tools/notificationConfig.js';
import notificationHistory from './tools/notificationHistory.js';

// ── Group E: Integrations, Versions, Patterns (4) ──
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
//  FREE     — no API key required
//  PRO      — MCP_PRO_KEY env var or a pro plan key
//  BUSINESS — business/enterprise plan key: the PRO toolset at a higher rate limit
//  ADMIN    — operator ABIS_ADMIN_KEY env var or local stdio only (never a customer plan)
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

// In-memory key cache: token → { tier, exp }
const _keyCache = new Map();
const _TTL_HIT  = 300_000; // 5 min for pro/admin hits
const _TTL_FREE =  60_000; // 1 min for free (allows quick key activation)

// Purge expired cache entries every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _keyCache) {
    if (now > v.exp) _keyCache.delete(k);
  }
}, 60_000);

function safeCompare(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch { return false; }
}

async function resolveTier(token) {
  if (!token) return 'free';

  // Env-var fast paths — timing-safe comparison
  if (ADMIN_KEY && safeCompare(token, ADMIN_KEY)) return 'admin';
  if (PRO_KEY   && safeCompare(token, PRO_KEY))   return 'pro';

  // Check cache
  const cached = _keyCache.get(token);
  if (cached && Date.now() < cached.exp) return cached.tier;

  // MongoDB lookup
  try {
    const col = await getCollection('mcp_api_keys');
    if (col) {
      const doc = await col.findOne({ key: token, active: true });
      if (doc) {
        const tier = tierFromPlan(doc.plan); // business/enterprise -> 'business' (never 'admin')
        _keyCache.set(token, { tier, exp: Date.now() + _TTL_HIT });
        return tier;
      }
    }
  } catch (err) {
    console.error('[ABIS MCP] resolveTier DB error:', err.message);
  }

  // Not found or DB unavailable → free (short TTL so activation propagates fast)
  _keyCache.set(token, { tier: 'free', exp: Date.now() + _TTL_FREE });
  return 'free';
}

// Extract Bearer token from Authorization header only
function extractToken(req) {
  const authHeader = req.headers['authorization'] || '';
  if (authHeader.startsWith('Bearer ')) return authHeader.slice(7).trim();
  return '';
}

function getToolsForTier(tier) {
  return selectTools(ALL_TOOLS, tier, { freeNames: FREE_TOOL_NAMES, proNames: PRO_TOOL_NAMES, adminOnly: ADMIN_ONLY_TOOLS });
}

// ─── Rate limiting — per-IP + per-key ──────────────────────────────────────
const _rlStore = new Map();
const _RL_WINDOW = 60_000;
const _RL_MAX_IP = 60;       // 60 req/min per IP
const _RL_MAX_FREE = 30;     // 30 req/min for free tier keys
const _RL_MAX_PRO = 120;     // 120 req/min for pro tier keys
const _RL_MAX_BUSINESS = 200; // 200 req/min for business keys
const _RL_MAX_ADMIN = 300;   // 300 req/min for admin keys

function _getClientIP(req) {
  // Only trust XFF if behind Railway's proxy (RAILWAY_ENVIRONMENT set)
  if (process.env.RAILWAY_ENVIRONMENT) {
    const xff = (req.headers['x-forwarded-for'] || '').split(',');
    // Trust the rightmost IP (closest to proxy)
    const proxyIP = xff.length > 0 ? xff[xff.length - 1].trim() : '';
    if (proxyIP) return proxyIP;
  }
  return req.socket?.remoteAddress || 'unknown';
}

function _checkRL(key, limit) {
  const now = Date.now();
  // Cap store size to prevent memory exhaustion via spoofed IPs
  if (_rlStore.size > 10_000) {
    for (const [k, v] of _rlStore) { if (now > v.t) _rlStore.delete(k); }
    if (_rlStore.size > 10_000) _rlStore.clear();
  }
  const e = _rlStore.get(key) || { n: 0, t: now + _RL_WINDOW };
  if (now > e.t) { e.n = 0; e.t = now + _RL_WINDOW; }
  e.n++;
  _rlStore.set(key, e);
  return e.n <= limit;
}

function checkRateLimits(req, tier) {
  const ip = _getClientIP(req);
  // Per-IP check (always applied)
  if (!_checkRL(`ip:${ip}`, _RL_MAX_IP)) return false;
  // Per-tier check (stricter for free users)
  const tierLimit = rateLimitFor(tier, { free: _RL_MAX_FREE, pro: _RL_MAX_PRO, business: _RL_MAX_BUSINESS, admin: _RL_MAX_ADMIN });
  const token = extractToken(req);
  const tierKey = token ? `key:${token.substring(0, 8)}` : `ip:${ip}:tier`;
  return _checkRL(tierKey, tierLimit);
}

setInterval(() => { const now = Date.now(); for (const [k,v] of _rlStore) { if (now > v.t) _rlStore.delete(k); } }, 300_000);

// ─── Per-tool authorization gate (runtime enforcement) ─────────────────────
// Even though tools are filtered at SSE connection time, this provides
// defense-in-depth: if a tool name somehow reaches CallToolRequestSchema
// for a lower-tier session, it gets blocked here.

const ADMIN_ONLY_TOOLS = new Set([
  'abis_api_cost_analysis', // was misspelt abis_cost_analysis (no such tool), so the gate never matched
  'abis_ears_correlations',
  'abis_sdk_sessions',
  'abis_notification_history',
  'abis_notification_config',
  'abis_pipeline_stats',
  'abis_training_status',
  'abis_baseline_recalibrate',
  'abis_monitoring_phase',
  'abis_stress_benchmark',
]);

const PRO_ONLY_TOOLS = new Set([
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

function checkToolAuthorization(toolName, tier) {
  return isToolAllowed(toolName, tier, { adminOnly: ADMIN_ONLY_TOOLS, proOnly: PRO_ONLY_TOOLS });
}

// ─── Input validation ──────────────────────────────────────────────────────
const ALLOWED_MODELS = new Set([
  'gpt-4o', 'claude-opus-4.6', 'claude-sonnet-4.5', 'claude-haiku-4.5',
  'deepseek-v3.2', 'deepseek-r1', 'gpt-5.2', 'gpt-5.2-instant',
  'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-3-flash',
]);

function validateArgs(toolName, args) {
  const errors = [];

  // Model name validation — applied to any tool that accepts a 'model' param
  if (args.model !== undefined && args.model !== null && args.model !== '') {
    if (typeof args.model !== 'string') {
      errors.push('model must be a string');
    } else if (args.model.length > 50) {
      errors.push('model name too long (max 50 chars)');
    } else if (!ALLOWED_MODELS.has(args.model)) {
      errors.push(`Unknown model '${args.model}'. Valid: ${[...ALLOWED_MODELS].join(', ')}`);
    }
  }

  // Numeric range validation
  if (args.min_drift !== undefined) {
    const v = Number(args.min_drift);
    if (isNaN(v) || v < 0 || v > 1) errors.push('min_drift must be 0-1');
  }
  if (args.max_drift !== undefined) {
    const v = Number(args.max_drift);
    if (isNaN(v) || v < 0 || v > 1) errors.push('max_drift must be 0-1');
  }
  if (args.days !== undefined) {
    const v = Number(args.days);
    if (isNaN(v) || v < 1 || v > 365) errors.push('days must be 1-365');
  }
  if (args.limit !== undefined) {
    const v = Number(args.limit);
    if (isNaN(v) || v < 1 || v > 1000) errors.push('limit must be 1-1000');
  }

  // String length caps (prevent payload abuse)
  if (args.response_text && args.response_text.length > 50_000) {
    errors.push('response_text exceeds 50,000 char limit');
  }
  if (args.user_prompt && args.user_prompt.length > 10_000) {
    errors.push('user_prompt exceeds 10,000 char limit');
  }
  if (args.context_hint && args.context_hint.length > 500) {
    errors.push('context_hint exceeds 500 char limit');
  }
  if (args.session_id && args.session_id.length > 200) {
    errors.push('session_id exceeds 200 char limit');
  }

  // Report type validation
  if (args.report_type !== undefined) {
    const valid = ['daily_summary', 'drift_alert', 'migration_report', 'compliance_doc', 'investor_brief'];
    if (!valid.includes(args.report_type)) {
      errors.push(`Invalid report_type. Valid: ${valid.join(', ')}`);
    }
  }

  // Phase validation
  if (args.phase !== undefined) {
    const valid = ['BASELINE', 'AGGRESSIVE', 'SUSTAIN', 'SCALE'];
    if (!valid.includes(args.phase)) {
      errors.push(`Invalid phase. Valid: ${valid.join(', ')}`);
    }
  }

  return errors;
}

// ─── MCP server factory (tier-scoped with runtime auth) ───────────────────
function createMCPServer(tierTools, tier) {
  const tierRegistry = {};
  tierTools.forEach(tool => { tierRegistry[tool.name] = tool; });

  const server = new Server(
    { name: 'abis-mcp', version: '3.5.0' },
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

    // ── Runtime auth gate (defense-in-depth) ──
    if (!checkToolAuthorization(name, tier)) {
      console.warn(`[ABIS MCP] AUTH BLOCKED: ${name} called by ${tier} tier`);
      return {
        content: [{ type: 'text', text: deniedMessage(name, ADMIN_ONLY_TOOLS) }],
        isError: true,
      };
    }

    const tool = tierRegistry[name];
    if (!tool) {
      return {
        content: [{ type: 'text', text: `Tool '${name}' is not available on your current tier. Upgrade at https://cijlabs.com/pricing` }],
        isError: true,
      };
    }

    // ── Input validation ──
    const validationErrors = validateArgs(name, args || {});
    if (validationErrors.length > 0) {
      console.warn(`[ABIS MCP] VALIDATION FAILED: ${name} — ${validationErrors.join('; ')}`);
      return {
        content: [{ type: 'text', text: `Input validation failed for ${name}: ${validationErrors.join('; ')}` }],
        isError: true,
      };
    }

    try {
      return await tool.execute(args || {}, { sessionId: `mcp-${uuidv4()}`, tier });
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

// ─── Active sessions: sessionId → { transport, tier, ip } ────────────────
const activeSessions = new Map();
const _MAX_SESSIONS = 200;
const _MAX_SESSIONS_PER_IP = 5;

// ─── SSE mode (default) — uses raw Node http ──────────────────────────────
async function startSSE() {
  await connectDB();

  const PORT = parseInt(process.env.PORT || '3100', 10);

  const httpServer = createHttpServer(async (req, res) => {
    // CORS
    const _allowedOrigins = (process.env.MCP_ALLOWED_ORIGINS || 'https://cijlabs.com,https://www.cijlabs.com').split(',').map(s => s.trim());
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

    // Rate limiting — per-IP baseline (tier-aware limits applied at SSE connection)
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
    if (!_checkRL(`ip:${ip}`, _RL_MAX_IP)) {
      res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': '60' });
      res.end(JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }));
      return;
    }

    const url = new URL(req.url, `http://localhost:${PORT}`);

    // Health check
    if (req.method === 'GET' && url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        server: 'abis-mcp',
        version: '3.5.0',
        tiers: { free: getToolsForTier('free').length, pro: getToolsForTier('pro').length, business: getToolsForTier('business').length },
        transport: 'sse',
      }));
      return;
    }

    // SSE endpoint — client connects here, tier resolved from token
    if (req.method === 'GET' && url.pathname === '/sse') {
      const clientIP = _getClientIP(req);

      // Connection limits
      if (activeSessions.size >= _MAX_SESSIONS) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Server at capacity. Try again later.' }));
        return;
      }
      const ipCount = [...activeSessions.values()].filter(s => s.ip === clientIP).length;
      if (ipCount >= _MAX_SESSIONS_PER_IP) {
        res.writeHead(429, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Too many connections from this IP.' }));
        return;
      }

      const token = extractToken(req);
      const tier = await resolveTier(token);

      // Per-key rate limiting for SSE connections
      if (!checkRateLimits(req, tier)) {
        res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': '60' });
        res.end(JSON.stringify({ error: 'Rate limit exceeded for your tier. Upgrade for higher limits.' }));
        return;
      }

      const tierTools = getToolsForTier(tier);
      console.log(`[ABIS MCP] New SSE connection — tier: ${tier} (${tierTools.length} tools)`);
      try {
        const mcpServer = createMCPServer(tierTools, tier);
        const transport = new SSEServerTransport('/messages', res);
        const sessionId = transport.sessionId;
        activeSessions.set(sessionId, { transport, tier, ip: clientIP });

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
    console.log(`ABIS MCP server v3.4.0 running on http://0.0.0.0:${PORT}/sse — customer tiers free/pro/business (${getToolsForTier('free').length}/${getToolsForTier('pro').length}/${getToolsForTier('business').length} tools)`);
  });
}

// ─── Stdio mode (fallback for terminal) ────────────────────────────────────
async function startStdio() {
  const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
  await connectDB();

  // Stdio connections default to admin tier (local use only)
  const server = createMCPServer(ALL_TOOLS, 'admin');
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('ABIS MCP server v3.5.0 running on stdio — all tools (local operator / admin tier)');
}

// ─── Entrypoint ────────────────────────────────────────────────────────────
const mode = process.argv.includes('--stdio') ? 'stdio' : 'sse';

if (mode === 'stdio') {
  startStdio().catch(err => { console.error('Fatal:', err); process.exit(1); });
} else {
  startSSE().catch(err => { console.error('Fatal:', err); process.exit(1); });
}
