import { apiGet } from '../api.js';

export default {
  name: 'abis_notification_history',
  description: 'View recent notification delivery history — shows what alerts were sent, when, and delivery status.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },

  async execute() {
    const data = await apiGet('/notifications/history');

    if (!data) {
      return { content: [{ type: 'text', text: 'ABIS: Could not fetch notification history — API offline or endpoint not available.' }] };
    }

    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
};
