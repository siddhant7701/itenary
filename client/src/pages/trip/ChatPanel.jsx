import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { toast } from 'sonner';
import { Bot, Clock, Send, ShieldCheck, Sparkles } from 'lucide-react';
import { Avatar, Button, Segmented, Spinner } from '../../components/ui';
import { ProposalCard } from '../../components/BookingRow';
import { api } from '../../lib/api';
import { getSocket, useSocketEvent } from '../../lib/socket';
import { useConfig } from '../../lib/config';
import { useOnline } from '../../lib/hooks';
import { chatSegments, fmtDay } from '../../lib/format';
import dayjs from 'dayjs';

const OUTBOX_KEY = 'tc_outbox';
const readOutbox = () => {
  try {
    return JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]');
  } catch {
    return [];
  }
};
const writeOutbox = (v) => {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(v));
  } catch {
    // ignore
  }
};

function RichText({ text }) {
  const lines = chatSegments(text);
  return (
    <div className="prose-chat space-y-0.5 whitespace-pre-wrap break-words">
      {lines.map((parts, i) => (
        <div key={i} className={clsx(!parts.length && 'h-2')}>
          {parts.map((p, j) => (p.t === 'bold' ? <strong key={j}>{p.v}</strong> : p.t === 'em' ? <em key={j}>{p.v}</em> : <Fragment key={j}>{p.v}</Fragment>))}
        </div>
      ))}
    </div>
  );
}

function YatriAvatar({ size = 32 }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-plum-600 to-plum-900 text-marigold-300" style={{ width: size, height: size }}>
      <Sparkles style={{ width: size * 0.5, height: size * 0.5 }} />
    </span>
  );
}

function suggestionsFor(trip, days) {
  const dest = trip.destination || 'the city';
  const d1 = days[0];
  return [
    `Book a cab from the station to our hotel in ${dest} on day 1 at 11am`,
    'Suggest places for our vibe and add them to our itinerary',
    `Find a homestay in ${dest} under ₹3000 a night`,
    'Order dinner for all of us tonight, something local',
    'Any events or activities during our trip?',
    d1 ? `What should we do on Day ${d1.day_number}?` : 'Plan our days',
  ];
}

