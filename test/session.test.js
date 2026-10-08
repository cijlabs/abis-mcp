// A LIVE session follows its key: index.js's createMCPServer + refreshLiveSession,
// driven through a real MCP client over an in-memory transport.
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.ABIS_MCP_NO_AUTOSTART = '1';
process.env.RAILWAY_URL = 'http://backend.invalid'; // no test path may reach the real backend
process.env.ABIS_ADMIN_KEY = '';
process.env.MCP_PRO_KEY = '';
process.env.MONGODB_URI = '';
const { createMCPServer, refreshLiveSession } = await import('../index.js');
const { createTierResolver } = await import('../auth.js');
const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js');
const { ToolListChangedNotificationSchema } = await import('@modelcontextprotocol/sdk/types.js');

async function setup(row) {
  const rows = { k: row };
  const c = { t: 1_000_000 };
  const resolver = createTierResolver({
    lookup: async (token) => (rows[token]?.active ? { plan: rows[token].plan } : null),
    now: () => c.t, ttlHitMs: 30_000, ttlFreeMs: 60_000, graceMs: 300_000,
  });
  const session = { id: 'test', token: 'k', tier: await resolver.resolve('k') };
  session.server = createMCPServer(() => session.tier);

  const client = new Client({ name: 'test', version: '1.0.0' });
  let listChanged = 0;
  client.setNotificationHandler(ToolListChangedNotificationSchema, () => { listChanged++; });
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  await session.server.connect(serverT);
  await client.connect(clientT);

  return {
    rows, session, client, listChanged: () => listChanged,
    advance: (ms) => { c.t += ms; },
    refresh: () => refreshLiveSession(session, resolver.resolve),
    names: async () => new Set((await client.listTools()).tools.map(t => t.name)),
    call: async (name, args) => (await client.callTool({ name, arguments: args })).content[0].text,
  };
}
const settle = () => new Promise(r => setTimeout(r, 20));

test('deactivating a Business key on an OPEN session drops it to free', async () => {
  const s = await setup({ plan: 'business', active: true });
  assert.equal(s.session.tier, 'business');
  assert.equal((await s.names()).size, 27);
  // Pro tool passes the tier gate (fails later on input validation, so nothing executes)
  assert.match(await s.call('abis_score_message', { model: 'no-such-model' }), /Input validation failed/);

  s.rows.k.active = false;
  s.advance(30_001);
  assert.equal(await s.refresh(), 'free');
  await settle();

  assert.equal(s.listChanged(), 1, 'client told to re-list tools');
  const names = await s.names();
  assert.equal(names.size, 15);
  assert.ok(!names.has('abis_score_message'));
  assert.match(await s.call('abis_score_message', { model: 'no-such-model' }), /requires a Pro or Business plan/);
  await s.client.close();
});

test('downgrade Business -> Pro on an open session; no notification when nothing changed', async () => {
  const s = await setup({ plan: 'business', active: true });
  assert.equal(await s.refresh(), 'business');
  await settle();
  assert.equal(s.listChanged(), 0);

  s.rows.k.plan = 'pro';
  s.advance(30_001);
  assert.equal(await s.refresh(), 'pro');
  assert.equal(s.session.tier, 'pro');
  await settle();
  assert.equal(s.listChanged(), 1);
  await s.client.close();
});

test('a refresh failure fails closed to free', async () => {
  const s = await setup({ plan: 'pro', active: true });
  assert.equal(await refreshLiveSession(s.session, async () => { throw new Error('boom'); }), 'free');
  assert.equal(s.session.tier, 'free');
  assert.equal((await s.names()).size, 15);
  await s.client.close();
});

test('model_hint (sent to the backend as the model to run) is held to the allowlist', async () => {
  const s = await setup({ plan: 'pro', active: true });
  assert.match(await s.call('abis_score_message', { message: 'hi', model_hint: 'gpt-5.4-pro' }), /Input validation failed.*Unknown model 'gpt-5.4-pro'/);
  await s.client.close();
});

test('admin-only tools stay refused for every customer tier on a live session', async () => {
  const s = await setup({ plan: 'enterprise', active: true });
  assert.equal(s.session.tier, 'business');
  assert.match(await s.call('abis_baseline_recalibrate', {}), /internal operator tool/);
  await s.client.close();
});
