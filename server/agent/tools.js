// Tools exposed to the AI concierge. Search tools return options; propose_booking turns an
// option into a proposal card. Nothing here can move money — payment only happens when a
// traveller taps "Review & pay" and authorises UPI (see services/bookings.js#confirm).
import { connectorFor, recall, remember } from '../connectors/index.js';
import { searchPlaces, geocode } from '../data/places.js';
import { q } from '../db.js';
import { emitTrip } from '../realtime.js';
import { propose } from '../services/bookings.js';
import { addItemToDay, dayCount } from '../services/trips.js';

const TIME_HINT = 'Local time in India (IST) as YYYY-MM-DDTHH:mm, e.g. 2026-10-03T09:00';

export const TOOL_DEFINITIONS = [
  {
    name: 'search_cabs',
    description: 'Search sandbox cab partners for a ride. Returns priced options (each has an option_id) across vehicle classes. Use trip context for sensible defaults such as pickup at the trip destination and passengers = number of travellers.',
    input_schema: {
      type: 'object',
      properties: {
        pickup: { type: 'string', description: 'Pickup place name, e.g. "Nainital" or "Naini Lake Boating"' },
        drop: { type: 'string', description: 'Drop place name, e.g. "Bhimtal"' },
        pickup_time: { type: 'string', description: TIME_HINT },
        passengers: { type: 'integer', minimum: 1, maximum: 12 },
      },
      required: ['drop'],
    },
  },
  {
    name: 'search_food',
    description: 'Search food delivery partners near the trip destination. Returns restaurant bundles priced for the whole party (each has an option_id).',
    input_schema: {
      type: 'object',
      properties: {
        area: { type: 'string', description: 'Delivery area / town' },
        cuisine: { type: 'string' },
        meal: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snacks'] },
        party_size: { type: 'integer', minimum: 1, maximum: 20 },
        budget_per_person: { type: 'integer', description: 'Budget per person in INR' },
        time: { type: 'string', description: TIME_HINT },
      },
    },
  },
  {
    name: 'search_stays',
    description: 'Search stays (hostels, homestays, boutique hotels, resorts). Returns priced options for the full stay (each has an option_id).',
    input_schema: {
      type: 'object',
      properties: {
        location: { type: 'string' },
        check_in: { type: 'string', description: 'YYYY-MM-DD' },
        check_out: { type: 'string', description: 'YYYY-MM-DD' },
        guests: { type: 'integer', minimum: 1, maximum: 20 },
        max_price_per_night: { type: 'integer', description: 'INR per room per night' },
        style: { type: 'string', description: 'hostel | homestay | boutique | resort' },
      },
    },
  },
  {
    name: 'search_events',
    description: 'Search bookable local events and experiences (festivals, tours, adventure activities) in a city between two dates. Each result has an option_id.',
    input_schema: {
      type: 'object',
      properties: {
        city: { type: 'string' },
        from: { type: 'string', description: 'YYYY-MM-DD' },
        to: { type: 'string', description: 'YYYY-MM-DD' },
        category: { type: 'string', enum: ['festival', 'activity', 'food', 'culture', 'adventure', 'music'] },
        quantity: { type: 'integer', minimum: 1, maximum: 10, description: 'Number of tickets' },
      },
    },
  },
  {
    name: 'find_places',
    description: 'Look up attractions and places (with coordinates) at a destination, to plan days or resolve place names.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Place or destination name; empty returns top places near `near`' }, near: { type: 'string' } },
    },
  },
  {
    name: 'propose_booking',
    description: 'Create a booking proposal card from a search option_id. The traveller must review and approve the UPI payment in the app; this tool never charges money and does not confirm the booking.',
    input_schema: { type: 'object', properties: { option_id: { type: 'string' } }, required: ['option_id'] },
  },
  {
    name: 'add_itinerary_item',
    description: 'Add a planned activity to a specific day of the shared trip itinerary. Use when the travellers ask you to plan, add or schedule something.',
    input_schema: {
      type: 'object',
      properties: {
        day_number: { type: 'integer', minimum: 1 },
        title: { type: 'string' },
        type: { type: 'string', enum: ['place', 'activity', 'food', 'stay', 'transport', 'note'] },
        start_time: { type: 'string', description: 'HH:mm, 24-hour' },
        place_name: { type: 'string' },
        description: { type: 'string' },
        cost: { type: 'integer', description: 'Estimated cost in INR for the group' },
      },
      required: ['day_number', 'title'],
    },
  },
];

