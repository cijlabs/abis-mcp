const fetch = require('node-fetch');
const { ABIS_API_URL, ABIS_ADMIN_KEY } = require('../config');

const REPORT_TYPES = [
  'daily_summary',
  'drift_alert',
  'migration_comparison',
  'eu_ai_act_compliance',
  'investor_brief'
];

module.exports = {
  name: 'abis_generate_report',
  description: `Generate a natural language report from ABIS's Mouth organ (Llama 3.1 8B via Groq). Report types: daily_summary (overview of all model drift today), drift_alert (urgent notification for models crossing thresholds), migration_comparison (before/after analysis for model version changes), eu_ai_act_compliance (EU AI Act audit trail with deterministic scores), investor_brief (formatted traction summary for investors). Valid types: ${REPORT_TYPES.join(', ')}.`,
  inputSchema: {
    type: 'object',
    properties: {
      report_type: {
        type: 'string',
        enum: REPORT_TYPES,
        description: `Type of report to generate. Options: ${REPORT_TYPES.join(', ')}`
      }
    },
    required: ['report_type']
  },
  async execute(args) {
    const res = await fetch(`${ABIS_API_URL}/report/${args.report_type}`, {
      method: 'POST',
      headers: {
        'X-Admin-Key': ABIS_ADMIN_KEY,
        'Content-Type': 'application/json'
      }
    });
    const data = await res.json();
    return {
      content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
    };
  }
};