export default function ChatPanel({ ctx, channel: initialChannel = 'group', switchable = false, tall = false, fill = false, autoPrompt, onAutoPromptSent }) {
  const { tripId, data, user } = ctx;
  const config = useConfig();
  const online = useOnline();
  const [channel, setChannel] = useState(initialChannel);
  const [messages, setMessages] = useState(null);
  const [bookings, setBookings] = useState({});
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [agentTyping, setAgentTyping] = useState(false);
  const [typers, setTypers] = useState({});
  const [quota, setQuota] = useState(null);
  const scroller = useRef(null);
  const lastTyping = useRef(0);
  const autoSent = useRef(false);
  const isConcierge = channel === 'concierge';

  const stick = useRef(true); // keep pinned to the latest message unless the user scrolled up
  const scrollDown = useCallback((smooth = true) => {
    stick.current = true;
    const go = () => scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    requestAnimationFrame(go);
    setTimeout(go, 120);
  }, []);
  useEffect(() => {
    if (stick.current) scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages, bookings, agentTyping]);

  useEffect(() => {
    let alive = true;
    setMessages(null);
    api
      .get(`/trips/${tripId}/chat?channel=${channel}`)
      .then((r) => {
        if (!alive) return;
        const pending = readOutbox().filter((o) => o.tripId === tripId && o.channel === channel).map((o) => ({ id: o.client_id, client_id: o.client_id, sender_id: user.id, sender_type: 'user', sender_name: user.name, content: o.content, created_at: o.created_at, pending: true, meta: {} }));
        setMessages([...r.messages, ...pending]);
        setBookings(Object.fromEntries(r.bookings.map((b) => [b.id, b])));
        scrollDown(false);
      })
      .catch((e) => toast.error(e.message));
    return () => {
      alive = false;
    };
  }, [tripId, channel, user.id, user.name, scrollDown]);

  useSocketEvent('trip:event', (ev) => {
    if (ev.tripId !== tripId) return;
    if (ev.type === 'chat:message' && ev.data.message.channel === channel) {
      const m = ev.data.message;
      const member = data.members.find((x) => x.user_id === m.sender_id);
      const full = { ...m, sender_name: member?.name, sender_avatar: member?.avatar_url };
      setMessages((ms) => {
        if (!ms) return ms;
        if (ms.some((x) => x.id === m.id)) return ms;
        const cid = m.meta?.client_id;
        let withoutOptimistic = cid ? ms.filter((x) => x.client_id !== cid) : ms;
        if (!cid && m.sender_id === user.id) {
          const idx = withoutOptimistic.findIndex((x) => x.pending && x.content === m.content);
          if (idx >= 0) withoutOptimistic = withoutOptimistic.filter((_, i) => i !== idx);
        }
        return [...withoutOptimistic, full];
      });
      setTypers((t) => ({ ...t, [m.sender_id]: 0 }));
      scrollDown();
    }
    if (ev.type === 'booking') setBookings((b) => ({ ...b, [ev.data.booking.id]: ev.data.booking }));
    if (ev.type === 'agent:typing' && isConcierge) {
      setAgentTyping(ev.data.on);
      if (ev.data.on) scrollDown();
    }
  });

  useSocketEvent('typing', (t) => {
    if (t.tripId !== tripId || t.channel !== channel || t.user_id === user.id) return;
    setTypers((x) => ({ ...x, [t.user_id]: Date.now() }));
  });
  useEffect(() => {
    const i = setInterval(() => setTypers((t) => Object.fromEntries(Object.entries(t).filter(([, ts]) => ts > Date.now() - 4000))), 1500);
    return () => clearInterval(i);
  }, []);

  // Flush messages queued while offline
  useEffect(() => {
    if (!online) return;
    const box = readOutbox();
    const mine = box.filter((o) => o.tripId === tripId);
    if (!mine.length) return;
    writeOutbox(box.filter((o) => o.tripId !== tripId));
    (async () => {
      for (const o of mine) {
        try {
          if (o.channel === 'group') await api.post(`/trips/${tripId}/chat/messages`, { content: o.content, client_id: o.client_id });
          else await api.post(`/trips/${tripId}/agent/requests`, { message: o.content });
        } catch {
          writeOutbox([...readOutbox(), o]);
        }
      }
    })();
  }, [online, tripId]);

  const send = useCallback(
    async (content) => {
      const body = (content ?? text).trim();
      if (!body || sending) return;
      setText('');
      const client_id = 'c' + Math.random().toString(36).slice(2, 10);
      const optimistic = { id: client_id, client_id, sender_id: user.id, sender_type: 'user', sender_name: user.name, content: body, created_at: new Date().toISOString(), pending: true, meta: {} };
      setMessages((ms) => [...(ms || []), optimistic]);
      scrollDown();
      if (!navigator.onLine) {
        writeOutbox([...readOutbox(), { tripId, channel, content: body, client_id, created_at: optimistic.created_at }]);
        toast('Saved — it will send when you’re back online');
        return;
      }
      if (channel === 'group') {
        try {
          const { message } = await api.post(`/trips/${tripId}/chat/messages`, { content: body, client_id });
          setMessages((ms) => {
            const rest = ms.filter((x) => x.client_id !== client_id && x.id !== message.id);
            return [...rest, message];
          });
        } catch (err) {
          toast.error(err.message);
          setMessages((ms) => ms.map((x) => (x.client_id === client_id ? { ...x, pending: false, failed: true } : x)));
        }
      } else {
        setSending(true);
        setAgentTyping(true);
        try {
          const r = await api.post(`/trips/${tripId}/agent/requests`, { message: body });
          setBookings((b) => ({ ...b, ...Object.fromEntries(r.bookings.map((x) => [x.id, x])) }));
          setMessages((ms) => {
            const rest = ms.filter((x) => x.client_id !== client_id && x.id !== r.userMessage.id && x.id !== r.agentMessage.id);
            const merged = [...rest, { ...r.userMessage, sender_name: user.name }, r.agentMessage];
            return merged.sort((a, b) => a.created_at.localeCompare(b.created_at));
          });
          scrollDown();
        } catch (err) {
          setMessages((ms) => ms.filter((x) => x.client_id !== client_id));
          setText(body);
          if (err.status === 429 && err.data?.code === 'quota') setQuota(err.message);
          else toast.error(err.message);
        } finally {
          setSending(false);
          setAgentTyping(false);
        }
      }
    },
    [text, sending, channel, tripId, user.id, user.name, scrollDown],
  );

  useEffect(() => {
    if (autoPrompt && isConcierge && messages && !autoSent.current) {
      autoSent.current = true;
      send(autoPrompt);
      onAutoPromptSent?.();
    }
  }, [autoPrompt, isConcierge, messages, send, onAutoPromptSent]);

  const onInput = (v) => {
    setText(v);
    if (channel === 'group' && Date.now() - lastTyping.current > 2000) {
      lastTyping.current = Date.now();
      getSocket()?.emit('typing', { tripId, channel });
    }
  };

  const typingNames = Object.keys(typers).map((id) => data.members.find((m) => m.user_id === id)?.name.split(' ')[0]).filter(Boolean);
  let lastDay = null;

  return (
    <div className={clsx('card flex flex-col overflow-hidden p-0', fill ? 'h-full' : tall ? 'h-[calc(100dvh-15rem)] min-h-[520px]' : 'h-[560px]')}>
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        {switchable ? (
          <Segmented size="sm" value={channel} onChange={setChannel} options={[{ value: 'group', label: 'Group chat' }, { value: 'concierge', label: '✨ Yatri' }]} />
        ) : isConcierge ? (
          <div className="flex items-center gap-2.5">
            <YatriAvatar size={36} />
            <div>
              <div className="font-bold leading-tight">Yatri · AI concierge</div>
              <div className="text-[11.5px] text-muted">{config.ai?.engine === 'claude' ? 'Powered by Claude' : 'Built-in engine'} · shared with everyone on this trip</div>
            </div>
          </div>
        ) : (
          <div>
            <div className="font-bold leading-tight">Group chat</div>
            <div className="text-[11.5px] text-muted">{data.members.length} travellers · @mention to notify</div>
          </div>
        )}
      </div>

      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="scrollbar-thin flex-1 space-y-3 overflow-y-auto overflow-x-hidden bg-paper/50 px-3 py-4 sm:px-4"
      >
        {!messages ? (
          <div className="grid h-full place-items-center"><Spinner /></div>
        ) : messages.length === 0 ? (
          <div className="mx-auto max-w-sm py-10 text-center">
            {isConcierge ? <YatriAvatar size={56} /> : <div className="text-4xl">💬</div>}
            <div className="mt-3 font-bold">{isConcierge ? 'Namaste! I’m Yatri.' : 'Say hi to your crew'}</div>
            <p className="mt-1 text-sm text-muted">{isConcierge ? 'I can book cabs, order food, find stays and plan your days. Everyone on the trip sees what I propose, and nothing is paid until one of you approves it.' : 'Messages here stay next to your plan — no more scrolling WhatsApp for the hotel name.'}</p>
          </div>
        ) : (
          messages.map((m) => {
            const day = fmtDay(m.created_at);
            const showDay = day !== lastDay;
            lastDay = day;
            const mine = m.sender_id === user.id && m.sender_type === 'user';
            const proposals = (m.meta?.proposals || []).map((id) => bookings[id]).filter(Boolean);
            return (
              <Fragment key={m.id}>
                {showDay && <div className="py-1 text-center text-[11px] font-semibold uppercase tracking-wider text-muted">{dayjs(m.created_at).isSame(dayjs(), 'day') ? 'Today' : day}</div>}
                {m.sender_type === 'system' ? (
                  <div className="text-center"><span className="inline-block rounded-full bg-sand px-3 py-1 text-[12px] font-medium text-ink/70">{m.content}</span></div>
                ) : m.sender_type === 'agent' ? (
                  <div className="flex max-w-[92%] gap-2.5 animate-fade-up">
                    <YatriAvatar />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="rounded-2xl rounded-tl-md bg-white px-3.5 py-2.5 text-[14px] leading-relaxed shadow-soft ring-1 ring-plum-100">
                        <RichText text={m.content} />
                      </div>
                      {proposals.length > 0 && <div className="grid grid-cols-1 gap-2 [&>*]:min-w-0">{proposals.map((b) => <ProposalCard key={b.id} booking={b} tripLimit={data.trip.spend_limit_booking} onChanged={() => api.get(`/bookings/${b.id}`).then((r) => setBookings((x) => ({ ...x, [b.id]: r.booking }))).catch(() => {})} />)}</div>}
                      {m.meta?.items?.length > 0 && <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11.5px] font-semibold text-emerald-700">✓ Added {m.meta.items.length} stop{m.meta.items.length > 1 ? 's' : ''} to the plan</div>}
                      <div className="text-[10.5px] text-muted">{dayjs(m.created_at).format('h:mm A')}</div>
                    </div>
                  </div>
                ) : (
                  <div className={clsx('flex gap-2', mine ? 'justify-end' : 'justify-start')}>
                    {!mine && <Avatar user={{ id: m.sender_id, name: m.sender_name, avatar_url: m.sender_avatar }} size={30} />}
                    <div className={clsx('max-w-[78%]', mine && 'items-end')}>
                      {!mine && <div className="mb-0.5 ml-1 text-[11.5px] font-semibold text-muted">{m.sender_name?.split(' ')[0]}</div>}
                      <div className={clsx('rounded-2xl px-3.5 py-2 text-[14px] leading-relaxed', mine ? 'rounded-br-md bg-plum-700 text-white' : 'rounded-tl-md bg-white shadow-soft', m.failed && 'bg-rose-100 text-rose-900')}>
                        <RichText text={m.content} />
                      </div>
                      <div className={clsx('mt-0.5 flex items-center gap-1 text-[10.5px] text-muted', mine ? 'justify-end mr-1' : 'ml-1')}>
                        {m.pending && <Clock className="size-3" />}
                        {m.failed ? 'Not sent' : dayjs(m.created_at).format('h:mm A')}
                      </div>
                    </div>
                  </div>
                )}
              </Fragment>
            );
          })
        )}
        {isConcierge && agentTyping && (
          <div className="flex items-center gap-2.5">
            <YatriAvatar />
            <div className="flex items-center gap-2 rounded-2xl bg-white px-3.5 py-2.5 text-[13px] text-muted shadow-soft">
              <span className="flex gap-1">{[0, 1, 2].map((i) => <span key={i} className="size-1.5 animate-bounce rounded-full bg-plum-400" style={{ animationDelay: `${i * 0.15}s` }} />)}</span>
              Yatri is checking options…
            </div>
          </div>
        )}
        {!isConcierge && typingNames.length > 0 && <div className="ml-10 text-[12px] italic text-muted">{typingNames.join(', ')} {typingNames.length > 1 ? 'are' : 'is'} typing…</div>}
      </div>

      {quota && (
        <div className="flex items-center justify-between gap-3 border-t border-marigold-100 bg-marigold-50 px-4 py-2.5 text-[13px] text-marigold-900">
          <span>{quota}</span>
          <Button size="xs" variant="accent" to="/app/profile#plus">Get Plus</Button>
        </div>
      )}

      {isConcierge && messages && messages.length < 4 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto border-t border-line bg-white px-3 py-2.5">
          {suggestionsFor(data.trip, data.days).map((s) => (
            <button key={s} onClick={() => send(s)} disabled={sending} className="chip shrink-0 text-xs">{s}</button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex items-end gap-2 border-t border-line bg-white p-3"
      >
        <textarea
          value={text}
          onChange={(e) => onInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          maxLength={isConcierge ? 1500 : 2000}
          placeholder={isConcierge ? 'Ask Yatri: “cab to Bhimtal tomorrow 9am for 3”' : 'Message your crew…'}
          className="input max-h-32 min-h-11 flex-1 resize-none py-2.5"
        />
        <Button type="submit" size="icon" icon={isConcierge ? Bot : Send} loading={sending} disabled={!text.trim()} aria-label="Send" />
      </form>
      {isConcierge && (
        <div className="flex items-center justify-center gap-1.5 bg-white pb-2 text-[10.5px] text-muted">
          <ShieldCheck className="size-3" /> Yatri only proposes — you review & approve every payment. Limit {'₹' + data.trip.spend_limit_booking.toLocaleString('en-IN')}/booking.
        </div>
      )}
    </div>
  );
}
