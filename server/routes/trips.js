import { Router } from 'express';
import { insert, newId, now, parseJson, q, tx, update } from '../db.js';
import { requireAuth, publicUser } from '../lib/auth.js';
import { badRequest, forbidden, notFound, date, int, num, oneOf, phone as parsePhone, str, url } from '../lib/http.js';
import { findDestination, geocode, themeFor } from '../data/places.js';
import { emitTrip, kickFromTrip } from '../realtime.js';
import { notify, notifyTrip } from '../services/notify.js';
import { handleConciergeRequest, saveMessage } from '../agent/concierge.js';
import {
  addMember, createTrip, inviteCode, listMembers, loadDays, loadPoll, loadTripFull, nextPosition, recomputeVibe,
  requireMember, serializeItem, snapshotItinerary, syncDays, touchTrip, tripCards, dayCount,
} from '../services/trips.js';

const router = Router();
router.use(requireAuth);

export const ITINERARY_TAGS = ['Budget', 'Solo Female', 'Foodie', 'Adventure', 'Chill', 'Couple', 'Family', 'Backpacking', 'Luxury', 'Spiritual', 'Offbeat', 'Weekend', 'Trek', 'Beach', 'Heritage', 'Monsoon'];
const ITEM_TYPES = ['place', 'activity', 'food', 'stay', 'transport', 'note'];
const THEMES = ['mountains', 'snow', 'beach', 'heritage', 'desert', 'spiritual', 'forest', 'backwaters', 'city'];

const by = (req) => req.user.id;

// ---------- Trips ----------
router.get('/', (req, res) => {
  res.json({ trips: tripCards(req.user.id) });
});

router.post('/', (req, res) => {
  const b = req.body;
  const trip = createTrip({
    owner: req.user,
    name: str(b.name, 'Trip name', { required: true, max: 80 }),
    destination: str(b.destination, 'Destination', { required: true, max: 80 }),
    start_date: date(b.start_date, 'Start date', { required: true }),
    end_date: date(b.end_date, 'End date', { required: true }),
    budget: int(b.budget, 'Budget', { min: 0, max: 10_000_000 }) || 0,
    cover_theme: oneOf(b.cover_theme, 'Cover', THEMES),
  });
  res.status(201).json({ trip });
});

router.post('/join', (req, res) => {
  const code = str(req.body.code, 'Invite code', { required: true, max: 12 }).toUpperCase();
  const trip = q.get('SELECT * FROM trips WHERE invite_code = ?', code);
  if (!trip) throw notFound('That invite code is not valid. Ask your friend to share the link again.');
  const count = q.value('SELECT COUNT(*) FROM trip_members WHERE trip_id = ?', trip.id);
  if (count >= 20) throw badRequest('This trip already has the maximum of 20 members');
  const added = addMember(trip.id, req.user.id);
  if (added) {
    emitTrip(trip.id, 'members', { members: listMembers(trip.id) }, req.user.id);
    notifyTrip(trip.id, { type: 'member_joined', title: `${req.user.name || 'Someone'} joined ${trip.name}`, link: `/app/trips/${trip.id}` }, { except: req.user.id });
    saveMessage({ tripId: trip.id, channel: 'group', senderType: 'system', content: `${req.user.name || 'A new traveller'} joined the trip 👋` });
  }
  res.json({ trip, joined: added });
});

router.get('/invite/:code', (req, res) => {
  const trip = q.get('SELECT id, name, destination, start_date, end_date, cover_theme, owner_id FROM trips WHERE invite_code = ?', String(req.params.code).toUpperCase());
  if (!trip) throw notFound('Invite not found');
  const owner = q.get('SELECT * FROM users WHERE id = ?', trip.owner_id);
  const members = q.value('SELECT COUNT(*) FROM trip_members WHERE trip_id = ?', trip.id);
  const isMember = !!q.get('SELECT 1 FROM trip_members WHERE trip_id = ? AND user_id = ?', trip.id, req.user.id);
  res.json({ trip, owner: publicUser(owner), members, is_member: isMember });
});

