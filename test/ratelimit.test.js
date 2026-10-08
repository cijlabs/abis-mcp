// Rate-limit bucket policy: paid keys are limited per key (not by the per-IP cap),
// free traffic per IP; bucket ids come from the whole key.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter, requestBuckets, tokenBucketId } from '../ratelimit.js';

const LIMITS = { ip: 60, free: 30, pro: 120, business: 200, admin: 300 };
const KEY_A = 'abis_pro_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const KEY_B = 'abis_pro_BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';

function fill(limiter, req, n) {
  let allowed = 0;
  for (let i = 0; i < n; i++) if (!limiter.exceeded(requestBuckets(req, LIMITS))) allowed++;
  return allowed;
}

test('business reaches its full 200/min from ONE IP (the per-IP cap no longer runs first)', () => {
  const rl = createRateLimiter({ now: () => 0 });
  assert.equal(fill(rl, { tier: 'business', token: KEY_A, ip: '1.2.3.4' }, 250), 200);
});

test('pro reaches 120/min from one IP', () => {
  const rl = createRateLimiter({ now: () => 0 });
  assert.equal(fill(rl, { tier: 'pro', token: KEY_A, ip: '1.2.3.4' }, 150), 120);
});

test('free is capped at 30/min per IP', () => {
  const rl = createRateLimiter({ now: () => 0 });
  assert.equal(fill(rl, { tier: 'free', token: '', ip: '1.2.3.4' }, 50), 30);
  assert.equal(fill(rl, { tier: 'free', token: '', ip: '5.6.7.8' }, 50), 30, 'another IP has its own bucket');
});

test('an invalid key gets the free (per-IP) limits, not a key bucket', () => {
  assert.deepEqual(requestBuckets({ tier: 'free', token: 'garbage', ip: '9.9.9.9' }, LIMITS).map(([k]) => k), ['ip:9.9.9.9', 'ip:9.9.9.9:free']);
});

test('keys sharing the abis_pro_ / abis_biz_ prefix get SEPARATE buckets', () => {
  assert.notEqual(tokenBucketId(KEY_A), tokenBucketId(KEY_B));
  const rl = createRateLimiter({ now: () => 0 });
  assert.equal(fill(rl, { tier: 'pro', token: KEY_A, ip: '1.1.1.1' }, 120), 120);
  assert.equal(fill(rl, { tier: 'pro', token: KEY_B, ip: '1.1.1.1' }, 120), 120, 'customer B is not throttled by customer A');
});

test('bucket keys never contain the raw API key', () => {
  for (const tier of ['pro', 'business', 'admin']) {
    for (const [k] of requestBuckets({ tier, token: KEY_A, ip: '1.1.1.1' }, LIMITS)) assert.ok(!k.includes(KEY_A.slice(9)), k);
  }
});

test('exceeded() names the bucket that tripped and the window resets', () => {
  let t = 0;
  const rl = createRateLimiter({ now: () => t, windowMs: 60_000 });
  const req = { tier: 'free', token: '', ip: '1.2.3.4' };
  for (let i = 0; i < 30; i++) assert.equal(rl.exceeded(requestBuckets(req, LIMITS)), null);
  assert.equal(rl.exceeded(requestBuckets(req, LIMITS)), 'ip:1.2.3.4:free');
  t = 60_001;
  assert.equal(rl.exceeded(requestBuckets(req, LIMITS)), null, 'new window');
});

test('free traffic also counts toward the 60/min per-IP cap', () => {
  const rl = createRateLimiter({ now: () => 0 });
  for (let i = 0; i < 59; i++) rl.hit('ip:1.2.3.4', LIMITS.ip); // e.g. /health polling
  assert.equal(rl.exceeded(requestBuckets({ tier: 'free', token: '', ip: '1.2.3.4' }, LIMITS)), null);
  assert.equal(rl.exceeded(requestBuckets({ tier: 'free', token: '', ip: '1.2.3.4' }, LIMITS)), 'ip:1.2.3.4');
});

test('store size is capped by evicting the oldest entry, not by wiping every bucket', () => {
  const rl = createRateLimiter({ now: () => 0, maxKeys: 100 });
  for (let i = 0; i < 100; i++) { rl.hit(`ip:${i}`, 1); rl.hit(`ip:${i}`, 1); } // all at their limit
  rl.hit('ip:new', 1); // store full: evicts ip:0 only
  assert.equal(rl.hit('ip:99', 1), false, 'ip:99 is still limited (old code clear()ed the store here)');
  assert.equal(rl.hit('ip:0', 1), true, 'only the oldest entry was evicted');
  for (let i = 0; i < 500; i++) rl.hit(`ip:x${i}`, 10);
  assert.ok(rl.size() <= 100);
});
