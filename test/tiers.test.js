// Run: npm test   (node --test test/tiers.test.js)
// Proves the access rules against the REAL tool set: tool names are read from
// tools/*.js and the tier sets from index.js (as text, so the server never starts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { tierFromPlan, selectTools, isToolAllowed, rateLimitFor, deniedMessage } from '../tiers.js';

const root = new URL('../', import.meta.url);
const src = readFileSync(new URL('index.js', root), 'utf8');
function setFromSource(name, spreads = {}) {
  const start = src.indexOf(`const ${name} = new Set([`);
  assert.ok(start >= 0, `${name} not found in index.js`);
  const body = src.slice(start, src.indexOf(']);', start));
  const names = new Set((body.match(/'[a-z0-9_]+'/g) || []).map(s => s.slice(1, -1)));
  for (const [spreadName, spreadSet] of Object.entries(spreads)) {
    if (body.includes(`...${spreadName}`)) for (const n of spreadSet) names.add(n);
  }
  return names;
}
const freeNames = setFromSource('FREE_TOOL_NAMES');
const proNames = setFromSource('PRO_TOOL_NAMES', { FREE_TOOL_NAMES: freeNames });
const adminOnly = setFromSource('ADMIN_ONLY_TOOLS');
const proOnly = setFromSource('PRO_ONLY_TOOLS');

// Real tool names, straight from the tool definitions
const realNames = new Set();
for (const f of readdirSync(new URL('tools/', root)).filter(f => f.endsWith('.js'))) {
  const m = readFileSync(new URL(`tools/${f}`, root), 'utf8').match(/name:\s*'(abis_[a-z0-9_]+)'/);
  if (m) realNames.add(m[1]);
}
const allTools = [...realNames].map(name => ({ name }));
const sets = { freeNames, proNames, adminOnly };

test('every name in the tier sets is a real tool (catches misspellings)', () => {
  for (const [label, s] of [['FREE', freeNames], ['PRO', proNames], ['ADMIN_ONLY', adminOnly], ['PRO_ONLY', proOnly]]) {
    for (const n of s) assert.ok(realNames.has(n), `${label} lists '${n}' but no tool has that name`);
  }
});

test('every real tool is classified as exactly customer (pro) or admin-only', () => {
  for (const n of realNames) {
    const inPro = proNames.has(n), inAdmin = adminOnly.has(n);
    assert.ok(inPro !== inAdmin, `${n} must be in exactly one of PRO_TOOL_NAMES / ADMIN_ONLY_TOOLS (pro=${inPro}, admin=${inAdmin})`);
  }
});

test('business and enterprise plans map to the business tier, never admin', () => {
  assert.equal(tierFromPlan('business'), 'business');
  assert.equal(tierFromPlan('enterprise'), 'business');
  assert.equal(tierFromPlan('pro'), 'pro');
  for (const plan of ['business', 'enterprise', 'pro', 'free', '', 'admin', undefined]) {
    assert.notEqual(tierFromPlan(plan), 'admin', `plan ${plan} must not become admin`);
  }
});

test('an active row with an unknown or non-paid plan fails closed to free', () => {
  for (const plan of ['free', 'cancelled', 'starter', '', 'admin', 'ADMIN', undefined, null, 42]) {
    assert.equal(tierFromPlan(plan), 'free', `plan ${plan}`);
  }
  assert.equal(tierFromPlan(' Pro '), 'pro', 'case/whitespace normalised');
  assert.equal(tierFromPlan('Business'), 'business');
});

test('DB keys resolve through tierFromPlan (no hard-coded admin mapping)', () => {
  const authSrc = readFileSync(new URL('auth.js', root), 'utf8');
  assert.match(authSrc, /const tier = doc \? tierFromPlan\(doc\.plan\) : 'free'/);
  assert.match(src, /createTierResolver\(/, 'index.js must resolve keys via auth.js createTierResolver');
  for (const s of [src, authSrc]) assert.doesNotMatch(s, /\?\s*'admin'\s*:\s*'pro'/);
});

test('business gets exactly the customer toolset and no admin-only tool', () => {
  const names = new Set(selectTools(allTools, 'business', sets).map(t => t.name));
  for (const a of adminOnly) assert.ok(!names.has(a), `business must not get admin tool ${a}`);
  assert.ok(!names.has('abis_api_cost_analysis'), 'cross-tenant cost analysis must be admin-only');
  for (const p of proNames) assert.ok(names.has(p), `business must get customer tool ${p}`);
  assert.equal(names.size, proNames.size);
});

test('runtime gate: admin-only tools refuse business/pro/free, allow admin', () => {
  for (const a of adminOnly) {
    for (const tier of ['business', 'pro', 'free']) assert.equal(isToolAllowed(a, tier, { adminOnly, proOnly }), false, `${a} @ ${tier}`);
    assert.equal(isToolAllowed(a, 'admin', { adminOnly, proOnly }), true);
  }
  for (const p of proOnly) {
    assert.equal(isToolAllowed(p, 'business', { adminOnly, proOnly }), true, `${p} @ business`);
    assert.equal(isToolAllowed(p, 'free', { adminOnly, proOnly }), false, `${p} @ free`);
  }
});

test('every tier only lists tools its runtime gate allows', () => {
  for (const tier of ['free', 'pro', 'business', 'admin']) {
    for (const t of selectTools(allTools, tier, sets)) {
      assert.ok(isToolAllowed(t.name, tier, { adminOnly, proOnly }), `${tier} lists ${t.name} but the gate refuses it`);
    }
  }
});

test('rate limits and denial messages', () => {
  const limits = { free: 30, pro: 120, business: 200, admin: 300 };
  assert.equal(rateLimitFor('business', limits), 200);
  assert.equal(rateLimitFor('free', limits), 30);
  assert.match(deniedMessage([...adminOnly][0], adminOnly), /internal operator tool/);
  assert.doesNotMatch(deniedMessage('x', adminOnly), /abis\.cijlabs\.com/);
  assert.match(deniedMessage('x', adminOnly), /https:\/\/cijlabs\.com\/pricing/);
});

test('admin (operator key / local stdio) still has every tool', () => {
  assert.equal(selectTools(allTools, 'admin', sets).length, realNames.size);
});
