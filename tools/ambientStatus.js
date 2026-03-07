import { v4 as uuid } from 'uuid';
import { apiGet } from '../api.js';
import { insertDoc } from '../db.js';

export default {
  name: 'abis_ambient_status',
  description: 'Get the current ABIS ambient status — fetches live drift scores for all 8 monitored models. Call at session start to pre-load behavioral context. Returns formatted drift snapshot.',
  inputSchema: { type: 'object', properties: {}, required: [] },

  async execute(_args, sessionCtx) {
    const health = await apiGet('/health');
    const drift = await apiGet('/drift/all');
    const aggregate = await apiGet('/aggregate');

    const sessionId = sessionCtx?.sessionId || uuid();

    // Store session start event
    await insertDoc('mcp_sessions', {
      session_id: sessionId,
      started_at: new Date(),
      initial_drift_snapshot: drift,
      turns_count: 0,
      models_encountered: [],
    });

    const online = health && health.status === 'healthy';
    if (!online) {
      return { content: [{ type: 'text', text: 'ABIS OFFLINE — Railway API unreachable. Monitoring paused.' }] };
    }

    // Build drift summary from aggregate data
    let modelLines = 'No benchmark data available yet.';
    if (aggregate && aggregate.benchmarks && aggregate.benchmarks.length > 0) {
      const latest = aggregate.benchmarks.reduce((a, b) => (b.total_calls > a.total_calls ? b : a), aggregate.benchmarks[0]);
      if (latest.models && latest.models.length > 0) {
        modelLines = latest.models.map(m => {
          const score = m.avg_drift != null ? m.avg_drift.toFixed(3) : 'N/A';
          const status = m.avg_drift == null ? '⬜' : m.avg_drift > 0.90 ? '🔴' : m.avg_drift > 0.65 ? '🟠' : m.avg_drift > 0.40 ? '🟡' : '🟢';
          return `  ${status} ${m.model}: ${score} (${m.prompts_run} prompts)`;
        }).join('\n');
      }
    }

    const statusText = [
      'ABIS AMBIENT INTELLIGENCE ACTIVE',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      `Railway: ${online ? 'CONNECTED' : 'OFFLINE'}`,
      `MongoDB: ${health.mongo_connected ? 'CONNECTED' : 'DISCONNECTED'}`,
      '',
      'Current model drift snapshot:',
      modelLines,
      '',
      'ABIS is monitoring this conversation. Drift scores update every turn.',
      'When drift exceeds 0.65, ABIS will alert you automatically.',
      'You can ask ABIS anything about model behavior, API costs, or drift history.',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    ].join('\n');

    return { content: [{ type: 'text', text: statusText }] };
  }
};
