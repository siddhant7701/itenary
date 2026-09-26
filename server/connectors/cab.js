// Cab connector v1 (sandbox). Replace search/execute with a ride-hailing partner API.
import crypto from 'node:crypto';
import { findDestination, geocode, haversineKm } from '../data/places.js';
import { DRIVER_NAMES, STATE_CODES, enabledProviders, pick, ref, roundTo, seededRandom, shouldFail } from './common.js';

export const version = 'cab-sandbox-1.2';

const CLASSES = [
  { key: 'mini', label: 'Mini', seats: 4, perKm: 13, base: 60, model: 'WagonR or similar' },
  { key: 'sedan', label: 'Sedan', seats: 4, perKm: 16, base: 80, model: 'Dzire or similar' },
  { key: 'suv', label: 'SUV', seats: 6, perKm: 21, base: 120, model: 'Ertiga or similar' },
  { key: 'traveller', label: 'Tempo Traveller', seats: 12, perKm: 30, base: 300, model: 'Force Traveller 12-seater' },
];

const FAILURES = [
  'No drivers available near the pickup point at the requested time',
  'Driver partner could not verify the pickup address',
  'Provider API timed out after payment authorisation',
];

export function search({ pickup, drop, pickup_time, passengers = 2 }, { trip }) {
  const near = trip?.destination;
  const dest = findDestination(near);
  const fallback = dest ? { lat: dest.lat, lng: dest.lng, name: dest.name } : { lat: 28.6139, lng: 77.209, name: near || 'City centre' };
  const from = geocode(pickup, near) || { ...fallback, name: pickup || fallback.name };
  const to = geocode(drop, near) || null;
  let km = to ? haversineKm(from, to) * 1.3 : 12;
  if (km < 3) km = 3 + (to ? 0 : 5);
  const hilly = ['mountains', 'snow', 'forest'].includes(dest?.theme);
  const speed = hilly ? 24 : 32;
  const minutes = Math.round((km / speed) * 60);
  const when = pickup_time ? new Date(pickup_time) : new Date(Date.now() + 30 * 60 * 1000);
  const scheduled_at = Number.isNaN(when.getTime()) ? new Date(Date.now() + 30 * 60 * 1000).toISOString() : when.toISOString();
  const pax = Math.max(1, Math.min(12, Number(passengers) || 2));

  const options = [];
  for (const provider of enabledProviders('cab')) {
    const rand = seededRandom(`${provider.id}:${from.name}:${to?.name || drop}`);
    for (const c of CLASSES.filter((c) => c.seats >= pax)) {
      const surge = hilly ? 1.15 : 1;
      const amount = roundTo((c.base + c.perKm * km) * surge * provider.price_factor * (0.95 + rand() * 0.1));
      options.push({
        category: 'cab',
        provider_id: provider.id,
        provider_name: provider.name,
        title: `${c.label} · ${c.model}`,
        subtitle: `${from.name} → ${to?.name || drop || 'Drop'} · ${Math.round(km)} km · ~${minutes} min${hilly ? ' · hill route' : ''}`,
        scheduled_at,
        amount,
        rating: provider.rating,
        details: {
          pickup: from.name, drop: to?.name || drop || '', pickup_lat: from.lat, pickup_lng: from.lng,
          drop_lat: to?.lat ?? null, drop_lng: to?.lng ?? null, km: Math.round(km), minutes, vehicle_class: c.label,
          vehicle_model: c.model, seats: c.seats, passengers: pax,
        },
      });
    }
  }
  options.sort((a, b) => a.amount - b.amount);
  // Keep variety: cheapest per class across providers, max 4
  const seen = new Set();
  return options.filter((o) => (seen.has(o.details.vehicle_class) ? false : seen.add(o.details.vehicle_class))).slice(0, 4);
}

export function execute(booking, provider, details) {
  if (shouldFail(provider)) return { ok: false, reason: pick(Math.random, FAILURES) };
  const dest = findDestination(details.pickup) || findDestination(details.drop);
  const code = STATE_CODES[dest?.state] || 'DL';
  const plate = `${code} ${String(crypto.randomInt(1, 99)).padStart(2, '0')} ${String.fromCharCode(65 + crypto.randomInt(0, 26))}${String.fromCharCode(65 + crypto.randomInt(0, 26))} ${crypto.randomInt(1000, 9999)}`;
  return {
    ok: true,
    providerRef: ref('CAB'),
    details: {
      driver_name: pick(Math.random, DRIVER_NAMES),
      driver_phone: `+91 ${crypto.randomInt(70000, 99999)} ${crypto.randomInt(10000, 99999)}`,
      vehicle_plate: plate,
      ride_otp: String(crypto.randomInt(1000, 9999)),
      driver_rating: (4.5 + Math.random() * 0.5).toFixed(1),
    },
  };
}
