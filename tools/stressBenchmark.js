import { apiPost } from '../api.js';

export default {
  name: 'abis_stress_benchmark',
  description: 'Run a stress benchmark using 30 adversarial edge-case prompts across all monitored models. Tests behavioral stability under extreme conditions. Requires admin key. Returns run_id for tracking.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },

  async execute() {
    const data = await apiPost('/cron/stress-benchmark', {});

    if (!data) {
      return { content: [{ type: 'text', text: 'ABIS: Could not start stress benchmark — API offline or admin key missing.' }] };
    }

    if (data.error) {
      return { content: [{ type: 'text', text: `ABIS: Stress benchmark error — ${data.message || data.error}` }] };
    }

    const lines = [
      '🔥 ABIS STRESS BENCHMARK STARTED',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      `Run ID: ${data.run_id}`,
      `Models: ${data.models}`,
      `Stress prompts: ${data.prompts}`,
      '',
      'This benchmark uses adversarial edge-case prompts to test model stability.',
      'Results will be available via abis_get_drift_scores once complete.',
    ];

    return { content: [{ type: 'text', text: lines.join('\n') }] };
  }
};
