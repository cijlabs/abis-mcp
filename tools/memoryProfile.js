import { apiGet } from '../api.js';

export default {
  name: 'abis_memory_profile',
  description: 'Get the full behavioral memory profile for a model including KEDH drift horizon predictions, trend analysis, and baseline stats.',
  inputSchema: {
    type: 'object',
    properties: {
      model: { type: 'string', description: 'Model name (e.g. gpt-4o, claude-opus-4.6).' },
      days: { type: 'number', description: 'Number of days to include in the profile. Default: 30.' },
    },
    required: ['model'],
  },

  async execute(args) {
    const model = encodeURIComponent(args.model);
    const days = Math.min(parseInt(args.days) || 30, 365);
    const data = await apiGet(`/memory/profile/${model}?days=${days}`);

    if (!data) {
      return { content: [{ type: 'text', text: `ABIS: Could not fetch memory profile for ${args.model} — API offline or endpoint not available.` }] };
    }

    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
};