/** Interpret a model-provided local time as IST. */
export function istToIso(value) {
  if (!value) return undefined;
  const s = String(value).trim();
  const withZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(s) ? s : `${s.length === 10 ? s + 'T10:00' : s}+05:30`;
  const d = new Date(withZone);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

function summarizeOptions(options) {
  return options.map((o) => ({
    option_id: o.option_id,
    provider: o.provider_name,
    title: o.title,
    summary: o.subtitle,
    price_inr: o.amount,
    rating: o.rating,
    when_ist: o.scheduled_at ? new Date(o.scheduled_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) : null,
  }));
}

/**
 * Execute one tool call. `ctx` = { trip, user, collected: { proposals: [], items: [] } }.
 * Returns a JSON-serialisable result for the model.
 */
export function runTool(name, input = {}, ctx) {
  const { trip, user } = ctx;
  const members = q.value('SELECT COUNT(*) FROM trip_members WHERE trip_id = ?', trip.id);
  const search = (category, params) => {
    const options = connectorFor(category).search(params, { trip }).map((o) => remember(o, trip.id));
    if (!options.length) return { options: [], note: 'No options available from enabled partners for these parameters.' };
    return { options: summarizeOptions(options) };
  };

  switch (name) {
    case 'search_cabs':
      return search('cab', { pickup: input.pickup || trip.destination, drop: input.drop, pickup_time: istToIso(input.pickup_time), passengers: input.passengers || members });
    case 'search_food':
      return search('food', { ...input, party_size: input.party_size || members, time: istToIso(input.time) });
    case 'search_stays':
      return search('stay', { ...input, guests: input.guests || members });
    case 'search_events':
      return search('experience', { ...input, quantity: input.quantity || members });
    case 'find_places':
      return { places: searchPlaces(input.query || '', { near: input.near || trip.destination, limit: 8 }) };
    case 'propose_booking': {
      const option = recall(input.option_id, trip.id);
      if (!option) return { error: 'Unknown or expired option_id. Search again to get fresh options.' };
      if (ctx.collected.proposals.length >= 4) return { error: 'Proposal limit for this reply reached; let the travellers choose first.' };
      const booking = propose({ tripId: trip.id, userId: user.id, option, source: 'agent' });
      ctx.collected.proposals.push(booking.id);
      return {
        booking_id: booking.id,
        status: 'proposed',
        total_inr_including_fee: booking.total,
        within_per_booking_limit: booking.total <= trip.spend_limit_booking,
        note: 'Shown to travellers as a card with a "Review & pay" button. It is NOT booked until they approve the UPI payment.',
      };
    }
    case 'add_itinerary_item': {
      const days = dayCount(trip.start_date, trip.end_date);
      const dayNumber = Math.min(days, Math.max(1, Number(input.day_number) || 1));
      const coords = input.place_name ? geocode(input.place_name, trip.destination) : null;
      const item = addItemToDay(
        trip.id,
        dayNumber,
        {
          title: String(input.title).slice(0, 140),
          type: input.type || 'activity',
          start_time: /^\d{2}:\d{2}$/.test(input.start_time || '') ? input.start_time : null,
          place_name: input.place_name || coords?.name || null,
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
          description: String(input.description || '').slice(0, 500),
          cost: Math.max(0, Math.round(Number(input.cost) || 0)),
        },
        { userId: user.id, agent: true },
      );
      if (!item) return { error: 'Could not add item' };
      emitTrip(trip.id, 'item:upsert', { item }, 'agent');
      ctx.collected.items.push(item.id);
      return { added: true, item_id: item.id, day_number: dayNumber };
    }
    default:
      return { error: `Unknown tool ${name}` };
  }
}
