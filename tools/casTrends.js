import { apiGet } from '../api.js';

export default {
  name: 'abis_cas_trends',
  description: 'Get CAS (Composite Autonomic Score) contributor trends for a model. Shows which features most commonly drive drift, failure mode diversity, and recurring patterns. Use to understand WHY a model drifts, not just how much.',
  inputSchema: {
    type: 'object',
    properties: {
      model: {
        type: 'string',
        description: 'Model to analyse (e.g., "gpt-4o", "claude-sonnet-4.5").',
      },
      days: {
        type: 'number',
        description: 'Number of days of history. Default: 90.',
      },
    },
    required: ['model'],
  },

  async execute(args) {
    const days = Math.min(parseInt(args.days) || 90, 365);
    const data = await apiGet(`/memory/cas-trends/${encodeURIComponent(args.model)}?days=${days}`);

    if (!data) {
      return { content: [{ type: 'text', text: 'ABIS: Could not fetch CAS trends — API offline.' }] };
    }

    if (data.error || data.total_observations === 0) {
      return { content: [{ type: 'text', text: `ABIS: No CAS data for ${args.model} — ${data.message || 'no observations'}` }] };
    }

    const lines = [
      `ABIS CAS TRENDS — ${args.model}`,
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      `Observations: ${data.total_observations} | Days: ${data.days}`,
      `Diversity score: ${data.cas_diversity_score} — ${data.interpretation}`,
      '',
      'TOP CONTRIBUTING FEATURES (what drives drift):',
    ];

    if (data.top_contributing_features) {
      for (const f of data.top_contributing_features) {
        lines.push(`  ${f.feature}: ${f.frequency_pct}% of observations (avg ${f.avg_contribution_pct}% contribution)`);
      }
    }

    return { content: [{ type: 'text', text: lines.join('\n') }] };
  }
};
