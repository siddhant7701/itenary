// Sandbox UPI payment service provider.
// Mirrors the collect/refund/payout shape of a licensed PSP (Razorpay / Cashfree) so a real
// gateway can be swapped in behind the same functions. Itenary never stores UPI PINs:
// the PIN is only format-checked here and discarded, exactly as a PSP SDK would handle it.
import crypto from 'node:crypto';
import { insert, newId, now, q, update } from '../db.js';
import { badRequest } from '../lib/http.js';

export const UPI_APPS = ['gpay', 'phonepe', 'paytm', 'bhim', 'other'];

export function checkUpiAuthorisation({ upi_app, pin } = {}) {
  if (!UPI_APPS.includes(upi_app)) throw badRequest('Choose a UPI app to pay with');
  if (!/^\d{4}(\d{2})?$/.test(String(pin || ''))) throw badRequest('Enter your 4 or 6 digit UPI PIN');
}

const upiRef = () => String(crypto.randomInt(100000, 999999)) + String(crypto.randomInt(100000, 999999));

/** Collect money from a user. Returns the payment row (status "success" in sandbox). */
export function collect({ userId, amount, purpose, tripId = null, bookingId = null, payeeUserId = null, upiApp = 'gpay', meta = {} }) {
  if (!(amount > 0)) throw badRequest('Amount must be greater than zero');
  return insert('payments', {
    id: newId(),
    user_id: userId,
    payee_user_id: payeeUserId,
    trip_id: tripId,
    booking_id: bookingId,
    purpose,
    amount: Math.round(amount),
    method: 'upi',
    upi_app: upiApp,
    upi_ref: upiRef(),
    status: 'success',
    meta,
    created_at: now(),
  });
}

/** Refund a previous payment (full by default). */
export function refund(paymentId, { amount, reason = '' } = {}) {
  const original = q.get('SELECT * FROM payments WHERE id = ?', paymentId);
  if (!original || original.status !== 'success') return null;
  const value = Math.min(original.amount, Math.round(amount ?? original.amount));
  update('payments', paymentId, { status: 'refunded' });
  return insert('payments', {
    id: newId(),
    user_id: original.user_id,
    trip_id: original.trip_id,
    booking_id: original.booking_id,
    purpose: 'refund',
    amount: value,
    method: 'upi',
    upi_app: original.upi_app,
    upi_ref: upiRef(),
    status: 'success',
    meta: { original_payment_id: paymentId, reason },
    created_at: now(),
  });
}

/** Pay out to a creator's UPI ID. */
export function payout({ userId, amount, upiId, payoutId }) {
  return insert('payments', {
    id: newId(),
    user_id: null,
    payee_user_id: userId,
    purpose: 'payout',
    amount: Math.round(amount),
    method: 'upi',
    upi_app: 'other',
    upi_ref: upiRef(),
    status: 'success',
    meta: { upi_id: upiId, payout_id: payoutId },
    created_at: now(),
  });
}