router.get('/:id', (req, res) => {
  const { trip, member } = requireMember(req.params.id, req.user);
  const data = loadTripFull(trip.id, req.user.id);
  if (member.role !== 'owner') data.trip.invite_code = null;
  res.json(data);
});

router.patch('/:id', (req, res) => {
  const { trip, member } = requireMember(req.params.id, req.user);
  const b = req.body;
  const isOwner = member.role === 'owner';
  const fields = {
    name: str(b.name, 'Trip name', { max: 80 }),
    budget: int(b.budget, 'Budget', { min: 0, max: 10_000_000 }),
    cover_theme: oneOf(b.cover_theme, 'Cover', THEMES),
    cover_url: b.cover_url === null ? null : url(b.cover_url, 'Cover image'),
  };
  if (b.destination !== undefined) {
    fields.destination = str(b.destination, 'Destination', { required: true, max: 80 });
    const d = findDestination(fields.destination);
    fields.dest_lat = d?.lat ?? null;
    fields.dest_lng = d?.lng ?? null;
    if (!b.cover_theme) fields.cover_theme = themeFor(fields.destination);
  }
  const ownerOnly = ['start_date', 'end_date', 'spend_limit_booking', 'spend_limit_trip', 'status'];
  if (ownerOnly.some((k) => b[k] !== undefined) && !isOwner) throw forbidden('Only the trip owner can change dates, spending limits or status');
  if (b.start_date || b.end_date) {
    fields.start_date = date(b.start_date, 'Start date') || trip.start_date;
    fields.end_date = date(b.end_date, 'End date') || trip.end_date;
    if (fields.end_date < fields.start_date) throw badRequest('End date must be on or after the start date');
    if (dayCount(fields.start_date, fields.end_date) > 60) throw badRequest('Trips can be at most 60 days long');
  }
  fields.spend_limit_booking = int(b.spend_limit_booking, 'Per-booking limit', { min: 500, max: 1_000_000 });
  fields.spend_limit_trip = int(b.spend_limit_trip, 'Trip limit', { min: 1000, max: 5_000_000 });
  fields.status = oneOf(b.status, 'Status', ['planning', 'booked', 'ongoing', 'completed', 'archived']);
  fields.updated_at = now();
  update('trips', trip.id, fields);
  const updated = q.get('SELECT * FROM trips WHERE id = ?', trip.id);
  if (fields.start_date) {
    syncDays(updated);
    emitTrip(trip.id, 'days:reload', {}, by(req));
  }
  emitTrip(trip.id, 'trip:update', { trip: { ...updated, invite_code: null } }, by(req));
  res.json({ trip: isOwner ? updated : { ...updated, invite_code: null } });
});

router.delete('/:id', (req, res) => {
  const { trip } = requireMember(req.params.id, req.user, { owner: true });
  const active = q.value(`SELECT COUNT(*) FROM bookings WHERE trip_id = ? AND status IN ('requested','confirmed','needs_attention')`, trip.id);
  if (active) throw badRequest('Cancel the active bookings on this trip before deleting it');
  emitTrip(trip.id, 'trip:deleted', {}, by(req));
  q.run('DELETE FROM trips WHERE id = ?', trip.id);
  res.json({ ok: true });
});

// ---------- Members ----------
router.post('/:id/members', (req, res) => {
  const { trip } = requireMember(req.params.id, req.user, { owner: true });
  const phone = parsePhone(req.body.phone);
  const user = q.get(`SELECT * FROM users WHERE phone = ? AND status = 'active'`, phone);
  if (!user) {
    return res.status(202).json({ invited: false, message: `No Itenary account for ${phone} yet — share the invite link on WhatsApp instead.`, invite_code: trip.invite_code });
  }
  if (q.value('SELECT COUNT(*) FROM trip_members WHERE trip_id = ?', trip.id) >= 20) throw badRequest('This trip already has the maximum of 20 members');
  const added = addMember(trip.id, user.id);
  if (!added) throw badRequest(`${user.name || phone} is already on this trip`);
  notify(user.id, { type: 'trip_invite', title: `${req.user.name} added you to ${trip.name}`, body: `${trip.destination} · ${trip.start_date} → ${trip.end_date}`, link: `/app/trips/${trip.id}` });
  saveMessage({ tripId: trip.id, channel: 'group', senderType: 'system', content: `${req.user.name} added ${user.name || 'a new traveller'} to the trip` });
  const members = listMembers(trip.id);
  emitTrip(trip.id, 'members', { members }, by(req));
  res.status(201).json({ invited: true, members });
});

