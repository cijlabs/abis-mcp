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

No API key required. Connects directly to the ABIS cloud.

## 37 Tools

### Drift & Scoring
| Tool | Description |
|------|-------------|
| `abis_get_drift_scores` | Live drift scores for all 11 monitored models |
| `abis_score_message` | Score any text through the behavioral pipeline |
| `abis_get_scorecard` | Full 9-score breakdown (drift, coherence, entropy, alignment, etc.) |
| `abis_ambient_status` | Quick snapshot of all models — call at session start |
| `abis_whisper` | Contextual status line (clear / monitor / alert / critical) |
| `abis_drift_gate` | Pre-response drift interceptor (Layer 3) |
| `abis_observe` | Post-response observer — how ABIS learns (Layer 3) |

### History & Memory
| Tool | Description |
|------|-------------|
| `abis_historical_drift` | Drift time-series by model or date |
| `abis_conversation_history` | Scored conversation log with drift per turn |
| `abis_memory_profile` | Full 30-day behavioral memory for a model |
| `abis_memory_trend` | Time-series trend for any score dimension |
| `abis_memory_compare` | Cross-model stability ranking |
| `abis_memory_versions` | Silent version change detection history |
| `abis_version_changes` | All detected version changes across models |
| `abis_cas_trends` | What features drive drift (energy distance, entropy, coherence) |

### Correction
| Tool | Description |
|------|-------------|
| `abis_corrector_strategies` | List all 8 correction strategies with severity levels |
| `abis_corrector_history` | Which strategies work best per model |
| `abis_simulate` | Test a correction before applying it |

### Immune System
| Tool | Description |
|------|-------------|
| `abis_immune_assess` | Classify threat: CLEAN / ORGANIC_DRIFT / PROMPT_INJECTION / COORDINATED_ATTACK |
| `abis_immune_scan` | Historical attack scan for a model |

### Benchmarking
| Tool | Description |
|------|-------------|
| `abis_run_benchmark` | Single or full benchmark run |
| `abis_stress_benchmark` | 30 adversarial prompts across all models |
| `abis_baseline_recalibrate` | Recompute drift baselines |

### Monitoring & Config
| Tool | Description |
|------|-------------|
| `abis_monitoring_config` | Current phase, tier assignments, cost estimate |
| `abis_monitoring_phase` | Switch phase (BASELINE / AGGRESSIVE / SUSTAIN / SCALE) |

### Reporting
| Tool | Description |
|------|-------------|
| `abis_generate_report` | 5 report types: daily_summary, drift_alert, migration_report, compliance_doc, investor_brief |
| `abis_cost_report` | Monthly API cost breakdown by model and tier |
| `abis_cost_vs_drift` | 30-day cost vs drift matrix |
| `abis_api_cost_analysis` | Most-called models with drift trajectory |

### Infrastructure
| Tool | Description |
|------|-------------|
| `abis_nervous_status` | Event bus health, 13 handlers, recent event log |
| `abis_pipeline_stats` | Ingestion statistics, vector counts |
| `abis_training_status` | XGBoost AUC scores, retraining history |
| `abis_ears_status` | Webhook sources: Datadog, PagerDuty, Zendesk, Intercom |
| `abis_ears_correlations` | Drift vs business impact correlations |

### Notifications
| Tool | Description |
|------|-------------|
| `abis_notification_config` | Get/set alert preferences (email, Slack, webhook) |
| `abis_notification_history` | Recent alert delivery log |

### SDK
| Tool | Description |
|------|-------------|
| `abis_sdk_sessions` | View SDK customer session history |

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

If you want to run the MCP server locally:

```bash
git clone https://github.com/cijlabs/abis-mcp
cd abis-mcp
npm install
cp .env.example .env
# Set ABIS_ADMIN_KEY and RAILWAY_URL in .env
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
        "ABIS_ADMIN_KEY": "your_key_here"
      }
    }
  }
}
```

## About

**CIJ Labs Ltd** | Company No. 16984759 | London
Patent: **GB2521226.7**
Website: [abis.cijlabs.com](https://abis.cijlabs.com)
