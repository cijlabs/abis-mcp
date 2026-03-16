import { apiGet } from '../api.js';

export default {
  name: 'abis_memory_trend',
  description: 'Get the time-series trend for a specific score dimension of a model. Shows direction, velocity, and confidence.',
  inputSchema: {
    type: 'object',
    properties: {
      model: { type: 'string', description: 'Model name (e.g. gpt-4o, claude-opus-4.6).' },
      score: { type: 'string', description: 'Score dimension to trend. Default: drift_score. Options: drift_score, coherence, empathy, toxicity, etc.' },
      days: { type: 'number', description: 'Number of days to include. Default: 7.' },
    },
    required: ['model'],
  },

  async execute(args) {
    const model = encodeURIComponent(args.model);
    const score = encodeURIComponent(args.score || 'drift_score');
    const days = Math.min(parseInt(args.days) || 7, 365);
    const data = await apiGet(`/memory/trend/${model}?score=${score}&days=${days}`);

    if (!data) {
      return { content: [{ type: 'text', text: `ABIS: Could not fetch trend data for ${args.model} — API offline or endpoint not available.` }] };
    }

    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
};
