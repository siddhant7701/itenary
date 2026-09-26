import { Router } from 'express';
import { insert, newId, now, parseJson, q, update } from '../db.js';
import { hashPassword, requireAdmin, selfUser } from '../lib/auth.js';
import { badRequest, date, int, notFound, num, oneOf, paginate, str, url } from '../lib/http.js';
import { findDestination } from '../data/places.js';
import { onlineUserCount, emitAdmins } from '../realtime.js';
import { aiStatus } from '../agent/concierge.js';
import { adminLog, notify, notifyMany } from '../services/notify.js';
import { adminSettings, updateSettings } from '../services/settings.js';
import { cancel, getBooking, resolve } from '../services/bookings.js';
import { payout, refund } from '../services/payments.js';
import { loadTripFull, listMembers } from '../services/trips.js';
import { refreshRating } from './feed.js';

const router = Router();
router.use(requireAdmin);

const like = (s) => `%${String(s).toLowerCase().slice(0, 60)}%`;
const ACTIVE_BOOKING = `status IN ('requested','confirmed','completed','needs_attention')`;
const REVENUE_BOOKING = `status IN ('confirmed','completed')`;

// ---------- Dashboard ----------
router.get('/stats', (_req, res) => {
  const d7 = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const since = new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10);
  const kpis = {
    users: q.value(`SELECT COUNT(*) FROM users WHERE role = 'user'`),
    users_new_7d: q.value(`SELECT COUNT(*) FROM users WHERE role = 'user' AND created_at >= ?`, d7),
    active_7d: q.value(`SELECT COUNT(*) FROM users WHERE role = 'user' AND last_seen_at >= ?`, d7),
    plus_users: q.value(`SELECT COUNT(*) FROM users WHERE plan = 'plus' AND (plan_expires_at IS NULL OR plan_expires_at > ?)`, now()),
    creators: q.value(`SELECT COUNT(DISTINCT creator_id) FROM public_itineraries WHERE status = 'published'`),
    trips: q.value('SELECT COUNT(*) FROM trips'),
    trips_active: q.value(`SELECT COUNT(*) FROM trips WHERE status IN ('planning','booked','ongoing')`),
    bookings: q.value(`SELECT COUNT(*) FROM bookings WHERE ${ACTIVE_BOOKING}`),
    proposals: q.value(`SELECT COUNT(*) FROM bookings`),
    gmv: q.value(`SELECT COALESCE(SUM(total),0) FROM bookings WHERE ${REVENUE_BOOKING}`),
    booking_revenue: q.value(`SELECT COALESCE(SUM(fee + commission),0) FROM bookings WHERE ${REVENUE_BOOKING}`),
    marketplace_revenue: q.value('SELECT COALESCE(SUM(platform_fee),0) FROM itinerary_purchases'),
    subscription_revenue: q.value(`SELECT COALESCE(SUM(amount),0) FROM payments WHERE purpose = 'subscription' AND status = 'success'`),
    refunds: q.value(`SELECT COALESCE(SUM(amount),0) FROM payments WHERE purpose = 'refund'`),
    itineraries: q.value(`SELECT COUNT(*) FROM public_itineraries WHERE status = 'published'`),
    forks: q.value('SELECT COUNT(*) FROM forks'),
    online_now: onlineUserCount(),
  };
  kpis.total_revenue = kpis.booking_revenue + kpis.marketplace_revenue + kpis.subscription_revenue;
  kpis.conversion = kpis.proposals ? Math.round((q.value(`SELECT COUNT(*) FROM bookings WHERE ${ACTIVE_BOOKING}`) / kpis.proposals) * 100) : 0;

  const daily = (sql) => Object.fromEntries(q.all(sql, since).map((r) => [r.d, r]));
  const signups = daily(`SELECT date(created_at) AS d, COUNT(*) AS n FROM users WHERE role = 'user' AND date(created_at) >= ? GROUP BY d`);
  const books = daily(`SELECT date(created_at) AS d, COUNT(*) AS n, COALESCE(SUM(total),0) AS gmv, COALESCE(SUM(fee + commission),0) AS rev FROM bookings WHERE ${ACTIVE_BOOKING} AND date(created_at) >= ? GROUP BY d`);
  const market = daily(`SELECT date(created_at) AS d, COALESCE(SUM(platform_fee),0) AS rev FROM itinerary_purchases WHERE date(created_at) >= ? GROUP BY d`);
  const subs = daily(`SELECT date(created_at) AS d, COALESCE(SUM(amount),0) AS rev FROM payments WHERE purpose = 'subscription' AND date(created_at) >= ? GROUP BY d`);
  const series = [];
  for (let k = 0; k < 30; k++) {
    const d = new Date(Date.parse(since) + k * 86_400_000).toISOString().slice(0, 10);
    series.push({ date: d, signups: signups[d]?.n || 0, bookings: books[d]?.n || 0, gmv: books[d]?.gmv || 0, revenue: (books[d]?.rev || 0) + (market[d]?.rev || 0) + (subs[d]?.rev || 0) });
  }

  res.json({
    kpis,
    series,
    by_category: q.all(`SELECT category, COUNT(*) AS count, COALESCE(SUM(total),0) AS gmv FROM bookings WHERE ${ACTIVE_BOOKING} GROUP BY category ORDER BY gmv DESC`),
    by_status: q.all(`SELECT status, COUNT(*) AS count FROM bookings GROUP BY status`),
    top_destinations: q.all(`SELECT destination, COUNT(*) AS trips FROM trips WHERE destination != '' GROUP BY lower(destination) ORDER BY trips DESC LIMIT 8`),
    queues: {
      needs_attention: q.value(`SELECT COUNT(*) FROM bookings WHERE status = 'needs_attention'`),
      sos_active: q.value(`SELECT COUNT(*) FROM sos_alerts WHERE status IN ('active','acknowledged')`),
      verifications: q.value(`SELECT COUNT(*) FROM users WHERE verification_status = 'pending'`),
      payouts: q.value(`SELECT COUNT(*) FROM payouts WHERE status IN ('requested','approved')`),
      flagged_reviews: q.value(`SELECT COUNT(*) FROM reviews WHERE status = 'flagged'`),
    },
    recent_bookings: q.all(`SELECT b.id, b.title, b.category, b.status, b.total, b.created_at, u.name AS user_name FROM bookings b LEFT JOIN users u ON u.id = b.user_id WHERE b.status != 'proposed' ORDER BY b.updated_at DESC LIMIT 8`),
    recent_users: q.all(`SELECT id, name, phone, created_at, verified FROM users WHERE role = 'user' ORDER BY created_at DESC LIMIT 6`),
    ai: aiStatus(),
  });
});

