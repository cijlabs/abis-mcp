import { apiGet } from '../api.js';

export default {
  name: 'abis_training_status',
  description: 'Get model training status — latest AUC scores and optionally full retraining history with snapshots.',
  inputSchema: {
    type: 'object',
    properties: {
      include_history: { type: 'boolean', description: 'If true, also fetch full training history. Default: false.' },
    },
    required: [],
  },

  async execute(args) {
    const latest = await apiGet('/training/latest');

    if (!latest) {
      return { content: [{ type: 'text', text: 'ABIS: Could not fetch training status — API offline or endpoint not available.' }] };
    }

    if (args.include_history) {
      const history = await apiGet('/training/history');
      const combined = {
        latest,
        history: history || { error: 'Could not fetch training history' },
      };
      return { content: [{ type: 'text', text: JSON.stringify(combined, null, 2) }] };
    }

    return { content: [{ type: 'text', text: JSON.stringify(latest, null, 2) }] };
  }
};
