import { Router } from 'express';
import { now, q, update } from '../db.js';
import { publicUser, requireAuth, selfUser, optionalAuth, planActive } from '../lib/auth.js';
import { badRequest, notFound, phone as parsePhone, str, int } from '../lib/http.js';
import { collect, checkUpiAuthorisation } from '../services/payments.js';
import { getSettings } from '../services/settings.js';
import { notify } from '../services/notify.js';
import { emitAdmins } from '../realtime.js';
import { uploadImage, publicUrl } from '../lib/upload.js';
import { parseJson } from '../db.js';

const router = Router();

const TRAVEL_STYLES = ['Budget', 'Solo Female', 'Foodie', 'Adventure', 'Chill', 'Couple', 'Family', 'Backpacking', 'Luxury', 'Spiritual', 'Offbeat', 'Weekend'];

router.patch('/me', requireAuth, (req, res) => {
  const b = req.body;
  const fields = {
    name: str(b.name, 'Name', { max: 60 }),
    bio: str(b.bio, 'Bio', { max: 300 }) ?? (b.bio === '' ? '' : undefined),
    home_city: str(b.home_city, 'Home city', { max: 60 }) ?? (b.home_city === '' ? '' : undefined),
    emergency_name: str(b.emergency_name, 'Emergency contact name', { max: 60 }),
    emergency_phone: b.emergency_phone ? parsePhone(b.emergency_phone) : undefined,
    upi_id: b.upi_id ? str(b.upi_id, 'UPI ID', { max: 60 }) : undefined,
    email: b.email ? str(b.email, 'Email', { max: 120 })?.toLowerCase() : undefined,
  };
  if (fields.upi_id && !/^[\w.-]{2,}@[a-zA-Z]{2,}$/.test(fields.upi_id)) throw badRequest('Enter a valid UPI ID like name@okhdfcbank');
  if (fields.email && !/^\S+@\S+\.\S+$/.test(fields.email)) throw badRequest('Enter a valid email');
  if (fields.email && q.get('SELECT 1 FROM users WHERE lower(email) = ? AND id != ?', fields.email, req.user.id)) throw badRequest('That email is already in use');
  if (Array.isArray(b.travel_style)) fields.travel_style = JSON.stringify(b.travel_style.filter((s) => TRAVEL_STYLES.includes(s)).slice(0, 6));
  if (b.onboarded === true) fields.onboarded = 1;
  if (b.name !== undefined && !fields.name) throw badRequest('Name is required');
  update('users', req.user.id, fields);
  res.json({ user: selfUser(q.get('SELECT * FROM users WHERE id = ?', req.user.id)) });
});

router.post('/me/avatar', requireAuth, uploadImage.single('file'), (req, res) => {
  if (!req.file) throw badRequest('Choose an image to upload');
  update('users', req.user.id, { avatar_url: publicUrl(req.file) });
  res.json({ user: selfUser(q.get('SELECT * FROM users WHERE id = ?', req.user.id)) });
});

router.post('/me/verification', requireAuth, (req, res) => {
  if (req.user.verified) throw badRequest('You are already verified');
  if (!req.user.emergency_phone) throw badRequest('Add an emergency contact before requesting verification');
  const note = str(req.body.note, 'Note', { max: 300 }) || '';
  update('users', req.user.id, { verification_status: 'pending', verification_note: note });
  emitAdmins('verification', { user_id: req.user.id, name: req.user.name });
  res.json({ user: selfUser(q.get('SELECT * FROM users WHERE id = ?', req.user.id)) });
});

router.post('/me/upgrade', requireAuth, (req, res) => {
  const price = getSettings().plus_price_monthly;
  checkUpiAuthorisation(req.body);
  const months = int(req.body.months, 'Months', { min: 1, max: 12 }) || 1;
  const base = planActive(req.user) && req.user.plan_expires_at ? new Date(req.user.plan_expires_at) : new Date();
  base.setMonth(base.getMonth() + months);
  const payment = collect({ userId: req.user.id, amount: price * months, purpose: 'subscription', upiApp: req.body.upi_app, meta: { months } });
  update('users', req.user.id, { plan: 'plus', plan_expires_at: base.toISOString() });
  notify(req.user.id, { type: 'plus', title: 'Welcome to Itenary Plus ✨', body: `Unlimited concierge requests until ${base.toLocaleDateString('en-IN', { dateStyle: 'medium' })}.`, link: '/app/profile' });
  res.json({ user: selfUser(q.get('SELECT * FROM users WHERE id = ?', req.user.id)), payment });
});

