// Seeds the admin account, provider connectors and realistic demo content.
// Runs automatically on first start; `npm run seed` wipes and re-seeds.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { db, insert, newId, q, update } from './db.js';
import { hashPassword } from './lib/auth.js';
import { findDestination } from './data/places.js';
import { connectors, remember } from './connectors/index.js';
import { propose, confirm, execute } from './services/bookings.js';
import { addExpense } from './services/budget.js';
import { addDays, addItemToDay, createTrip, addMember, recomputeVibe, snapshotItinerary } from './services/trips.js';

const DAY = 86_400_000;
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const ago = (days, hours = 0) => new Date(Date.now() - days * DAY - hours * 3600_000).toISOString();
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];

const TABLES = [
  'admin_logs', 'announcements', 'usage_counters', 'live_locations', 'sos_alerts', 'agent_audit', 'notifications', 'payouts', 'follows', 'reviews', 'forks',
  'itinerary_purchases', 'itinerary_likes', 'zines', 'media_reactions', 'media_assets', 'settlements', 'expense_shares', 'expenses', 'payments', 'bookings',
  'chat_messages', 'poll_votes', 'poll_options', 'polls', 'stash_items', 'itinerary_items', 'itinerary_days', 'trip_members', 'public_itineraries', 'trips',
  'events', 'providers', 'otp_codes', 'settings', 'users',
];

const TIPS = {
  heritage: 'Go early to beat the crowds; licensed guides wait at the gate (~₹300).',
  beach: 'Best light after 4:30 pm. Shacks rent loungers for the price of a drink.',
  lake: 'Boats run 8 am – 6 pm; pedal boats are cheaper than rowing boats.',
  trek: 'Carry 2 L of water and wear proper shoes — the trail gets slippery.',
  adventure: 'Book the morning slot; afternoons get windy and slots sell out.',
  spiritual: 'Dress modestly and keep footwear at the stand outside.',
  viewpoint: 'Sunrise is worth the early alarm. Carry a light jacket.',
  market: 'Bargain with a smile — start at 60% of the quoted price.',
  food: 'Ask for the local special; portions are generous, so share.',
  nature: 'Carry cash — card machines rarely work here.',
  culture: 'Shows start on time; reach 20 minutes early for good seats.',
  walk: 'Wear comfortable shoes; lots of photo stops along the way.',
  family: 'Great for kids; tickets are cheaper before noon.',
};

const LUNCH = {
  Uttarakhand: ['Lunch: Kumaoni thali at a dhaba', 'Momos & maggi by the lake', 'Bal mithai tasting on Mall Road'],
  'Himachal Pradesh': ['Lunch: Himachali dham', 'Cafe hopping in Old Manali', 'Trout lunch by the river'],
  Rajasthan: ['Lunch: Rajasthani thali', 'Pyaaz kachori breakfast', 'Rooftop dinner with fort views'],
  Goa: ['Lunch: Goan fish thali', 'Beach shack sundowner', 'Bebinca & coffee in Panjim'],
  Kerala: ['Lunch: Kerala sadya on banana leaf', 'Karimeen fry by the water', 'Chai & banana chips stop'],
  Karnataka: ['Lunch: Udupi meals', 'Coorg pandi curry dinner', 'Filter coffee break'],
  'Uttar Pradesh': ['Kachori sabzi breakfast', 'Lassi at Blue Lassi', 'Street chaat crawl'],
  Puducherry: ['Croissants in White Town', 'Seafood dinner on the promenade', 'Tamil meals lunch'],
  Meghalaya: ['Jadoh lunch', 'Tea & pukhlein break', 'Smoked pork dinner'],
  Ladakh: ['Thukpa lunch', 'Butter tea stop', 'Apricot cake at a German bakery'],
  default: ['Local lunch stop', 'Chai break', 'Dinner at a local favourite'],
};

function plan(destName, days, { vibe = 50, titles = [] } = {}) {
  const d = findDestination(destName);
  const places = [...d.places].filter((p) => p.kind !== 'transport').sort((a, b) => Math.abs(a.vibe - vibe) - Math.abs(b.vibe - vibe));
  const lunches = LUNCH[d.state] || LUNCH.default;
  let pi = 0;
  const out = [];
  for (let n = 1; n <= days; n++) {
    const items = [];
    const morning = places[pi++ % places.length];
    const evening = places[pi++ % places.length];
    items.push({ type: morning.kind === 'food' ? 'food' : 'place', title: morning.name, description: TIPS[morning.kind] || '', place_name: morning.name, lat: morning.lat, lng: morning.lng, start_time: n === 1 ? '11:00' : '08:30', duration_min: 150, cost: rand(0, 6) * 100 });
    items.push({ type: 'food', title: lunches[(n - 1) % lunches.length], description: TIPS.food, place_name: d.name, lat: null, lng: null, start_time: '13:30', duration_min: 60, cost: rand(4, 12) * 100 });
    if (n < days || days === 1) items.push({ type: evening.kind === 'food' ? 'food' : 'activity', title: evening.name, description: TIPS[evening.kind] || '', place_name: evening.name, lat: evening.lat, lng: evening.lng, start_time: '16:30', duration_min: 120, cost: rand(0, 10) * 100 });
    out.push({ day_number: n, title: titles[n - 1] || (n === 1 ? 'Arrive & settle in' : n === days ? 'Slow morning & head home' : `${morning.name.split(' ')[0]} day`), notes: '', items });
  }
  return out;
}

function makeUser(u) {
  return insert('users', {
    id: newId(), phone: u.phone || null, email: u.email || null, password_hash: u.password ? hashPassword(u.password) : null, name: u.name, avatar_url: null,
    bio: u.bio || '', home_city: u.city || '', travel_style: JSON.stringify(u.styles || []), role: u.role || 'user', verified: u.verified ? 1 : 0,
    verification_status: u.verified ? 'approved' : u.pending ? 'pending' : 'none', verification_note: u.pending ? 'Solo traveller, would love the verified badge for safety.' : null,
    emergency_name: u.emergency_name || null, emergency_phone: u.emergency_phone || null, upi_id: u.upi || null,
    plan: u.plus ? 'plus' : 'free', plan_expires_at: u.plus ? new Date(Date.now() + 25 * DAY).toISOString() : null, status: 'active', onboarded: 1,
    created_at: u.created_at || ago(rand(20, 90)), last_seen_at: ago(0, rand(0, 72)),
  });
}

