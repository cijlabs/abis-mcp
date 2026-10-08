// Public copy must match what the service actually does (owner decision 2026-10-08):
// the leaderboard benchmarks 10 models DAILY — no "real-time", "hourly" or "11 models".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const PUBLIC = ['README.md', 'server.json', 'package.json', '.claude-plugin/plugin.json'];
const BANNED = [/real[\s-]?time/i, /\bhourly\b/i, /\b11\s+(llms?|(llm\s+)?models)\b/i, /\beleven\b/i];

// The model allowlist enforced by index.js (read as text so no server starts)
const src = read('index.js');
const body = src.slice(src.indexOf('const ALLOWED_MODELS = new Set(['), src.indexOf(']);', src.indexOf('const ALLOWED_MODELS')));
const ALLOWED = (body.match(/'[a-z0-9.\-]+'/g) || []).map(s => s.slice(1, -1));

test('public files make no real-time / hourly / 11-model claims', () => {
  for (const p of PUBLIC) {
    const text = read(p);
    for (const re of BANNED) assert.doesNotMatch(text, re, `${p} matches ${re}`);
  }
});

test('tool descriptions (shown to every client) make no real-time claims', () => {
  for (const f of readdirSync(new URL('tools/', root)).filter(f => f.endsWith('.js'))) {
    const text = read(`tools/${f}`);
    for (const m of text.matchAll(/description:\s*'((?:[^'\\]|\\.)*)'/g)) {
      assert.doesNotMatch(m[1], /real[\s-]?time/i, `tools/${f}: ${m[1].slice(0, 80)}`);
      assert.doesNotMatch(m[1], /\b(8|11)\s+(monitored\s+)?(llm\s+)?models\b/i, `tools/${f}: stale model count`);
    }
  }
});

test('the model allowlist is the 10 benchmarked models, and the docs list exactly those', () => {
  assert.equal(ALLOWED.length, 10);
  const plugin = JSON.parse(read('.claude-plugin/plugin.json'));
  assert.deepEqual([...plugin.models_monitored].sort(), [...ALLOWED].sort());
  const readme = read('README.md');
  const table = readme.slice(readme.indexOf('## Models Benchmarked'), readme.indexOf('## Try It'));
  const listed = [...table.matchAll(/\|\s*\*\*[A-Za-z]+\*\*\s*\|\s*([^|]+)\|/g)].flatMap(m => m[1].split(',').map(s => s.trim()));
  assert.deepEqual(listed.sort(), [...ALLOWED].sort());
});

test('server.json description fits the MCP registry limit (maxLength 100)', () => {
  assert.ok(JSON.parse(read('server.json')).description.length <= 100);
});

test('plugin.json advertises customer tiers only (no admin tier)', () => {
  const plugin = JSON.parse(read('.claude-plugin/plugin.json'));
  assert.deepEqual(Object.keys(plugin.tiers).sort(), ['business', 'free', 'pro']);
  assert.equal(plugin.tiers.business.tools, 27);
  assert.equal(plugin.tool_count, 27);
});
