import crypto from 'node:crypto';
import { insert, newId, now, parseJson, q, tx, update } from '../db.js';
import { findDestination, themeFor } from '../data/places.js';
import { forbidden, notFound, badRequest } from '../lib/http.js';
import { publicUser } from '../lib/auth.js';
import { setting } from './settings.js';

export function inviteCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += alphabet[crypto.randomInt(0, alphabet.length)];
  return code;
}

export function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function dayCount(start, end) {
  return Math.max(1, Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1);
}

/** Load a trip and check the user is a member. Admins can read any trip. */
export function requireMember(tripId, user, { owner = false } = {}) {
  const trip = q.get('SELECT * FROM trips WHERE id = ?', tripId);
  if (!trip) throw notFound('Trip not found');
  const member = q.get('SELECT * FROM trip_members WHERE trip_id = ? AND user_id = ?', tripId, user.id);
  if (!member) throw forbidden('You are not a member of this trip');
  if (owner && member.role !== 'owner') throw forbidden('Only the trip owner can do that');
  return { trip, member };
}

export function touchTrip(tripId) {
  q.run('UPDATE trips SET updated_at = ? WHERE id = ?', now(), tripId);
}

export function memberIds(tripId) {
  return q.all('SELECT user_id FROM trip_members WHERE trip_id = ?', tripId).map((r) => r.user_id);
}

export function listMembers(tripId) {
  return q
    .all(
      `SELECT u.*, m.role AS member_role, m.vibe, m.share_location, m.joined_at FROM trip_members m JOIN users u ON u.id = m.user_id
       WHERE m.trip_id = ? ORDER BY CASE m.role WHEN 'owner' THEN 0 ELSE 1 END, m.joined_at`,
      tripId,
    )
    .map((r) => ({ ...publicUser(r), user_id: r.id, role: r.member_role, vibe: r.vibe, share_location: !!r.share_location, joined_at: r.joined_at, phone: r.phone }));
}

export function recomputeVibe(tripId) {
  const avg = q.value('SELECT AVG(vibe) FROM trip_members WHERE trip_id = ?', tripId);
  const score = Math.round(avg ?? 50);
  q.run('UPDATE trips SET vibe_score = ? WHERE id = ?', score, tripId);
  return score;
}

export function serializeItem(i) {
  return i ? { ...i, added_by_agent: !!i.added_by_agent } : i;
}

export function loadDays(tripId) {
  const days = q.all('SELECT * FROM itinerary_days WHERE trip_id = ? ORDER BY day_number', tripId);
  const items = q.all('SELECT * FROM itinerary_items WHERE trip_id = ? ORDER BY position, created_at', tripId);
  return days.map((d) => ({ ...d, items: items.filter((i) => i.day_id === d.id).map(serializeItem) }));
}

export function loadPolls(tripId) {
  const polls = q.all('SELECT * FROM polls WHERE trip_id = ? ORDER BY closed, created_at DESC', tripId);
  if (!polls.length) return [];
  const options = q.all(`SELECT o.* FROM poll_options o JOIN polls p ON p.id = o.poll_id WHERE p.trip_id = ? ORDER BY o.position`, tripId);
  const votes = q.all(`SELECT v.* FROM poll_votes v JOIN polls p ON p.id = v.poll_id WHERE p.trip_id = ?`, tripId);
  return polls.map((p) => ({
    ...p,
    multi: !!p.multi,
    closed: !!p.closed,
    options: options.filter((o) => o.poll_id === p.id).map((o) => ({ ...o, votes: votes.filter((v) => v.option_id === o.id).map((v) => v.user_id) })),
  }));
}

export function loadPoll(pollId) {
  const p = q.get('SELECT * FROM polls WHERE id = ?', pollId);
  if (!p) return null;
  return loadPolls(p.trip_id).find((x) => x.id === pollId);
}

export function serializeTrip(t) {
  return t ? { ...t } : t;
}

