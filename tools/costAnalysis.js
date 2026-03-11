import { getCollection } from '../db.js';

export default {
  name: 'abis_api_cost_analysis',
  description: 'Analyze which models are being called most frequently and their drift scores over the last 7 days. Groups MCP message scores by model, counts calls, and shows average drift per model. Answers: "why am I being charged for a drifted model?"',
  inputSchema: {
    type: 'object',
    properties: {
      days: { type: 'number', description: 'Number of days to look back. Default: 7.' },
    },
    required: [],
  },

  async execute(args) {
    const days = Math.min(parseInt(args.days) || 7, 365);
    const col = await getCollection('mcp_message_scores');
    if (col === null) {
      return { content: [{ type: 'text', text: 'ABIS: MongoDB not connected. Cannot run cost analysis without persistence layer.' }] };
    }

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const pipeline = [
      { $match: { timestamp: { $gte: since } } },
      {
        $group: {
          _id: '$model_hint',
          call_count: { $sum: 1 },
          avg_drift: { $avg: '$drift_score' },
          max_drift: { $max: '$drift_score' },
          min_drift: { $min: '$drift_score' },
          alerts: { $sum: { $cond: [{ $in: ['$whisper_level', ['alert', 'critical']] }, 1, 0] } },
        },
      },
      { $sort: { call_count: -1 } },
    ];

    try {
      const results = await col.aggregate(pipeline).toArray();
      if (results.length === 0) {
        return { content: [{ type: 'text', text: `ABIS: No scored messages in the last ${days} days.` }] };
      }

      const lines = [
        `ABIS API Cost Analysis (last ${days} days)`,
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      ];
      results.forEach(r => {
        const icon = (r.avg_drift || 0) > 0.65 ? '🔴' : (r.avg_drift || 0) > 0.40 ? '🟡' : '🟢';
        lines.push(`${icon} ${(r._id || 'unknown').padEnd(25)} calls: ${r.call_count}  avg_drift: ${(r.avg_drift || 0).toFixed(3)}  max: ${(r.max_drift || 0).toFixed(3)}  alerts: ${r.alerts}`);
      });

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `ABIS: Cost analysis query failed: ${err.message}` }] };
    }
  }
};
