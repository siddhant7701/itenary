// WhatsApp OTP delivery.
// With WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID + WHATSAPP_OTP_TEMPLATE set, codes are sent through the
// WhatsApp Business Cloud API using an approved authentication template. Otherwise (demo mode)
// the code is returned to the client so the app is usable without a Meta business account.
import crypto from 'node:crypto';
import { config } from '../config.js';
import { insert, newId, now, q, update } from '../db.js';
import { hashOtp } from '../lib/auth.js';
import { HttpError, badRequest } from '../lib/http.js';

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export const whatsappConfigured = () => Boolean(config.whatsapp.token && config.whatsapp.phoneNumberId && config.whatsapp.template);

async function sendWhatsApp(phone, code) {
  const { token, phoneNumberId, template, language } = config.whatsapp;
  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phone.replace('+', ''),
      type: 'template',
      template: {
        name: template,
        language: { code: language },
        components: [
          { type: 'body', parameters: [{ type: 'text', text: code }] },
          { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
        ],
      },
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error('[whatsapp] send failed', res.status, detail.slice(0, 300));
    throw new HttpError(502, 'Could not send the WhatsApp code right now. Please try again in a minute.');
  }
}

export async function requestOtp(phone) {
  const recent = q.value(`SELECT COUNT(*) FROM otp_codes WHERE phone = ? AND created_at > ?`, phone, new Date(Date.now() - 15 * 60 * 1000).toISOString());
  if (recent >= 5) throw new HttpError(429, 'Too many codes requested. Please wait 15 minutes.');
  const code = String(crypto.randomInt(100000, 999999));
  const live = whatsappConfigured();
  if (live) await sendWhatsApp(phone, code);
  insert('otp_codes', { id: newId(), phone, code_hash: hashOtp(phone, code), delivery: live ? 'whatsapp' : 'demo', attempts: 0, expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(), created_at: now() });
  if (!live && !config.demoMode) {
    console.warn('[otp] WhatsApp is not configured and DEMO_MODE is off — code for', phone, 'is', code);
  }
  return { delivery: live ? 'whatsapp' : 'demo', demoCode: !live && config.demoMode ? code : undefined };
}

export function verifyOtp(phone, code) {
  const row = q.get(`SELECT * FROM otp_codes WHERE phone = ? AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1`, phone);
  if (!row || row.expires_at < now()) throw badRequest('That code has expired. Request a new one.');
  if (row.attempts >= MAX_ATTEMPTS) throw badRequest('Too many wrong attempts. Request a new code.');
  if (row.code_hash !== hashOtp(phone, String(code || '').trim())) {
    update('otp_codes', row.id, { attempts: row.attempts + 1 });
    throw badRequest('Incorrect code. Please check WhatsApp and try again.');
  }
  update('otp_codes', row.id, { consumed_at: now() });
  return true;
}
