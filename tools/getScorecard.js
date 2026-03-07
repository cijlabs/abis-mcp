import { apiGet } from '../api.js';

export default {
  name: 'abis_get_scorecard',
  description: 'Get the full 9-score behavioral scorecard for a specific model. Returns: drift, correctability, anomaly, consistency, complexity, reasoning depth, alignment stability, entropy, coherence, and behavioral health. Use for deep dives on model behavior.',
  inputSchema: {
    type: 'object',
    properties: {
      model: { type: 'string', description: 'Model name to fetch scorecard for (e.g. gpt-4o, claude-opus-4.6, deepseek-v3.2).' },
    },
    required: ['model'],
  },

  async execute(args) {
    const data = await apiGet(`/scorecard/latest/${encodeURIComponent(args.model)}`);
    if (!data) {
      return { content: [{ type: 'text', text: `ABIS: Could not fetch scorecard for ${args.model}. API may be offline or no data exists for this model.` }] };
    }

    if (data.status === 'no_data') {
      return { content: [{ type: 'text', text: `ABIS: No scorecard data for ${args.model}. Run a benchmark first.` }] };
    }

    const s = data;
    const lines = [
      `ABIS Scorecard: ${s.model}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `Patent: ${s.patent || 'GB2521226.7'}`,
      `Version: ${s.version || '2.0.0'}`,
      '',
      `  Drift Score:        ${fmt(s.drift_score)}`,
      `  Correctability:     ${fmt(s.correctability_score)}`,
      `  Anomaly:            ${fmt(s.anomaly_score)}`,
      `  Consistency:        ${fmt(s.consistency_score)}`,
      `  Complexity:         ${fmt(s.complexity_score)}`,
      `  Reasoning Depth:    ${fmt(s.reasoning_depth_score)}`,
      `  Alignment:          ${fmt(s.alignment_stability_score)}`,
      `  Entropy:            ${fmt(s.entropy_score)}`,
      `  Coherence:          ${fmt(s.coherence_score)}`,
      '',
      `  Behavioral Health:  ${fmt(s.behavioral_health)}`,
      `  Coverage:           ${s.data_quality?.coverage_pct || 'N/A'}%`,
      `  Dimensions:         ${s.data_quality?.populated_dimensions || 'N/A'} / ${s.data_quality?.total_dimensions || '1544'}`,
    ];

    return { content: [{ type: 'text', text: lines.join('\n') }] };
  }
};

function fmt(v) {
  return v != null ? v.toFixed(4) : 'N/A';
}