function message(tripId, userId, content, when, { channel = 'group', type = 'user', meta = {} } = {}) {
  insert('chat_messages', { id: newId(), trip_id: tripId, channel, sender_id: userId, sender_type: type, content, meta, created_at: when });
}

function bookFromSearch(trip, user, category, params, { pickIndex = 0, when, status = 'confirmed' } = {}) {
  const limit = q.value('SELECT spend_limit_booking FROM trips WHERE id = ?', trip.id);
  const options = connectors[category].search(params, { trip }).map((o) => remember(o, trip.id)).filter((o) => o.amount * 1.05 < limit);
  const option = options[Math.min(pickIndex, options.length - 1)];
  if (!option) return null;
  const b = propose({ tripId: trip.id, userId: user.id, option, source: 'agent' });
  if (status === 'proposed') return b;
  try {
    confirm(b.id, user, { upi_app: pickOne(['gpay', 'phonepe', 'paytm']), pin: '1234' });
  } catch {
    update('bookings', b.id, { status: 'cancelled', failure_reason: 'Dismissed' });
    return null;
  }
  execute(b.id, { forceSuccess: true });
  if (status === 'completed') update('bookings', b.id, { status: 'completed' });
  if (when) {
    update('bookings', b.id, { created_at: when, updated_at: when, confirmed_at: when });
    q.run('UPDATE payments SET created_at = ? WHERE booking_id = ?', when, b.id);
    q.run('UPDATE agent_audit SET created_at = ? WHERE booking_id = ?', when, b.id);
  }
  return q.get('SELECT * FROM bookings WHERE id = ?', b.id);
}

