import { apiGet, apiPost } from '../api.js';

export default {
  name: 'abis_notification_config',
  description: 'Get or set notification preferences — configure alerts for drift, attacks, version changes via email/webhook/Slack.',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'Action to perform: "get" to read current config, "set" to update config.',
        enum: ['get', 'set'],
      },
      config: {
        type: 'object',
        description: 'Notification config object (only used when action="set"). Can include: channels (email/webhook/slack), thresholds, enabled flags.',
      },
    },
    required: ['action'],
  },

  async execute(args) {
    if (args.action === 'set') {
      if (!args.config) {
        return { content: [{ type: 'text', text: 'ABIS: config object is required when action="set".' }] };
      }
      const data = await apiPost('/notifications/config', args.config);
      if (!data) {
        return { content: [{ type: 'text', text: 'ABIS: Could not update notification config — API offline or endpoint not available.' }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }

    // Default: get
    const data = await apiGet('/notifications/config');
    if (!data) {
      return { content: [{ type: 'text', text: 'ABIS: Could not fetch notification config — API offline or endpoint not available.' }] };
    }
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
};
