// Food delivery connector v1 (sandbox). Replace with a Swiggy / Zomato partner API.
import crypto from 'node:crypto';
import { findDestination } from '../data/places.js';
import { DRIVER_NAMES, enabledProviders, pick, ref, roundTo, seededRandom, shouldFail } from './common.js';

export const version = 'food-sandbox-1.1';

const REGIONAL = {
  Uttarakhand: { cuisines: ['Kumaoni', 'Pahadi', 'North Indian', 'Cafe'], dishes: ['Bhatt ki Churkani', 'Aloo ke Gutke', 'Kumaoni Raita', 'Bal Mithai', 'Madua Roti'] },
  'Himachal Pradesh': { cuisines: ['Himachali', 'Tibetan', 'Cafe', 'North Indian'], dishes: ['Siddu', 'Thukpa', 'Momos', 'Chha Gosht', 'Trout Fry'] },
  Rajasthan: { cuisines: ['Rajasthani', 'Marwari Thali', 'North Indian', 'Rooftop Cafe'], dishes: ['Dal Baati Churma', 'Laal Maas', 'Gatte ki Sabzi', 'Ker Sangri', 'Pyaaz Kachori'] },
  Goa: { cuisines: ['Goan', 'Seafood', 'Konkani', 'Beach Shack'], dishes: ['Goan Fish Curry', 'Prawn Balchão', 'Chicken Xacuti', 'Bebinca', 'Poi Bread'] },
  Kerala: { cuisines: ['Kerala', 'Seafood', 'South Indian', 'Cafe'], dishes: ['Appam & Stew', 'Karimeen Pollichathu', 'Kerala Parotta', 'Avial', 'Payasam'] },
  Karnataka: { cuisines: ['South Indian', 'Coorgi', 'Udupi', 'Cafe'], dishes: ['Pandi Curry', 'Akki Roti', 'Neer Dosa', 'Bisi Bele Bath', 'Filter Coffee'] },
  'Uttar Pradesh': { cuisines: ['Awadhi', 'Banarasi Street Food', 'Mughlai', 'Chaat'], dishes: ['Kachori Sabzi', 'Tamatar Chaat', 'Galouti Kebab', 'Malaiyyo', 'Banarasi Paan'] },
  Ladakh: { cuisines: ['Ladakhi', 'Tibetan', 'Cafe'], dishes: ['Skyu', 'Thenthuk', 'Butter Tea', 'Apricot Cake', 'Momos'] },
  Delhi: { cuisines: ['Mughlai', 'Punjabi', 'Street Food', 'Cafe'], dishes: ['Butter Chicken', 'Chole Bhature', 'Nihari', 'Paranthe', 'Daulat ki Chaat'] },
  Maharashtra: { cuisines: ['Maharashtrian', 'Coastal', 'Street Food', 'Cafe'], dishes: ['Vada Pav', 'Misal Pav', 'Bombil Fry', 'Pav Bhaji', 'Solkadhi'] },
};
const GENERIC = { cuisines: ['North Indian', 'South Indian', 'Indo-Chinese', 'Cafe'], dishes: ['Paneer Tikka', 'Masala Dosa', 'Veg Biryani', 'Hakka Noodles', 'Gulab Jamun'] };
const NAME_PARTS = ['Rasoi', 'Dhaba', 'Kitchen', 'Bhojanalaya', 'Café', 'Tiffin House', 'Bistro', 'Thali House'];
const PREFIXES = ['Pahadi', 'Lakeside', 'Old Town', 'Mountain', 'Heritage', 'Chulha', 'Masala', 'Annapurna', 'Sunrise', 'Nani’s'];

export function search({ area, cuisine, meal = 'dinner', party_size = 2, budget_per_person, time }, { trip }) {
  const dest = findDestination(area) || findDestination(trip?.destination);
  const region = REGIONAL[dest?.state] || GENERIC;
  const pax = Math.max(1, Math.min(20, Number(party_size) || 2));
  const target = Number(budget_per_person) || null;
  const when = time ? new Date(time) : new Date(Date.now() + 45 * 60 * 1000);
  const scheduled_at = Number.isNaN(when.getTime()) ? new Date(Date.now() + 45 * 60 * 1000).toISOString() : when.toISOString();

  const options = [];
  for (const provider of enabledProviders('food')) {
    const rand = seededRandom(`${provider.id}:${dest?.name || area}:${meal}`);
    for (let i = 0; i < 3; i++) {
      const c = cuisine && rand() > 0.3 ? cuisine : pick(rand, region.cuisines);
      const name = `${pick(rand, PREFIXES)} ${pick(rand, NAME_PARTS)}`;
      const tier = 0.7 + rand() * 1.6;
      const perPerson = roundTo((target ? target * (0.8 + rand() * 0.35) : 220 * tier) * provider.price_factor);
      const dishes = [...region.dishes].sort(() => rand() - 0.5).slice(0, 3);
      options.push({
        category: 'food',
        provider_id: provider.id,
        provider_name: provider.name,
        title: `${name} · ${c}`,
        subtitle: `${dishes.join(', ')} for ${pax} · delivered in ~${30 + Math.round(rand() * 25)} min`,
        scheduled_at,
        amount: roundTo(perPerson * pax + 40),
        rating: Math.round((3.9 + rand() * 1) * 10) / 10,
        details: { restaurant: name, cuisine: c, dishes, party_size: pax, per_person: perPerson, meal, delivery_fee: 40, deliver_to: area || trip?.destination || '' },
      });
    }
  }
  options.sort((a, b) => b.rating - a.rating);
  return options.slice(0, 4);
}

export function execute(booking, provider) {
  if (shouldFail(provider)) return { ok: false, reason: pick(Math.random, ['Restaurant is not accepting orders right now', 'Delivery address is outside the serviceable area', 'Items went out of stock after payment']) };
  return {
    ok: true,
    providerRef: ref('ORD'),
    details: { rider_name: pick(Math.random, DRIVER_NAMES), eta_minutes: 25 + crypto.randomInt(0, 20) },
  };
}
