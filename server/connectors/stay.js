// Stays connector v1 (sandbox). Replace with a hotel/OTA partner API or channel manager.
import crypto from 'node:crypto';
import { findDestination } from '../data/places.js';
import { enabledProviders, pick, ref, roundTo, seededRandom, shouldFail } from './common.js';

export const version = 'stay-sandbox-1.0';

const TIERS = [
  { key: 'hostel', label: 'Hostel dorm', base: 750, perGuest: true, amenities: ['Wi-Fi', 'Common kitchen', 'Lockers', 'Community events'] },
  { key: 'homestay', label: 'Homestay', base: 2200, amenities: ['Home-cooked breakfast', 'Hosted by locals', 'Wi-Fi', 'Bonfire'] },
  { key: 'boutique', label: 'Boutique stay', base: 4600, amenities: ['Breakfast', 'Room service', 'Mountain/lake view', 'Wi-Fi'] },
  { key: 'resort', label: 'Resort', base: 8900, amenities: ['Pool / spa', 'All meals option', 'Airport transfer', 'Activities desk'] },
];

const NAMES = {
  mountains: ['Pine Crest Cottages', 'Deodar Homestay', 'Cloud Nine Retreat', 'Backpacker Nest', 'Lakeview Villa'],
  snow: ['Snowline Chalets', 'Apple Orchard Homestay', 'The Himalayan Lodge', 'Nomad Hostel', 'Riverside Cabins'],
  beach: ['Palm Grove Villas', 'Salt & Sand Hostel', 'Casa Azul Homestay', 'Coconut Shore Resort', 'Tide House'],
  heritage: ['Haveli Rang Mahal', 'Pink Pearl Heritage', 'Courtyard Homestay', 'Royal Orchid Palace Stay', 'Old City Hostel'],
  desert: ['Dune Tents Camp', 'Golden Sands Haveli', 'Nomad Camp', 'Sunset Desert Resort', 'Fort View Homestay'],
  spiritual: ['Ganga View Ashram Stay', 'Riverside Hostel', 'Yoga Garden Homestay', 'Sacred Banks Retreat', 'Ghat House'],
  forest: ['Misty Estate Bungalow', 'Coffee Trails Homestay', 'Rainforest Cabins', 'Jungle Nest Hostel', 'Plantation Villa'],
  backwaters: ['Lagoon Houseboat', 'Paddy Field Homestay', 'Backwater Retreat', 'Canal Side Cottages', 'Coir Village Stay'],
  city: ['The Urban Loft', 'Metro Backpackers', 'Heritage Bungalow Stay', 'Skyline Suites', 'Garden Homestay'],
};

function nightsBetween(a, b) {
  const n = Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function search({ location, check_in, check_out, guests = 2, max_price_per_night, style }, { trip }) {
  const dest = findDestination(location) || findDestination(trip?.destination);
  const theme = dest?.theme || 'mountains';
  const inDate = check_in || trip?.start_date || new Date().toISOString().slice(0, 10);
  const outDate = check_out || trip?.end_date || inDate;
  const nights = nightsBetween(inDate, outDate);
  const pax = Math.max(1, Math.min(20, Number(guests) || 2));
  const rooms = Math.ceil(pax / 2);
  const cap = Number(max_price_per_night) || null;

  const options = [];
  for (const provider of enabledProviders('stay')) {
    const rand = seededRandom(`${provider.id}:${dest?.name || location}`);
    for (const tier of TIERS) {
      if (style && !String(style).toLowerCase().includes(tier.key) && rand() > 0.6) continue;
      const perNight = roundTo(tier.base * provider.price_factor * (0.85 + rand() * 0.4), 50);
      const units = tier.perGuest ? pax : rooms;
      if (cap && perNight > cap * 1.1) continue;
      const name = `${pick(rand, NAMES[theme] || NAMES.mountains)}${dest ? ', ' + dest.name : ''}`;
      options.push({
        category: 'stay',
        provider_id: provider.id,
        provider_name: provider.name,
        title: `${name}`,
        subtitle: `${tier.label} · ${units} ${tier.perGuest ? 'bed' : 'room'}${units > 1 ? 's' : ''} × ${nights} night${nights > 1 ? 's' : ''} · ₹${perNight.toLocaleString('en-IN')}/${tier.perGuest ? 'bed' : 'room'}/night`,
        scheduled_at: new Date(`${inDate}T14:00:00+05:30`).toISOString(),
        amount: perNight * units * nights,
        rating: Math.round((4 + rand() * 0.9) * 10) / 10,
        details: { property: name, tier: tier.label, check_in: inDate, check_out: outDate, nights, guests: pax, units, per_night: perNight, amenities: tier.amenities, location: dest?.name || location || '' },
      });
    }
  }
  options.sort((a, b) => a.amount - b.amount);
  return options.slice(0, 4);
}

export function execute(booking, provider) {
  if (shouldFail(provider)) return { ok: false, reason: pick(Math.random, ['Property sold out for the selected dates', 'Channel manager rejected the rate after payment', 'Room inventory mismatch at the property']) };
  return { ok: true, providerRef: ref('STAY'), details: { confirmation_code: `TC${crypto.randomInt(100000, 999999)}`, check_in_time: '2:00 PM', check_out_time: '11:00 AM' } };
}
