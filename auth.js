// API key -> tier resolution, and re-resolution for live SSE sessions.
// Pure factory (injected lookup + clock) so it can be unit-tested (test/auth.test.js).
//
// 2026-10-08: a key's tier used to be cached for 5 min AND frozen into an open SSE
// session until it disconnected, so a deactivated or downgraded key kept working.
// Now the cache is short and every POST /messages re-resolves the session's key
// (refreshSessionTier), so a key whose DB row is no longer active drops to 'free'
// within ttlHitMs.
import { timingSafeEqual } from 'node:crypto';
import { tierFromPlan } from './tiers.js';

export function safeCompare(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch { return false; }
}

// lookup(token) -> the ACTIVE key row ({ plan }) or null; throws when the DB is unreachable.
export function createTierResolver({
  lookup,
  adminKey = '',
  proKey = '',
  ttlHitMs = 30_000,   // a paid key is re-checked against the DB at least this often
  ttlFreeMs = 60_000,  // unknown/inactive keys: short, so a new activation propagates fast
  ttlErrorMs = 10_000, // lookup failed with nothing to fall back on: retry soon after recovery
  graceMs = 300_000,   // DB outage: keep the last DB-confirmed PAID tier this long after confirmation
  maxEntries = 50_000, // tokens are client-chosen headers, so the cache must be bounded
  lookupTimeoutMs = 8_000, // a hung query must not pin a key (every POST of its sessions waits on it)
  now = Date.now,
  onError = () => {},
  onPlanRejected = () => {}, // an ACTIVE row whose plan is not a paid plan (resolved to free)
} = {}) {
  const cache = new Map();    // token -> { tier, exp, verifiedAt }; insertion order ~ LRU
  const inflight = new Map(); // token -> pending lookup (one DB query per key at a time)
  let lastPurge = -Infinity;

  function envTier(token) {
    if (adminKey && safeCompare(token, adminKey)) return 'admin';
    if (proKey && safeCompare(token, proKey)) return 'pro';
    return null;
  }

  const inGrace = (e, t) => e.tier !== 'free' && e.verifiedAt !== undefined && t - e.verifiedAt < graceMs;

  function purge() {
    const t = now();
    // Expired entries go, except paid ones still inside their outage grace window.
    for (const [k, v] of cache) if (t > v.exp && !inGrace(v, t)) cache.delete(k);
  }

  function store(token, entry) {
    cache.delete(token); // re-insert so recently refreshed keys are evicted last
    if (cache.size >= maxEntries) {
      const t = now();
      if (t - lastPurge >= 1_000) { lastPurge = t; purge(); } // O(n): at most once a second
      // Still full: evict least-recently-stored. Losing an entry only costs a fresh lookup.
      for (const k of cache.keys()) {
        if (cache.size < maxEntries) break;
        cache.delete(k);
      }
    }
    cache.set(token, entry);
  }

  function lookupWithTimeout(token) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`key lookup timed out after ${lookupTimeoutMs}ms`)), lookupTimeoutMs);
    });
    return Promise.race([Promise.resolve().then(() => lookup(token)), timeout]).finally(() => clearTimeout(timer));
  }

  // Tier known WITHOUT touching the DB (env key or fresh cache entry), else null.
  // Lets callers rate-limit unknown tokens before paying for a DB lookup.
  function peek(token) {
    if (!token) return 'free';
    const env = envTier(token);
    if (env) return env;
    const c = cache.get(token);
    return c && now() < c.exp ? c.tier : null;
  }

  async function lookupAndCache(token) {
    const t = now();
    const prev = cache.get(token);
    let doc;
    try {
      doc = await lookupWithTimeout(token);
    } catch (err) {
      onError(err);
      // We cannot see a deactivation while the DB is down, so keep the last PAID tier
      // the DB confirmed, but only for graceMs after that confirmation. Then fail closed.
      if (prev && inGrace(prev, t)) {
        store(token, { ...prev, exp: Math.min(t + ttlHitMs, prev.verifiedAt + graceMs) });
        return prev.tier;
      }
      store(token, { tier: 'free', exp: t + ttlErrorMs, verifiedAt: prev?.verifiedAt });
      return 'free';
    }

    // Not found, inactive or not a paid plan -> free. business/enterprise -> 'business' (never 'admin').
    const tier = doc ? tierFromPlan(doc.plan) : 'free';
    if (doc && tier === 'free') onPlanRejected(doc.plan);
    store(token,{ tier, exp: t + (tier === 'free' ? ttlFreeMs : ttlHitMs), verifiedAt: t });
    return tier;
  }

  async function resolve(token) {
    const known = peek(token);
    if (known) return known;
    // Concurrent requests for the same key share one lookup (and cannot race to
    // overwrite each other's result).
    const pending = inflight.get(token);
    if (pending) return pending;
    const p = lookupAndCache(token).finally(() => inflight.delete(token));
    inflight.set(token, p);
    return p;
  }

  return { resolve, peek, purge, size: () => cache.size };
}

// Re-resolve a live session's key and record the new tier on the session.
// onChange(from, to) fires only when the tier actually changed.
export async function refreshSessionTier(session, resolve, onChange = () => {}) {
  const tier = await resolve(session.token);
  if (tier !== session.tier) {
    const from = session.tier;
    session.tier = tier;
    onChange(from, tier);
  }
  return tier;
}