router.delete('/:id/members/:userId', (req, res) => {
  const { trip, member } = requireMember(req.params.id, req.user);
  const target = req.params.userId;
  const leaving = target === req.user.id;
  if (!leaving && member.role !== 'owner') throw forbidden('Only the trip owner can remove members');
  const targetMember = q.get('SELECT * FROM trip_members WHERE trip_id = ? AND user_id = ?', trip.id, target);
  if (!targetMember) throw notFound('Member not found');
  if (targetMember.role === 'owner') throw badRequest('The owner cannot leave. Transfer ownership or delete the trip.');
  q.run('DELETE FROM trip_members WHERE trip_id = ? AND user_id = ?', trip.id, target);
  recomputeVibe(trip.id);
  kickFromTrip(trip.id, target);
  const name = q.value('SELECT name FROM users WHERE id = ?', target);
  saveMessage({ tripId: trip.id, channel: 'group', senderType: 'system', content: leaving ? `${name} left the trip` : `${name} was removed from the trip` });
  if (!leaving) notify(target, { type: 'trip_removed', title: `You were removed from ${trip.name}` });
  const members = listMembers(trip.id);
  emitTrip(trip.id, 'members', { members }, by(req));
  res.json({ members });
});

router.patch('/:id/members/:userId', (req, res) => {
  const { trip } = requireMember(req.params.id, req.user, { owner: true });
  if (req.body.role !== 'owner') throw badRequest('Only ownership transfer is supported');
  const target = q.get('SELECT * FROM trip_members WHERE trip_id = ? AND user_id = ?', trip.id, req.params.userId);
  if (!target) throw notFound('Member not found');
  tx(() => {
    q.run(`UPDATE trip_members SET role = 'member' WHERE trip_id = ? AND user_id = ?`, trip.id, req.user.id);
    q.run(`UPDATE trip_members SET role = 'owner' WHERE trip_id = ? AND user_id = ?`, trip.id, target.user_id);
    update('trips', trip.id, { owner_id: target.user_id, updated_at: now() });
  });
  notify(target.user_id, { type: 'trip_owner', title: `You're now the owner of ${trip.name}`, link: `/app/trips/${trip.id}` });
  const members = listMembers(trip.id);
  emitTrip(trip.id, 'members', { members }, by(req));
  res.json({ members });
});

router.post('/:id/invite-code', (req, res) => {
  const { trip } = requireMember(req.params.id, req.user, { owner: true });
  const code = inviteCode();
  update('trips', trip.id, { invite_code: code });
  res.json({ invite_code: code });
});

router.post('/:id/vibe-check', (req, res) => {
  const { trip } = requireMember(req.params.id, req.user);
  const value = int(req.body.value, 'Vibe', { required: true, min: 0, max: 100 });
  q.run('UPDATE trip_members SET vibe = ? WHERE trip_id = ? AND user_id = ?', value, trip.id, req.user.id);
  const score = recomputeVibe(trip.id);
  emitTrip(trip.id, 'vibe', { user_id: req.user.id, vibe: value, vibe_score: score }, by(req));
  res.json({ vibe: value, vibe_score: score });
});