// ---------- Users ----------
router.get('/users', (req, res) => {
  const { limit, offset } = paginate(req.query);
  const where = ['1=1'];
  const p = {};
  if (req.query.q) {
    where.push('(lower(name) LIKE :q OR phone LIKE :q OR lower(COALESCE(email, \'\')) LIKE :q)');
    p.q = like(req.query.q);
  }
  if (req.query.role) {
    where.push('role = :role');
    p.role = String(req.query.role);
  }
  if (req.query.status) {
    where.push('status = :status');
    p.status = String(req.query.status);
  }
  if (req.query.verification) {
    where.push('verification_status = :v');
    p.v = String(req.query.verification);
  }
  if (req.query.plan === 'plus') where.push(`plan = 'plus'`);
  const rows = q.all(
    `SELECT u.*, (SELECT COUNT(*) FROM trip_members m WHERE m.user_id = u.id) AS trip_count,
     (SELECT COUNT(*) FROM bookings b WHERE b.user_id = u.id AND b.${ACTIVE_BOOKING}) AS booking_count,
     (SELECT COUNT(*) FROM public_itineraries i WHERE i.creator_id = u.id) AS itinerary_count
     FROM users u WHERE ${where.join(' AND ')} ORDER BY u.created_at DESC LIMIT ${limit} OFFSET ${offset}`,
    p,
  );
  res.json({
    users: rows.map((u) => ({ ...selfUser(u), last_seen_at: u.last_seen_at, verification_note: u.verification_note, trip_count: u.trip_count, booking_count: u.booking_count, itinerary_count: u.itinerary_count })),
    total: q.value(`SELECT COUNT(*) FROM users WHERE ${where.join(' AND ')}`, p),
  });
});

router.get('/users/:id', (req, res) => {
  const u = q.get('SELECT * FROM users WHERE id = ?', req.params.id);
  if (!u) throw notFound('User not found');
  res.json({
    user: { ...selfUser(u), last_seen_at: u.last_seen_at, verification_note: u.verification_note },
    trips: q.all(`SELECT t.id, t.name, t.destination, t.start_date, t.end_date, t.status, m.role FROM trips t JOIN trip_members m ON m.trip_id = t.id WHERE m.user_id = ? ORDER BY t.start_date DESC`, u.id),
    bookings: q.all(`SELECT id, title, category, status, total, created_at FROM bookings WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`, u.id),
    payments: q.all(`SELECT id, purpose, amount, status, upi_ref, created_at FROM payments WHERE user_id = ? OR payee_user_id = ? ORDER BY created_at DESC LIMIT 50`, u.id, u.id),
    itineraries: q.all(`SELECT id, title, status, price, fork_count, sales_count FROM public_itineraries WHERE creator_id = ? ORDER BY created_at DESC`, u.id),
    sos: q.all(`SELECT * FROM sos_alerts WHERE user_id = ? ORDER BY created_at DESC LIMIT 10`, u.id),
  });
});

