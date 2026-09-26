import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { UPLOAD_DIR } from '../config.js';
import { insert, newId, now, parseJson, q, update } from '../db.js';
import { requireAuth } from '../lib/auth.js';
import { badRequest, forbidden, int, notFound, num, oneOf, str } from '../lib/http.js';
import { publicUrl, uploadImage } from '../lib/upload.js';
import { emitAdmins, emitTrip } from '../realtime.js';
import { notify, notifyTrip } from '../services/notify.js';
import { dayCount, loadDays, requireMember } from '../services/trips.js';

const router = Router();

const REACTIONS = ['❤️', '😍', '😂', '🔥', '🙌', '😮'];
const ZINE_THEMES = ['marigold', 'monsoon', 'chai', 'indigo', 'mehendi'];

function loadMedia(tripId) {
  const media = q.all(`SELECT m.*, u.name AS uploader_name FROM media_assets m LEFT JOIN users u ON u.id = m.uploaded_by WHERE m.trip_id = ? ORDER BY COALESCE(m.day_number, 999), m.created_at`, tripId);
  const reactions = q.all(`SELECT r.* FROM media_reactions r JOIN media_assets m ON m.id = r.media_id WHERE m.trip_id = ?`, tripId);
  return media.map((m) => ({ ...m, reactions: reactions.filter((r) => r.media_id === m.id).map((r) => ({ user_id: r.user_id, emoji: r.emoji })) }));
}

router.get('/trips/:id/media', requireAuth, (req, res) => {
  const { trip } = requireMember(req.params.id, req.user);
  res.json({ media: loadMedia(trip.id) });
});

router.post('/trips/:id/media', requireAuth, uploadImage.array('files', 20), (req, res) => {
  const { trip } = requireMember(req.params.id, req.user);
  if (!req.files?.length) throw badRequest('Choose at least one photo');
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const inferred = Math.round((Date.parse(today) - Date.parse(trip.start_date)) / 86_400_000) + 1;
  const total = dayCount(trip.start_date, trip.end_date);
  const dayNumber = int(req.body.day_number, 'Day', { min: 1, max: total }) ?? (inferred >= 1 && inferred <= total ? inferred : null);
  const caption = str(req.body.caption, 'Caption', { max: 300 }) || '';
  const rows = req.files.map((f) => insert('media_assets', { id: newId(), trip_id: trip.id, uploaded_by: req.user.id, url: publicUrl(f), caption, type: 'photo', day_number: dayNumber, taken_at: now(), created_at: now() }));
  emitTrip(trip.id, 'media', {}, req.user.id);
  notifyTrip(trip.id, { type: 'media', title: `${req.user.name} added ${rows.length} photo${rows.length > 1 ? 's' : ''} to ${trip.name}`, link: `/app/trips/${trip.id}?tab=album` }, { except: req.user.id });
  res.status(201).json({ media: rows });
});

router.patch('/trips/:id/media/:mid', requireAuth, (req, res) => {
  const { trip } = requireMember(req.params.id, req.user);
  const m = q.get('SELECT * FROM media_assets WHERE id = ? AND trip_id = ?', req.params.mid, trip.id);
  if (!m) throw notFound('Photo not found');
  update('media_assets', m.id, {
    caption: req.body.caption !== undefined ? str(req.body.caption, 'Caption', { max: 300 }) ?? '' : undefined,
    day_number: int(req.body.day_number, 'Day', { min: 1, max: dayCount(trip.start_date, trip.end_date) }),
  });
  emitTrip(trip.id, 'media', {}, req.user.id);
  res.json({ ok: true });
});

router.delete('/trips/:id/media/:mid', requireAuth, (req, res) => {
  const { trip, member } = requireMember(req.params.id, req.user);
  const m = q.get('SELECT * FROM media_assets WHERE id = ? AND trip_id = ?', req.params.mid, trip.id);
  if (!m) throw notFound('Photo not found');
  if (m.uploaded_by !== req.user.id && member.role !== 'owner') throw forbidden('Only the uploader or trip owner can delete this photo');
  q.run('DELETE FROM media_assets WHERE id = ?', m.id);
  if (m.url.startsWith('/uploads/')) fs.promises.unlink(path.join(UPLOAD_DIR, path.basename(m.url))).catch(() => {});
  emitTrip(trip.id, 'media', {}, req.user.id);
  res.json({ ok: true });
});

