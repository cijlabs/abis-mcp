import { apiGet } from '../api.js';

export default {
  name: 'abis_version_changes',
  description: 'List detected model version changes across all or a specific model. Shows when silent updates were detected and what behavioral shifts occurred.',
  inputSchema: {
    type: 'object',
    properties: {
      model: { type: 'string', description: 'Optional: filter to a specific model name.' },
    },
    required: [],
  },

  async execute(args) {
    let path = '/version-changes';
    if (args.model) {
      path = `/version-changes/${encodeURIComponent(args.model)}`;
    }

    const data = await apiGet(path);

    if (!data) {
      return { content: [{ type: 'text', text: 'ABIS: Could not fetch version changes — API offline or endpoint not available.' }] };
    }

    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
};
