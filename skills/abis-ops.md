---
name: abis-ops
description: Run ABIS daily health check. Use when the user asks "check ABIS", "morning briefing", "what's the drift today", "daily standup", or "run ABIS check".
---

Run a full ABIS daily health check using the available MCP tools in this order:

1. Call `abis_ambient_status` to get the live drift snapshot for all models.
2. Call `abis_nervous_status` to check event bus health and handler status.
3. Call `abis_monitoring_config` to confirm the monitoring phase and tier coverage.
4. Call `abis_version_changes` to check for any newly detected silent model updates.
5. Call `abis_memory_compare` to rank all models by stability over the last 7 days.

Then produce a concise briefing:
- Overall system status (healthy / degraded / alert)
- Any models with drift score > 0.50 — flag them
- Any version changes detected since last check
- Most stable and most drifted model
- Monitoring phase and estimated monthly cost
- One recommended action if anything needs attention

Keep the briefing to under 200 words. Use plain language — no jargon.