router.patch('/users/:id', (req, res) => {
  const u = q.get('SELECT * FROM users WHERE id = ?', req.params.id);
  if (!u) throw notFound('User not found');
  if (u.id === req.user.id && (req.body.status === 'suspended' || req.body.role === 'user')) throw badRequest("You can't suspend or demote yourself");
  const b = req.body;
  const fields = {
    name: str(b.name, 'Name', { max: 60 }),
    role: oneOf(b.role, 'Role', ['user', 'admin']),
    status: oneOf(b.status, 'Status', ['active', 'suspended']),
    plan: oneOf(b.plan, 'Plan', ['free', 'plus']),
    plan_expires_at: b.plan_expires_at === null ? null : date(b.plan_expires_at, 'Plan expiry') ? new Date(b.plan_expires_at).toISOString() : undefined,
  };
  if (b.verified !== undefined) {
    fields.verified = b.verified ? 1 : 0;
    fields.verification_status = b.verified ? 'approved' : oneOf(b.verification_status, 'Verification', ['none', 'rejected']) || 'rejected';
  }
  if (fields.role === 'admin' && !u.email) throw badRequest('Add an email and password before granting admin access (use “Create admin”).');
  update('users', u.id, fields);
  if (b.verified === true && !u.verified) notify(u.id, { type: 'verified', title: '✅ You are now a Verified Traveller', body: 'Your verified badge now shows on your profile, trips and itineraries.', link: '/app/profile' });
  if (b.verified === false && u.verification_status === 'pending') notify(u.id, { type: 'verification', title: 'Verification needs more info', body: str(b.note, 'Note', { max: 200 }) || 'Please make sure your profile and emergency contact are complete, then request again.', link: '/app/profile' });
  if (fields.plan === 'plus' && u.plan !== 'plus') notify(u.id, { type: 'plus', title: 'You have been upgraded to Itenary Plus ✨', link: '/app/profile' });
  adminLog(req.user.id, 'user.update', u.id, fields);
  res.json({ user: selfUser(q.get('SELECT * FROM users WHERE id = ?', u.id)) });
});

router.post('/admins', (req, res) => {
  const email = str(req.body.email, 'Email', { required: true, max: 120 }).toLowerCase();
  const password = str(req.body.password, 'Password', { required: true, min: 8, max: 200 });
  if (!/^\S+@\S+\.\S+$/.test(email)) throw badRequest('Enter a valid email');
  if (q.get('SELECT 1 FROM users WHERE lower(email) = ?', email)) throw badRequest('An account with that email already exists');
  const user = insert('users', { id: newId(), email, password_hash: hashPassword(password), name: str(req.body.name, 'Name', { required: true, max: 60 }), role: 'admin', onboarded: 1, created_at: now() });
  adminLog(req.user.id, 'admin.create', user.id, { email });
  res.status(201).json({ user: selfUser(user) });
});

router.post('/me/password', (req, res) => {
  const password = str(req.body.password, 'Password', { required: true, min: 8, max: 200 });
  update('users', req.user.id, { password_hash: hashPassword(password) });
  adminLog(req.user.id, 'admin.password', req.user.id);
  res.json({ ok: true });
});

// ---------- Trips ----------
router.get('/trips', (req, res) => {
  const { limit, offset } = paginate(req.query);
  const where = ['1=1'];
  const p = {};
  if (req.query.q) {
    where.push('(lower(t.name) LIKE :q OR lower(t.destination) LIKE :q)');
    p.q = like(req.query.q);
  }
  if (req.query.status) {
    where.push('t.status = :status');
    p.status = String(req.query.status);
  }
  const rows = q.all(
    `SELECT t.*, u.name AS owner_name, (SELECT COUNT(*) FROM trip_members m WHERE m.trip_id = t.id) AS member_count,
     (SELECT COUNT(*) FROM itinerary_items i WHERE i.trip_id = t.id) AS item_count,
     (SELECT COALESCE(SUM(total),0) FROM bookings b WHERE b.trip_id = t.id AND b.${ACTIVE_BOOKING}) AS booked_total
     FROM trips t LEFT JOIN users u ON u.id = t.owner_id WHERE ${where.join(' AND ')} ORDER BY t.updated_at DESC LIMIT ${limit} OFFSET ${offset}`,
    p,
  );
  res.json({ trips: rows, total: q.value(`SELECT COUNT(*) FROM trips t WHERE ${where.join(' AND ')}`, p) });
});

router.get('/trips/:id', (req, res) => {
  const t = q.get('SELECT * FROM trips WHERE id = ?', req.params.id);
  if (!t) throw notFound('Trip not found');
  const data = loadTripFull(t.id, req.user.id);
  data.bookings = q.all('SELECT * FROM bookings WHERE trip_id = ? ORDER BY created_at DESC', t.id).map((b) => ({ ...b, details: parseJson(b.details, {}) }));
  data.chat_count = q.value('SELECT COUNT(*) FROM chat_messages WHERE trip_id = ?', t.id);
  res.json(data);
});

