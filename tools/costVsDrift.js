import { getCollection } from '../db.js';

export default {
  name: 'abis_cost_vs_drift',
  description: 'Show a 30-day cost-vs-drift matrix. Groups MCP usage by model and week, showing call volume alongside drift trajectory. Answers: "am I paying for drifted models?" and "which model gives best stability per call?"',
  inputSchema: {
    type: 'object',
    properties: {
      days: { type: 'number', description: 'Days to look back. Default: 30.' },
    },
    required: [],
  },

  async execute(args) {
    const days = args.days || 30;
    const col = await getCollection('mcp_message_scores');
    if (col === null) {
      return { content: [{ type: 'text', text: 'ABIS: MongoDB not connected. Cannot generate cost-vs-drift matrix without persistence layer.' }] };
    }

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Aggregate by model + week
    const pipeline = [
      { $match: { timestamp: { $gte: since } } },
      {
        $addFields: {
          week_start: {
            $dateFromParts: {
              isoWeekYear: { $isoWeekYear: '$timestamp' },
              isoWeek: { $isoWeek: '$timestamp' },
              isoDayOfWeek: 1,
            },
          },
        },
      },
      {
        $group: {
          _id: { model: '$model_hint', week: '$week_start' },
          calls: { $sum: 1 },
          avg_drift: { $avg: '$drift_score' },
          max_drift: { $max: '$drift_score' },
          alerts: { $sum: { $cond: [{ $gte: ['$drift_score', 0.65] }, 1, 0] } },
        },
      },
      { $sort: { '_id.model': 1, '_id.week': 1 } },
    ];

    try {
      const results = await col.aggregate(pipeline).toArray();

      if (results.length === 0) {
        return { content: [{ type: 'text', text: `ABIS: No scored messages in the last ${days} days. Use ABIS in conversations to generate data.` }] };
      }

      // Group by model
      const byModel = {};
      results.forEach(r => {
        const model = r._id.model || 'unknown';
        if (!byModel[model]) byModel[model] = [];
        byModel[model].push({
          week: r._id.week,
          calls: r.calls,
          avg_drift: r.avg_drift || 0,
          max_drift: r.max_drift || 0,
          alerts: r.alerts,
        });
      });

      // Build output
      const lines = [
        `ABIS COST vs DRIFT MATRIX (last ${days} days)`,
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '',
      ];

      for (const [model, weeks] of Object.entries(byModel)) {
        const totalCalls = weeks.reduce((s, w) => s + w.calls, 0);
        const overallAvg = weeks.reduce((s, w) => s + w.avg_drift * w.calls, 0) / totalCalls;
        const totalAlerts = weeks.reduce((s, w) => s + w.alerts, 0);
        const icon = overallAvg > 0.65 ? '\u{1F534}' : overallAvg > 0.40 ? '\u{1F7E1}' : '\u{1F7E2}';

        lines.push(`${icon} ${model}`);
        lines.push(`   Total calls: ${totalCalls} | Avg drift: ${overallAvg.toFixed(3)} | Alerts: ${totalAlerts}`);
        lines.push('   Weekly breakdown:');

        weeks.forEach(w => {
          const weekLabel = new Date(w.week).toISOString().substring(0, 10);
          const bar = '\u2588'.repeat(Math.min(Math.round(w.avg_drift * 20), 20));
          const pad = '\u2591'.repeat(20 - Math.min(Math.round(w.avg_drift * 20), 20));
          lines.push(`     ${weekLabel}: ${bar}${pad} ${w.avg_drift.toFixed(3)} drift | ${w.calls} calls | ${w.alerts} alerts`);
        });
        lines.push('');
      }

      // Summary recommendations
      const modelStats = Object.entries(byModel).map(([model, weeks]) => {
        const totalCalls = weeks.reduce((s, w) => s + w.calls, 0);
        const overallAvg = weeks.reduce((s, w) => s + w.avg_drift * w.calls, 0) / totalCalls;
        return { model, totalCalls, overallAvg };
      });

      const bestModel = modelStats.reduce((a, b) => a.overallAvg < b.overallAvg ? a : b);
      const worstModel = modelStats.reduce((a, b) => a.overallAvg > b.overallAvg ? a : b);

      lines.push('RECOMMENDATIONS:');
      lines.push(`  Best stability/call: ${bestModel.model} (${bestModel.overallAvg.toFixed(3)} avg drift, ${bestModel.totalCalls} calls)`);
      if (worstModel.overallAvg > 0.65) {
        lines.push(`  \u26A0\uFE0F Consider reducing usage of ${worstModel.model} (${worstModel.overallAvg.toFixed(3)} avg drift)`);
      }

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `ABIS: Cost-vs-drift query failed: ${err.message}` }] };
    }
  }
};
