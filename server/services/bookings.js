// Booking service: the central record of every provider booking and its state machine.
//   proposed → (user reviews & pays) → requested → confirmed → completed
//                                     ↘ needs_attention (human-in-the-loop) → confirmed | cancelled
//   proposed → cancelled (dismissed)          confirmed → cancelled (refunded)
// Every money-moving step requires explicit user confirmation, respects the trip spending
// limits (enforced here, independent of the agent) and is written to the audit trail.
import { insert, newId, now, parseJson, q, update } from '../db.js';
import { connectorFor } from '../connectors/index.js';
import { badRequest, forbidden, notFound } from '../lib/http.js';
import { emitAdmins, emitTrip, emitUser } from '../realtime.js';
import { audit, notify, notifyTrip } from './notify.js';
import { collect, refund, checkUpiAuthorisation } from './payments.js';
import { setting } from './settings.js';
import { addExpense } from './budget.js';
import { addItemToDay, dayCount } from './trips.js';

const ACTIVE = ['requested', 'confirmed', 'completed', 'needs_attention'];

export function serializeBooking(b) {
  if (!b) return b;
  return { ...b, details: parseJson(b.details, {}) };
}

export function getBooking(id) {
  return serializeBooking(q.get('SELECT * FROM bookings WHERE id = ?', id));
}

function broadcast(b) {
  if (!b) return;
  if (b.trip_id) emitTrip(b.trip_id, 'booking', { booking: b });
  if (b.user_id) emitUser(b.user_id, 'booking', b);
  emitAdmins('booking', b);
}

/** Create a booking proposal from a connector search option. No money moves here. */
export function propose({ tripId, userId, option, source = 'agent' }) {
  const provider = q.get('SELECT * FROM providers WHERE id = ?', option.provider_id);
  if (!provider || !provider.enabled) throw badRequest('That provider is currently unavailable');
  const amount = Math.round(option.amount);
  const fee = Math.round((amount * setting('booking_fee_pct')) / 100);
  const booking = {
    id: newId(),
    trip_id: tripId,
    user_id: userId,
    category: option.category,
    provider_id: provider.id,
    provider_name: provider.name,
    title: option.title,
    details: { ...option.details, subtitle: option.subtitle, rating: option.rating },
    scheduled_at: option.scheduled_at || null,
    amount,
    fee,
    total: amount + fee,
    commission: Math.round((amount * provider.commission_pct) / 100),
    status: 'proposed',
    source,
    created_at: now(),
    updated_at: now(),
  };
  insert('bookings', booking);
  audit({ tripId, userId, bookingId: booking.id, action: 'proposed', detail: { source, provider: provider.name, title: booking.title, total: booking.total, scheduled_at: booking.scheduled_at } });
  const row = getBooking(booking.id);
  broadcast(row);
  return row;
}

function assertCanAct(booking, user) {
  if (!booking) throw notFound('Booking not found');
  if (user.role === 'admin') return;
  const member = booking.trip_id && q.get('SELECT 1 FROM trip_members WHERE trip_id = ? AND user_id = ?', booking.trip_id, user.id);
  if (!member && booking.user_id !== user.id) throw forbidden('This booking belongs to another trip');
}

/** Check the configurable per-booking and per-trip spending limits. */
export function checkSpendLimits(booking) {
  if (!booking.trip_id) return;
  const trip = q.get('SELECT spend_limit_booking, spend_limit_trip FROM trips WHERE id = ?', booking.trip_id);
  if (!trip) return;
  if (booking.total > trip.spend_limit_booking) {
    throw badRequest(`This booking (₹${booking.total.toLocaleString('en-IN')}) is above the trip's per-booking limit of ₹${trip.spend_limit_booking.toLocaleString('en-IN')}. The trip owner can raise it in Trip settings.`, { code: 'limit_booking' });
  }
  const spent = q.value(`SELECT COALESCE(SUM(total),0) FROM bookings WHERE trip_id = ? AND status IN ('requested','confirmed','completed','needs_attention')`, booking.trip_id);
  if (spent + booking.total > trip.spend_limit_trip) {
    throw badRequest(`Confirming this would take trip bookings to ₹${(spent + booking.total).toLocaleString('en-IN')}, above the trip limit of ₹${trip.spend_limit_trip.toLocaleString('en-IN')}. The trip owner can raise it in Trip settings.`, { code: 'limit_trip' });
  }
}