export function loadTripFull(tripId, userId) {
  const trip = q.get('SELECT * FROM trips WHERE id = ?', tripId);
  const members = listMembers(tripId);
  const me = members.find((m) => m.user_id === userId);
  const stats = {
    bookings: q.value(`SELECT COUNT(*) FROM bookings WHERE trip_id = ? AND status IN ('requested','confirmed','completed','needs_attention')`, tripId),
    booked_total: q.value(`SELECT COALESCE(SUM(total),0) FROM bookings WHERE trip_id = ? AND status IN ('requested','confirmed','completed','needs_attention')`, tripId),
    spent: q.value('SELECT COALESCE(SUM(amount),0) FROM expenses WHERE trip_id = ?', tripId),
    photos: q.value('SELECT COUNT(*) FROM media_assets WHERE trip_id = ?', tripId),
    unread_proposals: q.value(`SELECT COUNT(*) FROM bookings WHERE trip_id = ? AND status = 'proposed'`, tripId),
  };
  const published = trip.published_itinerary_id ? q.get('SELECT id, status, price, fork_count FROM public_itineraries WHERE id = ?', trip.published_itinerary_id) : null;
  return {
    trip: serializeTrip(trip),
    members,
    me: me ? { role: me.role, vibe: me.vibe, share_location: me.share_location } : null,
    days: loadDays(tripId),
    stash: q.all('SELECT * FROM stash_items WHERE trip_id = ? ORDER BY created_at DESC', tripId),
    polls: loadPolls(tripId),
    stats,
    published,
  };
}

/** Summary used for trip cards. */
export function tripCards(userId) {
  const trips = q.all(
    `SELECT t.*, m.role AS my_role FROM trips t JOIN trip_members m ON m.trip_id = t.id WHERE m.user_id = ?
     ORDER BY CASE t.status WHEN 'ongoing' THEN 0 WHEN 'planning' THEN 1 WHEN 'booked' THEN 1 WHEN 'completed' THEN 2 ELSE 3 END, t.start_date`,
    userId,
  );
  return trips.map((t) => ({
    ...t,
    members: q
      .all(`SELECT u.id, u.name, u.avatar_url, u.verified FROM trip_members m JOIN users u ON u.id = m.user_id WHERE m.trip_id = ? ORDER BY m.joined_at LIMIT 6`, t.id)
      .map((u) => ({ ...u, verified: !!u.verified })),
    member_count: q.value('SELECT COUNT(*) FROM trip_members WHERE trip_id = ?', t.id),
    item_count: q.value('SELECT COUNT(*) FROM itinerary_items WHERE trip_id = ?', t.id),
    booking_count: q.value(`SELECT COUNT(*) FROM bookings WHERE trip_id = ? AND status IN ('confirmed','completed','requested')`, t.id),
  }));
}

/** Create or trim itinerary days so they match the trip dates. */
export function syncDays(trip) {
  const count = dayCount(trip.start_date, trip.end_date);
  const days = q.all('SELECT * FROM itinerary_days WHERE trip_id = ? ORDER BY day_number', trip.id);
  tx(() => {
    for (let n = 1; n <= count; n++) {
      const existing = days.find((d) => d.day_number === n);
      const date = addDays(trip.start_date, n - 1);
      if (existing) update('itinerary_days', existing.id, { date });
      else insert('itinerary_days', { id: newId(), trip_id: trip.id, day_number: n, date, title: '', notes: '' });
    }
    const extra = days.filter((d) => d.day_number > count);
    if (extra.length) {
      const last = q.get('SELECT id FROM itinerary_days WHERE trip_id = ? AND day_number = ?', trip.id, count);
      for (const d of extra) {
        q.run('UPDATE itinerary_items SET day_id = ?, position = position + 1000 WHERE day_id = ?', last.id, d.id);
        q.run('DELETE FROM itinerary_days WHERE id = ?', d.id);
      }
    }
  });
}

export function createTrip({ owner, name, destination, start_date, end_date, budget = 0, cover_theme, source_itinerary_id = null }) {
  if (Date.parse(end_date) < Date.parse(start_date)) throw badRequest('End date must be on or after the start date');
  if (dayCount(start_date, end_date) > 60) throw badRequest('Trips can be at most 60 days long');
  const dest = findDestination(destination);
  const trip = {
    id: newId(),
    name,
    destination: destination || '',
    dest_lat: dest?.lat ?? null,
    dest_lng: dest?.lng ?? null,
    cover_theme: cover_theme || themeFor(destination),
    owner_id: owner.id,
    start_date,
    end_date,
    budget: budget || 0,
    vibe_score: 50,
    status: 'planning',
    invite_code: inviteCode(),
    spend_limit_booking: setting('default_spend_limit_booking'),
    spend_limit_trip: setting('default_spend_limit_trip'),
    source_itinerary_id,
    created_at: now(),
    updated_at: now(),
  };
  tx(() => {
    insert('trips', trip);
    insert('trip_members', { trip_id: trip.id, user_id: owner.id, role: 'owner', vibe: 50, share_location: 0, joined_at: now() });
    syncDays(trip);
  });
  return trip;
}

