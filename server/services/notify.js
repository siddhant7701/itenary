import { insert, newId, now, q } from '../db.js';
import { emitUser } from '../realtime.js';

export function notify(userId, { type, title, body = '', link = null }) {
  if (!userId) return null;
  const row = insert('notifications', { id: newId(), user_id: userId, type, title, body, link, read: 0, created_at: now() });
  emitUser(userId, 'notification', row);
  return row;
}

export function notifyMany(userIds, data, { except } = {}) {
  for (const id of new Set(userIds)) if (id && id !== except) notify(id, data);
}

export function notifyTrip(tripId, data, { except } = {}) {
  const ids = q.all('SELECT user_id FROM trip_members WHERE trip_id = ?', tripId).map((r) => r.user_id);
  notifyMany(ids, data, { except });
}

/** Audit trail of AI concierge proposals, confirmations and executions (dispute resolution). */
export function audit({ tripId = null, userId = null, bookingId = null, action, detail = {} }) {
  insert('agent_audit', { id: newId(), trip_id: tripId, user_id: userId, booking_id: bookingId, action, detail, created_at: now() });
}

export function adminLog(adminId, action, target, detail = {}) {
  insert('admin_logs', { id: newId(), admin_id: adminId, action, target, detail, created_at: now() });
}