router.delete('/trips/:id', (req, res) => {
  const t = q.get('SELECT * FROM trips WHERE id = ?', req.params.id);
  if (!t) throw notFound('Trip not found');
  const members = listMembers(t.id);
  q.run('DELETE FROM trips WHERE id = ?', t.id);
  notifyMany(members.map((m) => m.user_id), { type: 'trip_removed', title: `“${t.name}” was removed by Itenary support`, body: str(req.body?.reason, 'Reason', { max: 200 }) || 'It violated our community guidelines.' });
  adminLog(req.user.id, 'trip.delete', t.id, { name: t.name });
  res.json({ ok: true });
});

// ---------- Bookings (incl. human-in-the-loop queue) ----------
router.get('/bookings', (req, res) => {
  const { limit, offset } = paginate(req.query, { defaultLimit: 30 });
  const where = ['1=1'];
  const p = {};
  if (req.query.status) {
    const list = String(req.query.status).split(',');
    where.push(`b.status IN (${list.map((_, i) => ':s' + i).join(',')})`);
    list.forEach((s, i) => (p['s' + i] = s));
  }
  if (req.query.category) {
    where.push('b.category = :cat');
    p.cat = String(req.query.category);
  }
  if (req.query.q) {
    where.push('(lower(b.title) LIKE :q OR lower(COALESCE(u.name, \'\')) LIKE :q OR b.id LIKE :q OR lower(COALESCE(b.provider_ref, \'\')) LIKE :q)');
    p.q = like(req.query.q);
  }
  const rows = q.all(
    `SELECT b.*, u.name AS user_name, u.phone AS user_phone, t.name AS trip_name FROM bookings b LEFT JOIN users u ON u.id = b.user_id LEFT JOIN trips t ON t.id = b.trip_id
     WHERE ${where.join(' AND ')} ORDER BY CASE b.status WHEN 'needs_attention' THEN 0 ELSE 1 END, b.updated_at DESC LIMIT ${limit} OFFSET ${offset}`,
    p,
  );
  res.json({ bookings: rows.map((b) => ({ ...b, details: parseJson(b.details, {}) })), total: q.value(`SELECT COUNT(*) FROM bookings b LEFT JOIN users u ON u.id = b.user_id WHERE ${where.join(' AND ')}`, p) });
});

router.get('/bookings/:id', (req, res) => {
  const b = getBooking(req.params.id);
  if (!b) throw notFound('Booking not found');
  res.json({
    booking: b,
    user: selfUser(q.get('SELECT * FROM users WHERE id = ?', b.user_id)),
    trip: b.trip_id ? q.get('SELECT id, name, destination, start_date, end_date FROM trips WHERE id = ?', b.trip_id) : null,
    payments: q.all('SELECT * FROM payments WHERE booking_id = ? ORDER BY created_at', b.id),
    audit: q.all('SELECT * FROM agent_audit WHERE booking_id = ? ORDER BY created_at', b.id).map((a) => ({ ...a, detail: parseJson(a.detail, {}) })),
  });
});

router.post('/bookings/:id/resolve', (req, res) => {
  const action = oneOf(req.body.action, 'Action', ['confirm', 'retry', 'cancel_refund'], { required: true });
  const b = resolve(req.params.id, req.user, { action, note: str(req.body.note, 'Note', { max: 300 }) || '' });
  adminLog(req.user.id, `booking.${action}`, req.params.id, { note: req.body.note });
  res.json({ booking: b || getBooking(req.params.id) });
});

router.post('/bookings/:id/cancel', (req, res) => {
  const b = cancel(req.params.id, req.user, { reason: str(req.body.reason, 'Reason', { max: 200 }) || 'Cancelled by support', byAdmin: true });
  adminLog(req.user.id, 'booking.cancel', req.params.id, { reason: req.body.reason });
  res.json({ booking: b });
});

// ---------- Payments & payouts ----------
router.get('/payments', (req, res) => {
  const { limit, offset } = paginate(req.query, { defaultLimit: 40 });
  const where = ['1=1'];
  const p = {};
  if (req.query.purpose) {
    where.push('p.purpose = :purpose');
    p.purpose = String(req.query.purpose);
  }
  if (req.query.q) {
    where.push('(p.upi_ref LIKE :q OR lower(COALESCE(u.name, \'\')) LIKE :q OR p.id LIKE :q)');
    p.q = like(req.query.q);
  }
  const rows = q.all(
    `SELECT p.*, u.name AS user_name, pu.name AS payee_name FROM payments p LEFT JOIN users u ON u.id = p.user_id LEFT JOIN users pu ON pu.id = p.payee_user_id
     WHERE ${where.join(' AND ')} ORDER BY p.created_at DESC LIMIT ${limit} OFFSET ${offset}`,
    p,
  );
  const totals = q.all(`SELECT purpose, COUNT(*) AS count, COALESCE(SUM(amount),0) AS amount FROM payments GROUP BY purpose`);
  res.json({ payments: rows.map((r) => ({ ...r, meta: parseJson(r.meta, {}) })), total: q.value(`SELECT COUNT(*) FROM payments p LEFT JOIN users u ON u.id = p.user_id WHERE ${where.join(' AND ')}`, p), totals });
});