router.patch('/:id/me', (req, res) => {
  const { trip } = requireMember(req.params.id, req.user);
  if (req.body.share_location !== undefined) {
    const on = !!req.body.share_location;
    q.run('UPDATE trip_members SET share_location = ? WHERE trip_id = ? AND user_id = ?', on ? 1 : 0, trip.id, req.user.id);
    if (!on) {
      q.run('DELETE FROM live_locations WHERE trip_id = ? AND user_id = ?', trip.id, req.user.id);
      emitTrip(trip.id, 'location:stop', { user_id: req.user.id }, by(req));
    }
  }
  emitTrip(trip.id, 'members', { members: listMembers(trip.id) }, by(req));
  res.json({ ok: true });
});

router.get('/:id/locations', (req, res) => {
  const { trip } = requireMember(req.params.id, req.user);
  const rows = q.all(
    `SELECT l.*, u.name, u.avatar_url FROM live_locations l JOIN trip_members m ON m.trip_id = l.trip_id AND m.user_id = l.user_id AND m.share_location = 1
     JOIN users u ON u.id = l.user_id WHERE l.trip_id = ? AND l.updated_at > ?`,
    trip.id, new Date(Date.now() - 6 * 3600_000).toISOString(),
  );
  res.json({ locations: rows });
});

// ---------- Itinerary ----------
router.get('/:id/itinerary', (req, res) => {
  const { trip } = requireMember(req.params.id, req.user);
  res.json({ days: loadDays(trip.id) });
});

router.patch('/:id/days/:dayId', (req, res) => {
  const { trip } = requireMember(req.params.id, req.user);
  const day = q.get('SELECT * FROM itinerary_days WHERE id = ? AND trip_id = ?', req.params.dayId, trip.id);
  if (!day) throw notFound('Day not found');
  const fields = { title: req.body.title !== undefined ? str(req.body.title, 'Title', { max: 80 }) ?? '' : undefined, notes: req.body.notes !== undefined ? str(req.body.notes, 'Notes', { max: 2000 }) ?? '' : undefined };
  update('itinerary_days', day.id, fields);
  touchTrip(trip.id);
  const updated = q.get('SELECT * FROM itinerary_days WHERE id = ?', day.id);
  emitTrip(trip.id, 'day:update', { day: updated }, by(req));
  res.json({ day: updated });
});

function itemFields(b, trip, partial = false) {
  const f = {
    title: str(b.title, 'Title', { required: !partial, max: 140 }),
    type: oneOf(b.type, 'Type', ITEM_TYPES),
    description: b.description !== undefined ? str(b.description, 'Description', { max: 1000 }) ?? '' : undefined,
    place_name: b.place_name !== undefined ? str(b.place_name, 'Place', { max: 140 }) ?? null : undefined,
    start_time: b.start_time !== undefined ? (b.start_time && /^\d{2}:\d{2}$/.test(b.start_time) ? b.start_time : null) : undefined,
    duration_min: int(b.duration_min, 'Duration', { min: 0, max: 1440 }),
    cost: int(b.cost, 'Cost', { min: 0, max: 10_000_000 }),
    url: b.url !== undefined ? url(b.url, 'Link') ?? null : undefined,
    image_url: b.image_url !== undefined ? url(b.image_url, 'Image') ?? null : undefined,
    lat: num(b.lat, 'Latitude', { min: -90, max: 90 }),
    lng: num(b.lng, 'Longitude', { min: -180, max: 180 }),
  };
  if (f.place_name && (b.lat === undefined || b.lat === null)) {
    const g = geocode(f.place_name, trip.destination);
    if (g) {
      f.lat = g.lat;
      f.lng = g.lng;
    }
  }
  return f;
}

