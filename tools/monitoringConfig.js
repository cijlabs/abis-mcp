import { apiGet } from '../api.js';

export default {
  name: 'abis_monitoring_config',
  description: 'Get current monitoring configuration including phase, tier assignments, cost estimates, and schedule.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },

  async execute() {
    const data = await apiGet('/monitoring/config');

    if (!data) {
      return { content: [{ type: 'text', text: 'ABIS: Could not fetch monitoring config — API offline or endpoint not available.' }] };
    }

    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
};
