import { apiGet } from '../api.js';

export default {
  name: 'abis_get_drift_scores',
  description: 'Get live behavioral drift scores for all 8 monitored LLM models (gpt-4o, claude-opus-4.6, claude-sonnet-4.5, claude-haiku-4.5, deepseek-v3.2, deepseek-r1, gpt-5.2, gpt-5.2-instant). Returns model name, drift score, and prompt count. Use to answer "which model has lowest drift right now?"',
  inputSchema: {
    type: 'object',
    properties: {
      model: { type: 'string', description: 'Optional: filter to one model name.' },
    },
    required: [],
  },

  async execute(args) {
    if (args.model) {
      const data = await apiGet(`/drift/${encodeURIComponent(args.model)}`);
      if (!data) return { content: [{ type: 'text', text: `ABIS: Could not fetch drift for ${args.model} — API offline.` }] };
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }

    // Fetch aggregate for richer data
    const aggregate = await apiGet('/aggregate');
    if (!aggregate || !aggregate.benchmarks || aggregate.benchmarks.length === 0) {
      return { content: [{ type: 'text', text: 'ABIS: No benchmark data available. Run a benchmark first.' }] };
    }

    // Find the run with most data
    const best = aggregate.benchmarks.reduce((a, b) => (b.total_calls > a.total_calls ? b : a));

    const lines = ['ABIS Live Drift Scores', '━━━━━━━━━━━━━━━━━━━━━━'];
    if (best.models) {
      best.models.forEach(m => {
        const score = m.avg_drift != null ? m.avg_drift.toFixed(3) : 'N/A';
        const icon = m.avg_drift == null ? '⬜' : m.avg_drift > 0.90 ? '🔴' : m.avg_drift > 0.65 ? '🟠' : m.avg_drift > 0.40 ? '🟡' : '🟢';
        lines.push(`${icon} ${m.model.padEnd(25)} drift: ${score}  (${m.prompts_run} prompts)`);
      });
    }
    lines.push('', `Date: ${best.date} | Total calls: ${best.total_calls}`);

    return { content: [{ type: 'text', text: lines.join('\n') }] };
  }
};
