import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

try {
  process.loadEnvFile(path.join(ROOT, '.env'));
} catch {
  // .env is optional
}

export const DATA_DIR = path.resolve(ROOT, process.env.DATA_DIR || 'data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
export const DIST_DIR = path.join(ROOT, 'dist');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Persist a generated JWT secret so sessions survive restarts when JWT_SECRET is not set.
function loadSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  const file = path.join(DATA_DIR, '.jwt-secret');
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();
  const secret = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(file, secret, { mode: 0o600 });
  return secret;
}

const isProd = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT) || 4000;

export const config = {
  isProd,
  port,
  publicUrl: process.env.PUBLIC_URL || `http://localhost:${port}`,
  jwtSecret: loadSecret(),
  // Web-app origins allowed to call the API cross-origin (e.g. https://itenary.com,https://itenary.vercel.app). '*' = any.
  // Auth uses bearer tokens (no cookies), so '*' is safe; lock it down once your domains are final.
  corsOrigins: (process.env.CORS_ORIGIN || '*').split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  // Demo mode shows OTP codes on screen and enables one-tap demo logins. Turn off in production.
  demoMode: process.env.DEMO_MODE ? process.env.DEMO_MODE === 'true' : true,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  whatsapp: {
    token: process.env.WHATSAPP_TOKEN || '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    template: process.env.WHATSAPP_OTP_TEMPLATE || '',
    language: process.env.WHATSAPP_TEMPLATE_LANG || 'en',
  },
  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@itenary.com',
    password: process.env.ADMIN_PASSWORD || 'Admin@12345',
  },
};
