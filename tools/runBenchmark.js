import { v4 as uuid } from 'uuid';
import { apiPostResult } from '../api.js';
import { insertDoc } from '../db.js';

// The backend caps benchmark routes for ALL callers (the MCP calls them with one key):
// /benchmark/run allows 2 starts/min and one run at a time (409 while one runs);
// /benchmark/single is rate-capped too (429). Say so instead of "offline".
// Backend `detail` text is logged by api.js but never echoed to the customer.
function failureText(r, label) {
  if (r.status === 409) return 'ABIS: A full benchmark run is already in progress (only one runs at a time, ~20 min). Try again once it finishes.';
  if (r.status === 429) return `ABIS: ${label} is rate-limited right now (the limit is shared across all users). Try again in a minute.`;
  if (r.status >= 400) return `ABIS: ${label} request was rejected (HTTP ${r.status}). Contact support if this persists.`;
  return `ABIS: ${label} failed — Railway API offline.`;
}

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
      const r = await apiPostResult('/benchmark/single', { model: args.model, prompt: args.prompt });
      if (!r.ok || !r.data) return { content: [{ type: 'text', text: failureText(r, 'Benchmark') }] };
      const result = r.data;

      await insertDoc('mcp_benchmark_triggers', {
        session_id: sessionId, timestamp: new Date(), triggered_by: 'user_request',
        model: args.model, run_id: result.run_id || 'single', drift_before: result.drift_score || null,
      });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }

    if (args.mode === 'full') {
      const r = await apiPostResult('/benchmark/run', {});
      if (!r.ok || !r.data) return { content: [{ type: 'text', text: failureText(r, 'Full benchmark') }] };
      const result = r.data;

      await insertDoc('mcp_benchmark_triggers', {
        session_id: sessionId, timestamp: new Date(), triggered_by: 'user_request',
        model: 'all', run_id: result.run_id || 'full', drift_before: null,
      });
      return { content: [{ type: 'text', text: `Full benchmark started.\nrun_id: ${result.run_id || 'pending'}\n\n${JSON.stringify(result, null, 2)}` }] };
    }

    return { content: [{ type: 'text', text: 'Error: mode must be "single" or "full".' }] };
  }
};