/** User reviewed the proposal and authorised UPI payment. */
export function confirm(bookingId, user, { upi_app, pin } = {}) {
  const booking = getBooking(bookingId);
  assertCanAct(booking, user);
  if (booking.status !== 'proposed') throw badRequest(`This booking is already ${booking.status.replace('_', ' ')}`);
  const ttl = setting('proposal_ttl_minutes') * 60_000;
  if (Date.now() - Date.parse(booking.created_at) > ttl) {
    update('bookings', booking.id, { status: 'cancelled', failure_reason: 'Quote expired', updated_at: now() });
    broadcast(getBooking(booking.id));
    throw badRequest('This quote has expired. Ask the concierge for a fresh one.');
  }
  checkUpiAuthorisation({ upi_app, pin });
  checkSpendLimits(booking);

  const payment = collect({ userId: user.id, amount: booking.total, purpose: 'booking', tripId: booking.trip_id, bookingId: booking.id, upiApp: upi_app });
  update('bookings', booking.id, { status: 'requested', payment_id: payment.id, user_id: user.id, updated_at: now() });
  audit({ tripId: booking.trip_id, userId: user.id, bookingId: booking.id, action: 'confirmed', detail: { total: booking.total, upi_ref: payment.upi_ref, upi_app } });
  broadcast(getBooking(booking.id));

  // Provider execution runs off the request path (a slow provider never blocks the user).
  setTimeout(() => execute(booking.id), 1800 + Math.random() * 1500);
  return { booking: getBooking(booking.id), payment };
}

/** Call the provider connector. Failures route to the human-in-the-loop queue, never silently. */
export function execute(bookingId, { forceSuccess = false } = {}) {
  const booking = getBooking(bookingId);
  if (!booking || !['requested', 'needs_attention'].includes(booking.status)) return;
  const provider = q.get('SELECT * FROM providers WHERE id = ?', booking.provider_id);
  let result;
  try {
    result = connectorFor(booking.category).execute(booking, forceSuccess ? { ...provider, failure_rate: 0 } : provider, booking.details);
  } catch (err) {
    result = { ok: false, reason: `Connector error: ${err.message}` };
  }

  if (!result.ok) {
    update('bookings', booking.id, { status: 'needs_attention', failure_reason: result.reason, updated_at: now() });
    audit({ tripId: booking.trip_id, userId: booking.user_id, bookingId: booking.id, action: 'failed', detail: { reason: result.reason } });
    notify(booking.user_id, {
      type: 'booking_attention',
      title: `We hit a snag with “${booking.title}”`,
      body: `${result.reason}. Your payment is safe — an Itenary specialist is on it and will confirm or refund shortly.`,
      link: booking.trip_id ? `/app/trips/${booking.trip_id}?tab=bookings` : '/app/bookings',
    });
    const b = getBooking(booking.id);
    broadcast(b);
    emitAdmins('attention', b);
    return b;
  }

  const details = { ...booking.details, ...result.details };
  update('bookings', booking.id, { status: 'confirmed', provider_ref: result.providerRef, details, failure_reason: null, confirmed_at: now(), updated_at: now() });
  audit({ tripId: booking.trip_id, userId: booking.user_id, bookingId: booking.id, action: 'executed', detail: { provider_ref: result.providerRef } });
  attachToTrip(getBooking(booking.id));
  const b = getBooking(booking.id);
  if (b.trip_id) {
    notifyTrip(b.trip_id, { type: 'booking_confirmed', title: `Booked: ${b.title}`, body: bookingSummary(b), link: `/app/trips/${b.trip_id}?tab=bookings` });
  } else {
    notify(b.user_id, { type: 'booking_confirmed', title: `Booked: ${b.title}`, body: bookingSummary(b), link: '/app/bookings' });
  }
  broadcast(b);
  return b;
}

export function bookingSummary(b) {
  const d = b.details || {};
  const when = b.scheduled_at ? new Date(b.scheduled_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }) : '';
  if (b.category === 'cab') return `${d.driver_name ? d.driver_name + ' · ' + d.vehicle_plate + ' · OTP ' + d.ride_otp + ' · ' : ''}${when}`;
  if (b.category === 'stay') return `Check-in ${d.check_in} · ${d.confirmation_code || ''}`;
  if (b.category === 'food') return `Order ${b.provider_ref} · arriving in ~${d.eta_minutes || 35} min`;
  return `${when}${d.ticket_code ? ' · Ticket ' + d.ticket_code : ''}`;
}

