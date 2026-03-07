import { apiGet } from '../api.js';

export default {
  name: 'abis_cost_report',
  description: 'Get the estimated monthly API cost report broken down by model, tier, and provider.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },

  async execute() {
    const data = await apiGet('/monitoring/cost-report');

    if (!data) {
      return { content: [{ type: 'text', text: 'ABIS: Could not fetch cost report — API offline or endpoint not available.' }] };
    }

    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
};