router.post('/:id/days/:dayId/items', (req, res) => {
  const { trip } = requireMember(req.params.id, req.user);
  const day = q.get('SELECT * FROM itinerary_days WHERE id = ? AND trip_id = ?', req.params.dayId, trip.id);
  if (!day) throw notFound('Day not found');
  if (q.value('SELECT COUNT(*) FROM itinerary_items WHERE day_id = ?', day.id) >= 40) throw badRequest('A day can hold at most 40 items');
  const f = itemFields(req.body, trip);
  const item = {
    id: newId(), trip_id: trip.id, day_id: day.id, type: f.type || 'activity', title: f.title, description: f.description || '',
    place_name: f.place_name || null, lat: f.lat ?? null, lng: f.lng ?? null, start_time: f.start_time || null, duration_min: f.duration_min ?? null,
    cost: f.cost || 0, url: f.url || null, image_url: f.image_url || null, position: num(req.body.position, 'Position') ?? nextPosition(day.id),
    booking_id: null, added_by: req.user.id, added_by_agent: 0, created_at: now(), updated_at: now(),
  };
  insert('itinerary_items', item);
  touchTrip(trip.id);
  emitTrip(trip.id, 'item:upsert', { item: serializeItem(item) }, by(req));
  res.status(201).json({ item: serializeItem(item) });
});

router.patch('/:id/items/:itemId', (req, res) => {
  const { trip } = requireMember(req.params.id, req.user);
  const item = q.get('SELECT * FROM itinerary_items WHERE id = ? AND trip_id = ?', req.params.itemId, trip.id);
  if (!item) throw notFound('Item not found');
  const f = itemFields(req.body, trip, true);
  if (req.body.day_id && req.body.day_id !== item.day_id) {
    const day = q.get('SELECT id FROM itinerary_days WHERE id = ? AND trip_id = ?', req.body.day_id, trip.id);
    if (!day) throw notFound('Day not found');
    f.day_id = day.id;
  }
  f.position = num(req.body.position, 'Position');
  f.updated_at = now();
  update('itinerary_items', item.id, f);
  touchTrip(trip.id);
  const updated = serializeItem(q.get('SELECT * FROM itinerary_items WHERE id = ?', item.id));
  emitTrip(trip.id, 'item:upsert', { item: updated }, by(req));
  res.json({ item: updated });
});

router.delete('/:id/items/:itemId', (req, res) => {
  const { trip } = requireMember(req.params.id, req.user);
  const item = q.get('SELECT * FROM itinerary_items WHERE id = ? AND trip_id = ?', req.params.itemId, trip.id);
  if (!item) throw notFound('Item not found');
  if (item.booking_id) {
    const b = q.get(`SELECT status FROM bookings WHERE id = ?`, item.booking_id);
    if (b && ['requested', 'confirmed'].includes(b.status)) throw badRequest('This stop is linked to a booking. Cancel the booking from the Bookings tab instead.');
  }
  q.run('DELETE FROM itinerary_items WHERE id = ?', item.id);
  touchTrip(trip.id);
  emitTrip(trip.id, 'item:delete', { id: item.id }, by(req));
  res.json({ ok: true });
});

// ---------- Stash ----------
router.post('/:id/stash', (req, res) => {
  const { trip } = requireMember(req.params.id, req.user);
  const b = req.body;
  const type = oneOf(b.type, 'Type', ['place', 'photo', 'link', 'note']) || 'place';
  const title = str(b.title, 'Title', { required: true, max: 140 });
  const place = str(b.place_name, 'Place', { max: 140 }) || (type === 'place' ? title : null);
  const g = place && b.lat == null ? geocode(place, trip.destination) : null;
  const row = insert('stash_items', {
    id: newId(), trip_id: trip.id, type, title, note: str(b.note, 'Note', { max: 1000 }) || '', url: url(b.url, 'Link') || null,
    image_url: url(b.image_url, 'Image') || null, place_name: place || null, lat: num(b.lat, 'Latitude') ?? g?.lat ?? null, lng: num(b.lng, 'Longitude') ?? g?.lng ?? null,
    added_by: req.user.id, created_at: now(),
  });
  emitTrip(trip.id, 'stash:upsert', { item: row }, by(req));
  res.status(201).json({ item: row });
});

router.delete('/:id/stash/:sid', (req, res) => {
  const { trip } = requireMember(req.params.id, req.user);
  q.run('DELETE FROM stash_items WHERE id = ? AND trip_id = ?', req.params.sid, trip.id);
  emitTrip(trip.id, 'stash:delete', { id: req.params.sid }, by(req));
  res.json({ ok: true });
});

