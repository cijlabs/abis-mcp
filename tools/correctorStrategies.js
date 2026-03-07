import { apiGet } from '../api.js';

export default {
  name: 'abis_corrector_strategies',
  description: 'List all available correction strategies with descriptions and severity levels. Use to understand what ABIS can do to correct drifting models. Strategies include entropy_stabilize, baseline_anchor, spike_dampen, and more.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },

  async execute() {
    const data = await apiGet('/corrector/strategies');

    if (!data || !data.strategies) {
      return { content: [{ type: 'text', text: 'ABIS: Could not fetch corrector strategies — API offline or endpoint not available.' }] };
    }

    const lines = [
      'ABIS CORRECTION STRATEGIES',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '',
    ];

    for (const [signal, info] of Object.entries(data.strategies)) {
      lines.push(`  ${signal}`);
      lines.push(`    Severity: ${info.severity}`);
      lines.push(`    ${info.description}`);
      lines.push('');
    }

    lines.push('Use forced_strategy parameter in /benchmark/single to test a specific strategy.');

    return { content: [{ type: 'text', text: lines.join('\n') }] };
  }
};
