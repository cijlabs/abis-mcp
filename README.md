<p align="center">
  <img src="https://cijlabs.com/abis-logo.png" alt="ABIS Logo" width="120" />
</p>

<h1 align="center">ABIS MCP Server</h1>

<p align="center">
  <strong>AI Behavioral Drift Monitoring for Claude Code</strong>
</p>

<p align="center">
  <a href="https://github.com/cijlabs/abis-mcp/stargazers"><img src="https://img.shields.io/github/stars/cijlabs/abis-mcp?style=flat-square&color=yellow" alt="GitHub Stars" /></a>
  <a href="https://www.npmjs.com/package/abis-mcp"><img src="https://img.shields.io/npm/v/abis-mcp?style=flat-square&color=red" alt="npm version" /></a>
  <a href="https://github.com/cijlabs/abis-mcp/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License" /></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-%3E%3D18-green?style=flat-square" alt="Node.js" /></a>
  <a href="https://cijlabs.com"><img src="https://img.shields.io/badge/docs-cijlabs.com-purple?style=flat-square" alt="Documentation" /></a>
</p>

<p align="center">
  27 tools · 11 models · Free / Pro / Business · Real-time drift detection · Patent-backed
</p>

---

## What is ABIS?

**ABIS** (Adaptive Behavioral Intelligence System) monitors LLM behavioral drift in real-time. It detects when AI models silently change — shifts in tone, reasoning depth, safety calibration, or capability — even when providers don't announce updates.

This MCP server gives Claude Code native access to:
- **Live drift scores** across 11 major models (GPT-4o, Claude, Gemini, DeepSeek)
- **9-score behavioral scorecards** (drift, coherence, entropy, alignment, and more)
- **Silent version change detection** — catches updates providers don't announce
- **Immune threat assessment** — prompt injection, coordinated attacks, organic drift
- **Correction simulation** — test fixes before applying them
- **Compliance reporting** — EU AI Act, SOC 2, and investor briefs

