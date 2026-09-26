import { q } from '../db.js';

export const DEFAULT_SETTINGS = {
  booking_fee_pct: 2, // convenience fee added to AI-orchestrated bookings
  marketplace_fee_pct: 20, // platform share of premium itinerary sales
  tip_fee_pct: 5, // platform share of creator tips
  free_concierge_daily: 15, // concierge requests per day on the free plan
  plus_price_monthly: 199,
  auto_promote_forks: 25, // forks needed before a free itinerary is auto-promoted to verified premium
  auto_promote_price: 149,
  default_spend_limit_booking: 15000,
  default_spend_limit_trip: 75000,
  proposal_ttl_minutes: 30,
  min_payout: 500,
  ai_enabled: true,
  ai_model: 'claude-opus-5',
  ai_effort: 'medium',
  anthropic_api_key: '', // optional; the ANTHROPIC_API_KEY env var takes precedence
  signup_open: true,
  support_whatsapp: '+91 90000 00000',
};

let cache = null;

export function getSettings() {
  if (cache) return cache;
  const rows = q.all('SELECT key, value FROM settings');
  const stored = Object.fromEntries(rows.map((r) => [r.key, JSON.parse(r.value)]));
  cache = { ...DEFAULT_SETTINGS, ...stored };
  return cache;
}

export const setting = (key) => getSettings()[key];

export function updateSettings(patch) {
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in DEFAULT_SETTINGS)) continue;
    const def = DEFAULT_SETTINGS[key];
    let v = value;
    if (typeof def === 'number') v = Number(value);
    if (typeof def === 'boolean') v = value === true || value === 'true' || value === 1;
    if (typeof def === 'string') v = String(value ?? '');
    if (typeof def === 'number' && !Number.isFinite(v)) continue;
    q.run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, JSON.stringify(v));
  }
  cache = null;
  return getSettings();
}

/** Settings safe to expose to the admin UI (masks the API key). */
export function adminSettings() {
  const s = { ...getSettings() };
  s.anthropic_api_key = s.anthropic_api_key ? '••••' + s.anthropic_api_key.slice(-4) : '';
  return s;
}
