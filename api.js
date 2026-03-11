import { RAILWAY_URL, ABIS_ADMIN_KEY } from './config.js';

const TIMEOUT_MS_GET = 10000;
const TIMEOUT_MS_POST = 30000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

// Circuit breaker state
let _failCount = 0;
let _lastFailTime = 0;
const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_WINDOW_MS = 30000;

function isCircuitOpen() {
  if (_failCount >= CIRCUIT_BREAKER_THRESHOLD) {
    if (Date.now() - _lastFailTime < CIRCUIT_BREAKER_WINDOW_MS) return true;
    _failCount = 0; // Reset after window
  }
  return false;
}

function recordFailure() {
  _failCount++;
  _lastFailTime = Date.now();
}

function recordSuccess() {
  _failCount = 0;
}

async function fetchWithTimeout(url, options = {}, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function apiGet(path) {
  if (isCircuitOpen()) {
    console.error(`[ABIS API] Circuit open — skipping GET ${path}`);
    return null;
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetchWithTimeout(`${RAILWAY_URL}${path}`, {
        headers: { 'X-API-Key': ABIS_ADMIN_KEY, 'X-Admin-Key': ABIS_ADMIN_KEY },
      }, TIMEOUT_MS_GET);

      if (res.status >= 500 && attempt < MAX_RETRIES) {
        console.error(`[ABIS API] GET ${path} — ${res.status}, retry ${attempt + 1}/${MAX_RETRIES}`);
        await sleep(RETRY_DELAY_MS * (attempt + 1));
        continue;
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

      let data;
      try { data = await res.json(); } catch (e) {
        throw new Error(`JSON parse failed: ${e.message}`);
      }

      recordSuccess();
      return data;
    } catch (err) {
      if (attempt < MAX_RETRIES && (err.name === 'AbortError' || err.message.includes('fetch'))) {
        console.error(`[ABIS API] GET ${path} — ${err.message}, retry ${attempt + 1}/${MAX_RETRIES}`);
        await sleep(RETRY_DELAY_MS * (attempt + 1));
        continue;
      }
      console.error(`[ABIS API] GET ${path} failed:`, err.message);
      recordFailure();
      return null;
    }
  }
  return null;
}

export async function apiPost(path, body) {
  if (isCircuitOpen()) {
    console.error(`[ABIS API] Circuit open — skipping POST ${path}`);
    return null;
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetchWithTimeout(`${RAILWAY_URL}${path}`, {
        method: 'POST',
        headers: {
          'X-API-Key': ABIS_ADMIN_KEY,
          'X-Admin-Key': ABIS_ADMIN_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }, TIMEOUT_MS_POST);

      if (res.status >= 500 && attempt < MAX_RETRIES) {
        console.error(`[ABIS API] POST ${path} — ${res.status}, retry ${attempt + 1}/${MAX_RETRIES}`);
        await sleep(RETRY_DELAY_MS * (attempt + 1));
        continue;
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

      let data;
      try { data = await res.json(); } catch (e) {
        throw new Error(`JSON parse failed: ${e.message}`);
      }

      recordSuccess();
      return data;
    } catch (err) {
      if (attempt < MAX_RETRIES && (err.name === 'AbortError' || err.message.includes('fetch'))) {
        console.error(`[ABIS API] POST ${path} — ${err.message}, retry ${attempt + 1}/${MAX_RETRIES}`);
        await sleep(RETRY_DELAY_MS * (attempt + 1));
        continue;
      }
      console.error(`[ABIS API] POST ${path} failed:`, err.message);
      recordFailure();
      return null;
    }
  }
  return null;
}
