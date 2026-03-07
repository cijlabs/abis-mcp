import { v4 as uuid } from 'uuid';
import { apiPost } from '../api.js';
import { insertDoc } from '../db.js';

export default {
  name: 'abis_run_benchmark',
  description: 'Run a behavioral benchmark against ABIS-monitored models. mode=single: one model + one prompt = instant result. mode=full: all models x 20 prompts = async (~20 min). Returns drift scores and run_id.',
  inputSchema: {
    type: 'object',
    properties: {
      mode: { type: 'string', enum: ['single', 'full'], description: 'single = one model, one prompt. full = all models, async.' },
      model: { type: 'string', description: 'Required for single mode. Model name (e.g. gpt-4o).' },
      prompt: { type: 'string', description: 'Required for single mode. Prompt text to benchmark.' },
    },
    required: ['mode'],
  },

  async execute(args, sessionCtx) {
    const sessionId = sessionCtx?.sessionId || 'unknown';

    if (args.mode === 'single') {
      if (!args.model || !args.prompt) {
        return { content: [{ type: 'text', text: 'Error: single mode requires both model and prompt.' }] };
      }
      const result = await apiPost('/benchmark/single', { model: args.model, prompt: args.prompt });
      if (!result) return { content: [{ type: 'text', text: 'ABIS: Benchmark failed — Railway API offline.' }] };

      await insertDoc('mcp_benchmark_triggers', {
        session_id: sessionId, timestamp: new Date(), triggered_by: 'user_request',
        model: args.model, run_id: result.run_id || 'single', drift_before: result.drift_score || null,
      });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }

    if (args.mode === 'full') {
      const result = await apiPost('/benchmark/run', {});
      if (!result) return { content: [{ type: 'text', text: 'ABIS: Full benchmark failed — Railway API offline.' }] };

      await insertDoc('mcp_benchmark_triggers', {
        session_id: sessionId, timestamp: new Date(), triggered_by: 'user_request',
        model: 'all', run_id: result.run_id || 'full', drift_before: null,
      });
      return { content: [{ type: 'text', text: `Full benchmark started.\nrun_id: ${result.run_id || 'pending'}\n\n${JSON.stringify(result, null, 2)}` }] };
    }

    return { content: [{ type: 'text', text: 'Error: mode must be "single" or "full".' }] };
  }
};
