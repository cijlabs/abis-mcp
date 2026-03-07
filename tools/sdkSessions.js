import { apiGet } from '../api.js';

export default {
  name: 'abis_sdk_sessions',
  description: 'View SDK customer session history — shows all scoring interactions for a registered SDK customer.',
  inputSchema: {
    type: 'object',
    properties: {
      customer_id: { type: 'string', description: 'The SDK customer ID to look up sessions for.' },
    },
    required: ['customer_id'],
  },

  async execute(args) {
    const customerId = encodeURIComponent(args.customer_id);
    const data = await apiGet(`/sdk/sessions/${customerId}`);

    if (!data) {
      return { content: [{ type: 'text', text: `ABIS: Could not fetch SDK sessions for customer ${args.customer_id} — API offline or endpoint not available.` }] };
    }

    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
};
