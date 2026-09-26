import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { DATA_DIR } from './config.js';

export const DB_FILE = path.join(DATA_DIR, 'itenary.db');

export const db = new DatabaseSync(DB_FILE);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  phone TEXT UNIQUE,
  email TEXT UNIQUE,
  password_hash TEXT,
  name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  bio TEXT NOT NULL DEFAULT '',
  home_city TEXT NOT NULL DEFAULT '',
  travel_style TEXT NOT NULL DEFAULT '[]',
  role TEXT NOT NULL DEFAULT 'user',
  verified INTEGER NOT NULL DEFAULT 0,
  verification_status TEXT NOT NULL DEFAULT 'none',
  verification_note TEXT,
  emergency_name TEXT,
  emergency_phone TEXT,
  upi_id TEXT,
  plan TEXT NOT NULL DEFAULT 'free',
  plan_expires_at TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  onboarded INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  last_seen_at TEXT
);

CREATE TABLE IF NOT EXISTS otp_codes (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  delivery TEXT NOT NULL DEFAULT 'demo',
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_codes(phone, created_at);

CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  destination TEXT NOT NULL DEFAULT '',
  dest_lat REAL,
  dest_lng REAL,
  cover_url TEXT,
  cover_theme TEXT NOT NULL DEFAULT 'mountains',
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  budget INTEGER NOT NULL DEFAULT 0,
  vibe_score INTEGER NOT NULL DEFAULT 50,
  status TEXT NOT NULL DEFAULT 'planning',
  invite_code TEXT UNIQUE NOT NULL,
  spend_limit_booking INTEGER NOT NULL DEFAULT 15000,
  spend_limit_trip INTEGER NOT NULL DEFAULT 75000,
  source_itinerary_id TEXT,
  published_itinerary_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS trip_members (
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  vibe INTEGER NOT NULL DEFAULT 50,
  share_location INTEGER NOT NULL DEFAULT 0,
  joined_at TEXT NOT NULL,
  PRIMARY KEY (trip_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_members_user ON trip_members(user_id);

CREATE TABLE IF NOT EXISTS itinerary_days (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  date TEXT,
  title TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_days_trip ON itinerary_days(trip_id, day_number);

CREATE TABLE IF NOT EXISTS itinerary_items (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  day_id TEXT NOT NULL REFERENCES itinerary_days(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'activity',
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  place_name TEXT,
  lat REAL,
  lng REAL,
  start_time TEXT,
  duration_min INTEGER,
  cost INTEGER NOT NULL DEFAULT 0,
  url TEXT,
  image_url TEXT,
  position REAL NOT NULL DEFAULT 0,
  booking_id TEXT,
  added_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  added_by_agent INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_items_day ON itinerary_items(day_id, position);
CREATE INDEX IF NOT EXISTS idx_items_trip ON itinerary_items(trip_id);

CREATE TABLE IF NOT EXISTS stash_items (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'place',
  title TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  url TEXT,
  image_url TEXT,
  place_name TEXT,
  lat REAL,
  lng REAL,
  added_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_stash_trip ON stash_items(trip_id);

CREATE TABLE IF NOT EXISTS polls (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  multi INTEGER NOT NULL DEFAULT 0,
  closed INTEGER NOT NULL DEFAULT 0,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS poll_options (
  id TEXT PRIMARY KEY,
  poll_id TEXT NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS poll_votes (
  poll_id TEXT NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  option_id TEXT NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (poll_id, option_id, user_id)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'group',
  sender_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  sender_type TEXT NOT NULL DEFAULT 'user',
  content TEXT NOT NULL,
  meta TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chat_trip ON chat_messages(trip_id, channel, created_at);

CREATE TABLE IF NOT EXISTS providers (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1,
  commission_pct REAL NOT NULL DEFAULT 8,
  failure_rate REAL NOT NULL DEFAULT 0.05,
  rating REAL NOT NULL DEFAULT 4.5,
  price_factor REAL NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  trip_id TEXT REFERENCES trips(id) ON DELETE SET NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  provider_id TEXT,
  provider_name TEXT NOT NULL DEFAULT '',
  provider_ref TEXT,
  title TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '{}',
  scheduled_at TEXT,
  amount INTEGER NOT NULL DEFAULT 0,
  fee INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  commission INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'proposed',
  source TEXT NOT NULL DEFAULT 'agent',
  failure_reason TEXT,
  resolution_note TEXT,
  payment_id TEXT,
  expense_id TEXT,
  item_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  confirmed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_bookings_trip ON bookings(trip_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id, status);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  payee_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  trip_id TEXT REFERENCES trips(id) ON DELETE SET NULL,
  booking_id TEXT,
  purpose TEXT NOT NULL,
  amount INTEGER NOT NULL,
  method TEXT NOT NULL DEFAULT 'upi',
  upi_app TEXT,
  upi_ref TEXT,
  status TEXT NOT NULL DEFAULT 'success',
  meta TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id, created_at);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  paid_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  amount INTEGER NOT NULL,
  split_type TEXT NOT NULL DEFAULT 'equal',
  booking_id TEXT,
  spent_on TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_expenses_trip ON expenses(trip_id);
CREATE TABLE IF NOT EXISTS expense_shares (
  expense_id TEXT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  PRIMARY KEY (expense_id, user_id)
);
CREATE TABLE IF NOT EXISTS settlements (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  from_user TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested',
  note TEXT NOT NULL DEFAULT '',
  requested_by TEXT,
  payment_id TEXT,
  created_at TEXT NOT NULL,
  settled_at TEXT
);

CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'photo',
  day_number INTEGER,
  taken_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_media_trip ON media_assets(trip_id);
CREATE TABLE IF NOT EXISTS media_reactions (
  media_id TEXT NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  PRIMARY KEY (media_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS zines (
  id TEXT PRIMARY KEY,
  trip_id TEXT UNIQUE NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  theme TEXT NOT NULL DEFAULT 'marigold',
  layout TEXT NOT NULL DEFAULT '[]',
  generated_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public_itineraries (
  id TEXT PRIMARY KEY,
  source_trip_id TEXT REFERENCES trips(id) ON DELETE SET NULL,
  creator_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  destination TEXT NOT NULL DEFAULT '',
  cover_theme TEXT NOT NULL DEFAULT 'mountains',
  cover_url TEXT,
  days_count INTEGER NOT NULL DEFAULT 1,
  budget_estimate INTEGER NOT NULL DEFAULT 0,
  tags TEXT NOT NULL DEFAULT '[]',
  content TEXT NOT NULL DEFAULT '[]',
  price INTEGER NOT NULL DEFAULT 0,
  verified_premium INTEGER NOT NULL DEFAULT 0,
  featured INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'published',
  fork_count INTEGER NOT NULL DEFAULT 0,
  like_count INTEGER NOT NULL DEFAULT 0,
  view_count INTEGER NOT NULL DEFAULT 0,
  sales_count INTEGER NOT NULL DEFAULT 0,
  rating_avg REAL NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_itin_status ON public_itineraries(status, created_at);
CREATE TABLE IF NOT EXISTS itinerary_likes (
  itinerary_id TEXT NOT NULL REFERENCES public_itineraries(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (itinerary_id, user_id)
);
CREATE TABLE IF NOT EXISTS itinerary_purchases (
  id TEXT PRIMARY KEY,
  itinerary_id TEXT NOT NULL REFERENCES public_itineraries(id) ON DELETE CASCADE,
  buyer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  creator_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  platform_fee INTEGER NOT NULL,
  creator_earning INTEGER NOT NULL,
  kind TEXT NOT NULL DEFAULT 'purchase',
  payment_id TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_purchases_creator ON itinerary_purchases(creator_id, created_at);
CREATE TABLE IF NOT EXISTS forks (
  id TEXT PRIMARY KEY,
  itinerary_id TEXT NOT NULL REFERENCES public_itineraries(id) ON DELETE CASCADE,
  trip_id TEXT REFERENCES trips(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  itinerary_id TEXT NOT NULL REFERENCES public_itineraries(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL,
  text TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'visible',
  report_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS follows (
  follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  creator_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (follower_id, creator_id)
);
CREATE TABLE IF NOT EXISTS payouts (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  upi_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested',
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  processed_at TEXT
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL,
  venue TEXT NOT NULL DEFAULT '',
  lat REAL,
  lng REAL,
  category TEXT NOT NULL DEFAULT 'activity',
  start_at TEXT NOT NULL,
  end_at TEXT,
  price INTEGER NOT NULL DEFAULT 0,
  capacity INTEGER NOT NULL DEFAULT 50,
  booked_count INTEGER NOT NULL DEFAULT 0,
  cover_theme TEXT NOT NULL DEFAULT 'festival',
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  link TEXT,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, read, created_at);

CREATE TABLE IF NOT EXISTS agent_audit (
  id TEXT PRIMARY KEY,
  trip_id TEXT,
  user_id TEXT,
  booking_id TEXT,
  action TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON agent_audit(created_at);

CREATE TABLE IF NOT EXISTS sos_alerts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trip_id TEXT REFERENCES trips(id) ON DELETE SET NULL,
  lat REAL,
  lng REAL,
  message TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  resolution_note TEXT,
  created_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS live_locations (
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (trip_id, user_id)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  level TEXT NOT NULL DEFAULT 'info',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_logs (
  id TEXT PRIMARY KEY,
  admin_id TEXT,
  action TEXT NOT NULL,
  target TEXT,
  detail TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS usage_counters (
  user_id TEXT NOT NULL,
  day TEXT NOT NULL,
  kind TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day, kind)
);
`;

db.exec(SCHEMA);

// ---------- Query helpers ----------

const stmtCache = new Map();
function stmt(sql) {
  let s = stmtCache.get(sql);
  if (!s) {
    s = db.prepare(sql);
    stmtCache.set(sql, s);
  }
  return s;
}

function bindable(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') return JSON.stringify(v);
  return v;
}

function normalize(params) {
  if (params.length === 1 && params[0] && typeof params[0] === 'object' && !Array.isArray(params[0]) && !(params[0] instanceof Date)) {
    const out = {};
    for (const [k, v] of Object.entries(params[0])) out[k] = bindable(v);
    return [out];
  }
  return params.map(bindable);
}

const plain = (row) => (row ? { ...row } : row);

export const q = {
  get: (sql, ...params) => plain(stmt(sql).get(...normalize(params))),
  all: (sql, ...params) => stmt(sql).all(...normalize(params)).map(plain),
  run: (sql, ...params) => stmt(sql).run(...normalize(params)),
  value: (sql, ...params) => {
    const row = stmt(sql).get(...normalize(params));
    return row ? Object.values(row)[0] : undefined;
  },
};

/** Insert a row from an object. Objects/booleans are serialized automatically. */
export function insert(table, row) {
  const keys = Object.keys(row);
  const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map((k) => ':' + k).join(', ')})`;
  q.run(sql, row);
  return row;
}

/** Update a row by id with only the provided fields. */
export function update(table, id, fields, idColumn = 'id') {
  const keys = Object.keys(fields).filter((k) => fields[k] !== undefined);
  if (!keys.length) return;
  const sql = `UPDATE ${table} SET ${keys.map((k) => `${k} = :${k}`).join(', ')} WHERE ${idColumn} = :__id`;
  q.run(sql, { ...Object.fromEntries(keys.map((k) => [k, fields[k]])), __id: id });
}

let txDepth = 0;
export function tx(fn) {
  if (txDepth > 0) return fn();
  txDepth++;
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  } finally {
    txDepth--;
  }
}

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
export function newId(size = 12) {
  const bytes = crypto.randomBytes(size);
  let out = '';
  for (let i = 0; i < size; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export const now = () => new Date().toISOString();

export function parseJson(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
