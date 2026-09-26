import { Router } from 'express';
import { insert, newId, now, parseJson, q, update } from '../db.js';
import { optionalAuth, publicUser, requireAuth } from '../lib/auth.js';
import { HttpError, badRequest, date, forbidden, int, notFound, oneOf, str } from '../lib/http.js';
import { collect, checkUpiAuthorisation } from '../services/payments.js';
import { getSettings } from '../services/settings.js';
import { notify } from '../services/notify.js';
import { forkIntoTrip } from '../services/trips.js';
import { ITINERARY_TAGS } from './trips.js';

const router = Router();
const rupee = (n) => '₹' + Math.round(n).toLocaleString('en-IN');

function serialize(i, userId) {
  const creator = q.get('SELECT * FROM users WHERE id = ?', i.creator_id);
  return {
    ...i,
    tags: parseJson(i.tags, []),
    content: undefined,
    verified_premium: !!i.verified_premium,
    featured: !!i.featured,
    is_premium: i.price > 0,
    creator: publicUser(creator),
    liked: userId ? !!q.get('SELECT 1 FROM itinerary_likes WHERE itinerary_id = ? AND user_id = ?', i.id, userId) : false,
    purchased: userId ? hasAccess(i, userId) : false,
  };
}

function hasAccess(i, userId) {
  if (!userId) return i.price === 0;
  if (i.price === 0 || i.creator_id === userId) return true;
  return !!q.get(`SELECT 1 FROM itinerary_purchases WHERE itinerary_id = ? AND buyer_id = ? AND kind = 'purchase'`, i.id, userId);
}

function getPublished(id) {
  const i = q.get('SELECT * FROM public_itineraries WHERE id = ?', id);
  if (!i || i.status === 'removed') throw notFound('Itinerary not found');
  return i;
}

// ---------- Feed & marketplace ----------
router.get('/feed', optionalAuth, (req, res) => {
  const tags = req.query.tags ? String(req.query.tags).split(',').filter((t) => ITINERARY_TAGS.includes(t)) : [];
  const sort = oneOf(req.query.sort, 'Sort', ['trending', 'forks', 'new', 'rating', 'price_low', 'price_high']) || 'trending';
  const type = oneOf(req.query.type, 'Type', ['all', 'free', 'premium']) || 'all';
  const text = req.query.q ? `%${String(req.query.q).toLowerCase().slice(0, 60)}%` : null;
  const limit = Math.min(48, Number(req.query.limit) || 24);
  const offset = Math.max(0, (Number(req.query.page) || 1) - 1) * limit;
  const where = [`status = 'published'`];
  const params = {};
  if (type === 'free') where.push('price = 0');
  if (type === 'premium') where.push('price > 0');
  if (text) {
    where.push('(lower(title) LIKE :text OR lower(destination) LIKE :text OR lower(summary) LIKE :text)');
    params.text = text;
  }
  tags.forEach((t, idx) => {
    where.push(`tags LIKE :tag${idx}`);
    params[`tag${idx}`] = `%"${t}"%`;
  });
  if (req.query.creator) {
    where.push('creator_id = :creator');
    params.creator = String(req.query.creator);
  }
  const order = {
    trending: `featured DESC, (fork_count * 3 + like_count * 2 + view_count * 0.05) / (1 + (julianday('now') - julianday(created_at)) / 30.0) DESC`,
    forks: 'fork_count DESC',
    new: 'created_at DESC',
    rating: 'rating_avg DESC, rating_count DESC',
    price_low: 'price ASC, fork_count DESC',
    price_high: 'price DESC',
  }[sort];
  const rows = q.all(`SELECT * FROM public_itineraries WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT ${limit} OFFSET ${offset}`, params);
  const total = q.value(`SELECT COUNT(*) FROM public_itineraries WHERE ${where.join(' AND ')}`, params);
  res.json({ itineraries: rows.map((r) => serialize(r, req.user?.id)), total, tags: ITINERARY_TAGS });
});

