// Key -> tier resolution: deactivation, downgrade, cache bounds, DB-outage grace.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTierResolver, refreshSessionTier, safeCompare } from '../auth.js';

// Fake mcp_api_keys: lookup returns the row only while it is active (like the real query).
function fakeDb(rows = {}) {
  const db = { rows, calls: 0, down: false };
  db.lookup = async (token) => {
    db.calls++;
    if (db.down) throw new Error('db down');
    const r = db.rows[token];
    return r && r.active ? { plan: r.plan } : null;
  };
  return db;
}
function clock(start = 1_000_000) {
  const c = { t: start };
  c.now = () => c.t;
  c.advance = (ms) => { c.t += ms; };
  return c;
}
function resolver(db, c, extra = {}) {
  return createTierResolver({ lookup: db.lookup, now: c.now, ttlHitMs: 30_000, ttlFreeMs: 60_000, graceMs: 300_000, ...extra });
}

test('a deactivated key drops to free once its 30s cache entry expires', async () => {
  const db = fakeDb({ k_biz: { plan: 'business', active: true } });
  const c = clock();
  const r = resolver(db, c);
  assert.equal(await r.resolve('k_biz'), 'business');

  db.rows.k_biz.active = false;
  c.advance(29_000);
  assert.equal(await r.resolve('k_biz'), 'business', 'still inside the 30s cache bound');
  c.advance(2_000);
  assert.equal(await r.resolve('k_biz'), 'free', 'inactive row must resolve to free');
});

test('a downgraded key (business -> pro) takes its new tier after the cache bound', async () => {
  const db = fakeDb({ k: { plan: 'business', active: true } });
  const c = clock();
  const r = resolver(db, c);
  assert.equal(await r.resolve('k'), 'business');
  db.rows.k.plan = 'pro';
  c.advance(30_001);
  assert.equal(await r.resolve('k'), 'pro');
});

test('cache bounds DB load: one lookup per key per TTL', async () => {
  const db = fakeDb({ k: { plan: 'pro', active: true } });
  const c = clock();
  const r = resolver(db, c);
  for (let i = 0; i < 50; i++) await r.resolve('k');
  assert.equal(db.calls, 1);
  c.advance(30_001);
  await r.resolve('k');
  assert.equal(db.calls, 2);
});

test('unknown keys are free; activation propagates after the 60s free TTL', async () => {
  const db = fakeDb({});
  const c = clock();
  const r = resolver(db, c);
  assert.equal(await r.resolve('k_new'), 'free');
  db.rows.k_new = { plan: 'pro', active: true };
  c.advance(59_000);
  assert.equal(await r.resolve('k_new'), 'free');
  c.advance(2_000);
  assert.equal(await r.resolve('k_new'), 'pro');
});

test('no token is free; env keys bypass the DB', async () => {
  const db = fakeDb({});
  const r = resolver(db, clock(), { adminKey: 'ADMINKEY123', proKey: 'PROKEY12345' });
  assert.equal(await r.resolve(''), 'free');
  assert.equal(await r.resolve(undefined), 'free');
  assert.equal(await r.resolve('ADMINKEY123'), 'admin');
  assert.equal(await r.resolve('PROKEY12345'), 'pro');
  assert.equal(db.calls, 0);
});

test('business/enterprise plan rows never resolve to admin', async () => {
  const db = fakeDb({ b: { plan: 'business', active: true }, e: { plan: 'enterprise', active: true }, a: { plan: 'admin', active: true } });
  const r = resolver(db, clock());
  assert.equal(await r.resolve('b'), 'business');
  assert.equal(await r.resolve('e'), 'business');
  assert.notEqual(await r.resolve('a'), 'admin');
});

test('DB outage: last confirmed tier is kept only within the grace window, then free', async () => {
  const db = fakeDb({ k: { plan: 'business', active: true } });
  const errors = [];
  const c = clock();
  const r = resolver(db, c, { onError: (e) => errors.push(e.message) });
  assert.equal(await r.resolve('k'), 'business'); // confirmed at t0

  db.down = true;
  c.advance(31_000);
  assert.equal(await r.resolve('k'), 'business', 'inside grace: keep last confirmed tier');
  c.advance(240_000); // t0 + 271s
  assert.equal(await r.resolve('k'), 'business');
  c.advance(30_000); // t0 + 301s: grace over
  assert.equal(await r.resolve('k'), 'free', 'grace expired: fail closed');
  assert.ok(errors.length >= 2);

  db.down = false;
  c.advance(60_001);
  assert.equal(await r.resolve('k'), 'business', 'DB back: re-confirmed');
});

test('DB outage with no prior confirmation is free (never grants a paid tier), retried after 10s', async () => {
  const db = fakeDb({ k: { plan: 'business', active: true } });
  db.down = true;
  const c = clock();
  const r = resolver(db, c, { onError: () => {} });
  assert.equal(await r.resolve('k'), 'free');
  db.down = false;
  c.advance(10_001); // e.g. a restart during a Mongo blip: paying keys recover in ~10s, not 60s
  assert.equal(await r.resolve('k'), 'business');
});

