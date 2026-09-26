// Offline concierge engine used when no Anthropic API key is configured (or the API is
// unreachable). It understands the common intents — cabs, food, stays, events and day
// planning — and produces the same proposal cards as the Claude-powered agent.
import { findDestination } from '../data/places.js';
import { q } from '../db.js';
import { runTool } from './tools.js';
import { addDays, dayCount } from '../services/trips.js';

const rupee = (n) => '₹' + Math.round(n).toLocaleString('en-IN');

function todayIst() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function parseDate(text, trip) {
  const t = text.toLowerCase();
  const today = todayIst();
  const dayMatch = t.match(/\bday\s*(\d{1,2})\b/);
  if (dayMatch) return addDays(trip.start_date, Math.min(Number(dayMatch[1]), dayCount(trip.start_date, trip.end_date)) - 1);
  if (/\bday after tomorrow\b/.test(t)) return addDays(today, 2);
  if (/\btomorrow\b/.test(t)) return addDays(today, 1);
  if (/\b(today|tonight|now|asap)\b/.test(t)) return today;
  if (/\b(last day|check.?out)\b/.test(t)) return trip.end_date;
  return trip.start_date > today ? trip.start_date : today;
}

function parseTime(text, fallbackHour = 10) {
  const t = text.toLowerCase();
  const m = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/) || t.match(/\bat\s+(\d{1,2})(?::(\d{2}))\b/);
  if (m) {
    let h = Number(m[1]) % 12;
    if (m[3] === 'pm') h += 12;
    if (!m[3] && Number(m[1]) === 12) h = 12;
    if (!m[3] && Number(m[1]) > 12) h = Number(m[1]);
    return `${String(h).padStart(2, '0')}:${m[2] || '00'}`;
  }
  if (/\b(early morning|sunrise|dawn)\b/.test(t)) return '06:00';
  if (/\bmorning\b/.test(t)) return '09:00';
  if (/\b(noon|lunch)\b/.test(t)) return '13:00';
  if (/\bafternoon\b/.test(t)) return '15:00';
  if (/\b(evening|sunset)\b/.test(t)) return '18:00';
  if (/\b(night|dinner|tonight)\b/.test(t)) return '20:00';
  return `${String(fallbackHour).padStart(2, '0')}:00`;
}

function parsePeople(text, fallback) {
  const m = text.toLowerCase().match(/\b(\d{1,2})\s*(people|persons|pax|of us|adults|guests|travellers|travelers|friends)\b/);
  return m ? Number(m[1]) : fallback;
}

const STOP = '(?=\\s+(?:at|on|tomorrow|today|tonight|this|in the|by|for|around|early|morning|evening|afternoon|night|day)\\b|[,.!?]|$)';

function parseRoute(text, trip) {
  const from = text.match(new RegExp(`\\bfrom\\s+(.+?)\\s+to\\s+(.+?)${STOP}`, 'i'));
  if (from) return { pickup: from[1].trim(), drop: from[2].trim() };
  const to = text.match(new RegExp(`\\b(?:to|till|until|for)\\s+(?:the\\s+)?(.+?)${STOP}`, 'i'));
  const drop = to?.[1]?.trim();
  return { pickup: trip.destination, drop: drop && !/^(book|get|me|us)$/i.test(drop) ? drop : '' };
}

function proposeTop(result, ctx, count = 3) {
  const opts = result.options || [];
  const proposals = [];
  for (const o of opts.slice(0, count)) {
    if (o.price_inr > ctx.trip.spend_limit_booking) continue;
    const r = runTool('propose_booking', { option_id: o.option_id }, ctx);
    if (r.booking_id) proposals.push({ ...o, total: r.total_inr_including_fee });
  }
  return { proposals, skipped: opts.slice(0, count).filter((o) => o.price_inr > ctx.trip.spend_limit_booking).length, any: opts.length };
}

const REVIEW = 'Tap **Review & pay** on the one you like — nothing is charged until you approve the UPI payment.';

