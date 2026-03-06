const fetch = require('node-fetch');
const { ABIS_API_URL, ABIS_ADMIN_KEY } = require('../config');

module.exports = {
  name: 'abis_run_benchmark',
  description: 'Run a behavioral benchmark against one or all ABIS-monitored LLM models. Single model + prompt = instant result. Full benchmark (all 8 models x 20 prompts) = async, returns run_id, takes ~20 minutes. Use single benchmarks for quick checks. Use full benchmark for weekly drift tracking.',
  inputSchema: {
    type: 'object',
    properties: {
      mode: {
        type: 'string',
        enum: ['single', 'full'],
        description: 'single = one model, one prompt, immediate result. full = all 8 models x 20 prompts, async (~20 mins).'
      },
      model: {
        type: 'string',
        description: 'Required if mode is single. The model name to benchmark (e.g. gpt-4o, claude-opus-4.6).'
      },
      prompt: {
        type: 'string',
        description: 'Required if mode is single. The prompt to send to the model for behavioral measurement.'
      }
    },
    required: ['mode']
  },
  async execute(args) {
    if (args.mode === 'single') {
      if (!args.model || !args.prompt) {
        return {
          content: [{ type: 'text', text: 'Error: single mode requires both model and prompt.' }]
        };
      }
      const res = await fetch(`${ABIS_API_URL}/benchmark/single`, {
        method: 'POST',
        headers: {
          'X-Admin-Key': ABIS_ADMIN_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ model: args.model, prompt: args.prompt })
      });
      const data = await res.json();
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
      };
    }

    if (args.mode === 'full') {
      const res = await fetch(`${ABIS_API_URL}/benchmark/run`, {
        method: 'POST',
        headers: {
          'X-Admin-Key': ABIS_ADMIN_KEY,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      return {
        content: [{ type: 'text', text: `Full benchmark started. run_id: ${data.run_id || 'see response'}.\n\n${JSON.stringify(data, null, 2)}` }]
      };
    }

    return {
      content: [{ type: 'text', text: 'Error: mode must be "single" or "full".' }]
    };
  }
};