export function addMember(tripId, userId, role = 'member') {
  const exists = q.get('SELECT 1 FROM trip_members WHERE trip_id = ? AND user_id = ?', tripId, userId);
  if (exists) return false;
  insert('trip_members', { trip_id: tripId, user_id: userId, role, vibe: 50, share_location: 0, joined_at: now() });
  recomputeVibe(tripId);
  return true;
}

export function nextPosition(dayId) {
  return (q.value('SELECT MAX(position) FROM itinerary_items WHERE day_id = ?', dayId) ?? 0) + 1;
}

/** Add an itinerary item to a given day (by day number). */
export function addItemToDay(tripId, dayNumber, fields, { userId = null, agent = false } = {}) {
  let day = q.get('SELECT * FROM itinerary_days WHERE trip_id = ? AND day_number = ?', tripId, dayNumber);
  if (!day) day = q.get('SELECT * FROM itinerary_days WHERE trip_id = ? ORDER BY day_number LIMIT 1', tripId);
  if (!day) return null;
  const item = {
    id: newId(),
    trip_id: tripId,
    day_id: day.id,
    type: fields.type || 'activity',
    title: fields.title,
    description: fields.description || '',
    place_name: fields.place_name || null,
    lat: fields.lat ?? null,
    lng: fields.lng ?? null,
    start_time: fields.start_time || null,
    duration_min: fields.duration_min ?? null,
    cost: fields.cost || 0,
    url: fields.url || null,
    image_url: fields.image_url || null,
    position: fields.position ?? nextPosition(day.id),
    booking_id: fields.booking_id || null,
    added_by: userId,
    added_by_agent: agent ? 1 : 0,
    created_at: now(),
    updated_at: now(),
  };
  insert('itinerary_items', item);
  touchTrip(tripId);
  return serializeItem(item);
}

/** Snapshot a trip's itinerary for publishing to the community feed. */
export function snapshotItinerary(tripId) {
  return loadDays(tripId).map((d) => ({
    day_number: d.day_number,
    title: d.title,
    notes: d.notes,
    items: d.items.map((i) => ({ type: i.type, title: i.title, description: i.description, place_name: i.place_name, lat: i.lat, lng: i.lng, start_time: i.start_time, duration_min: i.duration_min, cost: i.cost, url: i.url })),
  }));
}

/** Fork a public itinerary into a brand-new trip for the user. */
export function forkIntoTrip(itinerary, user, { start_date, name }) {
  const content = parseJson(itinerary.content, []);
  const days = Math.max(1, content.length || itinerary.days_count || 1);
  const trip = createTrip({
    owner: user,
    name: name || itinerary.title,
    destination: itinerary.destination,
    start_date,
    end_date: addDays(start_date, days - 1),
    budget: itinerary.budget_estimate || 0,
    cover_theme: itinerary.cover_theme,
    source_itinerary_id: itinerary.id,
  });
  tx(() => {
    for (const d of content) {
      const day = q.get('SELECT * FROM itinerary_days WHERE trip_id = ? AND day_number = ?', trip.id, d.day_number);
      if (!day) continue;
      update('itinerary_days', day.id, { title: d.title || '', notes: d.notes || '' });
      (d.items || []).forEach((it, idx) => addItemToDay(trip.id, d.day_number, { ...it, position: idx + 1 }, { userId: user.id }));
    }
    insert('forks', { id: newId(), itinerary_id: itinerary.id, trip_id: trip.id, user_id: user.id, created_at: now() });
    q.run('UPDATE public_itineraries SET fork_count = fork_count + 1 WHERE id = ?', itinerary.id);
  });
  return trip;
}

/** Keep trip.status in step with the calendar (planning → ongoing → completed). */
export function refreshTripStatuses() {
  const today = new Date().toISOString().slice(0, 10);
  q.run(`UPDATE trips SET status = 'ongoing' WHERE status IN ('planning','booked') AND start_date <= ? AND end_date >= ?`, today, today);
  q.run(`UPDATE trips SET status = 'completed' WHERE status IN ('planning','booked','ongoing') AND end_date < ?`, today);
}
