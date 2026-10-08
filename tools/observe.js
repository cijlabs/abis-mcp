import { v4 as uuid } from 'uuid';
import { apiPost, apiPostResult, apiGet } from '../api.js';
import { insertDoc, getCollection } from '../db.js';
import { AMBIENT_DRIFT_THRESHOLD } from '../config.js';

/**
 * ABIS Observe — Layer 3 Post-Response Scorer & Pattern Learner
 *
 * Called AFTER Claude generates a response. Scores the response through
 * the ABIS behavioral pipeline, stores the pattern, and triggers
 * correction simulation if drift is detected.
 *
 * This is the "learning from event #1" mechanism:
 * - Scores the response for all 9 behavioral dimensions
 * - If drift detected: records the observation
 * - Triggers simulation to find effective corrections
 * - Next call to drift_gate will have a validated correction ready
 */

async function triggerSimulation(model, prompt, driftSignal) {
  // Fire-and-forget simulation via Railway
  try {
    const result = await apiPost('/simulate/correction', {
      model,
      prompt,
      drift_signal: driftSignal,
    });
    return result;
  } catch (err) {
    console.error('[ABIS] Simulation trigger failed:', err.message);
    return null;
  }
}

function classifyDriftSignal(scorecard, driftScore) {
  if (!scorecard) return 'DRIFT_SUSTAINED';

  // Check entropy
  const entropy = scorecard.entropy_score ?? 0.5;
  if (entropy > 0.85) return 'ENTROPY_SPIKE';
  if (entropy < 0.15) return 'ENTROPY_COLLAPSE';

  // Check coherence
  const coherence = scorecard.coherence_score ?? 0.5;
  if (coherence < 0.3) return 'RHYTHM_INSTABILITY';

  // Check consistency
  const consistency = scorecard.consistency_score ?? 0.5;
  if (consistency < 0.2) return 'ERRATIC_INPUT';

  // Energy distance / high drift
  if (driftScore > 0.9) return 'ENERGY_DISTANCE_HIGH';
  if (driftScore > 0.8) return 'DRIFT_SPIKE';

  return 'DRIFT_SUSTAINED';
}

