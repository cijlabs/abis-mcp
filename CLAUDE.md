# ABIS MCP Server

## Overview
MCP (Model Context Protocol) server for ABIS. **37 tools v3.5.0**, dual-mode SSE + stdio, raw Node.js (ESM), deployed on Railway.

## Commands
```bash
npm install        # Install dependencies
npm run dev        # Start with --watch (port 3100)
node index.js      # Start MCP server (stdio mode)
```

## Architecture
- **Transport:** Dual-mode — SSE (HTTP for Railway) + stdio (for Claude Desktop/Code)
- **Backend:** Proxies to Railway FastAPI at `RAILWAY_URL`
- **Persistence:** MongoDB Atlas via `MONGODB_URI`
- **Auth:** `ABIS_ADMIN_KEY` sent as `X-Admin-Key` (GET) and `X-API-Key` (POST)

## Security
- Per-tool auth gates (free/pro/admin tiers)
- Input validation with 11-model allowlist
- Per-key rate limits: free=30, pro=120, admin=300 req/min
- Hono CVE patched

## Key Files
```
index.js           # Entry point, registers all 37 tools
config.js          # Environment variable exports
db.js              # MongoDB connection, index creation
api.js             # Railway API fetch wrapper (10s timeout)
tools/*.js         # One file per tool (37 files)
```

## MongoDB Collections
- `mcp_sessions` — Session starts (ambient_status)
- `mcp_message_scores` — Scored messages with drift + whisper level
- `mcp_conversation_logs` — Conversation turns with drift scores
- `mcp_benchmark_triggers` — Benchmark run triggers

## Known API Quirks
- `/drift/all` returns empty — use `/aggregate` instead
- `/scorecard/all` returns no_data — use `/scorecard/latest/{model}`
- POST endpoints require `X-API-Key`; GET endpoints use `X-Admin-Key` (same key value)
- `/version-changes` returns 404 (not deployed)

## Drift Thresholds
- <0.40: stable (green)
- 0.40-0.65: monitor (yellow)
- 0.65-0.90: alert (red)
- >0.90: critical — likely baseline issue, not genuine drift

## Monitored Models (11)
gpt-4o, claude-opus-4.6, claude-sonnet-4.5, claude-haiku-4.5, deepseek-v3.2, deepseek-r1, gpt-5.2, gpt-5.2-instant, gemini-2.5-pro, gemini-2.5-flash, gemini-3-flash

## Deploy
Railway project: loyal-victory
URL: `https://abis-mcp-production.up.railway.app`
Known issue: healthcheck failing on commit f968a60, last working deploy was 3266bb5

## Patent
GB2521226.7 — Internal architecture is patent-protected. MCP exposes outputs only.

## ESM
`"type": "module"` in package.json. All imports use `import`/`export`, not `require`.
