// Experiences connector: bookable local events & activities from the event finder.
import crypto from 'node:crypto';
import { findDestination, haversineKm } from '../data/places.js';
import { q } from '../db.js';
import { enabledProviders, ref, shouldFail } from './common.js';

export const version = 'experience-1.0';

export function search({ city, from, to, category, quantity = 2 }, { trip }) {
  const dest = findDestination(city) || findDestination(trip?.destination);
  const provider = enabledProviders('experience')[0];
  if (!provider) return [];
  const start = from || trip?.start_date || new Date().toISOString().slice(0, 10);
  const end = to || trip?.end_date || '9999-12-31';
  const rows = q.all(
    `SELECT * FROM events WHERE status = 'active' AND date(start_at) >= date(?) AND date(start_at) <= date(?)
     AND (? IS NULL OR category = ?) ORDER BY start_at LIMIT 200`,
    start, end, category || null, category || null,
  );
  // Same city, or within ~40 km of the destination (e.g. Bhimtal events for a Nainital trip)
  const nearby = dest
    ? rows.filter((e) => e.city.toLowerCase() === dest.name.toLowerCase() || (e.lat != null && haversineKm(dest, { lat: e.lat, lng: e.lng }) <= 40))
    : rows;
  return nearby.slice(0, 6).map((e) => eventOption(e, provider, quantity));
}

export function eventOption(e, provider, quantity = 2) {
  const qty = Math.max(1, Math.min(10, Number(quantity) || 1));
  return {
    category: 'experience',
    provider_id: provider.id,
    provider_name: provider.name,
    title: e.title,
    subtitle: `${e.venue ? e.venue + ', ' : ''}${e.city} · ${qty} ticket${qty > 1 ? 's' : ''}`,
    scheduled_at: e.start_at,
    amount: e.price * qty,
    rating: provider.rating,
    details: { event_id: e.id, venue: e.venue, city: e.city, quantity: qty, unit_price: e.price, category: e.category, lat: e.lat, lng: e.lng },
  };
}

export function execute(booking, provider, details) {
  const ev = q.get('SELECT * FROM events WHERE id = ?', details.event_id);
  if (!ev || ev.status !== 'active') return { ok: false, reason: 'This event is no longer available' };
  if (ev.booked_count + details.quantity > ev.capacity) return { ok: false, reason: 'Event sold out before your tickets could be issued' };
  if (shouldFail(provider)) return { ok: false, reason: 'Organiser ticketing system did not respond' };
  q.run('UPDATE events SET booked_count = booked_count + ? WHERE id = ?', details.quantity, ev.id);
  return { ok: true, providerRef: ref('TIX'), details: { ticket_code: `TC-${crypto.randomInt(10000000, 99999999)}` } };
}
