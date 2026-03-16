import { apiGet } from '../api.js';

export default {
  name: 'abis_memory_versions',
  description: 'Check if a model has had silent version changes detected by ABIS memory analysis.',
  inputSchema: {
    type: 'object',
    properties: {
      model: { type: 'string', description: 'Model name (e.g. gpt-4o, claude-opus-4.6).' },
      days: { type: 'number', description: 'Number of days to look back. Default: 90.' },
    },
    required: ['model'],
  },

  async execute(args) {
    const model = encodeURIComponent(args.model);
    const days = Math.min(parseInt(args.days) || 90, 365);
    const data = await apiGet(`/memory/versions/${model}?days=${days}`);

    if (!data) {
      return { content: [{ type: 'text', text: `ABIS: Could not fetch version history for ${args.model} — API offline or endpoint not available.` }] };
    }

    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
};