router.post('/:id/stash/:sid/assign', (req, res) => {
  const { trip } = requireMember(req.params.id, req.user);
  const s = q.get('SELECT * FROM stash_items WHERE id = ? AND trip_id = ?', req.params.sid, trip.id);
  if (!s) throw notFound('Stash item not found');
  const day = q.get('SELECT * FROM itinerary_days WHERE id = ? AND trip_id = ?', req.body.day_id, trip.id);
  if (!day) throw notFound('Day not found');
  const item = {
    id: newId(), trip_id: trip.id, day_id: day.id, type: s.type === 'place' ? 'place' : s.type === 'note' ? 'note' : 'activity', title: s.title,
    description: s.note || '', place_name: s.place_name, lat: s.lat, lng: s.lng, start_time: null, duration_min: null, cost: 0,
    url: s.url, image_url: s.image_url, position: num(req.body.position, 'Position') ?? nextPosition(day.id), booking_id: null,
    added_by: req.user.id, added_by_agent: 0, created_at: now(), updated_at: now(),
  };
  tx(() => {
    insert('itinerary_items', item);
    q.run('DELETE FROM stash_items WHERE id = ?', s.id);
  });
  touchTrip(trip.id);
  emitTrip(trip.id, 'stash:delete', { id: s.id }, by(req));
  emitTrip(trip.id, 'item:upsert', { item: serializeItem(item) }, by(req));
  res.json({ item: serializeItem(item) });
});

// ---------- Polls ----------
router.post('/:id/polls', (req, res) => {
  const { trip } = requireMember(req.params.id, req.user);
  const question = str(req.body.question, 'Question', { required: true, max: 200 });
  const options = (Array.isArray(req.body.options) ? req.body.options : [])
    .map((o) => (typeof o === 'string' ? { label: o } : o))
    .map((o) => ({ label: str(o.label, 'Option', { max: 120 }), detail: str(o.detail, 'Detail', { max: 200 }) || '' }))
    .filter((o) => o.label);
  if (options.length < 2 || options.length > 8) throw badRequest('Add between 2 and 8 options');
  const poll = { id: newId(), trip_id: trip.id, question, multi: req.body.multi ? 1 : 0, closed: 0, created_by: req.user.id, created_at: now() };
  tx(() => {
    insert('polls', poll);
    options.forEach((o, i) => insert('poll_options', { id: newId(), poll_id: poll.id, label: o.label, detail: o.detail, position: i }));
  });
  const full = loadPoll(poll.id);
  emitTrip(trip.id, 'poll:upsert', { poll: full }, by(req));
  saveMessage({ tripId: trip.id, channel: 'group', senderType: 'system', content: `${req.user.name} started a vote: “${question}”`, meta: { poll_id: poll.id } });
  notifyTrip(trip.id, { type: 'poll', title: `New vote in ${trip.name}`, body: question, link: `/app/trips/${trip.id}` }, { except: req.user.id });
  res.status(201).json({ poll: full });
});

router.post('/:id/polls/:pid/vote', (req, res) => {
  const { trip } = requireMember(req.params.id, req.user);
  const poll = q.get('SELECT * FROM polls WHERE id = ? AND trip_id = ?', req.params.pid, trip.id);
  if (!poll) throw notFound('Poll not found');
  if (poll.closed) throw badRequest('Voting on this poll has closed');
  const option = q.get('SELECT * FROM poll_options WHERE id = ? AND poll_id = ?', req.body.option_id, poll.id);
  if (!option) throw notFound('Option not found');
  const existing = q.get('SELECT 1 FROM poll_votes WHERE poll_id = ? AND option_id = ? AND user_id = ?', poll.id, option.id, req.user.id);
  tx(() => {
    if (existing) q.run('DELETE FROM poll_votes WHERE poll_id = ? AND option_id = ? AND user_id = ?', poll.id, option.id, req.user.id);
    else {
      if (!poll.multi) q.run('DELETE FROM poll_votes WHERE poll_id = ? AND user_id = ?', poll.id, req.user.id);
      insert('poll_votes', { poll_id: poll.id, option_id: option.id, user_id: req.user.id, created_at: now() });
    }
  });
  const full = loadPoll(poll.id);
  emitTrip(trip.id, 'poll:upsert', { poll: full }, by(req));
  res.json({ poll: full });
});

