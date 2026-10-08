// Fixed-window rate limiting and the bucket policy per request (test/ratelimit.test.js).
//
// Policy (2026-10-08): a request made with a recognised paid key (pro/business/admin)
// is limited ONLY by that key's own bucket. The per-IP cap applies to anonymous/free
// traffic. Previously the 60/min per-IP cap ran first for everyone, so Business's
// 200/min (and Pro's 120/min) could never be reached from one IP.
import { createHash } from 'node:crypto';
import { rateLimitFor } from './tiers.js';

// Bucket id from the WHOLE key. Keys are minted as 'abis_pro_…' / 'abis_biz_…', so the
// old token.substring(0, 8) put every customer on a plan into one shared bucket.
export function tokenBucketId(token) {
  return createHash('sha256').update(token).digest('hex').slice(0, 16);
}

export function requestBuckets({ tier, token, ip }, limits) {
  if (tier !== 'free' && token) return [[`key:${tokenBucketId(token)}`, rateLimitFor(tier, limits)]];
  return [[`ip:${ip}`, limits.ip], [`ip:${ip}:free`, limits.free]];
}

export function createRateLimiter({ windowMs = 60_000, maxKeys = 10_000, now = Date.now } = {}) {
  const store = new Map(); // key -> { n, t: window end }; insertion order ~ LRU
  let lastPurge = -Infinity;

  function purge() {
    const t = now();
    for (const [k, v] of store) if (t > v.t) store.delete(k);
  }

  function hit(key, limit) {
    const t = now();
    // Cap store size to prevent memory exhaustion. Evict oldest-inserted rather than
    // clear(): wiping the store reset every caller's limits, so flooding it was a bypass.
    const e = store.get(key) || { n: 0, t: t + windowMs };
    store.delete(key); // re-inserted below, so active buckets are evicted last
    if (store.size >= maxKeys) {
      if (t - lastPurge >= 1_000) { lastPurge = t; purge(); } // O(n): at most once a second
      for (const k of store.keys()) {
        if (store.size < maxKeys) break;
        store.delete(k);
      }
    }
    if (t > e.t) { e.n = 0; e.t = t + windowMs; }
    e.n++;
    store.set(key, e);
    return e.n <= limit;
  }

  // Counts the request against each bucket in order; returns the key of the first
  // bucket over its limit (later buckets are not counted), or null if all allow it.
  function exceeded(buckets) {
    for (const [key, limit] of buckets) if (!hit(key, limit)) return key;
    return null;
  }

  return { hit, exceeded, purge, size: () => store.size };
}