router.post('/payments/:id/refund', (req, res) => {
  const p = q.get('SELECT * FROM payments WHERE id = ?', req.params.id);
  if (!p) throw notFound('Payment not found');
  if (p.booking_id) {
    const b = getBooking(p.booking_id);
    if (b && !['cancelled'].includes(b.status)) {
      const cancelled = cancel(b.id, req.user, { reason: str(req.body.reason, 'Reason', { max: 200 }) || 'Refunded by support', byAdmin: true });
      adminLog(req.user.id, 'payment.refund', p.id, { booking: b.id });
      return res.json({ booking: cancelled });
    }
  }
  if (!['purchase', 'tip', 'subscription', 'settlement'].includes(p.purpose)) throw badRequest('This payment cannot be refunded');
  const r = refund(p.id, { reason: str(req.body.reason, 'Reason', { max: 200 }) || 'Refunded by support' });
  if (!r) throw badRequest('This payment was already refunded');
  if (p.purpose === 'purchase' || p.purpose === 'tip') q.run('DELETE FROM itinerary_purchases WHERE payment_id = ?', p.id);
  if (p.user_id) notify(p.user_id, { type: 'refund', title: `Refund of ₹${r.amount.toLocaleString('en-IN')} initiated`, body: `UPI ref ${r.upi_ref}. It reaches your account in 3–5 working days.` });
  adminLog(req.user.id, 'payment.refund', p.id, { amount: r.amount });
  res.json({ refund: r });
});

router.get('/payouts', (req, res) => {
  const status = req.query.status ? String(req.query.status) : null;
  const rows = q.all(
    `SELECT p.*, u.name AS creator_name, u.phone AS creator_phone FROM payouts p JOIN users u ON u.id = p.creator_id
     ${status ? 'WHERE p.status = ?' : ''} ORDER BY CASE p.status WHEN 'requested' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, p.created_at DESC LIMIT 200`,
    ...(status ? [status] : []),
  );
  res.json({ payouts: rows });
});

router.patch('/payouts/:id', (req, res) => {
  const p = q.get('SELECT * FROM payouts WHERE id = ?', req.params.id);
  if (!p) throw notFound('Payout not found');
  const status = oneOf(req.body.status, 'Status', ['approved', 'paid', 'rejected'], { required: true });
  if (p.status === 'paid' || p.status === 'rejected') throw badRequest(`This payout is already ${p.status}`);
  const note = str(req.body.note, 'Note', { max: 200 }) || '';
  if (status === 'paid') payout({ userId: p.creator_id, amount: p.amount, upiId: p.upi_id, payoutId: p.id });
  update('payouts', p.id, { status, note, processed_at: now() });
  const rupee = '₹' + p.amount.toLocaleString('en-IN');
  if (status === 'paid') notify(p.creator_id, { type: 'payout', title: `💸 Payout of ${rupee} sent`, body: `Sent to ${p.upi_id}.`, link: '/app/creator' });
  if (status === 'rejected') notify(p.creator_id, { type: 'payout', title: `Payout of ${rupee} was not processed`, body: note || 'Please check your UPI ID and request again.', link: '/app/creator' });
  adminLog(req.user.id, `payout.${status}`, p.id, { amount: p.amount });
  res.json({ payout: q.get('SELECT * FROM payouts WHERE id = ?', p.id) });
});

// ---------- Marketplace moderation ----------
router.get('/itineraries', (req, res) => {
  const where = ['1=1'];
  const p = {};
  if (req.query.status) {
    where.push('i.status = :status');
    p.status = String(req.query.status);
  }
  if (req.query.q) {
    where.push('(lower(i.title) LIKE :q OR lower(i.destination) LIKE :q OR lower(u.name) LIKE :q)');
    p.q = like(req.query.q);
  }
  if (req.query.premium === '1') where.push('i.price > 0');
  const rows = q.all(
    `SELECT i.*, u.name AS creator_name, u.verified AS creator_verified,
     (SELECT COALESCE(SUM(amount),0) FROM itinerary_purchases pp WHERE pp.itinerary_id = i.id) AS gross
     FROM public_itineraries i JOIN users u ON u.id = i.creator_id WHERE ${where.join(' AND ')} ORDER BY i.created_at DESC LIMIT 200`,
    p,
  );
  res.json({ itineraries: rows.map((r) => ({ ...r, tags: parseJson(r.tags, []), content: undefined, verified_premium: !!r.verified_premium, featured: !!r.featured, creator_verified: !!r.creator_verified })) });
});

