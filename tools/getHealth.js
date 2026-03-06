const fetch = require('node-fetch');
const { ABIS_API_URL, ABIS_ADMIN_KEY } = require('../config');

module.exports = {
  name: 'abis_get_health',
  description: 'Check the health of all 8 ABIS biological organs (Eyes, Brain, Mouth, Memory, Immune System, Ears, Nervous System, Hands). Returns operational status of each organ and overall system health.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: []
  },
  async execute(_args) {
    const res = await fetch(`${ABIS_API_URL}/health`, {
      headers: { 'X-Admin-Key': ABIS_ADMIN_KEY }
    });
    const data = await res.json();
    return {
      content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
    };
  }
};
