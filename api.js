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

// FastAPI puts the reason in {detail}, the rate limiter in {error}.
async function readDetail(res) {
  try {
    const body = await res.json();
    const d = body?.detail ?? body?.error;
    return typeof d === 'string' ? d.slice(0, 200) : '';
  } catch { return ''; }
}

// Only an UNHEALTHY backend may open the circuit: 5xx, timeouts, network errors and
// unparseable success bodies. A 4xx means the backend answered (409 = a benchmark run is
// already in progress, 429 = backend rate cap, 404 = no data for that model), so it is
// never counted: three of them in 30s used to disable every tool for every user.
// Returns { ok, status, data, detail?, circuitOpen? }.
async function request(method, path, body) {
  if (isCircuitOpen()) {
    console.error(`[ABIS API] Circuit open — skipping ${method} ${path}`);
    return { ok: false, status: 0, data: null, circuitOpen: true };
  }

  const isPost = method === 'POST';
  const options = isPost
    ? {
        method: 'POST',
        headers: {
          'X-API-Key': ABIS_ADMIN_KEY,
          'X-Admin-Key': ABIS_ADMIN_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    : { headers: { 'X-API-Key': ABIS_ADMIN_KEY, 'X-Admin-Key': ABIS_ADMIN_KEY } };

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetchWithTimeout(`${RAILWAY_URL}${path}`, options, isPost ? TIMEOUT_MS_POST : TIMEOUT_MS_GET);

      if (res.status >= 500 && attempt < MAX_RETRIES) {
        console.error(`[ABIS API] ${method} ${path} — ${res.status}, retry ${attempt + 1}/${MAX_RETRIES}`);
        await sleep(RETRY_DELAY_MS * (attempt + 1));
        continue;
      }

      if (res.status >= 400 && res.status < 500) {
        const detail = await readDetail(res);
        console.error(`[ABIS API] ${method} ${path} — HTTP ${res.status}${detail ? `: ${detail}` : ''} (not counted toward the circuit breaker)`);
        return { ok: false, status: res.status, data: null, detail };
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

      let data;
      try { data = await res.json(); } catch (e) {
        throw new Error(`JSON parse failed: ${e.message}`);
      }

      recordSuccess();
      return { ok: true, status: res.status, data };
    } catch (err) {
      if (attempt < MAX_RETRIES && (err.name === 'AbortError' || err.message.includes('fetch'))) {
        console.error(`[ABIS API] ${method} ${path} — ${err.message}, retry ${attempt + 1}/${MAX_RETRIES}`);
        await sleep(RETRY_DELAY_MS * (attempt + 1));
        continue;
      }
      console.error(`[ABIS API] ${method} ${path} failed:`, err.message);
      recordFailure();
      return { ok: false, status: 0, data: null };
    }
  }
  return { ok: false, status: 0, data: null };
}

// Data on success, null on any failure (callers treat null as "unavailable").
export async function apiGet(path) {
  return (await request('GET', path)).data;
}

export async function apiPost(path, body) {
  return (await request('POST', path, body)).data;
}

// Full result, for callers that must tell "busy / rate-limited" (409/429) from "offline".
export async function apiPostResult(path, body) {
  return request('POST', path, body);
}

// Test hooks for the circuit-breaker state.
export const _breaker = {
  isOpen: isCircuitOpen,
  reset() { _failCount = 0; _lastFailTime = 0; },
};
