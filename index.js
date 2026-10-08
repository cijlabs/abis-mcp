import { selectTools, isToolAllowed, deniedMessage } from './tiers.js';
import { createTierResolver, refreshSessionTier } from './auth.js';
import { createRateLimiter, requestBuckets } from './ratelimit.js';
import 'dotenv/config';
import { v4 as uuidv4 } from 'uuid';
import { createServer as createHttpServer } from 'http';
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
  immuneAssess,        // 20. On-demand threat assessment
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

// Only an ACTIVE row counts; throws when the DB is unreachable (the resolver then
// keeps the last DB-confirmed tier for a bounded grace window, see auth.js).
async function lookupActiveKey(token) {
  const col = await getCollection('mcp_api_keys');
  if (!col) throw new Error('mcp_api_keys unavailable (no DB connection)');
  return col.findOne({ key: token, active: true }, { projection: { plan: 1 } });
}

// Paid keys are re-checked against the DB at least every 30s (was a 5 min cache), and
// every POST /messages re-resolves its session's key, so a deactivated or downgraded
// key stops working within ~30s even on an open SSE session.
const tierResolver = createTierResolver({
  lookup: lookupActiveKey,
  adminKey: ADMIN_KEY,
  proKey: PRO_KEY,
  ttlHitMs: 30_000,
  ttlFreeMs: 60_000,
  graceMs: 300_000,
  onError: (err) => console.error('[ABIS MCP] resolveTier DB error:', err.message),
  // Visible, so a mis-provisioned paying customer is noticed (the key is never logged).
  onPlanRejected: (plan) => console.warn(`[ABIS MCP] active mcp_api_keys row has non-paid plan ${JSON.stringify(plan)} — resolved to free`),
});
const resolveTier = tierResolver.resolve;

setInterval(() => tierResolver.purge(), 60_000).unref();

// Extract Bearer token from Authorization header only
function extractToken(req) {
  const authHeader = req.headers['authorization'] || '';
  if (authHeader.startsWith('Bearer ')) return authHeader.slice(7).trim();
  return '';
}

const _toolsByTier = new Map();
function getToolsForTier(tier) {
  if (!_toolsByTier.has(tier)) {
    _toolsByTier.set(tier, selectTools(ALL_TOOLS, tier, { freeNames: FREE_TOOL_NAMES, proNames: PRO_TOOL_NAMES, adminOnly: ADMIN_ONLY_TOOLS }));
  }
  return _toolsByTier.get(tier);
}

// ─── Rate limiting — per-key for paid tiers, per-IP for free ───────────────
// Order (see ratelimit.js): a request carrying a recognised paid key is limited
// only by that key's bucket, so Pro 120/min and Business 200/min are reachable
// from one IP. Anonymous/free traffic gets the per-IP cap AND the free-tier cap.
const _RL_LIMITS = {
  ip: 60,         // 60 req/min per IP — every unauthenticated / free request
  free: 30,       // 30 MCP messages/min per IP on the free tier
  pro: 120,       // 120 req/min per pro key
  business: 200,  // 200 req/min per business key
  admin: 300,     // 300 req/min per admin key
};
const rateLimiter = createRateLimiter({ windowMs: 60_000 });

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

// bucketKey is what rateLimiter.exceeded() returned, so the message names the limit hit.
function sendRateLimited(res, bucketKey, tier) {
  let msg = 'Rate limit exceeded. Try again later.';
  if (bucketKey.startsWith('key:')) {
    msg = `Rate limit exceeded for your plan (${tier}: ${_RL_LIMITS[tier]} requests/min per key). Try again shortly.`;
  } else if (bucketKey.endsWith(':free')) {
    msg = `Rate limit exceeded (free tier: ${_RL_LIMITS.free} requests/min per IP). Upgrade for higher limits at https://cijlabs.com/pricing`;
  }
  res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': '60' });
  res.end(JSON.stringify({ error: msg }));
}

