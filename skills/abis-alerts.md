---
name: abis-alerts
description: Investigate a drift alert or anomaly for a specific model. Use when the user says "why is [model] drifting", "investigate drift on [model]", "what happened to [model]", or "explain the alert".
---

Investigate a behavioral drift alert for the specified model using ABIS tools.

If the user didn't specify a model, first call `abis_get_drift_scores` to find the highest-scoring model.

Then for the target model, run in order:

1. `abis_get_scorecard` — get the full 9-score breakdown
2. `abis_cas_trends` — identify which features are driving the drift (energy distance, entropy, coherence, etc.)
3. `abis_memory_versions` — check if a silent version update coincides with the drift spike
4. `abis_immune_assess` with the scorecard — classify the threat (CLEAN / ORGANIC_DRIFT / PROMPT_INJECTION / DATA_POISONING / COORDINATED_ATTACK)
5. `abis_corrector_strategies` — list available correction strategies
6. If drift > 0.65, call `abis_simulate` with a relevant prompt to test whether correction is viable

Produce a concise incident report:
- Model name and current drift score
- Top 3 driving features and their contribution %
- Threat classification with confidence
- Whether a version update likely caused it
- Recommended correction strategy (or "UNCORRECTABLE" if immune assess says so)
- Suggested next step (recalibrate baseline / apply correction / monitor)
