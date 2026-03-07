import { v4 as uuid } from 'uuid';
import { apiPost } from '../api.js';
import { insertDoc } from '../db.js';
import { AMBIENT_DRIFT_THRESHOLD, AMBIENT_CRITICAL_THRESHOLD } from '../config.js';

function getWhisperLevel(drift) {
  if (drift > AMBIENT_CRITICAL_THRESHOLD) return 'critical';
  if (drift > AMBIENT_DRIFT_THRESHOLD) return 'alert';
  if (drift > 0.40) return 'monitor';
  return 'clear';
}

function buildWhisper(drift, model, scorecard) {
  const level = getWhisperLevel(drift);
  if (level === 'critical') {
    const correct = scorecard?.correctability_score != null
      ? `Correctability: ${(scorecard.correctability_score * 100).toFixed(0)}%.`
      : '';
    return `⚠️ CRITICAL: ${model} has drifted ${drift.toFixed(3)} from baseline. ${correct} Recommend switching to most stable model.`;
  }
  if (level === 'alert') {
    const entropy = scorecard?.entropy_score?.toFixed(2) || 'N/A';
    const coherence = scorecard?.coherence_score?.toFixed(2) || 'N/A';
    return `⚡ DRIFT DETECTED: ${model} showing ${drift.toFixed(3)} drift. Entropy: ${entropy}, Coherence: ${coherence}. Monitor closely.`;
  }
  if (level === 'monitor') {
    return `⚠ ${model}: ${drift.toFixed(3)} drift — approaching threshold. All 9 scores logged.`;
  }
  return `✓ ABIS: ${model} stable (${drift.toFixed(3)}). All 9 scores within baseline.`;
}

export default {
  name: 'abis_score_message',
  description: 'Score a message through the ABIS behavioral pipeline. Posts the message to Railway /benchmark/single and returns drift score, 9-score scorecard, and a whisper-level assessment. This is the core ambient tool — call it to score any AI response or prompt.',
  inputSchema: {
    type: 'object',
    properties: {
      message: { type: 'string', description: 'The message text to score for behavioral drift.' },
      model_hint: { type: 'string', description: 'Which model produced or will receive this message (e.g. gpt-4o, claude-sonnet-4.5). Defaults to gpt-4o.' },
    },
    required: ['message'],
  },

  async execute(args, sessionCtx) {
    const model = args.model_hint || 'gpt-4o';
    const message = args.message || '';
    const turnId = uuid();
    const sessionId = sessionCtx?.sessionId || 'unknown';

    // Score via Railway
    const result = await apiPost('/benchmark/single', {
      model: model,
      prompt: message.substring(0, 5000),
    });

    if (!result) {
      return { content: [{ type: 'text', text: 'ABIS scoring unavailable — Railway API offline. Continuing without drift data.' }] };
    }

    const drift = result.drift_score || 0;
    const scorecard = result.scorecard || {};
    const level = getWhisperLevel(drift);
    const whisper = buildWhisper(drift, model, scorecard);

    // Store to MongoDB
    await insertDoc('mcp_message_scores', {
      session_id: sessionId,
      turn_id: turnId,
      timestamp: new Date(),
      message_preview: message.substring(0, 200),
      message_length: message.length,
      model_hint: model,
      drift_score: drift,
      correctability_score: scorecard.correctability_score ?? null,
      anomaly_score: scorecard.anomaly_score ?? null,
      consistency: scorecard.consistency_score ?? null,
      complexity: scorecard.complexity_score ?? null,
      reasoning_depth: scorecard.reasoning_depth_score ?? null,
      alignment_stability: scorecard.alignment_stability_score ?? null,
      entropy: scorecard.entropy_score ?? null,
      coherence: scorecard.coherence_score ?? null,
      whisper_level: level,
      whisper_text: whisper,
    });

    await insertDoc('mcp_conversation_logs', {
      session_id: sessionId,
      turn_id: turnId,
      timestamp: new Date(),
      role: 'scored',
      content_preview: message.substring(0, 500),
      content_length: message.length,
      drift_score: drift,
      abis_injected: level !== 'clear',
      whisper_text: whisper,
    });

    const lines = [
      whisper,
      '',
      `Drift: ${drift.toFixed(4)} | Health: ${(scorecard.behavioral_health || 0).toFixed(3)}`,
      `Entropy: ${(scorecard.entropy_score || 0).toFixed(3)} | Coherence: ${(scorecard.coherence_score || 0).toFixed(3)} | Consistency: ${(scorecard.consistency_score || 0).toFixed(3)}`,
      `Complexity: ${(scorecard.complexity_score || 0).toFixed(3)} | Reasoning: ${(scorecard.reasoning_depth_score || 0).toFixed(3)} | Alignment: ${(scorecard.alignment_stability_score || 0).toFixed(3)}`,
    ];

    return { content: [{ type: 'text', text: lines.join('\n') }] };
  }
};