router.post('/:id/polls/:pid/close', (req, res) => {
  const { trip, member } = requireMember(req.params.id, req.user);
  const poll = q.get('SELECT * FROM polls WHERE id = ? AND trip_id = ?', req.params.pid, trip.id);
  if (!poll) throw notFound('Poll not found');
  if (poll.created_by !== req.user.id && member.role !== 'owner') throw forbidden('Only the poll creator or trip owner can close it');
  update('polls', poll.id, { closed: poll.closed ? 0 : 1 });
  const full = loadPoll(poll.id);
  if (full.closed) {
    const winner = [...full.options].sort((a, b) => b.votes.length - a.votes.length)[0];
    if (winner?.votes.length) saveMessage({ tripId: trip.id, channel: 'group', senderType: 'system', content: `Vote closed: “${full.question}” → ${winner.label} wins with ${winner.votes.length} vote${winner.votes.length > 1 ? 's' : ''} 🎉` });
  }
  emitTrip(trip.id, 'poll:upsert', { poll: full }, by(req));
  res.json({ poll: full });
});

router.delete('/:id/polls/:pid', (req, res) => {
  const { trip, member } = requireMember(req.params.id, req.user);
  const poll = q.get('SELECT * FROM polls WHERE id = ? AND trip_id = ?', req.params.pid, trip.id);
  if (!poll) throw notFound('Poll not found');
  if (poll.created_by !== req.user.id && member.role !== 'owner') throw forbidden('Only the poll creator or trip owner can delete it');
  q.run('DELETE FROM polls WHERE id = ?', poll.id);
  emitTrip(trip.id, 'poll:delete', { id: poll.id }, by(req));
  res.json({ ok: true });
});

// ---------- Chat & concierge ----------
router.get('/:id/chat', (req, res) => {
  const { trip } = requireMember(req.params.id, req.user);
  const channel = oneOf(req.query.channel, 'Channel', ['group', 'concierge']) || 'group';
  const before = req.query.before ? String(req.query.before) : '9999';
  const rows = q
    .all(
      `SELECT c.*, u.name AS sender_name, u.avatar_url AS sender_avatar FROM chat_messages c LEFT JOIN users u ON u.id = c.sender_id
       WHERE c.trip_id = ? AND c.channel = ? AND c.created_at < ? ORDER BY c.created_at DESC LIMIT 60`,
      trip.id, channel, before,
    )
    .reverse()
    .map((m) => ({ ...m, meta: parseJson(m.meta, {}) }));
  // Hydrate booking proposals referenced by concierge messages
  const ids = [...new Set(rows.flatMap((m) => m.meta.proposals || []))];
  const bookings = ids.length ? q.all(`SELECT * FROM bookings WHERE id IN (${ids.map(() => '?').join(',')})`, ...ids).map((b) => ({ ...b, details: parseJson(b.details, {}) })) : [];
  res.json({ messages: rows, bookings });
});

router.post('/:id/chat/messages', (req, res) => {
  const { trip } = requireMember(req.params.id, req.user);
  const content = str(req.body.content, 'Message', { required: true, max: 2000 });
  const msg = saveMessage({ tripId: trip.id, channel: 'group', senderId: req.user.id, content, meta: req.body.client_id ? { client_id: String(req.body.client_id).slice(0, 40) } : {} });
  // Mentions: @Name notifies that member
  const mentions = listMembers(trip.id).filter((m) => m.user_id !== req.user.id && m.name && content.toLowerCase().includes('@' + m.name.split(' ')[0].toLowerCase()));
  for (const m of mentions) notify(m.user_id, { type: 'mention', title: `${req.user.name} mentioned you in ${trip.name}`, body: content.slice(0, 140), link: `/app/trips/${trip.id}?tab=chat` });
  res.status(201).json({ message: { ...msg, sender_name: req.user.name, sender_avatar: req.user.avatar_url } });
});