setInterval(() => rateLimiter.purge(), 300_000).unref();

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
// The 10 models on the live leaderboard (benchmarked daily) — verified 2026-10-08
// against /api/public/leaderboard (total_models: 10). gpt-5.4 was missing (so it was
// refused); gpt-5.2-instant / gemini-2.5-pro are not benchmarked (backend 404s).
const ALLOWED_MODELS = new Set([
  'gpt-4o', 'gpt-5.2', 'gpt-5.4',
  'claude-opus-4.6', 'claude-sonnet-4.5', 'claude-haiku-4.5',
  'deepseek-v3.2', 'deepseek-r1',
  'gemini-2.5-flash', 'gemini-3-flash',
]);

function validateArgs(toolName, args) {
  const errors = [];

  // Model name validation — any tool param that names a model. model_hint
  // (abis_score_message) is sent to the backend as the model to benchmark, so it
  // must be held to the same allowlist.
  for (const field of ['model', 'model_hint']) {
    const v = args[field];
    if (v === undefined || v === null || v === '') continue;
    if (typeof v !== 'string') {
      errors.push(`${field} must be a string`);
    } else if (v.length > 50) {
      errors.push(`${field} too long (max 50 chars)`);
    } else if (!ALLOWED_MODELS.has(v)) {
      errors.push(`Unknown model '${v}'. Valid: ${[...ALLOWED_MODELS].join(', ')}`);
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
// getTier() is read on EVERY request, so a session follows its key's current tier
// (an SSE session's tier is re-resolved on each POST /messages).
function createMCPServer(getTier) {
  const server = new Server(
    { name: 'abis-mcp', version: '3.5.0' },
    { capabilities: { tools: { listChanged: true } } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: getToolsForTier(getTier()).map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const tier = getTier();

    // ── Runtime auth gate (defense-in-depth) ──
    if (!checkToolAuthorization(name, tier)) {
      console.warn(`[ABIS MCP] AUTH BLOCKED: ${name} called by ${tier} tier`);
      return {
        content: [{ type: 'text', text: deniedMessage(name, ADMIN_ONLY_TOOLS) }],
        isError: true,
      };
    }

    const tool = getToolsForTier(tier).find(t => t.name === name);
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

// ─── Active sessions: sessionId → { id, transport, server, token, tier, ip } ──
const activeSessions = new Map();

// Re-resolve a live session's key (cached ≤30s, see tierResolver) and record the
// current tier on the session; on a change, tell the client to re-list its tools.
// Any failure fails closed to free.
async function refreshLiveSession(session, resolve = resolveTier) {
  const notify = (from, to) => {
    console.warn(`[ABIS MCP] Session ${session.id} tier changed: ${from} -> ${to}`);
    session.server?.sendToolListChanged().catch(() => {});
  };
  try {
    return await refreshSessionTier(session, resolve, notify);
  } catch (err) {
    console.error('[ABIS MCP] tier refresh failed, failing closed to free:', err.message);
    if (session.tier !== 'free') { const from = session.tier; session.tier = 'free'; notify(from, 'free'); }
    return 'free';
  }
}
const _MAX_SESSIONS = 200;
const _MAX_SESSIONS_PER_IP = 5;

// ─── SSE mode (default) — uses raw Node http ──────────────────────────────
async function startSSE() {
  await connectDB();

  const PORT = parseInt(process.env.PORT || '3100', 10);

  // Every rejection is caught in createHttpServer below: an uncaught throw in this async
  // handler is an unhandled rejection, which exits the process (and Railway gives up
  // after 3 restarts). A raw `GET // HTTP/1.1` used to do exactly that via new URL().
  const handleHttp = async (req, res) => {
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

    let url;
    try {
      url = new URL(req.url, `http://localhost:${PORT}`);
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Bad request URL' }));
      return;
    }
    // One IP derivation for every limit. The old baseline used the LEFTMOST
    // X-Forwarded-For entry, which the client controls, so the per-IP cap was bypassable.
    const clientIP = _getClientIP(req);

    // /sse and /messages apply their own tier-aware limits below (paid keys are not
    // held to the per-IP cap). Everything else is per-IP only.
    const isMcpRoute = (req.method === 'GET' && url.pathname === '/sse') || (req.method === 'POST' && url.pathname === '/messages');
    if (!isMcpRoute && !rateLimiter.hit(`ip:${clientIP}`, _RL_LIMITS.ip)) {
      sendRateLimited(res, `ip:${clientIP}`, 'free');
      return;
    }

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

      // A token not already known to be paid pays the per-IP cap BEFORE the DB lookup,
      // so random tokens cannot be used to hammer Mongo. A cached paid key skips it.
      const known = tierResolver.peek(token);
      const ipCounted = !known || known === 'free';
      if (ipCounted && !rateLimiter.hit(`ip:${clientIP}`, _RL_LIMITS.ip)) {
        sendRateLimited(res, `ip:${clientIP}`, 'free');
        return;
      }

      // A client that disconnects while the key lookup is pending must not leave a
      // session behind (the cleanup listener below would never fire), or it would hold
      // one of the _MAX_SESSIONS / per-IP slots forever.
      let clientGone = false;
      res.once('close', () => { clientGone = true; });

      const tier = await resolveTier(token);
      if (clientGone) return;
      const buckets = requestBuckets({ tier, token, ip: clientIP }, _RL_LIMITS)
        .filter(([key]) => !(ipCounted && key === `ip:${clientIP}`)); // IP already counted above
      const over = rateLimiter.exceeded(buckets);
      if (over) {
        sendRateLimited(res, over, tier);
        return;
      }

      console.log(`[ABIS MCP] New SSE connection — tier: ${tier} (${getToolsForTier(tier).length} tools)`);
      try {
        const transport = new SSEServerTransport('/messages', res);
        const sessionId = transport.sessionId;
        // The token is kept so each POST /messages can re-resolve the key's CURRENT tier.
        const session = { id: sessionId, transport, server: null, token, tier, ip: clientIP };
        session.server = createMCPServer(() => session.tier);
        activeSessions.set(sessionId, session);

        res.on('close', () => {
          console.log(`[ABIS MCP] SSE closed: ${sessionId} (${session.tier})`);
          activeSessions.delete(sessionId);
          session.server.close().catch(() => {});
        });

        await session.server.connect(transport);
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
        if (!rateLimiter.hit(`ip:${clientIP}`, _RL_LIMITS.ip)) {
          sendRateLimited(res, `ip:${clientIP}`, 'free');
          return;
        }
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No active SSE session' }));
        return;
      }

      // Re-resolve the session's key on EVERY message, so a deactivated key drops to
      // free (and a downgraded one to its new tier) without waiting for a disconnect.
      const tier = await refreshLiveSession(session);

      const over = rateLimiter.exceeded(requestBuckets({ tier, token: session.token, ip: clientIP }, _RL_LIMITS));
      if (over) {
        sendRateLimited(res, over, tier);
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
  };

  const httpServer = createHttpServer((req, res) => {
    handleHttp(req, res).catch((err) => {
      console.error('[ABIS MCP] request handler error:', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      } else {
        res.destroy();
      }
    }).catch(() => {}); // the error responder itself must never become an unhandled rejection
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`ABIS MCP server v3.5.0 running on http://0.0.0.0:${PORT}/sse — customer tiers free/pro/business (${getToolsForTier('free').length}/${getToolsForTier('pro').length}/${getToolsForTier('business').length} tools)`);
  });
}

// ─── Stdio mode (fallback for terminal) ────────────────────────────────────
async function startStdio() {
  const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
  await connectDB();

  // Stdio connections default to admin tier (local use only)
  const server = createMCPServer(() => 'admin');
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('ABIS MCP server v3.5.0 running on stdio — all tools (local operator / admin tier)');
}

// ─── Entrypoint ────────────────────────────────────────────────────────────
// Exported for tests, which set ABIS_MCP_NO_AUTOSTART=1 to import without starting a server.
export { createMCPServer, getToolsForTier, refreshLiveSession, ALLOWED_MODELS };

const mode = process.argv.includes('--stdio') ? 'stdio' : 'sse';

if (process.env.ABIS_MCP_NO_AUTOSTART !== '1') {
  if (mode === 'stdio') {
    startStdio().catch(err => { console.error('Fatal:', err); process.exit(1); });
  } else {
    startSSE().catch(err => { console.error('Fatal:', err); process.exit(1); });
  }
}
