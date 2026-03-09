# ABIS MCP — AI Behavioral Drift Monitor

Model Context Protocol server for **ABIS** — the deterministic AI behavioral drift monitoring platform by CIJ Labs.

Gives Claude Code native access to live drift scores, 9-score behavioral scorecards, silent version change detection, correction strategies, immune threat assessment, and compliance reporting — backed by **Patent GB2521226.7**.

## Quick Install (Claude Code Plugin)

```bash
/plugin install abis-drift-monitor
```

Or add to your `.mcp.json`:

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

No API key required for the Free tier. Connects directly to the ABIS cloud.

## Access Tiers

| Tier | Tools | Key Required | Includes |
|------|-------|-------------|---------|
| **Free** | 15 | None | Read-only drift scores, scorecards, version changes, report generation |
| **Pro** | 27 | `MCP_PRO_KEY` | + Scoring pipeline, memory analysis, immune system, correction simulation, cost/drift reports |
| **Admin** | 37 | `ABIS_ADMIN_KEY` | + Benchmarking, stress tests, monitoring config changes, pipeline stats, notifications |

### Pro/Admin connection

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

## 37 Tools

### Free Tier (15 tools — no key required)

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
| `abis_corrector_strategies` | List all 8 correction strategies with severity levels |
| `abis_nervous_status` | Event bus health, registered handlers, recent event log |
| `abis_monitoring_config` | Current phase, tier assignments, cost estimate |
| `abis_ears_status` | EARS webhook sources: Datadog, PagerDuty, Zendesk, Intercom |
| `abis_generate_report` | 5 report types: daily_summary, drift_alert, migration_report, compliance_doc, investor_brief |

### Pro Tier (27 tools — adds 12)

| Tool | Description |
|------|-------------|
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

### Admin Tier (37 tools — adds 10)

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

After installing, you get two skills:

- **`/abis-ops`** — Daily health check: drift snapshot, version changes, stability ranking, cost summary
- **`/abis-alerts`** — Investigate a drift alert: scorecard deep-dive, CAS trends, threat classification, correction recommendation

## Models Monitored

| Provider | Models |
|----------|--------|
| OpenAI | gpt-4o, gpt-5.2, gpt-5.2-instant |
| Anthropic | claude-opus-4.6, claude-sonnet-4.5, claude-haiku-4.5 |
| DeepSeek | deepseek-v3.2, deepseek-r1 |
| Google | gemini-2.5-pro, gemini-2.5-flash, gemini-3-flash |

## Example Prompts

- "What is the current drift score for GPT-4o?"
- "Run ABIS daily check"
- "Has Claude Sonnet drifted in the last 7 days?"
- "Investigate the drift alert on gpt-4o"
- "Generate an EU AI Act compliance report"
- "Which model is most stable right now?"
- "Have any models had silent version updates this week?"
- "Show me the cost vs drift matrix for the last 30 days"
- "Give me an investor brief on ABIS findings"

## Self-Hosted / Local Setup

```bash
git clone https://github.com/cijlabs/abis-mcp
cd abis-mcp
npm install
cp .env.example .env
# Set ABIS_ADMIN_KEY, MCP_PRO_KEY, and RAILWAY_URL in .env
node index.js
```

Add to Claude Code settings:
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

## About

**CIJ Labs Ltd** | Company No. 16984759 | London
Patent: **GB2521226.7**
Website: [abis.cijlabs.com](https://abis.cijlabs.com)
