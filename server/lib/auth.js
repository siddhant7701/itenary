import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { q, now } from '../db.js';
import { HttpError } from './http.js';

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch {
    return null;
  }
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function checkPassword(password, stored) {
  if (!stored || !stored.startsWith('scrypt$')) return false;
  const [, salt, hash] = stored.split('$');
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

export function hashOtp(phone, code) {
  return crypto.createHmac('sha256', config.jwtSecret).update(`${phone}:${code}`).digest('hex');
}

/** Fields safe to return to the user themself. */
export function selfUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    phone: u.phone,
    email: u.email,
    name: u.name,
    avatar_url: u.avatar_url,
    bio: u.bio,
    home_city: u.home_city,
    travel_style: safeJson(u.travel_style, []),
    role: u.role,
    verified: !!u.verified,
    verification_status: u.verification_status,
    emergency_name: u.emergency_name,
    emergency_phone: u.emergency_phone,
    upi_id: u.upi_id,
    plan: planActive(u) ? 'plus' : 'free',
    plan_expires_at: u.plan_expires_at,
    status: u.status,
    onboarded: !!u.onboarded,
    created_at: u.created_at,
  };
}

/** Fields safe to show to other users. */
export function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    name: u.name,
    avatar_url: u.avatar_url,
    bio: u.bio,
    home_city: u.home_city,
    verified: !!u.verified,
    plan: planActive(u) ? 'plus' : 'free',
  };
}

export function planActive(u) {
  return u.plan === 'plus' && (!u.plan_expires_at || u.plan_expires_at > now());
}

function safeJson(v, fallback) {
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
}

function loadUser(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  return q.get('SELECT * FROM users WHERE id = ?', payload.sub) || null;
}

const lastSeenWrites = new Map();

export function requireAuth(req, _res, next) {
  const user = loadUser(req);
  if (!user) throw new HttpError(401, 'Please sign in to continue');
  if (user.status === 'suspended') throw new HttpError(403, 'Your account has been suspended. Contact support@itenary.com');
  req.user = user;
  // Throttle last_seen writes to once a minute per user
  const t = Date.now();
  if ((lastSeenWrites.get(user.id) || 0) < t - 60_000) {
    lastSeenWrites.set(user.id, t);
    q.run('UPDATE users SET last_seen_at = ? WHERE id = ?', now(), user.id);
  }
  next();
}

export function optionalAuth(req, _res, next) {
  const user = loadUser(req);
  if (user && user.status !== 'suspended') req.user = user;
  next();
}

export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') throw new HttpError(403, 'Admin access required');
    next();
  });
}