router.patch('/itineraries/:id', (req, res) => {
  const i = q.get('SELECT * FROM public_itineraries WHERE id = ?', req.params.id);
  if (!i) throw notFound('Itinerary not found');
  const b = req.body;
  const fields = {
    featured: b.featured === undefined ? undefined : b.featured ? 1 : 0,
    verified_premium: b.verified_premium === undefined ? undefined : b.verified_premium ? 1 : 0,
    status: oneOf(b.status, 'Status', ['published', 'unpublished', 'removed']),
    price: int(b.price, 'Price', { min: 0, max: 2999 }),
    updated_at: now(),
  };
  update('public_itineraries', i.id, fields);
  if (fields.status === 'removed') notify(i.creator_id, { type: 'moderation', title: `“${i.title}” was removed from the feed`, body: str(b.reason, 'Reason', { max: 200 }) || 'It did not meet our community guidelines.' });
  if (fields.verified_premium === 1 && !i.verified_premium) notify(i.creator_id, { type: 'promoted', title: `🎉 “${i.title}” is now Verified Premium`, link: '/app/creator' });
  if (fields.featured === 1 && !i.featured) notify(i.creator_id, { type: 'featured', title: `⭐ “${i.title}” is featured on the feed`, link: `/app/itineraries/${i.id}` });
  adminLog(req.user.id, 'itinerary.update', i.id, fields);
  res.json({ ok: true });
});

router.get('/reviews', (req, res) => {
  const status = req.query.status ? String(req.query.status) : null;
  const rows = q.all(
    `SELECT r.*, u.name AS user_name, i.title AS itinerary_title FROM reviews r JOIN users u ON u.id = r.user_id JOIN public_itineraries i ON i.id = r.itinerary_id
     ${status ? 'WHERE r.status = ?' : ''} ORDER BY CASE r.status WHEN 'flagged' THEN 0 ELSE 1 END, r.report_count DESC, r.created_at DESC LIMIT 200`,
    ...(status ? [status] : []),
  );
  res.json({ reviews: rows });
});

router.patch('/reviews/:id', (req, res) => {
  const r = q.get('SELECT * FROM reviews WHERE id = ?', req.params.id);
  if (!r) throw notFound('Review not found');
  const status = oneOf(req.body.status, 'Status', ['visible', 'hidden'], { required: true });
  update('reviews', r.id, { status, report_count: status === 'visible' ? 0 : r.report_count });
  refreshRating(r.itinerary_id);
  adminLog(req.user.id, `review.${status}`, r.id);
  res.json({ ok: true });
});

router.delete('/reviews/:id', (req, res) => {
  const r = q.get('SELECT * FROM reviews WHERE id = ?', req.params.id);
  if (!r) throw notFound('Review not found');
  q.run('DELETE FROM reviews WHERE id = ?', r.id);
  refreshRating(r.itinerary_id);
  adminLog(req.user.id, 'review.delete', r.id);
  res.json({ ok: true });
});

// ---------- Events ----------
const EVENT_CATEGORIES = ['festival', 'activity', 'food', 'culture', 'adventure', 'music'];
function eventFields(b, partial) {
  const f = {
    title: str(b.title, 'Title', { required: !partial, max: 120 }),
    description: b.description !== undefined ? str(b.description, 'Description', { max: 2000 }) ?? '' : undefined,
    city: str(b.city, 'City', { required: !partial, max: 60 }),
    venue: b.venue !== undefined ? str(b.venue, 'Venue', { max: 120 }) ?? '' : undefined,
    category: oneOf(b.category, 'Category', EVENT_CATEGORIES),
    start_at: b.start_at ? new Date(b.start_at).toISOString() : undefined,
    end_at: b.end_at ? new Date(b.end_at).toISOString() : b.end_at === null ? null : undefined,
    price: int(b.price, 'Price', { min: 0, max: 500000 }),
    capacity: int(b.capacity, 'Capacity', { min: 1, max: 100000 }),
    image_url: b.image_url !== undefined ? url(b.image_url, 'Image') ?? null : undefined,
    status: oneOf(b.status, 'Status', ['active', 'hidden']),
    lat: num(b.lat, 'Latitude'),
    lng: num(b.lng, 'Longitude'),
  };
  if (!partial && !f.start_at) throw badRequest('Start time is required');
  if (f.city && f.lat === undefined) {
    const d = findDestination(f.city);
    if (d) {
      f.lat = d.lat;
      f.lng = d.lng;
      f.cover_theme = d.theme;
    }
  }
  return f;
}

router.get('/events', (_req, res) => {
  res.json({ events: q.all('SELECT * FROM events ORDER BY start_at DESC LIMIT 300') });
});

router.post('/events', (req, res) => {
  const f = eventFields(req.body, false);
  const e = insert('events', { id: newId(), booked_count: 0, cover_theme: 'festival', status: 'active', category: 'activity', price: 0, capacity: 50, description: '', venue: '', created_at: now(), ...Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined)) });
  adminLog(req.user.id, 'event.create', e.id, { title: e.title });
  res.status(201).json({ event: e });
});

router.patch('/events/:id', (req, res) => {
  const e = q.get('SELECT * FROM events WHERE id = ?', req.params.id);
  if (!e) throw notFound('Event not found');
  update('events', e.id, eventFields(req.body, true));
  adminLog(req.user.id, 'event.update', e.id);
  res.json({ event: q.get('SELECT * FROM events WHERE id = ?', e.id) });
});

