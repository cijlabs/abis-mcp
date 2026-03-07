import { apiPost } from '../api.js';

export default {
  name: 'abis_immune_assess',
  description: 'Run a real-time immune threat assessment against a scorecard. Returns threat classification (CLEAN/ORGANIC_DRIFT/PROMPT_INJECTION/DATA_POISONING/COORDINATED_ATTACK).',
  inputSchema: {
    type: 'object',
    properties: {
      scorecard: {
        type: 'object',
        description: 'The behavioral scorecard object to assess. Should contain score dimensions like coherence, empathy, toxicity, etc.',
      },
      prompt: { type: 'string', description: 'Optional: the prompt that generated the scorecard, for injection analysis.' },
    },
    required: ['scorecard'],
  },

  async execute(args) {
    const body = { scorecard: args.scorecard };
    if (args.prompt) body.prompt = args.prompt;

    const data = await apiPost('/immune/assess', body);

    if (!data) {
      return { content: [{ type: 'text', text: 'ABIS: Could not run immune assessment — API offline or endpoint not available.' }] };
    }

    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
};
