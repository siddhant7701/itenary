// AI concierge orchestration: resolves trip context, lets Claude call booking tools, and
// records every proposal to the audit trail. Falls back to the offline engine when no API key
// is configured or the API is unavailable, so the concierge always answers.
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import { insert, newId, now, parseJson, q } from '../db.js';
import { HttpError } from '../lib/http.js';
import { planActive } from '../lib/auth.js';
import { emitTrip } from '../realtime.js';
import { getSettings } from '../services/settings.js';
import { loadDays, dayCount } from '../services/trips.js';
import { TOOL_DEFINITIONS, runTool } from './tools.js';
import { fallbackRespond } from './fallback.js';

const SYSTEM_PROMPT = `You are Yatri, the AI travel concierge inside Itenary — a collaborative trip-planning app for Indian travellers who plan together with partners, friends and family.

What you can do, through tools:
- Search sandbox partner inventory for cabs, food delivery, stays and bookable local experiences, then turn the best matches into booking proposals with propose_booking.
- Look up attractions with find_places and add planned stops to the shared itinerary with add_itinerary_item when the travellers ask you to plan, add or personalise days.

How bookings work (important):
- You never book or pay. A proposal appears in the trip chat as a card; a traveller must tap "Review & pay" and approve the UPI payment. Never say something is booked, confirmed or paid unless the trip context lists it as confirmed.
- Search before proposing. Propose one to three options that best fit the group's budget and Vibe Check; do not dump every result.
- If a detail that changes the price is missing (time, pickup point, party size, dates), make a sensible assumption from the trip context, state it in one short clause, and proceed.
- Stay within the trip's per-booking spending limit. If every option exceeds it, say so and mention that the trip owner can raise the limit in trip settings.

Style:
- Warm, brief and practical: two to five sentences or a short bulleted list. Plain text with **bold** and "•" bullets only — no headings or tables.
- Money in rupees with Indian digit grouping (₹1,250). Times in IST, 12-hour clock.
- Several travellers share this chat; user messages are prefixed with the sender's name. Address people by first name when helpful.
- If anyone mentions an emergency or feeling unsafe, tell them to press the red SOS button in the trip (shares live location with their emergency contact) and to call 112.
- Keep to travel planning for this trip; politely decline unrelated requests.`;

function todayIst() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function tripContext(trip, user) {
  const members = q.all(`SELECT u.name, m.role, m.vibe FROM trip_members m JOIN users u ON u.id = m.user_id WHERE m.trip_id = ?`, trip.id);
  const days = loadDays(trip.id);
  const bookings = q.all(`SELECT category, title, status, total, scheduled_at FROM bookings WHERE trip_id = ? AND status NOT IN ('cancelled') ORDER BY created_at DESC LIMIT 12`, trip.id);
  const booked = q.value(`SELECT COALESCE(SUM(total),0) FROM bookings WHERE trip_id = ? AND status IN ('requested','confirmed','completed','needs_attention')`, trip.id);
  const lines = [
    `Trip: "${trip.name}" to ${trip.destination || 'an unspecified destination'}, ${trip.start_date} → ${trip.end_date} (${dayCount(trip.start_date, trip.end_date)} days). Today (IST) is ${todayIst()}.`,
    `Travellers (${members.length}): ${members.map((m) => `${m.name}${m.role === 'owner' ? ' (owner)' : ''} vibe ${m.vibe}`).join(', ')}.`,
    `Group Vibe Check: ${trip.vibe_score}/100 (0 = chill, 100 = adventure).`,
    `Budget: ₹${trip.budget.toLocaleString('en-IN')} total. Booked so far: ₹${booked.toLocaleString('en-IN')}. Spending limits: ₹${trip.spend_limit_booking.toLocaleString('en-IN')} per booking, ₹${trip.spend_limit_trip.toLocaleString('en-IN')} per trip.`,
    `Message from: ${user.name}.`,
    'Itinerary:',
    ...days.map((d) => `Day ${d.day_number} (${d.date})${d.title ? ' — ' + d.title : ''}: ${d.items.length ? d.items.map((i) => `${i.start_time ? i.start_time + ' ' : ''}${i.title}`).join('; ') : 'empty'}`),
    'Bookings:',
    ...(bookings.length ? bookings.map((b) => `${b.category} "${b.title}" — ${b.status}, ₹${b.total}${b.scheduled_at ? ', ' + new Date(b.scheduled_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : ''}`) : ['none yet']),
  ];
  return `<trip_context>\n${lines.join('\n')}\n</trip_context>`;
}

function historyMessages(tripId, beforeId) {
  const rows = q
    .all(
      `SELECT c.*, u.name AS sender_name FROM chat_messages c LEFT JOIN users u ON u.id = c.sender_id
       WHERE c.trip_id = ? AND c.channel = 'concierge' AND c.id != ? ORDER BY c.created_at DESC LIMIT 16`,
      tripId, beforeId,
    )
    .reverse();
  const messages = [];
  for (const r of rows) {
    if (r.sender_type === 'user') messages.push({ role: 'user', content: `${r.sender_name || 'Traveller'}: ${r.content}` });
    else if (r.sender_type === 'agent') {
      const meta = parseJson(r.meta, {});
      const note = meta.proposals?.length ? `\n[I created ${meta.proposals.length} booking proposal(s) in that reply.]` : '';
      messages.push({ role: 'assistant', content: r.content + note });
    }
  }
  while (messages.length && messages[0].role !== 'user') messages.shift();
  return messages;
}

