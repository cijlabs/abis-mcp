import { getCollection } from '../db.js';
import { apiGet } from '../api.js';
import { AMBIENT_DRIFT_THRESHOLD, AMBIENT_CRITICAL_THRESHOLD } from '../config.js';

export default {
  name: 'abis_whisper',
  description: 'Get the current ABIS whisper — a contextual status line injected into Claude\'s system prompt based on live drift state. Whisper levels: clear (all stable), monitor (some drift), alert (threshold exceeded), critical (>0.90). Call this at conversation start or periodically to stay drift-aware.',
  inputSchema: {
    type: 'object',
    properties: {
      session_id: { type: 'string', description: 'Current session ID for logging.' },
      include_models: { type: 'boolean', description: 'Include per-model breakdown. Default: false.' },
    },
    required: [],
  },

  async execute(args) {
    const data = await apiGet('/aggregate');
    if (!data) {
      return { content: [{ type: 'text', text: '[ABIS WHISPER] System offline — cannot determine drift state.' }] };
    }

    const benchmarks = data.benchmarks || [];
    const latest = benchmarks.length > 0
      ? benchmarks.reduce((a, b) => (b.total_calls > a.total_calls ? b : a))
      : null;

    if (!latest || !latest.models) {
      return { content: [{ type: 'text', text: '[ABIS WHISPER] No benchmark data available. Run a benchmark first.' }] };
    }

    // Determine whisper level from model drift scores
    const models = latest.models;
    const drifts = models.map(m => m.avg_drift || 0);
    const maxDrift = Math.max(...drifts);
    const avgDrift = drifts.reduce((a, b) => a + b, 0) / drifts.length;
    const alertModels = models.filter(m => (m.avg_drift || 0) >= AMBIENT_DRIFT_THRESHOLD);
    const criticalModels = models.filter(m => (m.avg_drift || 0) >= AMBIENT_CRITICAL_THRESHOLD);

    let level, icon, whisperText;

    if (criticalModels.length > 0) {
      level = 'critical';
      icon = '\u{1F6A8}';
      const names = criticalModels.map(m => m.model).join(', ');
      whisperText = `${icon} ABIS CRITICAL: ${criticalModels.length} model(s) above ${AMBIENT_CRITICAL_THRESHOLD} drift threshold — ${names}. Baseline recalibration may be needed. Treat outputs from these models with increased scrutiny.`;
    } else if (alertModels.length > 0) {
      level = 'alert';
      icon = '\u26A0\uFE0F';
      const names = alertModels.map(m => `${m.model} (${(m.avg_drift || 0).toFixed(3)})`).join(', ');
      whisperText = `${icon} ABIS ALERT: ${alertModels.length} model(s) exceeding ${AMBIENT_DRIFT_THRESHOLD} drift — ${names}. Behavioral consistency not guaranteed.`;
    } else if (avgDrift > 0.40) {
      level = 'monitor';
      icon = '\u{1F7E1}';
      whisperText = `${icon} ABIS MONITOR: Average drift ${avgDrift.toFixed(3)} across ${models.length} models. No threshold breaches. Monitoring continues.`;
    } else {
      level = 'clear';
      icon = '\u{1F7E2}';
      whisperText = `${icon} ABIS CLEAR: All ${models.length} models stable. Average drift ${avgDrift.toFixed(3)}. No action needed.`;
    }

    // Build full output
    const lines = [
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      whisperText,
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '',
      `Whisper level: ${level}`,
      `Models monitored: ${models.length}`,
      `Average drift: ${avgDrift.toFixed(3)}`,
      `Max drift: ${maxDrift.toFixed(3)}`,
      `Alert threshold: ${AMBIENT_DRIFT_THRESHOLD}`,
      `Critical threshold: ${AMBIENT_CRITICAL_THRESHOLD}`,
    ];

    if (args.include_models) {
      lines.push('', 'Per-model breakdown:');
      models.forEach(m => {
        const d = m.avg_drift || 0;
        const status = d >= AMBIENT_CRITICAL_THRESHOLD ? '\u{1F534} CRITICAL'
          : d >= AMBIENT_DRIFT_THRESHOLD ? '\u{1F7E0} ALERT'
          : d > 0.40 ? '\u{1F7E1} WATCH'
          : '\u{1F7E2} STABLE';
        lines.push(`  ${status} ${m.model}: ${d.toFixed(3)} drift (${m.drifts_detected || 0} drifts detected)`);
      });
    }

    // Log whisper to MongoDB if session provided
    if (args.session_id) {
      const col = await getCollection('mcp_conversation_logs');
      if (col !== null) {
        try {
          await col.insertOne({
            session_id: args.session_id,
            timestamp: new Date(),
            role: 'system',
            content_preview: whisperText.substring(0, 200),
            drift_score: maxDrift,
            whisper_level: level,
            abis_injected: true,
            whisper_text: whisperText,
            schema_version: '1.0',
          });
        } catch (_) { /* silent */ }
      }
    }

    return { content: [{ type: 'text', text: lines.join('\n') }] };
  }
};
