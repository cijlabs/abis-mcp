import { apiGet } from '../api.js';

export default {
  name: 'abis_pipeline_stats',
  description: 'Get training pipeline ingestion statistics — shows vector counts, ingestion rate, and collection sizes.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },

  async execute() {
    const data = await apiGet('/pipeline/stats');

    if (!data) {
      return { content: [{ type: 'text', text: 'ABIS: Could not fetch pipeline stats — API offline or endpoint not available.' }] };
    }

    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
};