function apiKey() {
  return config.anthropicApiKey || getSettings().anthropic_api_key || '';
}

export function aiStatus() {
  const s = getSettings();
  return { enabled: s.ai_enabled, engine: s.ai_enabled && apiKey() ? 'claude' : 'built-in', model: s.ai_model };
}

async function runClaude({ trip, user, text, userMessageId, ctx }) {
  const settings = getSettings();
  const client = new Anthropic({ apiKey: apiKey(), timeout: 90_000, maxRetries: 2 });
  const messages = [...historyMessages(trip.id, userMessageId), { role: 'user', content: [{ type: 'text', text: tripContext(trip, user) }, { type: 'text', text: `${user.name}: ${text}` }] }];
  const supportsFallbacks = ['claude-opus-5', 'claude-fable-5-1'].includes(settings.ai_model);
  let finalText = '';

  for (let turn = 0; turn < 8; turn++) {
    const params = {
      model: settings.ai_model,
      max_tokens: 8000,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      tools: TOOL_DEFINITIONS,
      messages,
      output_config: { effort: settings.ai_effort || 'medium' },
    };
    const response = supportsFallbacks
      ? await client.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' })
      : await client.messages.create(params);

    if (response.stop_reason === 'refusal') {
      return "I can't help with that request. I'm happy to help with cabs, food, stays, experiences or planning your days.";
    }
    const texts = response.content.filter((b) => b.type === 'text').map((b) => b.text.trim()).filter(Boolean);
    if (texts.length) finalText = texts.join('\n\n');

    if (response.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: response.content });
      continue;
    }
    const toolUses = response.content.filter((b) => b.type === 'tool_use');
    if (response.stop_reason !== 'tool_use' || !toolUses.length) break;

    messages.push({ role: 'assistant', content: response.content });
    const results = toolUses.map((tu) => {
      try {
        const out = runTool(tu.name, tu.input, ctx);
        return { type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(out), ...(out?.error ? { is_error: true } : {}) };
      } catch (err) {
        return { type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify({ error: err.message }), is_error: true };
      }
    });
    messages.push({ role: 'user', content: results });
  }
  return finalText || (ctx.collected.proposals.length ? 'Here are some options — tap **Review & pay** on the one you like.' : 'Done.');
}

function checkQuota(user) {
  const settings = getSettings();
  if (planActive(user) || user.role === 'admin') return;
  const day = todayIst();
  const used = q.value('SELECT count FROM usage_counters WHERE user_id = ? AND day = ? AND kind = ?', user.id, day, 'concierge') || 0;
  if (used >= settings.free_concierge_daily) {
    throw new HttpError(429, `You've used all ${settings.free_concierge_daily} free concierge requests today. Upgrade to Itenary Plus for unlimited concierge.`, { code: 'quota' });
  }
  q.run(
    `INSERT INTO usage_counters (user_id, day, kind, count) VALUES (?, ?, 'concierge', 1)
     ON CONFLICT(user_id, day, kind) DO UPDATE SET count = count + 1`,
    user.id, day,
  );
}

export function saveMessage({ tripId, channel, senderId = null, senderType = 'user', content, meta = {} }) {
  const row = insert('chat_messages', { id: newId(), trip_id: tripId, channel, sender_id: senderId, sender_type: senderType, content, meta, created_at: now() });
  const msg = { ...row, meta };
  emitTrip(tripId, 'chat:message', { message: msg }, senderId);
  return msg;
}

export async function handleConciergeRequest({ trip, user, text }) {
  const settings = getSettings();
  checkQuota(user);
  const userMessage = saveMessage({ tripId: trip.id, channel: 'concierge', senderId: user.id, content: text });
  emitTrip(trip.id, 'agent:typing', { on: true });

  const ctx = { trip, user, collected: { proposals: [], items: [] } };
  let reply;
  let engine = 'built-in';
  try {
    if (settings.ai_enabled && apiKey()) {
      engine = 'claude';
      reply = await runClaude({ trip, user, text, userMessageId: userMessage.id, ctx });
    } else {
      reply = fallbackRespond(text, ctx);
    }
  } catch (err) {
    console.error('[concierge] Claude request failed, using built-in engine:', err?.status || '', err?.message);
    engine = 'built-in';
    if (!ctx.collected.proposals.length) reply = fallbackRespond(text, ctx);
    else reply = 'Here are the options I found — tap **Review & pay** on the one you like.';
  } finally {
    emitTrip(trip.id, 'agent:typing', { on: false });
  }

  const agentMessage = saveMessage({
    tripId: trip.id,
    channel: 'concierge',
    senderType: 'agent',
    content: reply,
    meta: { proposals: ctx.collected.proposals, items: ctx.collected.items, engine },
  });
  return { userMessage, agentMessage };
}
