import { apiPost, apiGet } from '../api.js';
import { insertDoc, getCollection } from '../db.js';

/**
 * ABIS Simulate — Layer 3 Correction Simulation Engine
 *
 * Runs correction simulations in a sandboxed environment against the
 * Railway backend. Tests whether a corrective prompt effectively
 * counters observed drift.
 *
 * The simulation flow:
 * 1. Send the original prompt to the model (baseline)
 * 2. Generate a corrective prompt based on the drift signal
 * 3. Send the corrected prompt to the model
 * 4. Compare drift scores — if reduction > 5%, the correction works
 * 5. Store the validated correction for drift_gate to use
 *
 * This is the proof that ABIS techniques work BEFORE deploying them.
 */

export default {
  name: 'abis_simulate',
  description: 'Run a drift correction simulation. Tests whether a corrective prompt effectively counters observed drift by comparing baseline vs corrected responses through the ABIS pipeline. If effective (>5% drift reduction), the correction is stored and will be automatically injected by drift_gate. Use this to manually test correction strategies or debug drift patterns.',
  inputSchema: {
    type: 'object',
    properties: {
      model: {
        type: 'string',
        description: 'Model to test correction against (e.g. gpt-4o, claude-opus-4.6).',
      },
      prompt: {
        type: 'string',
        description: 'The prompt to use for simulation. Should be representative of the drifting context.',
      },
      drift_signal: {
        type: 'string',
        description: 'The drift signal type to correct. Options: ENTROPY_SPIKE, ENTROPY_COLLAPSE, DRIFT_SUSTAINED, DRIFT_SPIKE, INCREASING_LATENCY, RHYTHM_INSTABILITY, ENERGY_DISTANCE_HIGH, ERRATIC_INPUT. Defaults to DRIFT_SUSTAINED.',
      },
    },
    required: ['model', 'prompt'],
  },

  async execute(args, sessionCtx) {
    const model = args.model || 'gpt-4o';
    const prompt = args.prompt || '';
    const driftSignal = args.drift_signal || 'DRIFT_SUSTAINED';
    const sessionId = sessionCtx?.sessionId || 'unknown';

    if (!prompt) {
      return {
        content: [{ type: 'text', text: 'Error: prompt is required for simulation.' }],
        isError: true,
      };
    }

    // Run simulation via Railway
    const result = await apiPost('/simulate/correction', {
      model,
      prompt: prompt.substring(0, 5000),
      drift_signal: driftSignal,
    });

    if (!result) {
      return {
        content: [{
          type: 'text',
          text: '[ABIS SIMULATE] Simulation failed — Railway API offline or error.',
        }],
      };
    }

    // Log simulation
    await insertDoc('mcp_simulation_log', {
      session_id: sessionId,
      model,
      drift_signal: driftSignal,
      strategy: result.strategy,
      baseline_drift: result.baseline_drift,
      corrected_drift: result.corrected_drift,
      drift_reduction: result.drift_reduction,
      effective: result.effective,
      timestamp: new Date(),
      schema_version: '1.0',
    });

    // Build response
    const effective = result.effective;
    const reductionPct = ((result.drift_reduction || 0) * 100).toFixed(1);

    const lines = [
      '━━━ ABIS CORRECTION SIMULATION ━━━',
      '',
      `Model: ${model}`,
      `Signal: ${driftSignal}`,
      `Strategy: ${result.strategy} (${result.severity})`,
      '',
      '── RESULTS ──',
      `Baseline drift:  ${result.baseline_drift?.toFixed(4) || 'N/A'}`,
      `Corrected drift: ${result.corrected_drift?.toFixed(4) || 'N/A'}`,
      `Drift reduction: ${result.drift_reduction?.toFixed(4) || 'N/A'} (${reductionPct}%)`,
      '',
      `Verdict: ${effective ? 'EFFECTIVE — correction validated and stored' : 'INEFFECTIVE — try a different strategy or prompt'}`,
    ];

    if (effective) {
      lines.push(
        '',
        'The correction has been stored in ABIS drift_patterns.',
        'Next time drift_gate detects this pattern, it will inject the correction automatically.',
        '',
        `Prompt preview: "${(result.correction_prompt_preview || '').substring(0, 150)}..."`,
      );
    } else {
      lines.push(
        '',
        'The correction did not reduce drift by >5%.',
        'Suggestions:',
        '  1. Try a different drift_signal classification',
        '  2. Use a more specific prompt that triggers the drift',
        '  3. The model may need baseline recalibration instead of correction',
      );
    }

    // Check how many validated patterns exist for this model
    const patternData = await apiGet(`/drift-patterns?model=${encodeURIComponent(model)}`);
    const patternCount = patternData?.total || 0;

    lines.push(
      '',
      `Total validated corrections for ${model}: ${patternCount}`,
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    );

    return { content: [{ type: 'text', text: lines.join('\n') }] };
  },
};
