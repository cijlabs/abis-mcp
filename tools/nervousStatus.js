import { apiGet } from '../api.js';

export default {
  name: 'abis_nervous_status',
  description: 'Get nervous system status — event bus health, registered handlers, recent event log, and correction rate limits.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },

  async execute() {
    const data = await apiGet('/nervous-system/status');

    if (!data) {
      return { content: [{ type: 'text', text: 'ABIS: Could not fetch nervous system status — API offline or endpoint not available.' }] };
    }

    const lines = ['ABIS Nervous System Status', '━━━━━━━━━━━━━━━━━━━━━━━━━━'];

    // Event bus state
    const active = data.active != null ? (data.active ? '✅ ACTIVE' : '❌ INACTIVE') : '❓ UNKNOWN';
    lines.push(`Event Bus: ${active}`);

    if (data.queue_size != null) {
      lines.push(`Queue Size: ${data.queue_size}`);
    }

    if (data.total_events_logged != null) {
      lines.push(`Events Logged: ${data.total_events_logged}`);
    }

    // Registered handlers
    if (data.registered_handlers) {
      lines.push('', 'Registered Handlers:');
      for (const [event, count] of Object.entries(data.registered_handlers)) {
        lines.push(`  ${event}: ${count} handler(s)`);
      }
    }

    // Recent event counts
    if (data.events_last_5min) {
      lines.push('', 'Events (last 5 min):');
      for (const [event, count] of Object.entries(data.events_last_5min)) {
        lines.push(`  ${event}: ${count}`);
      }
    }

    // Recent events log
    if (data.recent_events && data.recent_events.length > 0) {
      lines.push('', `Recent Events (last ${data.recent_events.length}):`);
      data.recent_events.slice(0, 10).forEach(evt => {
        const ts = evt.timestamp ? new Date(evt.timestamp).toLocaleTimeString() : '?';
        const type = evt.event_type || evt.type || 'unknown';
        lines.push(`  [${ts}] ${type}${evt.model ? ` — ${evt.model}` : ''}`);
      });
      if (data.recent_events.length > 10) {
        lines.push(`  ... and ${data.recent_events.length - 10} more`);
      }
    }

    return { content: [{ type: 'text', text: lines.join('\n') }] };
  }
};
