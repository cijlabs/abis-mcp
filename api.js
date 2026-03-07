import { RAILWAY_URL, ABIS_ADMIN_KEY } from './config.js';

const TIMEOUT_MS = 10000;

async function fetchWithTimeout(url, options = {}, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export async function apiGet(path) {
  try {
    const res = await fetchWithTimeout(`${RAILWAY_URL}${path}`, {
      headers: { 'X-Admin-Key': ABIS_ADMIN_KEY },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  } catch (err) {
    console.error(`[ABIS API] GET ${path} failed:`, err.message);
    return null;
  }
}

export async function apiPost(path, body) {
  try {
    const res = await fetchWithTimeout(`${RAILWAY_URL}${path}`, {
      method: 'POST',
      headers: {
        'X-API-Key': ABIS_ADMIN_KEY,
        'X-Admin-Key': ABIS_ADMIN_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  } catch (err) {
    console.error(`[ABIS API] POST ${path} failed:`, err.message);
    return null;
  }
}
