import { apiPost } from '../api.js';

export default {
  name: 'abis_baseline_recalibrate',
  description: 'Trigger drift baseline recalibration. This re-computes centroids and distance stats for all monitored models. Use when drift scores are consistently high across all models.',
  inputSchema: {
    type: 'object',
    properties: {
      model: { type: 'string', description: 'Optional: filter recalibration to a specific model. If omitted, recalibrates all models.' },
    },
    required: [],
  },

  async execute(args) {
    const body = {};
    if (args.model) body.model = args.model;

    const data = await apiPost('/baseline/recalibrate', body);

    if (!data) {
      return { content: [{ type: 'text', text: 'ABIS: Could not trigger baseline recalibration — API offline or endpoint not available.' }] };
    }

    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
};