export async function seed({ reset = false, quiet = true } = {}) {
  const log = (...a) => !quiet && console.log('[seed]', ...a);
  if (reset) {
    db.exec('PRAGMA foreign_keys = OFF');
    for (const t of TABLES) db.exec(`DELETE FROM ${t}`);
    db.exec('PRAGMA foreign_keys = ON');
    log('database cleared');
  }

  // ---------- Admin ----------
  makeUser({ name: 'Itenary Admin', email: config.admin.email, password: config.admin.password, role: 'admin', created_at: ago(120) });
  log(`admin: ${config.admin.email}`);

  // ---------- Providers (sandbox connectors) ----------
  const providers = [
    ['cab', 'Sawari Cabs', 'Outstation & hill-route specialists across North India', 9, 0.06, 4.6, 1],
    ['cab', 'RideNow', 'City rides and airport transfers', 7, 0.03, 4.4, 0.95],
    ['food', 'ZipEats', 'Food delivery from local favourites', 12, 0.04, 4.3, 1],
    ['food', 'Thali Express', 'Regional thalis and home-style meals', 10, 0.03, 4.5, 0.9],
    ['stay', 'Nest Stays', 'Hostels, homestays and boutique hotels', 12, 0.05, 4.5, 1],
    ['stay', 'Pahadi Homestays Network', 'Verified family-run homestays in the hills', 10, 0.04, 4.7, 0.9],
    ['experience', 'Itenary Experiences', 'Curated local events, tours and activities', 15, 0.02, 4.8, 1],
  ];
  for (const [category, name, description, commission_pct, failure_rate, rating, price_factor] of providers) {
    insert('providers', { id: newId(), category, name, description, enabled: 1, commission_pct, failure_rate, rating, price_factor, created_at: ago(120) });
  }

  // ---------- Travellers ----------
  const people = [
    { name: 'Aarav Sharma', city: 'Delhi', styles: ['Adventure', 'Foodie', 'Trek'], verified: true, plus: true, upi: 'aarav.sharma@okicici', bio: 'Weekend trekker, full-time foodie. 40+ Himalayan trails and counting.', emergency_name: 'Sunita Sharma', emergency_phone: '+919811100001' },
    { name: 'Priya Iyer', city: 'Bengaluru', styles: ['Solo Female', 'Budget', 'Spiritual'], verified: true, upi: 'priya.iyer@okaxis', bio: 'Solo female traveller. I write honest, safety-first guides for women on the road.', emergency_name: 'Lakshmi Iyer', emergency_phone: '+919845000002' },
    { name: 'Rohan Mehta', city: 'Mumbai', styles: ['Adventure', 'Backpacking'], upi: 'rohan.m@ybl', emergency_name: 'Neha Mehta', emergency_phone: '+919820000003' },
    { name: 'Ananya Gupta', city: 'Lucknow', styles: ['Heritage', 'Foodie', 'Spiritual'], upi: 'ananya.g@oksbi', bio: 'History nerd. Will walk 20k steps for the perfect kachori.' },
    { name: 'Kabir Singh', city: 'Chandigarh', styles: ['Budget', 'Beach', 'Weekend'], verified: true, upi: 'kabir.singh@paytm', bio: 'Maximum trip, minimum budget. Goa regular.', emergency_name: 'Harpreet Singh', emergency_phone: '+919815000005' },
    { name: 'Meera Nair', city: 'Kochi', styles: ['Chill', 'Luxury', 'Family'], verified: true, plus: true, upi: 'meera.nair@okhdfcbank', bio: 'Slow travel, good coffee, better company. Kerala local.', emergency_name: 'Arun Nair', emergency_phone: '+919847000006' },
    { name: 'Ishaan Verma', city: 'Jaipur', styles: ['Foodie', 'Heritage', 'Couple'], upi: 'ishaan.v@ybl', bio: 'Born in the Pink City. Ask me where to eat.' },
    { name: 'Zoya Khan', city: 'Hyderabad', styles: ['Solo Female', 'Offbeat', 'Monsoon'], pending: true, upi: 'zoya.khan@okaxis', bio: 'Chasing waterfalls in the Northeast.', emergency_name: 'Sameer Khan', emergency_phone: '+919849000008' },
  ];
  const U = people.map((p, i) => makeUser({ ...p, phone: `+9190000000${String(i + 1).padStart(2, '0')}`, created_at: ago(90 - i * 7) }));
  const [aarav, priya, rohan, ananya, kabir, meera, ishaan, zoya] = U;
  log(`${U.length} demo travellers (phones +91 90000 000 01…08)`);

  // Background users so the admin charts have shape
  const FIRST = ['Aditya', 'Sneha', 'Vikram', 'Pooja', 'Arjun', 'Divya', 'Karan', 'Riya', 'Siddharth', 'Nisha', 'Rahul', 'Tanvi', 'Manish', 'Kavya', 'Yash', 'Shreya', 'Nikhil', 'Aditi', 'Varun', 'Ira'];
  const LAST = ['Patel', 'Reddy', 'Das', 'Joshi', 'Kulkarni', 'Banerjee', 'Pillai', 'Chauhan', 'Bhat', 'Saxena', 'Rao', 'Malhotra'];
  const CITIES = ['Pune', 'Indore', 'Bhopal', 'Kolkata', 'Nagpur', 'Surat', 'Dehradun', 'Coimbatore', 'Guwahati', 'Patna', 'Ranchi', 'Mysuru', 'Vadodara', 'Kanpur'];
  const extra = [];
  for (let i = 0; i < 46; i++) {
    extra.push(makeUser({ name: `${pickOne(FIRST)} ${pickOne(LAST)}`, phone: `+91900010${String(1000 + i).slice(-4)}`, city: pickOne(CITIES), styles: [pickOne(['Budget', 'Foodie', 'Adventure', 'Chill', 'Couple'])], created_at: ago(rand(0, 29), rand(0, 23)), plus: i % 11 === 0 }));
  }

  // ---------- Follows (spread over 30 days for growth charts) ----------
  const follow = (a, b, when) => q.run('INSERT OR IGNORE INTO follows (follower_id, creator_id, created_at) VALUES (?, ?, ?)', a.id, b.id, when);
  for (const creator of [aarav, priya, meera, kabir]) {
    const n = { [aarav.id]: 34, [priya.id]: 41, [meera.id]: 22, [kabir.id]: 15 }[creator.id];
    for (const f of extra.slice(0, n)) follow(f, creator, ago(rand(0, 45), rand(0, 23)));
  }
  follow(rohan, aarav, ago(40));
  follow(priya, aarav, ago(38));
  follow(aarav, priya, ago(37));
  follow(zoya, priya, ago(12));
  follow(ananya, meera, ago(9));

  // ---------- Events ----------
  const ev = (title, city, category, inDays, hour, price, capacity, description, venue) => {
    const d = findDestination(city);
    const start = new Date(`${addDays(today(), inDays)}T${String(hour).padStart(2, '0')}:00:00+05:30`);
    insert('events', { id: newId(), title, description, city: d?.name || city, venue, lat: d?.lat ?? null, lng: d?.lng ?? null, category, start_at: start.toISOString(), end_at: new Date(start.getTime() + 3 * 3600_000).toISOString(), price, capacity, booked_count: rand(2, Math.floor(capacity / 2)), cover_theme: d?.theme || 'festival', image_url: null, status: 'active', created_at: ago(20) });
  };
  ev('Sunset Kayaking on Bhimtal Lake', 'Bhimtal', 'adventure', 13, 16, 900, 20, 'Guided 90-minute kayak session with life jackets and a certified instructor. No experience needed.', 'Bhimtal Boat Club');
  ev('Kumaoni Cooking Class', 'Nainital', 'food', 14, 11, 1200, 12, 'Cook bhatt ki churkani, aloo ke gutke and madua roti with a local home chef. Lunch included.', 'Mallital, Nainital');
  ev('Naukuchiatal Tandem Paragliding', 'Bhimtal', 'adventure', 15, 10, 2800, 10, '15–20 minute tandem flight over the lakes with a certified pilot. Weather dependent; full refund if cancelled.', 'Naukuchiatal launch site');
  ev('Ganga Aarti & Sunset Boat Ride', 'Rishikesh', 'culture', 42, 17, 600, 30, 'Watch the evening aarti at Triveni Ghat from a boat, followed by chai by the river.', 'Triveni Ghat');
  ev('16 km White-Water Rafting (Shivpuri)', 'Rishikesh', 'adventure', 43, 9, 1500, 24, 'Grade III–IV rapids with cliff jumping and body surfing. Transport from Tapovan included.', 'Shivpuri Rafting Point');
  ev('Pink City Food Trail', 'Jaipur', 'food', 1, 18, 1100, 15, 'Six stops, twelve tastings: pyaaz kachori, mirchi vada, lassi, ghevar and more with a local foodie.', 'Johari Bazaar');
  ev('Amber Fort Light & Sound Show', 'Jaipur', 'culture', 2, 19, 300, 80, 'An hour-long show narrating the history of Amer, voiced in Hindi and English.', 'Amber Fort');
  ev('Goa Sunset Music Fest', 'Goa', 'music', 30, 16, 2500, 400, 'Beachside indie and electronic line-up across two stages. Food trucks and flea market.', 'Vagator Beach');
  ev('Old Goa Heritage Walk', 'Goa', 'culture', 9, 8, 700, 20, 'Walk through the churches and convents of Old Goa with an architectural historian.', 'Basilica of Bom Jesus');
  ev('Dev Deepawali Boat Experience', 'Varanasi', 'festival', 25, 17, 3500, 40, 'Watch a million diyas light up the ghats from a private boat. Snacks and a local storyteller included.', 'Dashashwamedh Ghat');
  ev('Houseboat Day Cruise', 'Alleppey', 'activity', 20, 11, 4500, 16, 'Six hours on the backwaters with a Kerala lunch cooked on board.', 'Punnamada Jetty');
  ev('Coffee Estate Tour & Tasting', 'Coorg', 'food', 18, 10, 800, 20, 'Walk a working estate, learn bean-to-cup, and taste four single-origins.', 'Madikeri');
  ev('Hampi Bouldering for Beginners', 'Hampi', 'adventure', 27, 7, 1800, 10, 'Half-day bouldering session on Hampi’s famous granite with crash pads and coaching.', 'Hippie Island');
  ev('Hornbill-style Naga Food Evening', 'Shillong', 'food', 35, 19, 1400, 30, 'Smoked meats, bamboo shoot and axone dishes with live folk music.', 'Police Bazaar');
  ev('Tiger Hill Sunrise Jeep Safari', 'Darjeeling', 'activity', 22, 4, 950, 24, 'Early-morning jeep to Tiger Hill for sunrise over Kanchenjunga, with a stop at Batasia Loop.', 'Chowrasta pickup');
  ev('Pondicherry Heritage Cycle Tour', 'Pondicherry', 'culture', 16, 7, 650, 15, 'Cycle through White Town and the Tamil Quarter with breakfast at a French bakery.', 'Promenade Beach');

  // ---------- Trip A: upcoming, collaborative (the showcase) ----------
  const startA = addDays(today(), 12);
  const tripA = createTrip({ owner: aarav, name: 'Nainital & Bhimtal Getaway', destination: 'Nainital', start_date: startA, end_date: addDays(startA, 3), budget: 42000 });
  update('trips', tripA.id, { created_at: ago(9), spend_limit_booking: 20000, spend_limit_trip: 80000 });
  addMember(tripA.id, priya.id);
  addMember(tripA.id, rohan.id);
  q.run('UPDATE trip_members SET vibe = ?, joined_at = ? WHERE trip_id = ? AND user_id = ?', 72, ago(9), tripA.id, aarav.id);
  q.run('UPDATE trip_members SET vibe = ?, joined_at = ? WHERE trip_id = ? AND user_id = ?', 45, ago(8), tripA.id, priya.id);
  q.run('UPDATE trip_members SET vibe = ?, joined_at = ? WHERE trip_id = ? AND user_id = ?', 80, ago(7), tripA.id, rohan.id);
  recomputeVibe(tripA.id);
  const daysA = q.all('SELECT * FROM itinerary_days WHERE trip_id = ? ORDER BY day_number', tripA.id);
  const dayTitles = ['Arrive in Nainital', 'Lakes & views', 'Bhimtal adventure day', 'Slow morning & drive back'];
  daysA.forEach((d, i) => update('itinerary_days', d.id, { title: dayTitles[i] }));
  update('itinerary_days', daysA[0].id, { notes: 'Train to Kathgodam (Shatabdi) gets in at 11:40. Cab up the hill ~1.5 hrs.' });
  const P = (name) => findDestination('Nainital').places.find((p) => p.name === name) || findDestination('Bhimtal').places.find((p) => p.name === name);
  const itemA = (day, title, type, time, placeName, desc, cost, by) => {
    const p = placeName ? P(placeName) : null;
    return addItemToDay(tripA.id, day, { title, type, start_time: time, place_name: placeName, lat: p?.lat ?? null, lng: p?.lng ?? null, description: desc, cost }, { userId: by.id });
  };
  itemA(1, 'Check in & freshen up', 'stay', '14:00', null, 'Homestay near Mallital — to be finalised (see vote)', 0, aarav);
  itemA(1, 'Naini Lake Boating', 'activity', '16:30', 'Naini Lake Boating', 'Row boat for 3, 30 min. Go before sunset.', 600, priya);
  itemA(1, 'Dinner on Mall Road', 'food', '20:00', 'Mall Road Nainital', 'Try the momos at the Tibetan market end', 1500, rohan);
  itemA(2, 'Snow View Point by ropeway', 'place', '08:30', 'Snow View Point', 'Ropeway opens at 8 — beat the queue', 900, aarav);
  itemA(2, 'Tiffin Top hike', 'activity', '11:30', 'Tiffin Top', '4 km round trip, carry water', 0, rohan);
  itemA(2, 'Naina Devi Temple', 'place', '17:30', 'Naina Devi Temple', TIPS.spiritual, 0, priya);
  itemA(3, 'Bhimtal Lake Kayaking', 'activity', '09:30', 'Bhimtal Lake Kayaking', TIPS.adventure, 1800, rohan);
  itemA(3, 'Lunch at Sattal', 'food', '13:30', 'Sattal', 'Picnic lunch by the seven lakes', 900, priya);
  itemA(4, 'Butterfly Research Centre', 'place', '10:00', 'Butterfly Research Centre', 'Small entry fee, lovely garden', 300, priya);
  const stash = (type, title, note, by, extra = {}) => insert('stash_items', { id: newId(), trip_id: tripA.id, type, title, note, url: extra.url || null, image_url: extra.image_url || null, place_name: extra.place || null, lat: extra.lat ?? null, lng: extra.lng ?? null, added_by: by.id, created_at: ago(rand(1, 6)) });
  const para = P('Naukuchiatal Paragliding');
  stash('place', 'Naukuchiatal Paragliding', 'Rohan really wants this 🪂 — ₹2,800 each', rohan, { place: para.name, lat: para.lat, lng: para.lng });
  stash('link', 'Best cafés in Nainital (blog)', 'Saved from Instagram', priya, { url: 'https://en.wikipedia.org/wiki/Nainital' });
  stash('note', 'Carry warm jackets', 'Nights drop to 8°C in this season', aarav);
  stash('photo', 'Sunrise from Snow View', 'Want this shot!', priya, { image_url: 'https://picsum.photos/seed/tc-snowview/800/600' });

  // Polls
  const poll = (question, options, by, votes, when, closed = 0) => {
    const id = newId();
    insert('polls', { id, trip_id: tripA.id, question, multi: 0, closed, created_by: by.id, created_at: when });
    const ids = options.map((o, i) => insert('poll_options', { id: newId(), poll_id: id, label: o[0], detail: o[1], position: i }).id);
    for (const [user, idx] of votes) insert('poll_votes', { poll_id: id, option_id: ids[idx], user_id: user.id, created_at: when });
  };
  poll('Where do we stay?', [['Pine Crest Cottages', 'Homestay · ₹2,400/night · breakfast'], ['Lakeview Villa', 'Boutique · ₹4,800/night · lake view']], aarav, [[aarav, 1], [priya, 0]], ago(5));
  poll('Paragliding on Day 3?', [['Yes, let’s do it! 🪂', ''], ['I’ll watch from the ground', '']], rohan, [[rohan, 0], [aarav, 0], [priya, 1]], ago(3));

  // Chat
  message(tripA.id, null, 'Aarav created the trip ✨', ago(9), { type: 'system' });
  message(tripA.id, aarav.id, 'Booked the Shatabdi to Kathgodam 🚆 Now let’s plan the hills!', ago(9, -1));
  message(tripA.id, null, 'Priya Iyer joined the trip 👋', ago(8), { type: 'system' });
  message(tripA.id, priya.id, 'Yay! I added a café blog to the Stash. Also voting for the homestay, the villa is too pricey 😅', ago(8, -2));
  message(tripA.id, null, 'Rohan Mehta joined the trip 👋', ago(7), { type: 'system' });
  message(tripA.id, rohan.id, 'Guys. Paragliding. Naukuchiatal. Non-negotiable 🪂🔥', ago(7, -1));
  message(tripA.id, aarav.id, '@Rohan put it to a vote 😂 I set the vibe to 72, let’s keep day 4 chill for Priya', ago(6));
  message(tripA.id, priya.id, 'Thank you 🙏 I’ll handle the budget tab', ago(6, -1));
  message(tripA.id, rohan.id, 'Asked Yatri to sort the cab from Kathgodam. Check the concierge tab!', ago(2));

  // Concierge conversation with a confirmed cab + an open proposal
  message(tripA.id, rohan.id, 'Book a cab from Kathgodam station to Nainital on day 1 at 11:45am for 3 of us', ago(2, 1), { channel: 'concierge' });
  const cab = bookFromSearch(tripA, rohan, 'cab', { pickup: 'Kathgodam', drop: 'Nainital', pickup_time: new Date(`${startA}T11:45:00+05:30`).toISOString(), passengers: 3 }, { pickIndex: 1, when: ago(2) });
  message(tripA.id, null, `Here are cab options from **Kathgodam** to **Nainital** for day 1 at 11:45 AM. I'd pick the Sedan — room for 3 plus bags on the hill road. Tap **Review & pay** to confirm.`, ago(2, 0.9), { channel: 'concierge', type: 'agent', meta: { proposals: [cab.id], engine: 'built-in' } });
  message(tripA.id, priya.id, 'Can you find a homestay in Nainital for our dates under ₹3000 a night?', ago(1, 2), { channel: 'concierge' });
  const stayA = bookFromSearch(tripA, priya, 'stay', { location: 'Nainital', check_in: startA, check_out: addDays(startA, 3), guests: 3, style: 'homestay', max_price_per_night: 3000 }, { status: 'proposed' });
  const stayB = bookFromSearch(tripA, priya, 'stay', { location: 'Nainital', check_in: startA, check_out: addDays(startA, 3), guests: 3, max_price_per_night: 3000 }, { status: 'proposed', pickIndex: 1 });
  const stayIds = [stayA, stayB].filter(Boolean).map((b) => b.id);
  for (const id of stayIds) q.run(`UPDATE bookings SET created_at = ? WHERE id = ?`, new Date().toISOString(), id);
  message(tripA.id, null, `I found stays in **Nainital** for ${startA} → ${addDays(startA, 3)} within ₹3,000/night. The homestay includes home-cooked breakfast and a bonfire 🔥. Tap **Review & pay** on the one you like — nothing is charged until you approve the UPI payment.`, ago(1, 1.9), { channel: 'concierge', type: 'agent', meta: { proposals: stayIds, engine: 'built-in' } });

  // Budget
  addExpense({ tripId: tripA.id, paidBy: aarav.id, title: 'Shatabdi tickets (3)', category: 'transport', amount: 4260, spentOn: addDays(today(), -9) });
  addExpense({ tripId: tripA.id, paidBy: priya.id, title: 'Snacks & travel kit', category: 'shopping', amount: 1350, spentOn: addDays(today(), -4) });
  insert('settlements', { id: newId(), trip_id: tripA.id, from_user: rohan.id, to_user: aarav.id, amount: 1420, status: 'requested', note: 'Train tickets', requested_by: aarav.id, created_at: ago(1) });
  log('trip: Nainital & Bhimtal Getaway');

  // ---------- Trip B: completed Goa trip with album + zine ----------
  const startB = addDays(today(), -40);
  const tripB = createTrip({ owner: kabir, name: 'Goa with the Gang', destination: 'Goa', start_date: startB, end_date: addDays(startB, 3), budget: 60000 });
  update('trips', tripB.id, { created_at: ago(70), status: 'completed' });
  for (const u of [aarav, ananya, ishaan]) addMember(tripB.id, u.id);
  q.run('UPDATE trip_members SET vibe = ? WHERE trip_id = ?', 62, tripB.id);
  recomputeVibe(tripB.id);
  const goaPlan = plan('Goa', 4, { vibe: 60, titles: ['North Goa beaches', 'Forts & flea markets', 'Old Goa & Panjim', 'Palolem slow day'] });
  const daysB = q.all('SELECT * FROM itinerary_days WHERE trip_id = ? ORDER BY day_number', tripB.id);
  goaPlan.forEach((d, i) => {
    update('itinerary_days', daysB[i].id, { title: d.title });
    d.items.forEach((it) => addItemToDay(tripB.id, d.day_number, it, { userId: pickOne([kabir, aarav, ananya, ishaan]).id }));
  });
  const photoCaptions = ['First sunset at Baga 🌅', 'Fort Aguada views', 'Fish thali heaven', 'Flea market loot', 'Panjim colours', 'Squad photo!', 'Palolem calm', 'Last night vibes', 'Scooter gang 🛵', 'Bebinca > everything'];
  photoCaptions.forEach((caption, i) => {
    const m = insert('media_assets', { id: newId(), trip_id: tripB.id, uploaded_by: [kabir, aarav, ananya, ishaan][i % 4].id, url: `https://picsum.photos/seed/tc-goa-${i + 1}/900/${i % 3 === 0 ? 1200 : 700}`, caption, type: 'photo', day_number: Math.min(4, Math.floor(i / 2.5) + 1), taken_at: ago(40 - Math.floor(i / 3)), created_at: ago(39 - Math.floor(i / 3)) });
    for (const u of [kabir, aarav, ananya, ishaan].slice(0, rand(1, 4))) insert('media_reactions', { media_id: m.id, user_id: u.id, emoji: pickOne(['❤️', '😍', '🔥', '🙌', '😂']) });
  });
  bookFromSearch(tripB, kabir, 'stay', { location: 'Goa', check_in: startB, check_out: addDays(startB, 3), guests: 4, style: 'hostel' }, { status: 'completed', when: ago(50) });
  bookFromSearch(tripB, aarav, 'cab', { pickup: 'Baga Beach', drop: 'Basilica of Bom Jesus', pickup_time: new Date(`${addDays(startB, 2)}T09:00:00+05:30`).toISOString(), passengers: 4 }, { status: 'completed', when: ago(41) });
  bookFromSearch(tripB, ishaan, 'food', { area: 'Goa', meal: 'dinner', party_size: 4 }, { status: 'completed', when: ago(40) });
  addExpense({ tripId: tripB.id, paidBy: ananya.id, title: 'Scooter rentals', category: 'transport', amount: 2400, spentOn: startB });
  addExpense({ tripId: tripB.id, paidBy: ishaan.id, title: 'Beach shack dinner', category: 'food', amount: 3600, spentOn: addDays(startB, 1) });
  const pubB = newId();
  insert('public_itineraries', {
    id: pubB, source_trip_id: tripB.id, creator_id: kabir.id, title: 'Goa on a Budget: 4 Days, 4 Friends', summary: 'Hostels, scooters and beach shacks — how four of us did North & South Goa for under ₹15k each, with the best fish thali spots we found.',
    destination: 'Goa', cover_theme: 'beach', days_count: 4, budget_estimate: 15000, tags: JSON.stringify(['Budget', 'Beach', 'Foodie', 'Backpacking']), content: JSON.stringify(snapshotItinerary(tripB.id)),
    price: 0, verified_premium: 0, featured: 1, status: 'published', fork_count: 18, like_count: 44, view_count: 612, sales_count: 0, rating_avg: 0, rating_count: 0, created_at: ago(35), updated_at: ago(35),
  });
  update('trips', tripB.id, { published_itinerary_id: pubB });
  const { generateLayout } = await import('./routes/media.js');
  insert('zines', { id: newId(), trip_id: tripB.id, title: 'Goa with the Gang', subtitle: `Goa · ${new Date(startB).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`, theme: 'marigold', layout: JSON.stringify(generateLayout(q.get('SELECT * FROM trips WHERE id = ?', tripB.id))), generated_at: ago(35), updated_at: ago(35) });
  log('trip: Goa with the Gang (completed, album, zine)');

  // ---------- Trip C: ongoing Jaipur weekend ----------
  const tripC = createTrip({ owner: priya, name: 'Jaipur Heritage Weekend', destination: 'Jaipur', start_date: addDays(today(), -1), end_date: addDays(today(), 1), budget: 24000 });
  update('trips', tripC.id, { created_at: ago(15), status: 'ongoing' });
  addMember(tripC.id, meera.id);
  const jPlan = plan('Jaipur', 3, { vibe: 30, titles: ['Old city & bazaars', 'Amber & Nahargarh', 'Slow breakfast & fly home'] });
  const daysC = q.all('SELECT * FROM itinerary_days WHERE trip_id = ? ORDER BY day_number', tripC.id);
  jPlan.forEach((d, i) => {
    update('itinerary_days', daysC[i].id, { title: d.title });
    d.items.forEach((it) => addItemToDay(tripC.id, d.day_number, it, { userId: pickOne([priya, meera]).id }));
  });
  q.run('UPDATE trip_members SET share_location = 1, vibe = 30 WHERE trip_id = ?', tripC.id);
  recomputeVibe(tripC.id);
  q.run(`INSERT INTO live_locations (trip_id, user_id, lat, lng, updated_at) VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)`, tripC.id, priya.id, 26.9239, 75.8267, new Date().toISOString(), tripC.id, meera.id, 26.9258, 75.8237, new Date().toISOString());
  bookFromSearch(tripC, priya, 'stay', { location: 'Jaipur', check_in: addDays(today(), -1), check_out: addDays(today(), 1), guests: 2, style: 'boutique' }, { when: ago(12) });
  message(tripC.id, priya.id, 'Hawa Mahal at golden hour was unreal 😍', ago(0, 20));
  message(tripC.id, meera.id, 'Tomorrow Amber Fort first thing? I’ll ask Yatri for a cab', ago(0, 19));
  for (let i = 0; i < 4; i++) insert('media_assets', { id: newId(), trip_id: tripC.id, uploaded_by: [priya, meera][i % 2].id, url: `https://picsum.photos/seed/tc-jaipur-${i + 1}/900/700`, caption: ['Hawa Mahal', 'Chai stop', 'Johari Bazaar', 'Blue pottery'][i], type: 'photo', day_number: 1, taken_at: ago(0, 22 - i), created_at: ago(0, 21 - i) });
  log('trip: Jaipur Heritage Weekend (ongoing)');

  // ---------- Trip D: early planning ----------
  const tripD = createTrip({ owner: rohan, name: 'Rishikesh Rafting Escape', destination: 'Rishikesh', start_date: addDays(today(), 41), end_date: addDays(today(), 43), budget: 18000 });
  addMember(tripD.id, kabir.id);
  addItemToDay(tripD.id, 2, { title: '16 km rafting from Shivpuri', type: 'activity', start_time: '09:00', place_name: 'Shivpuri River Rafting', lat: 30.1454, lng: 78.3869, cost: 3000 }, { userId: rohan.id });
  message(tripD.id, rohan.id, 'Kabir! Rafting season opens soon. Grade IV or bust 🌊', ago(3));

  // ---------- Public itineraries (community feed & marketplace) ----------
  const itins = [
    [aarav, 'Kumaon Lakes in 4 Days', 'Nainital', 4, 70, 0, 38, 96, ['Adventure', 'Trek', 'Weekend'], 'Lakes, ridgeline hikes and paragliding over Naukuchiatal — the loop I recommend to every first-timer in Kumaon.', 1, 0, 20000],
    [aarav, 'Spiti Road Trip: The Complete 7-Day Plan', 'Spiti', 7, 85, 499, 22, 140, ['Adventure', 'Offbeat', 'Trek'], 'Acclimatisation-first route with fuel stops, homestays that actually have hot water, and the Chandratal detour done right.', 0, 1, 45000],
    [priya, 'Solo Female Guide to Rishikesh', 'Rishikesh', 3, 45, 199, 29, 188, ['Solo Female', 'Spiritual', 'Budget'], 'Where to stay safely, which ashrams welcome solo women, rafting operators with women guides, and cafés to work from.', 1, 1, 12000],
    [priya, 'Pondicherry Café Trail', 'Pondicherry', 2, 25, 0, 14, 52, ['Foodie', 'Chill', 'Weekend'], 'Two lazy days of croissants, cycle rides through White Town and sunrise on the promenade.', 0, 0, 9000],
    [priya, 'Hampi Backpacker Circuit', 'Hampi', 3, 60, 0, 11, 37, ['Backpacking', 'Budget', 'Heritage'], 'Boulders, ruins and coracle rides on ₹1,500 a day. Includes the best sunrise spot.', 0, 0, 8000],
    [meera, 'Kerala Backwaters & Munnar Tea', 'Munnar', 5, 20, 299, 9, 61, ['Couple', 'Chill', 'Luxury'], 'A slow, honeymoon-friendly loop from tea estates to a private houseboat night in Alleppey.', 0, 0, 55000],
    [meera, 'Coorg Coffee Country', 'Coorg', 3, 35, 149, 6, 30, ['Family', 'Chill', 'Foodie'], 'Plantation stays, waterfalls and Kodava food — easy on kids and grandparents.', 0, 0, 22000],
    [ishaan, 'Jaipur Food & Forts (by a local)', 'Jaipur', 2, 40, 0, 16, 58, ['Foodie', 'Heritage', 'Couple'], 'Skip the tourist traps: where Jaipurites actually eat, and the right time for every fort.', 1, 0, 10000],
    [ananya, 'Varanasi Soul Walk', 'Varanasi', 3, 20, 0, 12, 41, ['Spiritual', 'Heritage', 'Foodie'], 'Ghats at dawn, silk weavers at noon, aarti at dusk — and the kachori gali in between.', 0, 0, 11000],
    [zoya, 'Meghalaya Monsoon Magic', 'Shillong', 5, 70, 0, 7, 33, ['Monsoon', 'Offbeat', 'Solo Female'], 'Living root bridges, crystal-clear Dawki and the wettest place on earth — plan for rain, love every minute.', 0, 0, 26000],
  ];
  const pubIds = [];
  for (const [creator, title, dest, days, vibe, price, forks, likes, tags, summary, featured, verified, budget] of itins) {
    const id = newId();
    pubIds.push({ id, creator, price, title });
    insert('public_itineraries', {
      id, source_trip_id: null, creator_id: creator.id, title, summary, destination: findDestination(dest).name, cover_theme: findDestination(dest).theme, days_count: days, budget_estimate: budget,
      tags: JSON.stringify(tags), content: JSON.stringify(plan(dest, days, { vibe })), price, verified_premium: verified, featured, status: 'published', fork_count: forks, like_count: likes,
      view_count: likes * rand(5, 9), sales_count: 0, rating_avg: 0, rating_count: 0, created_at: ago(rand(10, 80)), updated_at: ago(rand(1, 9)),
    });
  }
  pubIds.push({ id: pubB, creator: kabir, price: 0, title: 'Goa on a Budget' });

  // Sales, tips and reviews spread across the last 30 days
  const s = { marketplace: 20, tip: 5 };
  for (const it of pubIds) {
    const buyers = extra.slice(0, it.price ? rand(6, 16) : 0);
    for (const b of buyers) {
      const when = ago(rand(0, 29), rand(0, 23));
      const fee = Math.round((it.price * s.marketplace) / 100);
      const pay = insert('payments', { id: newId(), user_id: b.id, payee_user_id: it.creator.id, purpose: 'purchase', amount: it.price, method: 'upi', upi_app: 'gpay', upi_ref: String(rand(100000, 999999)) + String(rand(100000, 999999)), status: 'success', meta: JSON.stringify({ itinerary_id: it.id }), created_at: when });
      insert('itinerary_purchases', { id: newId(), itinerary_id: it.id, buyer_id: b.id, creator_id: it.creator.id, amount: it.price, platform_fee: fee, creator_earning: it.price - fee, kind: 'purchase', payment_id: pay.id, created_at: when });
      q.run('UPDATE public_itineraries SET sales_count = sales_count + 1 WHERE id = ?', it.id);
    }
    for (const b of extra.slice(20, 20 + rand(0, 4))) {
      const amount = pickOne([50, 100, 101, 251]);
      const when = ago(rand(0, 29));
      const pay = insert('payments', { id: newId(), user_id: b.id, payee_user_id: it.creator.id, purpose: 'tip', amount, method: 'upi', upi_app: 'phonepe', upi_ref: String(rand(100000, 999999)) + String(rand(100000, 999999)), status: 'success', meta: JSON.stringify({ itinerary_id: it.id }), created_at: when });
      insert('itinerary_purchases', { id: newId(), itinerary_id: it.id, buyer_id: b.id, creator_id: it.creator.id, amount, platform_fee: Math.round((amount * s.tip) / 100), creator_earning: amount - Math.round((amount * s.tip) / 100), kind: 'tip', payment_id: pay.id, created_at: when });
    }
    const reviewers = extra.slice(25, 25 + rand(2, 5));
    const texts = ['Followed this almost exactly — worked perfectly!', 'Great pacing, the food tips were spot on.', 'Saved us hours of planning. Thank you!', 'Loved it, though day 2 was a bit packed for us.', 'Super detailed and honest. Would buy again.', 'Perfect for our group, forked and personalised in minutes.'];
    for (const r of reviewers) {
      insert('forks', { id: newId(), itinerary_id: it.id, trip_id: null, user_id: r.id, created_at: ago(rand(3, 40)) });
      insert('reviews', { id: newId(), itinerary_id: it.id, user_id: r.id, rating: pickOne([5, 5, 4, 5, 4, 3]), text: pickOne(texts), status: 'visible', report_count: 0, created_at: ago(rand(1, 30)) });
    }
    const r = q.get(`SELECT AVG(rating) AS a, COUNT(*) AS n FROM reviews WHERE itinerary_id = ? AND status = 'visible'`, it.id);
    update('public_itineraries', it.id, { rating_avg: Math.round((r.a || 0) * 10) / 10, rating_count: r.n });
  }
  const flagged = pubIds[0];
  insert('reviews', { id: newId(), itinerary_id: flagged.id, user_id: extra[40].id, rating: 1, text: 'Visit my page for cheap tickets!!! best deals click link in bio', status: 'flagged', report_count: 3, created_at: ago(2) });
  for (const [u, it] of [[rohan, pubIds[0]], [priya, pubIds[0]], [meera, pubIds[2]], [aarav, pubIds[2]], [kabir, pubIds[7]], [zoya, pubIds[2]]]) {
    q.run('INSERT OR IGNORE INTO itinerary_likes (itinerary_id, user_id, created_at) VALUES (?, ?, ?)', it.id, u.id, ago(rand(1, 20)));
  }
  insert('payouts', { id: newId(), creator_id: aarav.id, amount: 1500, upi_id: aarav.upi_id, status: 'paid', note: '', created_at: ago(14), processed_at: ago(13) });
  insert('payments', { id: newId(), user_id: null, payee_user_id: aarav.id, purpose: 'payout', amount: 1500, method: 'upi', upi_app: 'other', upi_ref: String(rand(100000, 999999)) + String(rand(100000, 999999)), status: 'success', meta: JSON.stringify({ upi_id: aarav.upi_id }), created_at: ago(13) });
  insert('payouts', { id: newId(), creator_id: priya.id, amount: 2000, upi_id: priya.upi_id, status: 'requested', note: '', created_at: ago(1) });
  log(`${pubIds.length} community itineraries with sales & reviews`);

  // ---------- Background bookings for platform stats ----------
  const extraTrips = [];
  const dests = ['Goa', 'Manali', 'Jaipur', 'Rishikesh', 'Udaipur', 'Varanasi', 'Coorg', 'Darjeeling', 'Pondicherry', 'Leh'];
  for (let i = 0; i < 14; i++) {
    const owner = extra[i];
    const dest = dests[i % dests.length];
    const start = addDays(today(), rand(-25, 30));
    const t = createTrip({ owner, name: `${dest} ${pickOne(['Getaway', 'Escape', 'with friends', 'Long Weekend', 'Trip'])}`, destination: dest, start_date: start, end_date: addDays(start, rand(1, 4)), budget: rand(10, 60) * 1000 });
    const created = ago(rand(0, 29), rand(0, 23));
    update('trips', t.id, { created_at: created, updated_at: created });
    addMember(t.id, extra[i + 20].id);
    extraTrips.push({ t, owner, created });
  }
  for (const { t, owner, created } of extraTrips) {
    const cat = pickOne(['cab', 'cab', 'stay', 'food']);
    const params = cat === 'cab' ? { pickup: t.destination, drop: findDestination(t.destination).places[0].name, pickup_time: new Date(`${t.start_date}T10:00:00+05:30`).toISOString(), passengers: 2 } : cat === 'stay' ? { location: t.destination, guests: 2 } : { area: t.destination, party_size: 2 };
    const b = bookFromSearch(t, owner, cat, params, { when: created, pickIndex: rand(0, 2), status: t.start_date < today() ? 'completed' : 'confirmed' });
    if (b && Math.random() < 0.15) update('bookings', b.id, { status: 'cancelled', failure_reason: 'Plans changed' });
  }
  // One booking waiting on the human-in-the-loop queue
  const stuck = bookFromSearch(extraTrips[3].t, extraTrips[3].owner, 'cab', { pickup: extraTrips[3].t.destination, drop: findDestination(extraTrips[3].t.destination).places[1].name, pickup_time: new Date(Date.now() + 3 * DAY).toISOString(), passengers: 2 }, { when: ago(0, 3) });
  if (stuck) {
    update('bookings', stuck.id, { status: 'needs_attention', failure_reason: 'Driver partner could not verify the pickup address', confirmed_at: null });
    insert('agent_audit', { id: newId(), trip_id: stuck.trip_id, user_id: stuck.user_id, booking_id: stuck.id, action: 'failed', detail: JSON.stringify({ reason: 'Driver partner could not verify the pickup address' }), created_at: ago(0, 2.9) });
  }

  // ---------- Safety ----------
  insert('sos_alerts', { id: newId(), user_id: zoya.id, trip_id: null, lat: 25.2702, lng: 91.7323, message: 'Stuck near Sohra bus stand, phone at 8% and it’s getting dark', status: 'active', created_at: ago(0, 0.5) });
  insert('sos_alerts', { id: newId(), user_id: priya.id, trip_id: tripC.id, lat: 26.9239, lng: 75.8267, message: 'Being followed near the bazaar', status: 'resolved', resolution_note: 'Called traveller, safely back at hotel. Local police informed.', created_at: ago(12), resolved_at: ago(12, -1) });

  // ---------- Notifications & announcements ----------
  const n = (user, type, title, body, link, when, read = 0) => insert('notifications', { id: newId(), user_id: user.id, type, title, body, link, read, created_at: when });
  n(aarav, 'booking_confirmed', `Booked: ${cab.title}`, 'Kathgodam → Nainital · driver details inside', `/app/trips/${tripA.id}?tab=bookings`, ago(2));
  n(aarav, 'poll', 'New vote in Nainital & Bhimtal Getaway', 'Paragliding on Day 3?', `/app/trips/${tripA.id}`, ago(3));
  n(aarav, 'sale', '💰 New sale: “Spiti Road Trip”', 'You earned ₹399.', '/app/creator', ago(1));
  n(priya, 'settlement', 'Aarav requested ₹1,420', 'Settle up for Nainital & Bhimtal Getaway', `/app/trips/${tripA.id}?tab=budget`, ago(1));
  insert('announcements', { id: newId(), title: 'Monsoon advisory for the hills', body: 'Landslide-prone routes in Uttarakhand & Himachal may close without notice. Yatri now checks road status before proposing cabs.', level: 'warning', active: 1, created_at: ago(2) });

  // Sanity: make sure every demo phone is unique and valid
  if (!quiet) console.log(`[seed] done. Demo logins: ${U.map((u) => `${u.name.split(' ')[0]} ${u.phone}`).join(', ')}`);
  return { admin: config.admin.email };
}

// CLI: node server/seed.js --reset
if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  const reset = process.argv.includes('--reset');
  await seed({ reset, quiet: false });
  console.log(`\nAdmin login → ${config.admin.email} / ${config.admin.password}`);
  process.exit(0);
}
