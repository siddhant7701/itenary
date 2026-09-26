import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../config.js';
import { insert, newId, now, q } from '../db.js';
import { checkPassword, requireAuth, selfUser, signToken } from '../lib/auth.js';
import { HttpError, badRequest, phone as parsePhone, str } from '../lib/http.js';
import { requestOtp, verifyOtp } from '../services/otp.js';
import { setting } from '../services/settings.js';
import { notify } from '../services/notify.js';

const router = Router();
const otpLimiter = rateLimit({ windowMs: 60_000, limit: 6, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts. Please wait a minute.' } });

router.post('/whatsapp/otp', otpLimiter, async (req, res) => {
  const phone = parsePhone(req.body.phone);
  const existing = q.get('SELECT id, status FROM users WHERE phone = ?', phone);
  if (!existing && !setting('signup_open')) throw new HttpError(403, 'New sign-ups are paused right now. Please try again later.');
  if (existing?.status === 'suspended') throw new HttpError(403, 'This account has been suspended. Contact support.');
  const result = await requestOtp(phone);
  res.json({ sent: true, phone, delivery: result.delivery, demo_code: result.demoCode, is_new: !existing });
});

router.post('/whatsapp/verify', otpLimiter, (req, res) => {
  const phone = parsePhone(req.body.phone);
  const code = str(req.body.code, 'Code', { required: true, max: 6 });
  verifyOtp(phone, code);
  let user = q.get('SELECT * FROM users WHERE phone = ?', phone);
  let isNew = false;
  if (!user) {
    isNew = true;
    user = insert('users', { id: newId(), phone, name: '', role: 'user', created_at: now(), last_seen_at: now() });
    user = q.get('SELECT * FROM users WHERE id = ?', user.id);
    notify(user.id, { type: 'welcome', title: 'Welcome to Itenary 🇮🇳', body: 'Plan trips together, let Yatri book the rides, and keep every memory in one place.', link: '/app' });
  }
  if (user.status === 'suspended') throw new HttpError(403, 'This account has been suspended.');
  res.json({ token: signToken(user), user: selfUser(user), is_new: isNew });
});

router.post('/admin/login', otpLimiter, (req, res) => {
  const email = str(req.body.email, 'Email', { required: true, max: 200 })?.toLowerCase();
  const password = str(req.body.password, 'Password', { required: true, max: 200 });
  const user = q.get('SELECT * FROM users WHERE lower(email) = ?', email);
  if (!user || !checkPassword(password, user.password_hash)) throw badRequest('Incorrect email or password');
  if (user.role !== 'admin') throw new HttpError(403, 'This account does not have admin access');
  if (user.status === 'suspended') throw new HttpError(403, 'This account has been suspended');
  q.run('UPDATE users SET last_seen_at = ? WHERE id = ?', now(), user.id);
  res.json({ token: signToken(user), user: selfUser(user) });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: selfUser(req.user) });
});

// Demo helpers: one-tap sign-in as seeded travellers so collaboration can be tried in two browsers.
router.get('/demo-accounts', (_req, res) => {
  if (!config.demoMode) return res.json({ accounts: [] });
  const accounts = q.all(`SELECT id, name, phone, avatar_url, verified, home_city FROM users WHERE role = 'user' AND status = 'active' AND phone LIKE '+9190000%' ORDER BY created_at LIMIT 8`);
  res.json({ accounts: accounts.map((a) => ({ ...a, verified: !!a.verified })) });
});

router.post('/demo-login', (req, res) => {
  if (!config.demoMode) throw new HttpError(404, 'Not found');
  const user = q.get(`SELECT * FROM users WHERE id = ? AND role = 'user' AND phone LIKE '+9190000%'`, req.body.user_id);
  if (!user) throw badRequest('Unknown demo account');
  res.json({ token: signToken(user), user: selfUser(user) });
});

export default router;
