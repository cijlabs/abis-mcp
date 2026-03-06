const fetch = require('node-fetch');
const { ABIS_API_URL, ABIS_ADMIN_KEY } = require('../config');

const VALID_MODELS = [
  'gpt-4o', 'claude-opus-4.6', 'claude-sonnet-4.5',
  'claude-haiku-4.5', 'deepseek-v3.2', 'deepseek-r1',
  'gpt-5.2', 'gpt-5.2-instant'
];

module.exports = {
  name: 'abis_get_scorecard',
  description: `Get the full 9-score behavioral scorecard for a specific LLM model. The 9 scores are: Drift (trained), Correctability (trained), Anomaly (trained), Consistency (deterministic), Complexity (deterministic), Reasoning Depth (deterministic), Alignment Stability (deterministic), Entropy (deterministic), Coherence (deterministic). Valid models: ${VALID_MODELS.join(', ')}.`,
  inputSchema: {
    type: 'object',
    properties: {
      model: {
        type: 'string',
        description: `The model to retrieve the scorecard for. Must be one of: ${VALID_MODELS.join(', ')}`
      }
    },
    required: ['model']
  },
  async execute(args) {
    const res = await fetch(`${ABIS_API_URL}/scorecard/latest/${encodeURIComponent(args.model)}`, {
      headers: { 'X-Admin-Key': ABIS_ADMIN_KEY }
    });
    const data = await res.json();
    return {
      content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
    };
  }
};
