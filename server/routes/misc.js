import { Router } from 'express';
import { config } from '../config.js';
import { q } from '../db.js';
import { searchPlaces, findDestination, DESTINATIONS } from '../data/places.js';
import { aiStatus } from '../agent/concierge.js';
import { getSettings } from '../services/settings.js';
import { whatsappConfigured } from '../services/otp.js';
import { EXPENSE_CATEGORIES } from '../services/budget.js';
import { UPI_APPS } from '../services/payments.js';
import { ITINERARY_TAGS } from './trips.js';
import { TRAVEL_STYLES } from './me.js';
import { REACTIONS, ZINE_THEMES } from './media.js';
import { notFound } from '../lib/http.js';

const router = Router();

router.get('/config', (_req, res) => {
  const s = getSettings();
  res.json({
    demo_mode: config.demoMode,
    whatsapp_live: whatsappConfigured(),
    ai: aiStatus(),
    announcements: q.all(`SELECT id, title, body, level FROM announcements WHERE active = 1 ORDER BY created_at DESC LIMIT 3`),
    itinerary_tags: ITINERARY_TAGS,
    travel_styles: TRAVEL_STYLES,
    reactions: REACTIONS,
    zine_themes: ZINE_THEMES,
    expense_categories: EXPENSE_CATEGORIES,
    upi_apps: UPI_APPS,
    plus_price_monthly: s.plus_price_monthly,
    free_concierge_daily: s.free_concierge_daily,
    booking_fee_pct: s.booking_fee_pct,
    support_whatsapp: s.support_whatsapp,
    signup_open: s.signup_open,
    destinations: DESTINATIONS.map((d) => ({ name: d.name, state: d.state, theme: d.theme, lat: d.lat, lng: d.lng })),
  });
});

router.get('/stats/public', (_req, res) => {
  res.json({
    travellers: q.value(`SELECT COUNT(*) FROM users WHERE role = 'user'`),
    trips: q.value('SELECT COUNT(*) FROM trips'),
    itineraries: q.value(`SELECT COUNT(*) FROM public_itineraries WHERE status = 'published'`),
    forks: q.value('SELECT COUNT(*) FROM forks'),
    bookings: q.value(`SELECT COUNT(*) FROM bookings WHERE status IN ('confirmed','completed')`),
  });
});

router.get('/places/search', async (req, res) => {
  const query = String(req.query.q || '').slice(0, 80);
  const near = req.query.near ? String(req.query.near) : undefined;
  let results = searchPlaces(query, { near, limit: 8 });
  if (results.length < 3 && query.length >= 3) {
    // Fall back to OpenStreetMap Nominatim for places outside the curated gazetteer.
    try {
      const nearDest = findDestination(near);
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=in&q=${encodeURIComponent(query + (nearDest ? ', ' + nearDest.name : ''))}`, {
        headers: { 'User-Agent': 'Itenary/1.0 (trip planner)' },
        signal: AbortSignal.timeout(4000),
      });
      if (r.ok) {
        const data = await r.json();
        results = results.concat(data.map((p) => ({ name: p.display_name.split(',')[0], subtitle: p.display_name.split(',').slice(1, 3).join(',').trim(), lat: Number(p.lat), lng: Number(p.lon), kind: p.type || 'place', destination: nearDest?.name || '' })));
      }
    } catch {
      // offline — curated results only
    }
  }
  res.json({ results: results.slice(0, 8) });
});

router.get('/events', (req, res) => {
  const where = [`status = 'active'`, `COALESCE(end_at, start_at) >= :from`];
  const params = { from: req.query.from ? String(req.query.from) : new Date().toISOString().slice(0, 10) };
  if (req.query.to) {
    where.push('date(start_at) <= :to');
    params.to = String(req.query.to);
  }
  if (req.query.city) {
    where.push('lower(city) = :city');
    params.city = (findDestination(String(req.query.city))?.name || String(req.query.city)).toLowerCase();
  }
  if (req.query.category) {
    where.push('category = :category');
    params.category = String(req.query.category);
  }
  if (req.query.q) {
    where.push('(lower(title) LIKE :text OR lower(description) LIKE :text OR lower(city) LIKE :text)');
    params.text = `%${String(req.query.q).toLowerCase().slice(0, 60)}%`;
  }
  const events = q.all(`SELECT * FROM events WHERE ${where.join(' AND ')} ORDER BY start_at LIMIT 100`, params);
  const cities = q.all(`SELECT city, COUNT(*) AS n FROM events WHERE status = 'active' GROUP BY city ORDER BY n DESC`).map((r) => r.city);
  res.json({ events, cities, categories: ['festival', 'activity', 'food', 'culture', 'adventure', 'music'] });
});

router.get('/events/:id', (req, res) => {
  const e = q.get(`SELECT * FROM events WHERE id = ? AND status = 'active'`, req.params.id);
  if (!e) throw notFound('Event not found');
  res.json({ event: e });
});

export default router;