router.delete('/events/:id', (req, res) => {
  const e = q.get('SELECT * FROM events WHERE id = ?', req.params.id);
  if (!e) throw notFound('Event not found');
  if (e.booked_count > 0) {
    update('events', e.id, { status: 'hidden' });
    adminLog(req.user.id, 'event.hide', e.id);
    return res.json({ ok: true, hidden: true });
  }
  q.run('DELETE FROM events WHERE id = ?', e.id);
  adminLog(req.user.id, 'event.delete', e.id);
  res.json({ ok: true });
});

// ---------- Provider connectors ----------
router.get('/providers', (_req, res) => {
  const rows = q.all(`SELECT p.*, (SELECT COUNT(*) FROM bookings b WHERE b.provider_id = p.id AND b.${ACTIVE_BOOKING}) AS bookings,
    (SELECT COUNT(*) FROM bookings b WHERE b.provider_id = p.id AND b.status = 'needs_attention') AS attention,
    (SELECT COALESCE(SUM(commission),0) FROM bookings b WHERE b.provider_id = p.id AND b.${REVENUE_BOOKING}) AS commission_earned
    FROM providers p ORDER BY category, name`);
  res.json({ providers: rows.map((p) => ({ ...p, enabled: !!p.enabled })) });
});

router.post('/providers', (req, res) => {
  const p = insert('providers', {
    id: newId(),
    category: oneOf(req.body.category, 'Category', ['cab', 'food', 'stay', 'experience'], { required: true }),
    name: str(req.body.name, 'Name', { required: true, max: 60 }),
    description: str(req.body.description, 'Description', { max: 300 }) || '',
    enabled: 1,
    commission_pct: num(req.body.commission_pct, 'Commission', { min: 0, max: 50 }) ?? 8,
    failure_rate: num(req.body.failure_rate, 'Failure rate', { min: 0, max: 1 }) ?? 0.05,
    rating: num(req.body.rating, 'Rating', { min: 1, max: 5 }) ?? 4.5,
    price_factor: num(req.body.price_factor, 'Price factor', { min: 0.5, max: 2 }) ?? 1,
    created_at: now(),
  });
  adminLog(req.user.id, 'provider.create', p.id, { name: p.name });
  res.status(201).json({ provider: p });
});

router.patch('/providers/:id', (req, res) => {
  const p = q.get('SELECT * FROM providers WHERE id = ?', req.params.id);
  if (!p) throw notFound('Provider not found');
  const fields = {
    name: str(req.body.name, 'Name', { max: 60 }),
    description: req.body.description !== undefined ? str(req.body.description, 'Description', { max: 300 }) ?? '' : undefined,
    enabled: req.body.enabled === undefined ? undefined : req.body.enabled ? 1 : 0,
    commission_pct: num(req.body.commission_pct, 'Commission', { min: 0, max: 50 }),
    failure_rate: num(req.body.failure_rate, 'Failure rate', { min: 0, max: 1 }),
    rating: num(req.body.rating, 'Rating', { min: 1, max: 5 }),
    price_factor: num(req.body.price_factor, 'Price factor', { min: 0.5, max: 2 }),
  };
  update('providers', p.id, fields);
  adminLog(req.user.id, 'provider.update', p.id, fields);
  res.json({ provider: { ...q.get('SELECT * FROM providers WHERE id = ?', p.id) } });
});

// ---------- Safety ----------
router.get('/sos', (req, res) => {
  const status = req.query.status ? String(req.query.status) : null;
  const rows = q.all(
    `SELECT s.*, u.name AS user_name, u.phone, u.emergency_name, u.emergency_phone, t.name AS trip_name, t.destination FROM sos_alerts s
     JOIN users u ON u.id = s.user_id LEFT JOIN trips t ON t.id = s.trip_id ${status ? 'WHERE s.status = ?' : ''}
     ORDER BY CASE s.status WHEN 'active' THEN 0 WHEN 'acknowledged' THEN 1 ELSE 2 END, s.created_at DESC LIMIT 200`,
    ...(status ? [status] : []),
  );
  res.json({ alerts: rows });
});

router.patch('/sos/:id', (req, res) => {
  const s = q.get('SELECT * FROM sos_alerts WHERE id = ?', req.params.id);
  if (!s) throw notFound('Alert not found');
  const status = oneOf(req.body.status, 'Status', ['acknowledged', 'resolved'], { required: true });
  const note = str(req.body.note, 'Note', { max: 300 }) || null;
  update('sos_alerts', s.id, { status, resolution_note: note, resolved_at: status === 'resolved' ? now() : null });
  notify(s.user_id, {
    type: 'sos_update',
    title: status === 'acknowledged' ? '🛟 Our safety team is on it' : '✅ Your SOS alert has been resolved',
    body: note || (status === 'acknowledged' ? 'An Itenary safety specialist has seen your alert and is reaching out.' : 'Stay safe out there.'),
  });
  emitAdmins('sos', { ...s, status });
  adminLog(req.user.id, `sos.${status}`, s.id, { note });
  res.json({ ok: true });
});