router.post('/:id/agent/requests', async (req, res) => {
  const { trip } = requireMember(req.params.id, req.user);
  const text = str(req.body.message, 'Message', { required: true, max: 1500 });
  const result = await handleConciergeRequest({ trip, user: req.user, text });
  const ids = result.agentMessage.meta.proposals || [];
  const bookings = ids.length ? q.all(`SELECT * FROM bookings WHERE id IN (${ids.map(() => '?').join(',')})`, ...ids).map((b) => ({ ...b, details: parseJson(b.details, {}) })) : [];
  res.json({ ...result, bookings });
});

router.get('/:id/audit', (req, res) => {
  const { trip } = requireMember(req.params.id, req.user);
  const rows = q.all(`SELECT a.*, u.name AS user_name FROM agent_audit a LEFT JOIN users u ON u.id = a.user_id WHERE a.trip_id = ? ORDER BY a.created_at DESC LIMIT 100`, trip.id);
  res.json({ audit: rows.map((r) => ({ ...r, detail: parseJson(r.detail, {}) })) });
});

// ---------- Publish to the community feed ----------
router.post('/:id/publish', (req, res) => {
  const { trip, member } = requireMember(req.params.id, req.user);
  if (member.role !== 'owner') throw forbidden('Only the trip owner can publish this itinerary');
  const content = snapshotItinerary(trip.id);
  const itemCount = content.reduce((s, d) => s + d.items.length, 0);
  if (itemCount < 2) throw badRequest('Add at least a couple of stops to your itinerary before publishing');
  const tags = (Array.isArray(req.body.tags) ? req.body.tags : []).filter((t) => ITINERARY_TAGS.includes(t)).slice(0, 6);
  const price = int(req.body.price, 'Price', { min: 0, max: 2999 }) || 0;
  const fields = {
    title: str(req.body.title, 'Title', { required: true, max: 100 }),
    summary: str(req.body.summary, 'Summary', { max: 1000 }) || '',
    destination: trip.destination,
    cover_theme: trip.cover_theme,
    cover_url: trip.cover_url,
    days_count: content.length,
    budget_estimate: int(req.body.budget_estimate, 'Budget estimate', { min: 0, max: 10_000_000 }) ?? trip.budget,
    tags: JSON.stringify(tags),
    content: JSON.stringify(content),
    price,
    status: 'published',
    updated_at: now(),
  };
  let itineraryId = trip.published_itinerary_id;
  const existing = itineraryId && q.get('SELECT id, status FROM public_itineraries WHERE id = ?', itineraryId);
  if (existing && existing.status === 'removed') throw forbidden('This itinerary was removed by moderators and cannot be republished');
  if (existing) update('public_itineraries', itineraryId, fields);
  else {
    itineraryId = newId();
    insert('public_itineraries', { id: itineraryId, source_trip_id: trip.id, creator_id: req.user.id, ...fields, created_at: now() });
    update('trips', trip.id, { published_itinerary_id: itineraryId });
    const followers = q.all('SELECT follower_id FROM follows WHERE creator_id = ?', req.user.id);
    for (const f of followers) notify(f.follower_id, { type: 'new_itinerary', title: `${req.user.name} published “${fields.title}”`, body: trip.destination, link: `/app/itineraries/${itineraryId}` });
  }
  res.json({ itinerary_id: itineraryId });
});

router.post('/:id/unpublish', (req, res) => {
  const { trip } = requireMember(req.params.id, req.user, { owner: true });
  if (trip.published_itinerary_id) q.run(`UPDATE public_itineraries SET status = 'unpublished', updated_at = ? WHERE id = ? AND status = 'published'`, now(), trip.published_itinerary_id);
  res.json({ ok: true });
});

export default router;