test('concurrent resolves of one key share a single DB lookup', async () => {
  const db = fakeDb({ k: { plan: 'pro', active: true } });
  const r = resolver(db, clock());
  const tiers = await Promise.all(Array.from({ length: 20 }, () => r.resolve('k')));
  assert.deepEqual(new Set(tiers), new Set(['pro']));
  assert.equal(db.calls, 1);
});

test('the cache is bounded against floods of junk tokens', async () => {
  const db = fakeDb({});
  const r = resolver(db, clock(), { maxEntries: 100 });
  for (let i = 0; i < 500; i++) await r.resolve(`junk_${i}`);
  assert.ok(r.size() <= 100, `size ${r.size()}`);
});

test('free / unknown tokens are dropped at expiry (no 5-minute grace retention)', async () => {
  const db = fakeDb({});
  const c = clock();
  const r = resolver(db, c);
  await r.resolve('junk');
  c.advance(60_001);
  r.purge();
  assert.equal(r.size(), 0);
});

test('an active row with a non-paid plan resolves to free and is reported', async () => {
  const db = fakeDb({ k: { plan: 'free', active: true }, m: { active: true }, p: { plan: 'pro', active: true } });
  const rejected = [];
  const r = resolver(db, clock(), { onPlanRejected: (plan) => rejected.push(plan) });
  assert.equal(await r.resolve('k'), 'free');
  assert.equal(await r.resolve('m'), 'free', 'missing plan');
  assert.equal(await r.resolve('p'), 'pro');
  assert.deepEqual(rejected, ['free', undefined]);
});

test('a hung DB lookup times out into the outage path instead of pinning the key', async () => {
  const r = createTierResolver({ lookup: () => new Promise(() => {}), lookupTimeoutMs: 50, onError: () => {} });
  const t0 = Date.now();
  assert.equal(await r.resolve('k'), 'free');
  assert.ok(Date.now() - t0 < 2_000);
});

test('a recently refreshed key is evicted last when the cache is full', async () => {
  const db = fakeDb({ hot: { plan: 'business', active: true } });
  const c = clock();
  const r = resolver(db, c, { maxEntries: 10 });
  await r.resolve('hot');
  for (let i = 0; i < 9; i++) await r.resolve(`junk_${i}`);
  c.advance(30_001);
  await r.resolve('hot'); // re-checked: moves to the newest position
  for (let i = 9; i < 14; i++) await r.resolve(`junk_${i}`);
  const calls = db.calls;
  assert.equal(r.peek('hot'), 'business', 'hot key still cached');
  assert.equal(db.calls, calls);
});

test('a key deactivated just before an outage stays free during the outage', async () => {
  const db = fakeDb({ k: { plan: 'business', active: true } });
  const c = clock();
  const r = resolver(db, c, { onError: () => {} });
  await r.resolve('k');
  db.rows.k.active = false;
  c.advance(30_001);
  assert.equal(await r.resolve('k'), 'free'); // DB confirmed the deactivation
  db.down = true;
  c.advance(60_001);
  assert.equal(await r.resolve('k'), 'free', 'grace keeps the last CONFIRMED tier, which is free');
});

test('peek never touches the DB and only reports known tiers', async () => {
  const db = fakeDb({ k: { plan: 'pro', active: true } });
  const c = clock();
  const r = resolver(db, c, { proKey: 'PROKEY12345' });
  assert.equal(r.peek(''), 'free');
  assert.equal(r.peek('PROKEY12345'), 'pro');
  assert.equal(r.peek('k'), null, 'unknown until resolved');
  await r.resolve('k');
  assert.equal(r.peek('k'), 'pro');
  c.advance(30_001);
  assert.equal(r.peek('k'), null, 'expired entries are not trusted');
  assert.equal(db.calls, 1);
});

test('purge drops expired entries but keeps those still inside the outage grace window', async () => {
  const db = fakeDb({ k: { plan: 'pro', active: true } });
  const c = clock();
  const r = resolver(db, c);
  await r.resolve('k');
  c.advance(31_000);
  r.purge();
  assert.equal(r.size(), 1, 'kept: still inside grace');
  c.advance(300_000);
  r.purge();
  assert.equal(r.size(), 0);
});

test('refreshSessionTier updates the session and reports only real changes', async () => {
  const db = fakeDb({ k: { plan: 'business', active: true } });
  const c = clock();
  const r = resolver(db, c);
  const session = { token: 'k', tier: await r.resolve('k') };
  const changes = [];
  const onChange = (from, to) => changes.push(`${from}->${to}`);

  assert.equal(await refreshSessionTier(session, r.resolve, onChange), 'business');
  assert.deepEqual(changes, []);

  db.rows.k.active = false;
  c.advance(30_001);
  assert.equal(await refreshSessionTier(session, r.resolve, onChange), 'free');
  assert.equal(session.tier, 'free');
  assert.deepEqual(changes, ['business->free']);
});

test('safeCompare', () => {
  assert.equal(safeCompare('abc', 'abc'), true);
  assert.equal(safeCompare('abc', 'abd'), false);
  assert.equal(safeCompare('abc', 'abcd'), false);
  assert.equal(safeCompare('', ''), false);
});
