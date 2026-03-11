# ABIS MCP Server

## What This Is
MCP (Model Context Protocol) server for ABIS — the Adaptive Behavioral Intelligence System by CIJ Labs. Exposes 13 tools that let Claude query live drift data, run benchmarks, score messages, and generate reports via natural language.

## Architecture
- **Transport:** Dual-mode — SSE (default for Railway/browser/desktop apps) + stdio (`--stdio` flag for terminal)
- **SSE Server:** Raw Node.js `http.createServer` (Express removed due to Railway v5 compat issues)
- **Routes:** `/health` (GET), `/sse` (GET — SSE stream), `/messages` (POST — JSON-RPC)
- **Backend:** Railway API at `RAILWAY_URL` (FastAPI + MongoDB + 17 biological organs)
- **Persistence:** MongoDB Atlas via `MONGODB_URI` — stores session logs, message scores, benchmark triggers
- **Auth:** `ABIS_ADMIN_KEY` sent as `X-Admin-Key` (GET) and `X-API-Key` (POST)

## 13 Tools
1. `abis_ambient_status` — Session start, drift snapshot from /health + /aggregate
2. `abis_score_message` — Core scoring: sends message to /benchmark/single, stores result
3. `abis_get_drift_scores` — Live drift for all models from /aggregate
4. `abis_get_scorecard` — Full 9-score behavioral card per model from /scorecard/latest/{model}
5. `abis_api_cost_analysis` — 7-day usage aggregation from MongoDB
6. `abis_run_benchmark` — Single prompt or full 8-model benchmark
7. `abis_conversation_history` — Query scored conversation logs with filters
8. `abis_generate_report` — NLG reports (daily_summary, drift_alert, investor_brief, etc.)
9. `abis_whisper` — Ambient status injection based on current drift state
10. `abis_cost_vs_drift` — 30-day cost-vs-drift matrix by model and week
11. `abis_drift_gate` — Layer 3 pre-response drift interceptor
12. `abis_observe` — Layer 3 post-response observer
13. `abis_simulate` — Layer 3 correction simulator

## Commands
```bash
npm install           # Install dependencies
node index.js         # Start MCP server (SSE mode, default)
node index.js --stdio # Start MCP server (stdio mode, for terminal)
npm run dev           # Start with --watch for development
```

## Deployment
- **Railway URL:** `abis-mcp-production.up.railway.app`
- **Builder:** Nixpacks (auto-detects Node.js)
- **Health check:** `/health` (200 OK with tool count + session count)
- **Port:** Set via `PORT` env var (Railway auto-sets, or configure in networking)

## Key Files
- `index.js` — MCP server entry point, dual-mode SSE+stdio, registers all 13 tools
- `config.js` — Environment variable exports
- `db.js` — MongoDB connection (5s timeout, retry), index creation, insertDoc helper
- `api.js` — Railway API fetch wrapper with 10s timeout
- `tools/*.js` — One file per tool, each exports { name, description, inputSchema, execute }

## MongoDB Collections
- `mcp_sessions` — One doc per session start (ambient_status tool)
- `mcp_message_scores` — Every scored message with drift + whisper level
- `mcp_conversation_logs` — Conversation turns with drift scores
- `mcp_benchmark_triggers` — Benchmark run triggers with session context

## Known API Quirks
- `/drift/all` returns empty results (no active monitoring) — use `/aggregate` instead
- `/scorecard/all` has a bug (returns no_data) — use `/scorecard/latest/{model}` per-model
- POST endpoints require `X-API-Key` header; GET endpoints use `X-Admin-Key` (same key value)
- `/version-changes` returns 404 (endpoint not deployed)

## Drift Thresholds
- <0.40: stable (green)
- 0.40-0.65: monitor (yellow)
- 0.65-0.90: alert (red)
- >0.90: critical — likely baseline recalibration needed, not genuine drift

## Monitored Models (8)
gpt-4o, claude-opus-4.6, claude-sonnet-4.5, claude-haiku-4.5, deepseek-v3.2, deepseek-r1, gpt-5.2, gpt-5.2-instant

## V2 Model (Current Production)
- `xgb_model_v2.pkl` — 1,543 features, trained on 112K rows from 29 LMSYS models
- AUC range: 0.66 (vicuna-7b) to 1.0 (claude-v1). Top: gpt-4 0.958, gpt-3.5-turbo 0.957
- V2 baselines: `model_baselines_v2.json` — 29 model centroids at 1,543D with p50/p90/p95/p99

## Patent Protection
GB2521226.7 — NEVER expose the 17 biological organ module names or 1,544D behavioral vector internals. MCP exposes outputs only.

## ESM
This project uses ES modules (`"type": "module"` in package.json). All imports use `import`/`export`, not `require`.
