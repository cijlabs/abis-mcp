import { apiGet } from '../api.js';

export default {
  name: 'abis_memory_compare',
  description: 'Get cross-model stability comparison and ranking across all monitored models.',
  inputSchema: {
    type: 'object',
    properties: {
      days: { type: 'number', description: 'Number of days to compare over. Default: 7.' },
    },
    required: [],
  },

  async execute(args) {
    const days = args.days || 7;
    const data = await apiGet(`/memory/compare?days=${days}`);

    if (!data) {
      return { content: [{ type: 'text', text: 'ABIS: Could not fetch cross-model comparison — API offline or endpoint not available.' }] };
    }

    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
};
