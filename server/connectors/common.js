import crypto from 'node:crypto';
import { newId, q } from '../db.js';

// Deterministic pseudo-random generator so the same destination yields the same venues.
export function seededRandom(seed) {
  let h = 1779033703 ^ String(seed).length;
  for (let i = 0; i < String(seed).length; i++) {
    h = Math.imul(h ^ String(seed).charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export const pick = (rand, arr) => arr[Math.floor(rand() * arr.length)];
export const roundTo = (n, step = 10) => Math.max(step, Math.round(n / step) * step);

export function enabledProviders(category) {
  return q.all('SELECT * FROM providers WHERE category = ? AND enabled = 1 ORDER BY name', category);
}

export function shouldFail(provider) {
  return crypto.randomInt(0, 10_000) / 10_000 < Number(provider?.failure_rate || 0);
}

export const ref = (prefix) => `${prefix}-${newId(8).toUpperCase()}`;

// Search results are cached so the agent (or UI) can propose one by option_id.
const optionCache = new Map();
const OPTION_TTL_MS = 60 * 60 * 1000;

export function remember(option, tripId) {
  const option_id = 'opt_' + newId(10);
  const stored = { ...option, option_id };
  optionCache.set(option_id, { option: stored, tripId, expires: Date.now() + OPTION_TTL_MS });
  if (optionCache.size > 5000) {
    const t = Date.now();
    for (const [k, v] of optionCache) if (v.expires < t) optionCache.delete(k);
  }
  return stored;
}

export function recall(optionId, tripId) {
  const hit = optionCache.get(optionId);
  if (!hit || hit.expires < Date.now() || hit.tripId !== tripId) return null;
  return hit.option;
}

export const STATE_CODES = {
  Goa: 'GA', 'Himachal Pradesh': 'HP', Rajasthan: 'RJ', Uttarakhand: 'UK', 'Uttar Pradesh': 'UP', Ladakh: 'LA',
  Puducherry: 'PY', Kerala: 'KL', 'West Bengal': 'WB', Karnataka: 'KA', Delhi: 'DL', Maharashtra: 'MH',
  Meghalaya: 'ML', 'Andaman & Nicobar': 'AN', 'Tamil Nadu': 'TN',
};

export const DRIVER_NAMES = ['Ramesh Negi', 'Suresh Bisht', 'Mohit Rawat', 'Imran Khan', 'Gurpreet Singh', 'Anil Kumar', 'Joseph D’Souza', 'Rajesh Nair', 'Vikram Rathore', 'Tenzin Dorje', 'Arjun Shetty', 'Deepak Yadav'];
