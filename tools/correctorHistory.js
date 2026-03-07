import { apiGet } from '../api.js';

export default {
  name: 'abis_corrector_history',
  description: 'Get correction outcome history with strategy effectiveness stats. Shows which correction strategies work best for each model, success rates, and average drift reduction. Essential for understanding model correctability.',
  inputSchema: {
    type: 'object',
    properties: {
      model: {
        type: 'string',
        description: 'Optional: filter by model name (e.g., "gpt-4o", "claude-sonnet-4.5").',
      },
      days: {
        type: 'number',
        description: 'Number of days of history to retrieve. Default: 30.',
      },
    },
    required: [],
  },

  async execute(args) {
    const params = new URLSearchParams();
    if (args.model) params.append('model', args.model);
    if (args.days) params.append('days', String(args.days));
    const qs = params.toString();
    const data = await apiGet(`/corrector/history${qs ? '?' + qs : ''}`);

    if (!data) {
      return { content: [{ type: 'text', text: 'ABIS: Could not fetch correction history — API offline.' }] };
    }

    const lines = [
      'ABIS CORRECTION HISTORY',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      `Total corrections: ${data.total_corrections} (last ${data.days} days)`,
      '',
    ];

    // Strategy effectiveness
    if (data.strategy_effectiveness && Object.keys(data.strategy_effectiveness).length > 0) {
      lines.push('STRATEGY EFFECTIVENESS:');
      for (const [strategy, stats] of Object.entries(data.strategy_effectiveness)) {
        const rate = (stats.success_rate * 100).toFixed(0);
        const icon = stats.success_rate > 0.3 ? '🟢' : stats.success_rate > 0.1 ? '🟡' : '🔴';
        lines.push(`  ${icon} ${strategy}: ${rate}% success (${stats.success}/${stats.total}) | avg reduction: ${stats.avg_reduction}%`);
      }
      lines.push('');
    }

    // Model correctability
    if (data.model_correctability && Object.keys(data.model_correctability).length > 0) {
      lines.push('MODEL CORRECTABILITY:');
      for (const [model, stats] of Object.entries(data.model_correctability)) {
        const rate = (stats.correctability_rate * 100).toFixed(0);
        const icon = stats.correctability_rate > 0.3 ? '🟢' : stats.correctability_rate > 0.1 ? '🟡' : '🔴';
        lines.push(`  ${icon} ${model}: ${rate}% correctable (${stats.success}/${stats.total})`);
      }
    }

    return { content: [{ type: 'text', text: lines.join('\n') }] };
  }
};
