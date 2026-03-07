import { apiGet } from '../api.js';

export default {
  name: 'abis_ears_correlations',
  description: 'Get drift-business impact correlations from EARS signals. Shows how external events (incidents, tickets, ratings) correlate with behavioral drift.',
  inputSchema: {
    type: 'object',
    properties: {
      model: { type: 'string', description: 'Optional: filter correlations to a specific model.' },
      days: { type: 'number', description: 'Number of days to analyze. Default: 7.' },
    },
    required: [],
  },

  async execute(args) {
    const params = [];
    if (args.model) params.push(`model=${encodeURIComponent(args.model)}`);
    params.push(`days=${args.days || 7}`);
    const query = params.length > 0 ? `?${params.join('&')}` : '';

    const data = await apiGet(`/ears/correlations${query}`);

    if (!data) {
      return { content: [{ type: 'text', text: 'ABIS: Could not fetch EARS correlations — API offline or endpoint not available.' }] };
    }

    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
};