// ---------- Audit & logs ----------
router.get('/audit', (req, res) => {
  const { limit, offset } = paginate(req.query, { defaultLimit: 50 });
  const where = ['1=1'];
  const p = {};
  if (req.query.action) {
    where.push('a.action = :action');
    p.action = String(req.query.action);
  }
  if (req.query.booking_id) {
    where.push('a.booking_id = :booking');
    p.booking = String(req.query.booking_id);
  }
  const rows = q.all(
    `SELECT a.*, u.name AS user_name, t.name AS trip_name, b.title AS booking_title FROM agent_audit a LEFT JOIN users u ON u.id = a.user_id
     LEFT JOIN trips t ON t.id = a.trip_id LEFT JOIN bookings b ON b.id = a.booking_id WHERE ${where.join(' AND ')} ORDER BY a.created_at DESC LIMIT ${limit} OFFSET ${offset}`,
    p,
  );
  res.json({ audit: rows.map((r) => ({ ...r, detail: parseJson(r.detail, {}) })), total: q.value(`SELECT COUNT(*) FROM agent_audit a WHERE ${where.join(' AND ')}`, p) });
});

router.get('/logs', (req, res) => {
  const { limit, offset } = paginate(req.query, { defaultLimit: 50 });
  const rows = q.all(`SELECT l.*, u.name AS admin_name FROM admin_logs l LEFT JOIN users u ON u.id = l.admin_id ORDER BY l.created_at DESC LIMIT ${limit} OFFSET ${offset}`);
  res.json({ logs: rows.map((r) => ({ ...r, detail: parseJson(r.detail, {}) })), total: q.value('SELECT COUNT(*) FROM admin_logs') });
});

// ---------- Settings, announcements & broadcasts ----------
router.get('/settings', (_req, res) => {
  res.json({ settings: adminSettings(), ai: aiStatus() });
});

router.patch('/settings', (req, res) => {
  const patch = { ...req.body };
  if (typeof patch.anthropic_api_key === 'string' && patch.anthropic_api_key.startsWith('••••')) delete patch.anthropic_api_key;
  updateSettings(patch);
  adminLog(req.user.id, 'settings.update', null, { keys: Object.keys(patch) });
  res.json({ settings: adminSettings(), ai: aiStatus() });
});

router.get('/announcements', (_req, res) => {
  res.json({ announcements: q.all('SELECT * FROM announcements ORDER BY created_at DESC') });
});

router.post('/announcements', (req, res) => {
  const a = insert('announcements', {
    id: newId(),
    title: str(req.body.title, 'Title', { required: true, max: 120 }),
    body: str(req.body.body, 'Body', { max: 500 }) || '',
    level: oneOf(req.body.level, 'Level', ['info', 'success', 'warning']) || 'info',
    active: 1,
    created_at: now(),
  });
  adminLog(req.user.id, 'announcement.create', a.id);
  res.status(201).json({ announcement: a });
});

router.patch('/announcements/:id', (req, res) => {
  update('announcements', req.params.id, {
    active: req.body.active === undefined ? undefined : req.body.active ? 1 : 0,
    title: str(req.body.title, 'Title', { max: 120 }),
    body: req.body.body !== undefined ? str(req.body.body, 'Body', { max: 500 }) ?? '' : undefined,
    level: oneOf(req.body.level, 'Level', ['info', 'success', 'warning']),
  });
  res.json({ ok: true });
});

router.delete('/announcements/:id', (req, res) => {
  q.run('DELETE FROM announcements WHERE id = ?', req.params.id);
  res.json({ ok: true });
});

router.post('/broadcast', (req, res) => {
  const title = str(req.body.title, 'Title', { required: true, max: 120 });
  const body = str(req.body.body, 'Message', { max: 500 }) || '';
  const audience = oneOf(req.body.audience, 'Audience', ['all', 'plus', 'creators', 'active_trips']) || 'all';
  const sql = {
    all: `SELECT id FROM users WHERE role = 'user' AND status = 'active'`,
    plus: `SELECT id FROM users WHERE role = 'user' AND status = 'active' AND plan = 'plus'`,
    creators: `SELECT DISTINCT creator_id AS id FROM public_itineraries WHERE status = 'published'`,
    active_trips: `SELECT DISTINCT m.user_id AS id FROM trip_members m JOIN trips t ON t.id = m.trip_id WHERE t.status IN ('planning','booked','ongoing')`,
  }[audience];
  const ids = q.all(sql).map((r) => r.id);
  notifyMany(ids, { type: 'broadcast', title, body, link: str(req.body.link, 'Link', { max: 200 }) || null });
  adminLog(req.user.id, 'broadcast', audience, { title, recipients: ids.length });
  res.json({ recipients: ids.length });
});

export default router;