router.get('/itineraries/:id', optionalAuth, (req, res) => {
  const i = getPublished(req.params.id);
  const isOwner = req.user?.id === i.creator_id;
  if (i.status !== 'published' && !isOwner && req.user?.role !== 'admin') throw notFound('Itinerary not found');
  q.run('UPDATE public_itineraries SET view_count = view_count + 1 WHERE id = ?', i.id);
  const access = hasAccess(i, req.user?.id);
  const content = parseJson(i.content, []);
  const preview = access
    ? content
    : content.map((d, idx) => (idx === 0 ? d : { day_number: d.day_number, title: d.title, notes: '', items: [], locked: true, item_count: d.items.length }));
  const reviews = q
    .all(`SELECT r.*, u.name, u.avatar_url, u.verified FROM reviews r JOIN users u ON u.id = r.user_id WHERE r.itinerary_id = ? AND r.status = 'visible' ORDER BY r.created_at DESC LIMIT 50`, i.id)
    .map((r) => ({ ...r, verified: !!r.verified }));
  const creatorStats = {
    followers: q.value('SELECT COUNT(*) FROM follows WHERE creator_id = ?', i.creator_id),
    itineraries: q.value(`SELECT COUNT(*) FROM public_itineraries WHERE creator_id = ? AND status = 'published'`, i.creator_id),
  };
  const more = q.all(`SELECT * FROM public_itineraries WHERE status = 'published' AND id != ? AND (creator_id = ? OR destination = ?) ORDER BY fork_count DESC LIMIT 4`, i.id, i.creator_id, i.destination);
  res.json({
    itinerary: { ...serialize(i, req.user?.id), content: preview, locked: !access },
    reviews,
    creator_stats: creatorStats,
    is_following: req.user ? !!q.get('SELECT 1 FROM follows WHERE follower_id = ? AND creator_id = ?', req.user.id, i.creator_id) : false,
    can_review: req.user ? !!(q.get('SELECT 1 FROM forks WHERE itinerary_id = ? AND user_id = ?', i.id, req.user.id) || q.get('SELECT 1 FROM itinerary_purchases WHERE itinerary_id = ? AND buyer_id = ?', i.id, req.user.id)) && !q.get('SELECT 1 FROM reviews WHERE itinerary_id = ? AND user_id = ?', i.id, req.user.id) : false,
    more: more.map((r) => serialize(r, req.user?.id)),
  });
});

router.post('/itineraries/:id/like', requireAuth, (req, res) => {
  const i = getPublished(req.params.id);
  const exists = q.get('SELECT 1 FROM itinerary_likes WHERE itinerary_id = ? AND user_id = ?', i.id, req.user.id);
  if (exists) q.run('DELETE FROM itinerary_likes WHERE itinerary_id = ? AND user_id = ?', i.id, req.user.id);
  else q.run('INSERT INTO itinerary_likes (itinerary_id, user_id, created_at) VALUES (?, ?, ?)', i.id, req.user.id, now());
  const count = q.value('SELECT COUNT(*) FROM itinerary_likes WHERE itinerary_id = ?', i.id);
  update('public_itineraries', i.id, { like_count: count });
  res.json({ liked: !exists, like_count: count });
});

function maybeAutoPromote(itineraryId) {
  const s = getSettings();
  const i = q.get('SELECT * FROM public_itineraries WHERE id = ?', itineraryId);
  if (!i || i.verified_premium || i.fork_count < s.auto_promote_forks) return;
  update('public_itineraries', i.id, { verified_premium: 1, price: i.price || s.auto_promote_price, updated_at: now() });
  notify(i.creator_id, {
    type: 'promoted',
    title: `🎉 “${i.title}” is now Verified Premium`,
    body: `It crossed ${s.auto_promote_forks} forks, so it's now listed in the marketplace${i.price ? '' : ` at ${rupee(s.auto_promote_price)}`}. You can change the price any time.`,
    link: '/app/creator',
  });
}