export function fallbackRespond(text, ctx) {
  const { trip } = ctx;
  const t = text.toLowerCase();
  const members = q.value('SELECT COUNT(*) FROM trip_members WHERE trip_id = ?', trip.id);
  const limitNote = (r) => (r.skipped ? `\n\n_${r.skipped} option${r.skipped > 1 ? 's were' : ' was'} hidden because ${r.skipped > 1 ? 'they exceed' : 'it exceeds'} your per-booking limit of ${rupee(trip.spend_limit_booking)}._` : '');

  if (/\b(sos|emergency|help me|unsafe|danger|police|accident)\b/.test(t)) {
    return 'If you are in danger, press the red **SOS** button at the top of your trip — it shares your live location with your emergency contact and alerts our safety team. You can also dial **112** (national emergency) right now.';
  }

  if (/\b(cab|taxi|ride|car|drive|pickup|pick me|pick us|airport|transfer)\b/.test(t)) {
    const route = parseRoute(text, trip);
    if (!route.drop) return `Where should the cab go? Try something like: _“Book a cab from ${trip.destination || 'the hotel'} to ${findDestination(trip.destination)?.places?.[0]?.name || 'the airport'} tomorrow at 9am”_.`;
    const date = parseDate(text, trip);
    const time = parseTime(text, 10);
    const r = proposeTop(runTool('search_cabs', { pickup: route.pickup, drop: route.drop, pickup_time: `${date}T${time}`, passengers: parsePeople(text, members) }, ctx), ctx, 3);
    if (!r.proposals.length) return r.any ? `All cab options for that route are above your per-booking limit of ${rupee(trip.spend_limit_booking)}. The trip owner can raise it in trip settings.` : 'No cab partners are available right now. Please try again shortly.';
    const when = new Date(`${date}T${time}:00+05:30`).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
    return `Here are ${r.proposals.length} cab options from **${route.pickup}** to **${route.drop}** for ${when}:\n${r.proposals.map((p) => `• ${p.title} — ${rupee(p.total)} (${p.provider})`).join('\n')}\n\n${REVIEW}${limitNote(r)}`;
  }

  if (/\b(hotel|stay|room|homestay|hostel|resort|accommodation|place to sleep|check.?in)\b/.test(t)) {
    const style = (t.match(/\b(hostel|homestay|boutique|resort)\b/) || [])[1];
    const budget = t.match(/(?:under|below|less than|max|budget)\s*(?:rs\.?|₹|inr)?\s*(\d[\d,]*)/);
    const r = proposeTop(runTool('search_stays', { location: trip.destination, check_in: trip.start_date, check_out: trip.end_date, guests: parsePeople(text, members), style, max_price_per_night: budget ? Number(budget[1].replace(/,/g, '')) : undefined }, ctx), ctx, 3);
    if (!r.proposals.length) return r.any ? `The stays I found are above your per-booking limit of ${rupee(trip.spend_limit_booking)}. Try a hostel or homestay, or ask the trip owner to raise the limit.` : 'I could not find stays matching that. Try a different style or budget.';
    return `I found ${r.proposals.length} stays in **${trip.destination}** for ${trip.start_date} → ${trip.end_date}:\n${r.proposals.map((p) => `• ${p.title} — ${rupee(p.total)} total (${p.summary.split(' · ')[0]})`).join('\n')}\n\n${REVIEW}${limitNote(r)}`;
  }

  if (/\b(food|eat|dinner|lunch|breakfast|order|hungry|restaurant|thali|meal|snack|biryani|momos)\b/.test(t)) {
    const meal = (t.match(/\b(breakfast|lunch|dinner|snacks?)\b/) || [])[1]?.replace(/s$/, '') || 'dinner';
    const date = parseDate(text, trip);
    const time = parseTime(text, meal === 'breakfast' ? 8 : meal === 'lunch' ? 13 : 20);
    const cuisine = (t.match(/\b(north indian|south indian|chinese|thali|momos|biryani|seafood|cafe|pahadi|kumaoni|rajasthani|goan|kerala)\b/) || [])[1];
    const r = proposeTop(runTool('search_food', { area: trip.destination, meal: meal === 'snack' ? 'snacks' : meal, cuisine, party_size: parsePeople(text, members), time: `${date}T${time}` }, ctx), ctx, 3);
    if (!r.proposals.length) return 'No food partners are delivering right now. Please try again in a bit.';
    return `Here's what I can get delivered for ${meal} (${parsePeople(text, members)} people):\n${r.proposals.map((p) => `• ${p.title} — ${rupee(p.total)} · ⭐ ${p.rating}`).join('\n')}\n\n${REVIEW}`;
  }

  if (/\b(event|festival|things to do|activity|activities|experience|show|concert|tour|rafting|kayak\w*|paraglid\w*|trek|safari|tickets?|class)\b/.test(t) && !/\b(plan|itinerary)\b/.test(t)) {
    const found = runTool('search_events', { city: trip.destination, from: trip.start_date, to: trip.end_date, quantity: parsePeople(text, members) }, ctx);
    // If the traveller named a specific event, propose just that one
    const named = (found.options || []).filter((o) => o.title.toLowerCase().split(/\W+/).filter((w) => w.length > 4).some((w) => t.includes(w)));
    const r = proposeTop(named.length ? { options: named } : found, ctx, named.length ? 1 : 3);
    if (!r.proposals.length) {
      const places = runTool('find_places', { query: '', near: trip.destination }, ctx).places.filter((p) => p.destination === findDestination(trip.destination)?.name).slice(0, 4);
      return `I couldn't find ticketed events in ${trip.destination || 'your destination'} during your dates. A few great things to do instead:\n${places.map((p) => `• ${p.name}`).join('\n') || '• Explore the old town on foot'}\n\nSay _“add these to my itinerary”_ and I'll slot them in.`;
    }
    return `Bookable experiences during your trip:\n${r.proposals.map((p) => `• ${p.title} — ${rupee(p.total)} · ${p.when_ist}`).join('\n')}\n\n${REVIEW}`;
  }

  if (/\b(plan|itinerary|suggest|recommend|ideas|what should we|what to do|personali[sz]e|fill|add these|add them)\b/.test(t)) {
    const dest = findDestination(trip.destination);
    if (!dest) return `Tell me more about ${trip.destination || 'your destination'} and what you enjoy, and I'll draft a plan. (I have detailed guides for 25+ Indian destinations like Goa, Manali, Jaipur, Rishikesh and Nainital.)`;
    const vibe = trip.vibe_score;
    const places = [...dest.places].filter((p) => p.kind !== 'transport').sort((a, b) => Math.abs(a.vibe - vibe) - Math.abs(b.vibe - vibe));
    const wantsAdd = /\b(add|fill|put|schedule|personali[sz]e|plan (it|them|our|my)|go ahead|yes)\b/.test(t);
    if (!wantsAdd) {
      return `Based on your Vibe Check (${vibe}/100 — ${vibe < 35 ? 'chill' : vibe > 65 ? 'adventurous' : 'balanced'}), my picks for **${dest.name}**:\n${places.slice(0, 5).map((p) => `• ${p.name}`).join('\n')}\n\nSay _“add these to my itinerary”_ and I'll spread them across your days.`;
    }
    const days = dayCount(trip.start_date, trip.end_date);
    const counts = q.all('SELECT d.day_number, COUNT(i.id) AS n FROM itinerary_days d LEFT JOIN itinerary_items i ON i.day_id = d.id WHERE d.trip_id = ? GROUP BY d.id ORDER BY d.day_number', trip.id);
    const slots = ['09:30', '14:00', '17:30'];
    let added = 0;
    let p = 0;
    for (let d = 1; d <= days && p < places.length; d++) {
      const existing = counts.find((c) => c.day_number === d)?.n || 0;
      for (let s = existing; s < Math.min(existing + 2, 3) && p < places.length; s++) {
        const place = places[p++];
        runTool('add_itinerary_item', { day_number: d, title: place.name, type: place.kind === 'food' ? 'food' : 'place', start_time: slots[s], place_name: place.name, description: `Suggested by Yatri to match your ${vibe < 35 ? 'chill' : vibe > 65 ? 'adventure' : 'balanced'} vibe` }, ctx);
        added++;
      }
    }
    const lines = [];
    lines.push(added ? `Done! I added **${added} stop${added > 1 ? 's' : ''}** to fill the lighter days, matched to your group's ${vibe < 35 ? 'chill' : vibe > 65 ? 'adventurous' : 'balanced'} vibe (${vibe}/100).` : `Your ${days} days already look well planned for your vibe (${vibe}/100).`);
    if (/personali[sz]e|forked|budget/.test(t)) {
      const planned = q.value('SELECT COALESCE(SUM(cost),0) FROM itinerary_items WHERE trip_id = ?', trip.id);
      if (trip.budget) {
        lines.push(planned > trip.budget ? `• Heads-up: listed costs add up to **${rupee(planned)}**, above your ${rupee(trip.budget)} budget — consider swapping a paid activity.` : `• Listed costs come to **${rupee(planned)}** of your ${rupee(trip.budget)} budget, leaving room for stays and cabs.`);
      }
      const ev = runTool('search_events', { city: trip.destination, from: trip.start_date, to: trip.end_date, quantity: members }, ctx).options || [];
      if (ev.length) lines.push(`• During your dates: ${ev.slice(0, 2).map((e) => `**${e.title}** (${e.when_ist})`).join(' and ')} — say _“book tickets for ${ev[0].title}”_ if you’re keen.`);
      lines.push(`• Want me to find a stay for ${trip.start_date} → ${trip.end_date} or a cab for Day 1? Just ask.`);
    } else {
      lines.push('Drag stops around the timeline, or ask me to book cabs between them.');
    }
    return lines.join('\n');
  }

  if (/\b(hi|hello|hey|namaste|help|what can you do)\b/.test(t) || t.length < 4) {
    return `Namaste! I'm **Yatri**, your trip concierge for ${trip.name}. I can:\n• Book cabs — _“cab from ${trip.destination || 'hotel'} to the airport tomorrow 7am”_\n• Order food — _“dinner for all of us tonight, something local”_\n• Find stays — _“homestay under ₹3000 a night”_\n• Find experiences — _“any activities during our trip?”_\n• Plan days — _“suggest places and add them to our itinerary”_\n\nEvery booking waits for your approval before any money moves.`;
  }

  return `I can help with cabs, food delivery, stays, local experiences and planning your days in ${trip.destination || 'your destination'}. Try _“book a cab to ${findDestination(trip.destination)?.places?.[0]?.name || 'the station'} at 9am”_ or _“plan our days”_.`;
}
