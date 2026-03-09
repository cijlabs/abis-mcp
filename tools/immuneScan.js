import { apiGet } from '../api.js';

export default {
  name: 'abis_immune_scan',
  description: 'Run a historical immune scan for a model — analyzes drift velocity, anomaly clusters, and attack signatures over the specified period.',
  inputSchema: {
    type: 'object',
    properties: {
      model: { type: 'string', description: 'Model name (e.g. gpt-4o, claude-opus-4.6).' },
      days: { type: 'number', description: 'Number of days to scan. Default: 7.' },
    },
    required: ['model'],
  },

  async execute(args) {
    const model = encodeURIComponent(args.model);
    const days = Math.min(parseInt(args.days) || 7, 365);
    const data = await apiGet(`/immune/scan/${model}?days=${days}`);

    if (!data) {
      return { content: [{ type: 'text', text: `ABIS: Could not run immune scan for ${args.model} — API offline or endpoint not available.` }] };
    }

    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
};
