import { apiPost } from '../api.js';

export default {
  name: 'abis_monitoring_phase',
  description: 'Switch the monitoring phase. BASELINE=full burst, AGGRESSIVE=daily all tiers, SUSTAIN=cost-optimized ($47/mo), SCALE=extreme monitoring.',
  inputSchema: {
    type: 'object',
    properties: {
      phase: {
        type: 'string',
        description: 'Target phase: BASELINE, AGGRESSIVE, SUSTAIN, or SCALE.',
        enum: ['BASELINE', 'AGGRESSIVE', 'SUSTAIN', 'SCALE'],
      },
    },
    required: ['phase'],
  },

  async execute(args) {
    const data = await apiPost('/monitoring/phase', { phase: args.phase });

    if (!data) {
      return { content: [{ type: 'text', text: 'ABIS: Could not change monitoring phase — API offline or endpoint not available.' }] };
    }

    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
};