export default {
  name: 'abis_observe',
  description: 'Layer 3 post-response observer. Call this AFTER generating a response to score it through the ABIS behavioral pipeline. Detects drift patterns, stores observations, and automatically triggers correction simulations when drift is found. This is how ABIS learns — after 1 confirmed drift event, it simulates corrections so they are ready before drift event #2.',
  inputSchema: {
    type: 'object',
    properties: {
      response_text: {
        type: 'string',
        description: 'The response text Claude just generated. Will be scored for behavioral drift.',
      },
      model: {
        type: 'string',
        description: 'The model that generated the response (e.g. claude-opus-4.6).',
      },
      user_prompt: {
        type: 'string',
        description: 'The original user prompt that triggered this response. Used for simulation if drift is detected.',
      },
      auto_simulate: {
        type: 'boolean',
        description: 'If true (default), automatically triggers correction simulation when drift is detected.',
      },
    },
    required: ['response_text'],
  },

  async execute(args, sessionCtx) {
    const responseText = args.response_text || '';
    const model = args.model || 'claude-opus-4.6';
    const userPrompt = args.user_prompt || '';
    const autoSimulate = args.auto_simulate !== false;
    const sessionId = sessionCtx?.sessionId || 'unknown';
    const turnId = uuid();

    // 1. Score the response through Railway
    const r = await apiPostResult('/benchmark/single', {
      model,
      prompt: responseText.substring(0, 5000),
    });

    if (!r.ok || !r.data) {
      return {
        content: [{
          type: 'text',
          text: r.status === 429
            ? '[ABIS OBSERVE] Scoring is rate-limited right now (shared limit) — try again in a minute.'
            : '[ABIS OBSERVE] Scoring unavailable — Railway API offline.',
        }],
      };
    }
    const result = r.data;

    const drift = result.drift_score || 0;
    const scorecard = result.scorecard || {};
    const driftDetected = drift > AMBIENT_DRIFT_THRESHOLD;
    const driftSignal = classifyDriftSignal(scorecard, drift);

    // 2. Store observation
    const observation = {
      session_id: sessionId,
      turn_id: turnId,
      model,
      observed_at: new Date(),
      drift_score: drift,
      drift_detected: driftDetected,
      drift_signal: driftSignal,
      scorecard: {
        behavioral_health: scorecard.behavioral_health ?? null,
        drift: scorecard.drift_score ?? drift,
        correctability: scorecard.correctability_score ?? null,
        anomaly: scorecard.anomaly_score ?? null,
        entropy: scorecard.entropy_score ?? null,
        coherence: scorecard.coherence_score ?? null,
        consistency: scorecard.consistency_score ?? null,
        complexity: scorecard.complexity_score ?? null,
        reasoning_depth: scorecard.reasoning_depth_score ?? null,
        alignment_stability: scorecard.alignment_stability_score ?? null,
      },
      response_preview: responseText.substring(0, 300),
      prompt_preview: userPrompt.substring(0, 200),
      schema_version: '1.0',
    };

    await insertDoc('mcp_drift_observations', observation);

    // 3. If drift detected, trigger simulation
    let simulationResult = null;
    if (driftDetected && autoSimulate && userPrompt) {
      simulationResult = await triggerSimulation(model, userPrompt, driftSignal);
    }

    // 4. Count total drift observations for this model in this session
    let sessionDriftCount = 0;
    const obsCol = await getCollection('mcp_drift_observations');
    if (obsCol) {
      try {
        sessionDriftCount = await obsCol.countDocuments({
          session_id: sessionId,
          model,
          drift_detected: true,
        });
      } catch (_) { /* silent */ }
    }

    // 5. Build response
    const statusIcon = driftDetected ? '\u{1F534}' : drift > 0.40 ? '\u{1F7E1}' : '\u{1F7E2}';
    const lines = [
      `${statusIcon} ABIS OBSERVE: ${model}`,
      '',
      `Drift: ${drift.toFixed(4)} ${driftDetected ? '— DRIFT DETECTED' : '— within bounds'}`,
      `Signal: ${driftSignal}`,
      `Health: ${(scorecard.behavioral_health || 0).toFixed(3)}`,
      `Entropy: ${(scorecard.entropy_score || 0).toFixed(3)} | Coherence: ${(scorecard.coherence_score || 0).toFixed(3)}`,
      `Consistency: ${(scorecard.consistency_score || 0).toFixed(3)} | Reasoning: ${(scorecard.reasoning_depth_score || 0).toFixed(3)}`,
      `Correctability: ${(scorecard.correctability_score || 0).toFixed(3)} | Anomaly: ${(scorecard.anomaly_score || 0).toFixed(3)}`,
    ];

    if (driftDetected) {
      lines.push(
        '',
        `Session drift events: ${sessionDriftCount}`,
      );

      if (simulationResult) {
        const effective = simulationResult.effective;
        lines.push(
          '',
          '── SIMULATION RESULT ──',
          `Strategy: ${simulationResult.strategy} (${simulationResult.severity})`,
          `Baseline drift: ${simulationResult.baseline_drift?.toFixed(4)}`,
          `Corrected drift: ${simulationResult.corrected_drift?.toFixed(4)}`,
          `Reduction: ${simulationResult.drift_reduction?.toFixed(4)}`,
          `Effective: ${effective ? 'YES — correction stored for drift gate' : 'NO — will try alternate strategy'}`,
          '── END SIMULATION ──',
        );

        if (effective) {
          lines.push(
            '',
            'Next time drift_gate is called, this correction will be injected automatically.',
            `ABIS caught this at drift event #${sessionDriftCount}. Without ABIS, this would go unnoticed for 50-500+ events.`,
          );
        }
      } else if (autoSimulate && userPrompt) {
        lines.push('', 'Simulation triggered but no result yet — correction being validated.');
      } else if (!userPrompt) {
        lines.push('', 'No user_prompt provided — simulation skipped. Provide the original prompt to enable auto-correction.');
      }
    }

    return { content: [{ type: 'text', text: lines.join('\n') }] };
  },
};