Backed by **Patent GB2521226.7** · Built by [CIJ Labs](https://cijlabs.com)

## Quick Start

### One-line install (Claude Code)

```bash
/plugin install abis-drift-monitor
```

### Manual setup

Add to your `.mcp.json`:

```json
{
  "mcpServers": {
    "abis": {
      "type": "sse",
      "url": "https://abis-mcp-production.up.railway.app/sse"
    }
  }
}
```

**No API key required** for the Free tier. Connects to the ABIS cloud instantly.

## Access Tiers

| Tier | Tools | Key Required | What you get |
|------|-------|-------------|---------|
| **Free** | 15 | None | Drift scores, scorecards, version changes, reports |
| **Pro** | 27 | `MCP_PRO_KEY` | + Scoring pipeline, memory analysis, immune system, correction simulation |
| **Admin** | 37 | `ABIS_ADMIN_KEY` | + Benchmarking, stress tests, config changes, pipeline stats |

<details>
<summary><strong>Pro/Admin connection</strong></summary>

```json
{
  "mcpServers": {
    "abis": {
      "type": "sse",
      "url": "https://abis-mcp-production.up.railway.app/sse",
      "headers": {
        "Authorization": "Bearer YOUR_KEY_HERE"
      }
    }
  }
}
```

</details>

## 37 Tools

### Free Tier (13 tools)

| Tool | Description |
|------|-------------|
| `abis_ambient_status` | Quick snapshot of all models — call at session start |
| `abis_get_drift_scores` | Live drift scores for all 11 monitored models |
| `abis_get_scorecard` | Full 9-score breakdown (drift, coherence, entropy, alignment, etc.) |
| `abis_whisper` | Contextual status line (clear / monitor / alert / critical) |
| `abis_drift_gate` | Pre-response drift interceptor (Layer 3) |
| `abis_observe` | Post-response observer — how ABIS learns (Layer 3) |
| `abis_historical_drift` | Drift time-series by model or date |
| `abis_version_changes` | All detected silent version changes across models |
| `abis_memory_versions` | Silent version change detection history per model |
| `abis_memory_compare` | Cross-model stability ranking |
| `abis_nervous_status` | Event bus health, registered handlers, recent event log |
| `abis_monitoring_config` | Current phase, tier assignments, cost estimate |
| `abis_ears_status` | EARS webhook sources: Datadog, PagerDuty, Zendesk, Intercom |

### Pro Tier (+14 tools)

| Tool | Description |
|------|-------------|
| `abis_generate_report` | 5 report types: daily_summary, drift_alert, migration_report, compliance_doc, investor_brief |
| `abis_corrector_strategies` | List all 8 correction strategies with severity levels |
| `abis_score_message` | Score any text through the behavioral pipeline |
| `abis_conversation_history` | Scored conversation log with drift per turn |
| `abis_memory_profile` | Full 30-day behavioral memory for a model |
| `abis_memory_trend` | Time-series trend for any score dimension |
| `abis_immune_assess` | Classify threat: CLEAN / ORGANIC_DRIFT / PROMPT_INJECTION / COORDINATED_ATTACK |
| `abis_immune_scan` | Historical attack scan for a model |
| `abis_simulate` | Test a correction before applying it |
| `abis_corrector_history` | Which strategies work best per model |
| `abis_cas_trends` | What features drive drift (energy distance, entropy, coherence) |
| `abis_cost_report` | Estimated monthly API cost breakdown by model and tier |
| `abis_cost_vs_drift` | 30-day cost vs drift matrix |
| `abis_run_benchmark` | Single or full benchmark run |

### Operator tools (internal only — not available on any customer plan)

| Tool | Description |
|------|-------------|
| `abis_api_cost_analysis` | Most-called models with drift trajectory over 7 days |
| `abis_ears_correlations` | Drift vs business impact correlations |
| `abis_sdk_sessions` | View SDK customer session history |
| `abis_notification_history` | Recent alert delivery log |
| `abis_notification_config` | Get/set alert preferences (email, Slack, webhook) |
| `abis_pipeline_stats` | Ingestion statistics, vector counts |
| `abis_training_status` | XGBoost AUC scores, retraining history |
| `abis_baseline_recalibrate` | Recompute drift baselines for all or one model |
| `abis_monitoring_phase` | Switch phase (BASELINE / AGGRESSIVE / SUSTAIN / SCALE) |
| `abis_stress_benchmark` | 30 adversarial prompts across all models |

## Included Skills

After installing, you get two built-in skills:

- **`/abis-ops`** — Daily health check: drift snapshot, version changes, stability ranking, cost summary
- **`/abis-alerts`** — Investigate a drift alert: scorecard deep-dive, CAS trends, threat classification, correction recommendation

## Models Monitored

| Provider | Models |
|----------|--------|
| **OpenAI** | gpt-4o, gpt-5.2, gpt-5.2-instant |
| **Anthropic** | claude-opus-4.6, claude-sonnet-4.5, claude-haiku-4.5 |
| **DeepSeek** | deepseek-v3.2, deepseek-r1 |
| **Google** | gemini-2.5-pro, gemini-2.5-flash, gemini-3-flash |

## Try It

```
"What is the current drift score for GPT-4o?"
"Run ABIS daily check"
"Has Claude Sonnet drifted in the last 7 days?"
"Generate an EU AI Act compliance report"
"Which model is most stable right now?"
"Have any models had silent version updates this week?"
"Show me the cost vs drift matrix"
```

## Self-Hosted Setup

```bash
git clone https://github.com/cijlabs/abis-mcp
cd abis-mcp
npm install
cp .env.example .env
# Set ABIS_ADMIN_KEY, MCP_PRO_KEY, and RAILWAY_URL in .env
node index.js
```

Then add to Claude Code:

```json
{
  "mcpServers": {
    "abis": {
      "command": "node",
      "args": ["/path/to/abis-mcp/index.js"],
      "env": {
        "ABIS_ADMIN_KEY": "your_admin_key_here"
      }
    }
  }
}
```

## Architecture

```
abis-mcp/
├── index.js          # MCP server — SSE + stdio dual transport
├── config.js         # Environment config
├── db.js             # MongoDB persistence
├── api.js            # Railway API proxy with circuit breaker
├── tools/            # 37 tool implementations (one per file)
└── skills/           # /abis-ops and /abis-alerts
```

- **Dual transport**: SSE (HTTP for cloud) + stdio (Claude Desktop/Code)
- **Rate limiting**: 60 req/min global; per-tier limits (free=30, pro=120, admin=300)
- **Backend**: Proxies to ABIS FastAPI on Railway
- **Persistence**: MongoDB Atlas (sessions, scores, conversations, benchmarks)

## Contributing

Contributions welcome! Please open an issue first to discuss what you'd like to change.

```bash
npm run dev    # Start with --watch on port 3100
```

## License

MIT — see [LICENSE](LICENSE) for details.

## About

**[CIJ Labs Ltd](https://cijlabs.com)** · Company No. 16984759 · London
Patent: **GB2521226.7** · [cijlabs.com](https://cijlabs.com)