router.post('/itineraries/:id/fork', requireAuth, (req, res) => {
  const i = getPublished(req.params.id);
  if (i.status !== 'published' && i.creator_id !== req.user.id) throw notFound('Itinerary not found');
  if (!hasAccess(i, req.user.id)) throw new HttpError(402, `Unlock this premium itinerary for ${rupee(i.price)} to fork it`, { code: 'purchase_required' });
  const startDate = date(req.body.start_date, 'Start date', { required: true });
  const trip = forkIntoTrip(i, req.user, { start_date: startDate, name: str(req.body.name, 'Trip name', { max: 80 }) });
  if (i.creator_id !== req.user.id) {
    notify(i.creator_id, { type: 'fork', title: `${req.user.name} forked “${i.title}”`, body: `${i.fork_count + 1} forks and counting`, link: `/app/itineraries/${i.id}` });
  }
  maybeAutoPromote(i.id);
  res.status(201).json({ trip });
});

router.post('/itineraries/:id/purchase', requireAuth, (req, res) => {
  const i = getPublished(req.params.id);
  if (i.status !== 'published') throw notFound('Itinerary not found');
  if (i.price === 0) throw badRequest('This itinerary is free — just fork it');
  if (hasAccess(i, req.user.id)) throw badRequest('You already have access to this itinerary');
  checkUpiAuthorisation(req.body);
  const fee = Math.round((i.price * getSettings().marketplace_fee_pct) / 100);
  const payment = collect({ userId: req.user.id, payeeUserId: i.creator_id, amount: i.price, purpose: 'purchase', upiApp: req.body.upi_app, meta: { itinerary_id: i.id } });
  insert('itinerary_purchases', { id: newId(), itinerary_id: i.id, buyer_id: req.user.id, creator_id: i.creator_id, amount: i.price, platform_fee: fee, creator_earning: i.price - fee, kind: 'purchase', payment_id: payment.id, created_at: now() });
  q.run('UPDATE public_itineraries SET sales_count = sales_count + 1 WHERE id = ?', i.id);
  notify(i.creator_id, { type: 'sale', title: `💰 New sale: “${i.title}”`, body: `${req.user.name} unlocked it. You earned ${rupee(i.price - fee)}.`, link: '/app/creator' });
  res.json({ ok: true, payment });
});

router.post('/itineraries/:id/tip', requireAuth, (req, res) => {
  const i = getPublished(req.params.id);
  if (i.creator_id === req.user.id) throw badRequest("You can't tip yourself");
  const amount = int(req.body.amount, 'Tip', { required: true, min: 10, max: 10000 });
  checkUpiAuthorisation(req.body);
  const fee = Math.round((amount * getSettings().tip_fee_pct) / 100);
  const payment = collect({ userId: req.user.id, payeeUserId: i.creator_id, amount, purpose: 'tip', upiApp: req.body.upi_app, meta: { itinerary_id: i.id } });
  insert('itinerary_purchases', { id: newId(), itinerary_id: i.id, buyer_id: req.user.id, creator_id: i.creator_id, amount, platform_fee: fee, creator_earning: amount - fee, kind: 'tip', payment_id: payment.id, created_at: now() });
  notify(i.creator_id, { type: 'tip', title: `🙏 ${req.user.name} tipped you ${rupee(amount)}`, body: `For “${i.title}”`, link: '/app/creator' });
  res.json({ ok: true, payment });
});