/** Add a confirmed booking to the trip ledger (split equally) and the itinerary timeline. */
function attachToTrip(b) {
  if (!b.trip_id) return;
  const trip = q.get('SELECT * FROM trips WHERE id = ?', b.trip_id);
  if (!trip) return;
  const categoryMap = { cab: 'transport', stay: 'stay', food: 'food', experience: 'activities' };
  let expenseId = null;
  if (!b.expense_id) {
    const e = addExpense({ tripId: b.trip_id, paidBy: b.user_id, title: b.title, category: categoryMap[b.category] || 'other', amount: b.total, bookingId: b.id, spentOn: (b.scheduled_at || now()).slice(0, 10) });
    expenseId = e.id;
    emitTrip(b.trip_id, 'expense', {});
  }
  let itemId = null;
  if (!b.item_id && b.scheduled_at) {
    const date = new Date(b.scheduled_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const dayNumber = Math.round((Date.parse(date) - Date.parse(trip.start_date)) / 86_400_000) + 1;
    if (dayNumber >= 1 && dayNumber <= dayCount(trip.start_date, trip.end_date)) {
      const d = b.details || {};
      const typeMap = { cab: 'transport', stay: 'stay', food: 'food', experience: 'activity' };
      const time = new Date(b.scheduled_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
      const item = addItemToDay(
        b.trip_id,
        dayNumber,
        {
          type: typeMap[b.category] || 'activity',
          title: b.category === 'cab' ? `${d.vehicle_class || 'Cab'}: ${d.pickup} → ${d.drop}` : b.title,
          description: `Booked via ${b.provider_name} · ${b.provider_ref}`,
          place_name: d.drop || d.property || d.venue || d.restaurant || null,
          lat: d.drop_lat ?? d.lat ?? null,
          lng: d.drop_lng ?? d.lng ?? null,
          start_time: time,
          cost: b.total,
          booking_id: b.id,
        },
        { userId: b.user_id, agent: b.source === 'agent' },
      );
      if (item) {
        itemId = item.id;
        emitTrip(b.trip_id, 'item:upsert', { item });
      }
    }
  }
  update('bookings', b.id, { expense_id: expenseId || b.expense_id, item_id: itemId || b.item_id });
}

function detachFromTrip(b) {
  if (b.expense_id) {
    q.run('DELETE FROM expenses WHERE id = ?', b.expense_id);
    if (b.trip_id) emitTrip(b.trip_id, 'expense', {});
  }
  if (b.item_id) {
    q.run('DELETE FROM itinerary_items WHERE id = ?', b.item_id);
    if (b.trip_id) emitTrip(b.trip_id, 'item:delete', { id: b.item_id });
  }
}

export function cancel(bookingId, user, { reason = 'Cancelled by traveller', byAdmin = false } = {}) {
  const booking = getBooking(bookingId);
  assertCanAct(booking, user);
  if (['cancelled', 'completed'].includes(booking.status)) throw badRequest(`This booking is already ${booking.status}`);
  let refundRow = null;
  if (booking.status !== 'proposed' && booking.payment_id) {
    refundRow = refund(booking.payment_id, { reason });
  }
  detachFromTrip(booking);
  update('bookings', booking.id, { status: 'cancelled', failure_reason: booking.status === 'proposed' ? 'Dismissed' : reason, updated_at: now() });
  audit({ tripId: booking.trip_id, userId: user.id, bookingId: booking.id, action: booking.status === 'proposed' ? 'dismissed' : 'cancelled', detail: { reason, refund: refundRow?.amount || 0, by_admin: byAdmin } });
  if (refundRow && booking.user_id) {
    notify(booking.user_id, { type: 'refund', title: `Refund of ₹${refundRow.amount.toLocaleString('en-IN')} initiated`, body: `${booking.title} was cancelled. The refund reaches your UPI account in 3–5 working days (ref ${refundRow.upi_ref}).`, link: '/app/bookings' });
  }
  const b = getBooking(booking.id);
  broadcast(b);
  return b;
}

/** Admin resolution of the human-in-the-loop queue. */
export function resolve(bookingId, admin, { action, note = '' }) {
  const booking = getBooking(bookingId);
  if (!booking) throw notFound('Booking not found');
  if (!['needs_attention', 'requested'].includes(booking.status)) throw badRequest('Only bookings awaiting attention can be resolved');
  update('bookings', booking.id, { resolution_note: note || null });
  if (action === 'retry') {
    return execute(booking.id, { forceSuccess: false }) || getBooking(booking.id);
  }
  if (action === 'confirm') {
    update('bookings', booking.id, { status: 'requested' });
    const b = execute(booking.id, { forceSuccess: true });
    audit({ tripId: booking.trip_id, userId: admin.id, bookingId: booking.id, action: 'resolved', detail: { action, note } });
    return b;
  }
  if (action === 'cancel_refund') {
    const b = cancel(booking.id, admin, { reason: note || 'Could not be fulfilled by provider', byAdmin: true });
    audit({ tripId: booking.trip_id, userId: admin.id, bookingId: booking.id, action: 'resolved', detail: { action, note } });
    return b;
  }
  throw badRequest('Unknown action');
}

/** Periodic job: mark past confirmed bookings completed and expire stale proposals. */
export function sweepBookings() {
  const cutoff = new Date(Date.now() - 3 * 3600_000).toISOString();
  const done = q.all(`SELECT id FROM bookings WHERE status = 'confirmed' AND scheduled_at IS NOT NULL AND scheduled_at < ?`, cutoff);
  for (const { id } of done) {
    update('bookings', id, { status: 'completed', updated_at: now() });
    broadcast(getBooking(id));
  }
  const ttlCutoff = new Date(Date.now() - setting('proposal_ttl_minutes') * 60_000).toISOString();
  q.run(`UPDATE bookings SET status = 'cancelled', failure_reason = 'Quote expired', updated_at = ? WHERE status = 'proposed' AND created_at < ?`, now(), ttlCutoff);
}

export { ACTIVE };
