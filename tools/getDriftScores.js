const fetch = require('node-fetch');
const { ABIS_API_URL, ABIS_ADMIN_KEY } = require('../config');

module.exports = {
  name: 'abis_get_drift_scores',
  description: 'Get the latest behavioral drift scores for all 8 monitored LLM models: gpt-4o, claude-opus-4.6, claude-sonnet-4.5, claude-haiku-4.5, deepseek-v3.2, deepseek-r1, gpt-5.2, gpt-5.2-instant. Scores range 0.0–1.0. Thresholds: 0–0.2 stable (green), 0.2–0.4 minor drift (yellow), 0.4–0.6 moderate (orange), 0.6–0.8 significant (red), 0.8–1.0 critical (deep red). Note: scores above 0.90 across all models indicate baseline recalibration is needed, not genuine drift.',
  inputSchema: {
    type: 'object',
    properties: {
      model: {
        type: 'string',
        description: 'Optional. Filter to a specific model name. If omitted, returns all models.'
      }
    },
    required: []
  },
  async execute(args) {
    const endpoint = args.model
      ? `${ABIS_API_URL}/drift/${encodeURIComponent(args.model)}`
      : `${ABIS_API_URL}/drift/all`;

    const res = await fetch(endpoint, {
      headers: { 'X-Admin-Key': ABIS_ADMIN_KEY }
    });
    const data = await res.json();
    return {
      content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
    };
  }
};
