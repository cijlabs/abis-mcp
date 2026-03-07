import { apiGet } from '../api.js';

export default {
  name: 'abis_ears_status',
  description: 'Get EARS integration status — shows connected webhook sources (Datadog, PagerDuty, Zendesk, Intercom), last signal times, and setup instructions.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },

  async execute() {
    const data = await apiGet('/ears/status');

    if (!data) {
      return { content: [{ type: 'text', text: 'ABIS: Could not fetch EARS status — API offline or endpoint not available.' }] };
    }

    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
};
