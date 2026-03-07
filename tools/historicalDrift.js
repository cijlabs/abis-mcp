import { apiGet } from '../api.js';

export default {
  name: 'abis_historical_drift',
  description: "Get historical drift data — either aggregate for a specific date or full drift history for a model. Use to answer 'what were the scores on March 1?'",
  inputSchema: {
    type: 'object',
    properties: {
      date: { type: 'string', description: 'Optional: specific date in YYYY-MM-DD format. If provided, fetches aggregate data for that date.' },
      model: { type: 'string', description: 'Optional: model name to filter history to.' },
    },
    required: [],
  },

  async execute(args) {
    let data;

    if (args.date) {
      data = await apiGet(`/aggregate/${encodeURIComponent(args.date)}`);
    } else {
      const query = args.model ? `?model=${encodeURIComponent(args.model)}` : '';
      data = await apiGet(`/history${query}`);
    }

    if (!data) {
      return { content: [{ type: 'text', text: 'ABIS: Could not fetch historical drift data — API offline or endpoint not available.' }] };
    }

    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
};