router.post('/trips/:id/media/:mid/react', requireAuth, (req, res) => {
  const { trip } = requireMember(req.params.id, req.user);
  const emoji = oneOf(req.body.emoji, 'Reaction', REACTIONS, { required: true });
  const m = q.get('SELECT * FROM media_assets WHERE id = ? AND trip_id = ?', req.params.mid, trip.id);
  if (!m) throw notFound('Photo not found');
  const exists = q.get('SELECT 1 FROM media_reactions WHERE media_id = ? AND user_id = ? AND emoji = ?', m.id, req.user.id, emoji);
  if (exists) q.run('DELETE FROM media_reactions WHERE media_id = ? AND user_id = ? AND emoji = ?', m.id, req.user.id, emoji);
  else insert('media_reactions', { media_id: m.id, user_id: req.user.id, emoji });
  emitTrip(trip.id, 'media', {}, req.user.id);
  res.json({ ok: true });
});

// ---------- Digital Zine ----------
export function generateLayout(trip) {
  const media = loadMedia(trip.id);
  const days = loadDays(trip.id);
  const members = q.all(`SELECT u.name FROM trip_members m JOIN users u ON u.id = m.user_id WHERE m.trip_id = ?`, trip.id).map((r) => r.name);
  const score = (m) => m.reactions.length * 2 + (m.caption ? 1 : 0);
  const cover = [...media].sort((a, b) => score(b) - score(a))[0];
  const pages = [{ type: 'cover', photo: cover?.id || null, members }];
  const used = new Set(cover ? [cover.id] : []);
  for (const d of days) {
    const photos = media.filter((m) => m.day_number === d.day_number && !used.has(m.id)).sort((a, b) => score(b) - score(a)).slice(0, 4);
    photos.forEach((p) => used.add(p.id));
    if (!photos.length && !d.items.length) continue;
    pages.push({
      type: 'day',
      day_number: d.day_number,
      date: d.date,
      title: d.title || `Day ${d.day_number}`,
      photos: photos.map((p) => p.id),
      highlights: d.items.slice(0, 5).map((i) => ({ title: i.title, time: i.start_time, type: i.type })),
      note: d.notes || '',
      reactions: photos.flatMap((p) => p.reactions.map((r) => r.emoji)).slice(0, 8),
    });
  }
  const leftover = media.filter((m) => !used.has(m.id)).slice(0, 9);
  if (leftover.length) pages.push({ type: 'collage', title: 'More moments', photos: leftover.map((p) => p.id) });
  const spent = q.value('SELECT COALESCE(SUM(amount),0) FROM expenses WHERE trip_id = ?', trip.id);
  const stops = q.value('SELECT COUNT(*) FROM itinerary_items WHERE trip_id = ?', trip.id);
  pages.push({ type: 'stats', days: days.length, photos: media.length, stops, spent, travellers: members.length, reactions: media.reduce((s, m) => s + m.reactions.length, 0) });
  pages.push({ type: 'end', message: `Until the next one, ${members.map((n) => n.split(' ')[0]).join(', ')} ✨` });
  return pages;
}

function zinePayload(tripId) {
  const zine = q.get('SELECT * FROM zines WHERE trip_id = ?', tripId);
  if (!zine) return { zine: null, media: loadMedia(tripId) };
  return { zine: { ...zine, layout: parseJson(zine.layout, []) }, media: loadMedia(tripId) };
}

router.get('/trips/:id/zine', requireAuth, (req, res) => {
  const { trip } = requireMember(req.params.id, req.user);
  res.json(zinePayload(trip.id));
});

router.post('/trips/:id/zine/generate', requireAuth, (req, res) => {
  const { trip } = requireMember(req.params.id, req.user);
  const layout = generateLayout(trip);
  const existing = q.get('SELECT * FROM zines WHERE trip_id = ?', trip.id);
  const theme = oneOf(req.body.theme, 'Theme', ZINE_THEMES) || existing?.theme || 'marigold';
  if (existing) update('zines', existing.id, { layout, theme, generated_at: now(), updated_at: now() });
  else {
    const start = new Date(trip.start_date).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    insert('zines', { id: newId(), trip_id: trip.id, title: trip.name, subtitle: `${trip.destination} · ${start}`, theme, layout, generated_at: now(), updated_at: now() });
  }
  emitTrip(trip.id, 'zine', {}, req.user.id);
  res.json(zinePayload(trip.id));
});

