import { apiGet } from '../api.js';

export default {
  name: 'abis_nervous_status',
  description: 'Get nervous system status — event bus health, registered handlers, recent event log, and correction rate limits.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },

  async execute() {
    const data = await apiGet('/nervous-system/status');

    if (!data) {
      return { content: [{ type: 'text', text: 'ABIS: Could not fetch nervous system status — API offline or endpoint not available.' }] };
    }

    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
};