router.post('/itineraries/:id/reviews', requireAuth, (req, res) => {
  const i = getPublished(req.params.id);
  if (i.creator_id === req.user.id) throw badRequest("You can't review your own itinerary");
  const used = q.get('SELECT 1 FROM forks WHERE itinerary_id = ? AND user_id = ?', i.id, req.user.id) || q.get('SELECT 1 FROM itinerary_purchases WHERE itinerary_id = ? AND buyer_id = ?', i.id, req.user.id);
  if (!used) throw forbidden('Fork or unlock this itinerary before reviewing it');
  if (q.get('SELECT 1 FROM reviews WHERE itinerary_id = ? AND user_id = ?', i.id, req.user.id)) throw badRequest('You have already reviewed this itinerary');
  const review = insert('reviews', { id: newId(), itinerary_id: i.id, user_id: req.user.id, rating: int(req.body.rating, 'Rating', { required: true, min: 1, max: 5 }), text: str(req.body.text, 'Review', { max: 1000 }) || '', status: 'visible', report_count: 0, created_at: now() });
  refreshRating(i.id);
  notify(i.creator_id, { type: 'review', title: `${req.user.name} rated “${i.title}” ${'★'.repeat(review.rating)}`, body: review.text.slice(0, 120), link: `/app/itineraries/${i.id}` });
  res.status(201).json({ review });
});

export function refreshRating(itineraryId) {
  const r = q.get(`SELECT AVG(rating) AS avg, COUNT(*) AS n FROM reviews WHERE itinerary_id = ? AND status = 'visible'`, itineraryId);
  update('public_itineraries', itineraryId, { rating_avg: Math.round((r.avg || 0) * 10) / 10, rating_count: r.n });
}

router.post('/reviews/:id/report', requireAuth, (req, res) => {
  const r = q.get('SELECT * FROM reviews WHERE id = ?', req.params.id);
  if (!r) throw notFound('Review not found');
  q.run(`UPDATE reviews SET report_count = report_count + 1, status = CASE WHEN report_count + 1 >= 3 THEN 'flagged' ELSE status END WHERE id = ?`, r.id);
  refreshRating(r.itinerary_id);
  res.json({ ok: true });
});

router.patch('/itineraries/:id', requireAuth, (req, res) => {
  const i = getPublished(req.params.id);
  if (i.creator_id !== req.user.id) throw forbidden('Only the creator can edit this itinerary');
  const fields = {
    title: str(req.body.title, 'Title', { max: 100 }),
    summary: req.body.summary !== undefined ? str(req.body.summary, 'Summary', { max: 1000 }) ?? '' : undefined,
    price: int(req.body.price, 'Price', { min: 0, max: 2999 }),
    status: oneOf(req.body.status, 'Status', ['published', 'unpublished']),
    tags: Array.isArray(req.body.tags) ? JSON.stringify(req.body.tags.filter((t) => ITINERARY_TAGS.includes(t)).slice(0, 6)) : undefined,
    updated_at: now(),
  };
  update('public_itineraries', i.id, fields);
  res.json({ itinerary: serialize(q.get('SELECT * FROM public_itineraries WHERE id = ?', i.id), req.user.id) });
});

// ---------- Creator dashboard ----------
function creatorBalance(userId) {
  const earned = q.value('SELECT COALESCE(SUM(creator_earning),0) FROM itinerary_purchases WHERE creator_id = ?', userId);
  const committed = q.value(`SELECT COALESCE(SUM(amount),0) FROM payouts WHERE creator_id = ? AND status IN ('requested','approved','paid')`, userId);
  const paid = q.value(`SELECT COALESCE(SUM(amount),0) FROM payouts WHERE creator_id = ? AND status = 'paid'`, userId);
  return { earned, paid, pending_payouts: committed - paid, available: earned - committed };
}

