import { getCollection } from '../db.js';

export default {
  name: 'abis_conversation_history',
  description: 'Query scored conversation history from MongoDB. Filter by time range and model. Shows drift scores per turn. Answers: "show me all conversations where drift exceeded 0.7"',
  inputSchema: {
    type: 'object',
    properties: {
      hours: { type: 'number', description: 'Hours to look back. Default: 24.' },
      model: { type: 'string', description: 'Optional: filter to a specific model.' },
      min_drift: { type: 'number', description: 'Optional: only show turns where drift >= this value.' },
    },
    required: [],
  },

  async execute(args) {
    const hours = args.hours || 24;
    const col = await getCollection('mcp_conversation_logs');
    if (col === null) {
      return { content: [{ type: 'text', text: 'ABIS: MongoDB not connected. No conversation history available.' }] };
    }

    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const query = { timestamp: { $gte: since } };
    if (args.min_drift != null) query.drift_score = { $gte: args.min_drift };

    try {
      const docs = await col.find(query).sort({ timestamp: -1 }).limit(50).toArray();
      if (docs.length === 0) {
        return { content: [{ type: 'text', text: `ABIS: No conversation logs in the last ${hours} hours matching criteria.` }] };
      }

      const lines = [`ABIS Conversation History (last ${hours}h, ${docs.length} results)`, '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'];
      docs.forEach(d => {
        const time = new Date(d.timestamp).toISOString().substring(11, 19);
        const icon = (d.drift_score || 0) > 0.65 ? '🔴' : (d.drift_score || 0) > 0.40 ? '🟡' : '🟢';
        const preview = (d.content_preview || '').substring(0, 80).replace(/\n/g, ' ');
        lines.push(`${icon} [${time}] drift: ${(d.drift_score || 0).toFixed(3)} | ${d.role || '?'} | ${preview}...`);
        if (d.abis_injected) lines.push(`   ↳ ${d.whisper_text}`);
      });

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `ABIS: History query failed: ${err.message}` }] };
    }
  }
};
