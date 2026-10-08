// End-to-end over real HTTP/SSE: spawns `node index.js` (no DB, fake backend URL) and
// drives it with the MCP SDK client. Proves the rate-limit ORDER in index.js's routing:
// a paid key gets more than the 60/min per-IP cap from one IP; free is held to 30/min.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

const PRO_KEY = 'test_pro_key_e2e_0123456789';
const PORT = 40_000 + Math.floor(Math.random() * 20_000);
const BASE = `http://127.0.0.1:${PORT}`;
let child;
let logs = '';

before(async () => {
  const env = { ...process.env, PORT: String(PORT), MONGODB_URI: '', MCP_PRO_KEY: PRO_KEY, ABIS_ADMIN_KEY: '', RAILWAY_URL: 'http://127.0.0.1:9' };
  delete env.RAILWAY_ENVIRONMENT;
  delete env.ABIS_MCP_NO_AUTOSTART;
  child = spawn(process.execPath, [fileURLToPath(new URL('../index.js', import.meta.url))], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', d => { logs += d; });
  child.stderr.on('data', d => { logs += d; });
  const deadline = Date.now() + 15_000;
  while (!logs.includes('running on')) {
    if (Date.now() > deadline || child.exitCode !== null) throw new Error(`server did not start:\n${logs}`);
    await new Promise(r => setTimeout(r, 100));
  }
});
after(() => { child?.kill(); });

async function connect(token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const client = new Client({ name: 'e2e', version: '1.0.0' });
  await client.connect(new SSEClientTransport(new URL(`${BASE}/sse`), { requestInit: { headers } }));
  return client;
}

test('a malformed request line (GET //) gets 400 and does NOT crash the server', async () => {
  const { connect: netConnect } = await import('node:net');
  const status = await new Promise((resolve, reject) => {
    const s = netConnect(PORT, '127.0.0.1', () => s.write('GET // HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n'));
    let buf = '';
    s.on('data', d => { buf += d; });
    s.on('close', () => resolve(buf.split('\r\n')[0]));
    s.on('error', reject);
  });
  assert.match(status, /^HTTP\/1\.1 400/);
  assert.equal((await fetch(`${BASE}/health`)).status, 200, 'server still up');
  assert.equal(child.exitCode, null);
});

test('/health reports the customer tiers', async () => {
  const body = await (await fetch(`${BASE}/health`)).json();
  assert.deepEqual(body.tiers, { free: 15, pro: 27, business: 27 });
});

test('pro key: 27 tools and 100 messages/min from one IP (above the 60/min per-IP cap)', async () => {
  const client = await connect(PRO_KEY);
  assert.equal((await client.listTools()).tools.length, 27);
  for (let i = 0; i < 100; i++) await client.ping(); // would 429 at ~60 before this change
  await client.close();
});

test('no key: 15 tools and held to 30 messages/min', async () => {
  const client = await connect('');
  assert.equal((await client.listTools()).tools.length, 15);
  let ok = 0;
  let limited = null;
  for (let i = 0; i < 40; i++) {
    try { await client.ping(); ok++; } catch (err) { limited = err; break; }
  }
  assert.ok(limited, 'free tier must hit its limit');
  assert.match(String(limited.message), /429/);
  assert.ok(ok < 30, `free got ${ok} pings after initialize + listTools`);
  await client.close();
});