router.get('/creator/dashboard', requireAuth, (req, res) => {
  const uid = req.user.id;
  const s = getSettings();
  const itineraries = q.all(`SELECT * FROM public_itineraries WHERE creator_id = ? AND status != 'removed' ORDER BY created_at DESC`, uid).map((i) => {
    const agg = q.get(`SELECT COALESCE(SUM(amount),0) AS gross, COALESCE(SUM(creator_earning),0) AS net FROM itinerary_purchases WHERE itinerary_id = ?`, i.id);
    return { ...serialize(i, uid), gross: agg.gross, net: agg.net };
  });
  const totals = q.get(`SELECT COUNT(CASE WHEN kind = 'purchase' THEN 1 END) AS sales, COALESCE(SUM(CASE WHEN kind = 'purchase' THEN amount END),0) AS sales_gross,
    COALESCE(SUM(CASE WHEN kind = 'tip' THEN amount END),0) AS tips, COALESCE(SUM(platform_fee),0) AS platform_fee, COALESCE(SUM(creator_earning),0) AS net FROM itinerary_purchases WHERE creator_id = ?`, uid);
  const since = new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10);
  const followersBefore = q.value('SELECT COUNT(*) FROM follows WHERE creator_id = ? AND date(created_at) < ?', uid, since);
  const followDaily = q.all(`SELECT date(created_at) AS d, COUNT(*) AS n FROM follows WHERE creator_id = ? AND date(created_at) >= ? GROUP BY d`, uid, since);
  const salesDaily = q.all(`SELECT date(created_at) AS d, COALESCE(SUM(creator_earning),0) AS earnings, COUNT(*) AS n FROM itinerary_purchases WHERE creator_id = ? AND date(created_at) >= ? GROUP BY d`, uid, since);
  const forkDaily = q.all(`SELECT date(f.created_at) AS d, COUNT(*) AS n FROM forks f JOIN public_itineraries i ON i.id = f.itinerary_id WHERE i.creator_id = ? AND date(f.created_at) >= ? GROUP BY d`, uid, since);
  let running = followersBefore;
  const series = [];
  for (let k = 0; k < 30; k++) {
    const d = new Date(Date.parse(since) + k * 86_400_000).toISOString().slice(0, 10);
    running += followDaily.find((x) => x.d === d)?.n || 0;
    series.push({ date: d, followers: running, earnings: salesDaily.find((x) => x.d === d)?.earnings || 0, sales: salesDaily.find((x) => x.d === d)?.n || 0, forks: forkDaily.find((x) => x.d === d)?.n || 0 });
  }
  const recent = q.all(
    `SELECT p.*, u.name AS buyer_name, i.title AS itinerary_title FROM itinerary_purchases p JOIN users u ON u.id = p.buyer_id JOIN public_itineraries i ON i.id = p.itinerary_id WHERE p.creator_id = ? ORDER BY p.created_at DESC LIMIT 20`,
    uid,
  );
  res.json({
    totals: { ...totals, followers: running, forks: itineraries.reduce((a, i) => a + i.fork_count, 0), views: itineraries.reduce((a, i) => a + i.view_count, 0) },
    balance: creatorBalance(uid),
    fees: { marketplace_fee_pct: s.marketplace_fee_pct, tip_fee_pct: s.tip_fee_pct, min_payout: s.min_payout, auto_promote_forks: s.auto_promote_forks },
    series,
    itineraries,
    recent,
    payouts: q.all('SELECT * FROM payouts WHERE creator_id = ? ORDER BY created_at DESC LIMIT 20', uid),
    upi_id: req.user.upi_id,
  });
});

router.post('/creator/payouts', requireAuth, (req, res) => {
  const s = getSettings();
  if (!req.user.upi_id) throw badRequest('Add your UPI ID in your profile to receive payouts');
  const amount = int(req.body.amount, 'Amount', { required: true, min: s.min_payout, max: 10_000_000 });
  const { available } = creatorBalance(req.user.id);
  if (amount > available) throw badRequest(`You can withdraw up to ${rupee(available)}`);
  const payout = insert('payouts', { id: newId(), creator_id: req.user.id, amount, upi_id: req.user.upi_id, status: 'requested', note: '', created_at: now() });
  res.status(201).json({ payout });
});

export default router;
