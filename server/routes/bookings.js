import { Router } from 'express';
import { parseJson, q } from '../db.js';
import { requireAuth } from '../lib/auth.js';
import { forbidden, notFound, oneOf, str } from '../lib/http.js';
import { cancel, confirm, getBooking, propose } from '../services/bookings.js';
import { requireMember } from '../services/trips.js';
import { connectorFor, remember, recall } from '../connectors/index.js';
import { eventOption } from '../connectors/experience.js';
import { istToIso } from '../agent/tools.js';

const router = Router();
router.use(requireAuth);

const serialize = (b) => ({ ...b, details: parseJson(b.details, {}) });

// Booking history across all my trips, segmented client-side into Upcoming / Past / Cancelled.
router.get('/', (req, res) => {
  const status = req.query.status ? String(req.query.status).split(',') : null;
  const tripId = req.query.trip_id ? String(req.query.trip_id) : null;
  if (tripId) requireMember(tripId, req.user);
  const rows = q.all(
    `SELECT b.*, t.name AS trip_name, t.destination AS trip_destination, u.name AS user_name FROM bookings b
     LEFT JOIN trips t ON t.id = b.trip_id LEFT JOIN users u ON u.id = b.user_id
     WHERE (${tripId ? 'b.trip_id = :key' : `(b.user_id = :key OR b.trip_id IN (SELECT trip_id FROM trip_members WHERE user_id = :key))`})
     ORDER BY COALESCE(b.scheduled_at, b.created_at) DESC LIMIT 300`,
    { key: tripId || req.user.id },
  );
  const filtered = status ? rows.filter((r) => status.includes(r.status)) : rows;
  res.json({ bookings: filtered.map(serialize) });
});

router.get('/:id', (req, res) => {
  const b = getBooking(req.params.id);
  if (!b) throw notFound('Booking not found');
  if (b.trip_id) requireMember(b.trip_id, req.user);
  else if (b.user_id !== req.user.id) throw forbidden();
  const payments = q.all('SELECT id, purpose, amount, upi_ref, upi_app, status, created_at FROM payments WHERE booking_id = ? ORDER BY created_at', b.id);
  const audit = q.all(`SELECT a.action, a.detail, a.created_at, u.name AS user_name FROM agent_audit a LEFT JOIN users u ON u.id = a.user_id WHERE a.booking_id = ? ORDER BY a.created_at`, b.id).map((a) => ({ ...a, detail: parseJson(a.detail, {}) }));
  res.json({ booking: b, payments, audit });
});

// Direct (non-agent) search + propose, used by the manual "Book" sheet in the trip.
router.post('/search', (req, res) => {
  const tripId = String(req.body.trip_id || '');
  const { trip } = requireMember(tripId, req.user);
  const category = oneOf(req.body.category, 'Category', ['cab', 'food', 'stay', 'experience'], { required: true });
  const params = { ...(req.body.params || {}) };
  if (params.pickup_time) params.pickup_time = istToIso(params.pickup_time);
  if (params.time) params.time = istToIso(params.time);
  const options = connectorFor(category).search(params, { trip }).map((o) => remember(o, trip.id));
  res.json({ options });
});

router.post('/propose', (req, res) => {
  const tripId = String(req.body.trip_id || '');
  // Event tickets can be bought without a trip; everything else lives inside a trip.
  const trip = tripId || !req.body.event_id ? requireMember(tripId, req.user).trip : { id: null };
  let option = null;
  if (req.body.event_id) {
    const ev = q.get(`SELECT * FROM events WHERE id = ? AND status = 'active'`, req.body.event_id);
    if (!ev) throw notFound('Event not found');
    const provider = q.get(`SELECT * FROM providers WHERE category = 'experience' AND enabled = 1 LIMIT 1`);
    if (!provider) throw notFound('Experiences are not available right now');
    option = eventOption(ev, provider, req.body.quantity);
  } else {
    option = recall(str(req.body.option_id, 'Option', { required: true }), trip.id);
    if (!option) throw notFound('This quote has expired — search again for fresh prices');
  }
  const booking = propose({ tripId: trip.id, userId: req.user.id, option, source: req.body.event_id ? 'event' : 'user' });
  res.status(201).json({ booking });
});

router.post('/:id/confirm', (req, res) => {
  const result = confirm(req.params.id, req.user, { upi_app: req.body.upi_app, pin: req.body.pin });
  res.json(result);
});

router.post('/:id/cancel', (req, res) => {
  const b = getBooking(req.params.id);
  if (!b) throw notFound('Booking not found');
  if (b.trip_id) {
    const { member } = requireMember(b.trip_id, req.user);
    if (b.status !== 'proposed' && b.user_id !== req.user.id && member.role !== 'owner') throw forbidden('Only the person who booked or the trip owner can cancel this booking');
  }
  res.json({ booking: cancel(b.id, req.user, { reason: str(req.body.reason, 'Reason', { max: 200 }) || 'Cancelled by traveller' }) });
});

export default router;