router.get('/me/usage', requireAuth, (req, res) => {
  const day = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const used = q.value(`SELECT count FROM usage_counters WHERE user_id = ? AND day = ? AND kind = 'concierge'`, req.user.id, day) || 0;
  res.json({ concierge_used: used, concierge_limit: planActive(req.user) ? null : getSettings().free_concierge_daily, plan: planActive(req.user) ? 'plus' : 'free', plus_price: getSettings().plus_price_monthly });
});

router.get('/me/payments', requireAuth, (req, res) => {
  const rows = q.all(`SELECT * FROM payments WHERE user_id = ? OR payee_user_id = ? ORDER BY created_at DESC LIMIT 100`, req.user.id, req.user.id);
  res.json({ payments: rows.map((p) => ({ ...p, meta: parseJson(p.meta, {}) })) });
});

// ---------- Notifications ----------
router.get('/notifications', requireAuth, (req, res) => {
  const rows = q.all('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 60', req.user.id);
  const unread = q.value('SELECT COUNT(*) FROM notifications WHERE user_id = ? AND read = 0', req.user.id);
  res.json({ notifications: rows.map((n) => ({ ...n, read: !!n.read })), unread });
});

router.post('/notifications/read-all', requireAuth, (req, res) => {
  q.run('UPDATE notifications SET read = 1 WHERE user_id = ?', req.user.id);
  res.json({ ok: true });
});

router.post('/notifications/:id/read', requireAuth, (req, res) => {
  q.run('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?', req.params.id, req.user.id);
  res.json({ ok: true });
});

// ---------- Public profiles & follows ----------
router.get('/users/:id', optionalAuth, (req, res) => {
  const u = q.get(`SELECT * FROM users WHERE id = ? AND status = 'active' AND role != 'admin'`, req.params.id);
  if (!u) throw notFound('Traveller not found');
  const itineraries = q
    .all(`SELECT * FROM public_itineraries WHERE creator_id = ? AND status = 'published' ORDER BY fork_count DESC`, u.id)
    .map((i) => ({ ...i, tags: parseJson(i.tags, []), content: undefined, verified_premium: !!i.verified_premium, featured: !!i.featured }));
  res.json({
    user: { ...publicUser(u), travel_style: parseJson(u.travel_style, []), created_at: u.created_at },
    stats: {
      followers: q.value('SELECT COUNT(*) FROM follows WHERE creator_id = ?', u.id),
      following: q.value('SELECT COUNT(*) FROM follows WHERE follower_id = ?', u.id),
      itineraries: itineraries.length,
      forks: itineraries.reduce((s, i) => s + i.fork_count, 0),
      trips: q.value('SELECT COUNT(*) FROM trip_members WHERE user_id = ?', u.id),
    },
    is_following: req.user ? !!q.get('SELECT 1 FROM follows WHERE follower_id = ? AND creator_id = ?', req.user.id, u.id) : false,
    itineraries,
  });
});

router.post('/users/:id/follow', requireAuth, (req, res) => {
  const target = q.get(`SELECT id, name FROM users WHERE id = ? AND status = 'active'`, req.params.id);
  if (!target) throw notFound('Traveller not found');
  if (target.id === req.user.id) throw badRequest("You can't follow yourself");
  const exists = q.get('SELECT 1 FROM follows WHERE follower_id = ? AND creator_id = ?', req.user.id, target.id);
  if (exists) q.run('DELETE FROM follows WHERE follower_id = ? AND creator_id = ?', req.user.id, target.id);
  else {
    q.run('INSERT INTO follows (follower_id, creator_id, created_at) VALUES (?, ?, ?)', req.user.id, target.id, now());
    notify(target.id, { type: 'follow', title: `${req.user.name || 'A traveller'} started following you`, link: `/app/u/${req.user.id}` });
  }
  res.json({ following: !exists, followers: q.value('SELECT COUNT(*) FROM follows WHERE creator_id = ?', target.id) });
});

export { TRAVEL_STYLES };
export default router;
