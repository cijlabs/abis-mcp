const fetch = require('node-fetch');
const { ABIS_API_URL, ABIS_ADMIN_KEY } = require('../config');

module.exports = {
  name: 'abis_get_benchmark_history',
  description: 'Retrieve historical benchmark data to compare model behavior over time. Use this to answer questions like "has GPT-4o gotten worse at coding since January?" or "show me Claude drift trajectory over the last 30 days". Returns timestamped benchmark runs with drift scores per model.',
  inputSchema: {
    type: 'object',
    properties: {
      model: {
        type: 'string',
        description: 'Optional. Filter history to a specific model.'
      },
      limit: {
        type: 'number',
        description: 'Optional. Number of benchmark runs to return. Default 10, max 50.'
      }
    },
    required: []
  },
  async execute(args) {
    const params = new URLSearchParams();
    if (args.model) params.append('model', args.model);
    if (args.limit) params.append('limit', args.limit);

    const url = `${ABIS_API_URL}/benchmark/history${params.toString() ? '?' + params.toString() : ''}`;

    const res = await fetch(url, {
      headers: { 'X-Admin-Key': ABIS_ADMIN_KEY }
    });
    const data = await res.json();
    return {
      content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
    };
  }
};
