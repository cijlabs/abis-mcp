// Circuit breaker: only an unhealthy backend (5xx / network / bad body) may open it.
// 409 (benchmark already running), 429 (backend rate cap) and other 4xx must not.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.RAILWAY_URL = 'http://backend.invalid';
process.env.ABIS_ADMIN_KEY = 'test-admin-key';
process.env.MONGODB_URI = '';
const { apiGet, apiPost, apiPostResult, _breaker } = await import('../api.js');
const { default: runBenchmark } = await import('../tools/runBenchmark.js');

let calls = 0;
function mockFetch(status, body) {
  globalThis.fetch = async () => {
    calls++;
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  };
}
beforeEach(() => { _breaker.reset(); calls = 0; });

for (const [status, body] of [
  [409, { detail: 'A benchmark run is already in progress. Try again later.' }],
  [429, { error: 'Rate limit exceeded: 2 per 1 minute' }],
  [404, { detail: 'Not found' }],
]) {
  test(`HTTP ${status} never opens the circuit (no retries, null to callers)`, async () => {
    mockFetch(status, body);
    for (let i = 0; i < 5; i++) assert.equal(await apiPost('/benchmark/run', {}), null);
    assert.equal(_breaker.isOpen(), false);
    assert.equal(calls, 5, '4xx is not retried');
    mockFetch(200, { ok: true });
    assert.deepEqual(await apiGet('/aggregate'), { ok: true }, 'other tools keep working');
  });
}

test('three backend failures in a row still open the circuit', async () => {
  mockFetch(200, 'not json'); // unparseable success body: counted, not retried
  for (let i = 0; i < 3; i++) assert.equal(await apiGet('/aggregate'), null);
  assert.equal(_breaker.isOpen(), true);
  mockFetch(200, { ok: true });
  assert.equal(await apiGet('/aggregate'), null, 'open circuit short-circuits');
  assert.equal(calls, 3, 'no request sent while open');
});

test('apiPostResult exposes status + detail for 409/429', async () => {
  mockFetch(409, { detail: 'A benchmark run is already in progress. Try again later.' });
  const r = await apiPostResult('/benchmark/run', {});
  assert.equal(r.ok, false);
  assert.equal(r.status, 409);
  assert.match(r.detail, /already in progress/);
});

test('abis_run_benchmark explains a 409 / 429 instead of saying "offline"', async () => {
  mockFetch(409, { detail: 'A benchmark run is already in progress. Try again later.' });
  let out = (await runBenchmark.execute({ mode: 'full' }, { sessionId: 't' })).content[0].text;
  assert.match(out, /already in progress/);
  assert.doesNotMatch(out, /offline/);

  mockFetch(429, { error: 'Rate limit exceeded: 2 per 1 minute' });
  out = (await runBenchmark.execute({ mode: 'full' }, { sessionId: 't' })).content[0].text;
  assert.match(out, /rate-limited/);
  assert.doesNotMatch(out, /offline/);

  out = (await runBenchmark.execute({ mode: 'single', model: 'gpt-4o', prompt: 'hi' }, { sessionId: 't' })).content[0].text;
  assert.match(out, /rate-limited/);
  assert.equal(_breaker.isOpen(), false);
});

test('backend error detail is never echoed to the customer', async () => {
  mockFetch(403, { detail: 'Invalid admin key for X-Admin-Key header' });
  const out = (await runBenchmark.execute({ mode: 'full' }, { sessionId: 't' })).content[0].text;
  assert.match(out, /rejected \(HTTP 403\)/);
  assert.doesNotMatch(out, /admin/i);
});

test('abis_score_message / abis_observe say "rate-limited" on a backend 429, not "offline"', async () => {
  const { default: scoreMessage } = await import('../tools/scoreMessage.js');
  const { default: observe } = await import('../tools/observe.js');
  mockFetch(429, { error: 'Rate limit exceeded: 5 per 1 minute' });
  for (const out of [
    (await scoreMessage.execute({ message: 'hi' }, { sessionId: 't' })).content[0].text,
    (await observe.execute({ response_text: 'hi', auto_simulate: false }, { sessionId: 't' })).content[0].text,
  ]) {
    assert.match(out, /rate-limited/);
    assert.doesNotMatch(out, /offline/);
  }
  assert.equal(_breaker.isOpen(), false);
});