router.patch('/trips/:id/zine', requireAuth, (req, res) => {
  const { trip } = requireMember(req.params.id, req.user);
  const zine = q.get('SELECT * FROM zines WHERE trip_id = ?', trip.id);
  if (!zine) throw notFound('Generate the zine first');
  const fields = {
    title: str(req.body.title, 'Title', { max: 80 }),
    subtitle: req.body.subtitle !== undefined ? str(req.body.subtitle, 'Subtitle', { max: 120 }) ?? '' : undefined,
    theme: oneOf(req.body.theme, 'Theme', ZINE_THEMES),
    updated_at: now(),
  };
  if (Array.isArray(req.body.layout)) {
    const layout = req.body.layout.slice(0, 40).map((p) => ({ ...p, note: typeof p.note === 'string' ? p.note.slice(0, 500) : p.note, title: typeof p.title === 'string' ? p.title.slice(0, 80) : p.title }));
    fields.layout = layout;
  }
  update('zines', zine.id, fields);
  emitTrip(trip.id, 'zine', {}, req.user.id);
  res.json(zinePayload(trip.id));
});

// ---------- Safety: SOS ----------
router.post('/sos', requireAuth, (req, res) => {
  const tripId = req.body.trip_id ? String(req.body.trip_id) : null;
  let trip = null;
  if (tripId) trip = requireMember(tripId, req.user).trip;
  const alert = insert('sos_alerts', {
    id: newId(), user_id: req.user.id, trip_id: trip?.id || null, lat: num(req.body.lat, 'Latitude', { min: -90, max: 90 }) ?? null, lng: num(req.body.lng, 'Longitude', { min: -180, max: 180 }) ?? null,
    message: str(req.body.message, 'Message', { max: 300 }) || '', status: 'active', created_at: now(),
  });
  const mapLink = alert.lat != null ? `https://maps.google.com/?q=${alert.lat},${alert.lng}` : 'location unavailable';
  if (trip) {
    notifyTrip(trip.id, { type: 'sos', title: `🚨 SOS from ${req.user.name}`, body: `${alert.message || 'Needs help now.'} Live location: ${mapLink}`, link: `/app/trips/${trip.id}?tab=map` }, { except: req.user.id });
    emitTrip(trip.id, 'sos', { alert, name: req.user.name }, req.user.id);
  }
  emitAdmins('sos', { ...alert, user_name: req.user.name, phone: req.user.phone, emergency_name: req.user.emergency_name, emergency_phone: req.user.emergency_phone });
  // Emergency contact delivery goes via WhatsApp in production; recorded for the safety desk here.
  res.status(201).json({
    alert,
    emergency_contact: req.user.emergency_phone ? { name: req.user.emergency_name, phone: req.user.emergency_phone } : null,
    share_text: `🚨 ${req.user.name} triggered SOS on Itenary. ${alert.message || ''} Location: ${mapLink}`,
  });
});

router.post('/sos/:id/cancel', requireAuth, (req, res) => {
  const alert = q.get('SELECT * FROM sos_alerts WHERE id = ? AND user_id = ?', req.params.id, req.user.id);
  if (!alert) throw notFound('Alert not found');
  update('sos_alerts', alert.id, { status: 'resolved', resolution_note: 'Cancelled by traveller — marked safe', resolved_at: now() });
  if (alert.trip_id) {
    notifyTrip(alert.trip_id, { type: 'sos_safe', title: `✅ ${req.user.name} is safe`, body: 'The SOS alert was cancelled.' }, { except: req.user.id });
    emitTrip(alert.trip_id, 'sos:resolved', { id: alert.id }, req.user.id);
  }
  emitAdmins('sos', { ...alert, status: 'resolved' });
  notify(req.user.id, { type: 'sos_safe', title: 'Glad you are safe', body: 'Your SOS alert has been closed.' });
  res.json({ ok: true });
});

export { REACTIONS, ZINE_THEMES };
export default router;
