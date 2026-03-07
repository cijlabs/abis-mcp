import { apiGet } from '../api.js';
import { getCollection } from '../db.js';

/**
 * ABIS Drift Gate — Layer 3 Pre-Response Interceptor
 *
 * Called BEFORE Claude processes a user message. Checks if there's
 * a known drift pattern for the current model. If a validated correction
 * exists (proven effective through simulation), returns the corrective
 * system prompt to inject into Claude's context.
 *
 * This is the "catch drift at event #1" mechanism:
 * - Event #1: Drift observed → simulation validates correction
 * - Event #2+: Drift gate injects counter-prompt BEFORE it happens
 */

export default {
  name: 'abis_drift_gate',
  description: 'Layer 3 drift interceptor. Call this BEFORE processing a user message to check for active drift patterns. If ABIS has observed and validated a drift correction for the current model, returns a corrective system prompt to inject. This prevents drift from manifesting — catching it at event #1 instead of event #50-500. Returns either a correction injection or an all-clear signal.',
  inputSchema: {
    type: 'object',
    properties: {
      model: {
        type: 'string',
        description: 'The model being used (e.g. claude-opus-4.6). Defaults to claude-opus-4.6.',
      },
      context_hint: {
        type: 'string',
        description: 'Optional brief description of the task context (e.g. "code review", "creative writing"). Helps match drift patterns.',
      },
    },
    required: [],
  },

  async execute(args, sessionCtx) {
    const model = args.model || 'claude-opus-4.6';
    const contextHint = args.context_hint || '';
    const sessionId = sessionCtx?.sessionId || 'unknown';

    // 1. Check for active validated corrections from Railway
    const patternData = await apiGet(`/drift-patterns/active/${encodeURIComponent(model)}`);

    // 2. Check local MongoDB for recent drift observations in this session
    const localCol = await getCollection('mcp_drift_observations');
    let recentDrift = null;
    if (localCol) {
      try {
        recentDrift = await localCol.findOne(
          {
            model,
            session_id: sessionId,
            observed_at: { $gte: new Date(Date.now() - 3600000) }, // Last hour
          },
          { sort: { observed_at: -1 } }
        );
      } catch (_) { /* silent */ }
    }

    // 3. Get live whisper status for context
    const aggregate = await apiGet('/aggregate');
    let currentDrift = 0;
    if (aggregate?.benchmarks?.length > 0) {
      const latest = aggregate.benchmarks.reduce((a, b) =>
        (b.total_calls > a.total_calls ? b : a)
      );
      const modelData = (latest.models || []).find(m => m.model === model);
      if (modelData) currentDrift = modelData.avg_drift || 0;
    }

    // 4. Build gate response
    const hasCorrection = patternData?.correction != null;
    const hasRecentDrift = recentDrift != null;
    const driftActive = currentDrift > 0.65;

    if (hasCorrection && (driftActive || hasRecentDrift)) {
      // INJECT CORRECTION — drift pattern known, correction validated
      const correction = patternData.correction;
      const lines = [
        '━━━ ABIS DRIFT GATE: CORRECTION ACTIVE ━━━',
        '',
        `Model: ${model}`,
        `Current drift: ${currentDrift.toFixed(3)}`,
        `Pattern: ${correction.drift_signal}`,
        `Strategy: ${correction.strategy} (${correction.severity})`,
        `Effectiveness: ${((correction.effectiveness || 0) * 100).toFixed(1)}% drift reduction`,
        `Validated: ${correction.validated ? 'YES' : 'NO'}`,
        `Uses: ${correction.uses || 0}`,
        '',
        '── CORRECTIVE INJECTION ──',
        correction.corrective_prompt || correction.strategy,
        '── END INJECTION ──',
        '',
        'Apply the above behavioral calibration to your response.',
        'This correction was validated through ABIS simulation.',
      ];

      // Log the gate activation
      const logCol = await getCollection('mcp_drift_gate_log');
      if (logCol) {
        try {
          await logCol.insertOne({
            session_id: sessionId,
            model,
            action: 'correction_injected',
            strategy: correction.strategy,
            drift_at_gate: currentDrift,
            context_hint: contextHint,
            timestamp: new Date(),
            schema_version: '1.0',
          });
        } catch (_) { /* silent */ }
      }

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    }

    if (driftActive && !hasCorrection) {
      // DRIFT DETECTED but no validated correction yet — flag it
      const lines = [
        '━━━ ABIS DRIFT GATE: DRIFT DETECTED — NO CORRECTION YET ━━━',
        '',
        `Model: ${model}`,
        `Current drift: ${currentDrift.toFixed(3)} (above 0.65 threshold)`,
        '',
        'No validated correction pattern exists yet for this drift.',
        'ABIS is observing. After this response, call abis_observe to score it.',
        'If drift is confirmed, ABIS will simulate corrections automatically.',
        '',
        'Recommendation: Maintain extra consistency in this response.',
      ];

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    }

    // ALL CLEAR
    const statusIcon = currentDrift < 0.40 ? '\u{1F7E2}' : '\u{1F7E1}';
    return {
      content: [{
        type: 'text',
        text: `${statusIcon} ABIS GATE: Clear — ${model} drift ${currentDrift.toFixed(3)}. No correction needed.`,
      }],
    };
  },
};
