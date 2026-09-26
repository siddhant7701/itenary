import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import { CalendarDays, Clock, ExternalLink, Luggage, MapPin, Minus, Plus, Search, Share2, Ticket, Users, X } from 'lucide-react';
import CoverArt from '../../components/CoverArt';
import UpiPaySheet from '../../components/UpiPaySheet';
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, Modal, PageHeader, Progress, Select, Skeleton, cx } from '../../components/ui';
import { api } from '../../lib/api';
import { useConfig } from '../../lib/config';
import { useDebounced, useFetch } from '../../lib/hooks';
import { fmtRange, inr } from '../../lib/format';
import { EVENT_CATEGORY, plural, useStableCallback } from './constants';

const RANGES = [
  { id: 'any', label: 'Any time' },
  { id: 'week', label: 'Next 7 days' },
  { id: 'weekend', label: 'This weekend' },
  { id: 'month', label: 'Next 30 days' },
  { id: 'custom', label: 'Pick dates' },
];

const ymd = (d) => dayjs(d).format('YYYY-MM-DD');

function rangeDates(range, customFrom, customTo) {
  const today = dayjs().startOf('day');
  if (range === 'week') return { from: ymd(today), to: ymd(today.add(6, 'day')) };
  if (range === 'month') return { from: ymd(today), to: ymd(today.add(29, 'day')) };
  if (range === 'weekend') {
    const dow = today.day(); // 0 = Sunday
    const sat = dow === 0 ? today.subtract(1, 'day') : today.add(6 - dow, 'day');
    return { from: ymd(dow === 0 ? today : sat), to: ymd(sat.add(1, 'day')) };
  }
  if (range === 'custom') return { from: customFrom || '', to: customTo || '' };
  return { from: '', to: '' };
}

const spotsLeft = (e) => Math.max(0, (e.capacity || 0) - (e.booked_count || 0));
const isPast = (e) => dayjs(e.end_at || e.start_at).isBefore(dayjs());

/** An upcoming trip in the event's city whose dates cover the event day. */
function matchTrip(trips, e) {
  if (!trips?.length || !e) return null;
  const day = ymd(e.start_at);
  const city = (e.city || '').toLowerCase();
  return (
    trips.find((t) => {
      const dest = (t.destination || '').toLowerCase();
      const sameCity = dest && city && (dest.includes(city) || city.includes(dest));
      return sameCity && t.start_date <= day && t.end_date >= day;
    }) || null
  );
}

function timeLabel(e) {
  const s = dayjs(e.start_at);
  const end = e.end_at ? dayjs(e.end_at) : null;
  if (!end) return s.format('h:mm A');
  if (end.isSame(s, 'day')) return `${s.format('h:mm A')} – ${end.format('h:mm A')}`;
  return `${s.format('D MMM, h:mm A')} – ${end.format('D MMM, h:mm A')}`;
}

export default function Events() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [city, setCity] = useState(() => params.get('city') || '');
  const [category, setCategory] = useState(() => (EVENT_CATEGORY[params.get('category')] ? params.get('category') : ''));
  const [range, setRange] = useState('any');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [text, setText] = useState('');
  const q = useDebounced(text.trim(), 350);

  const { from, to } = rangeDates(range, customFrom, customTo);
  const sp = new URLSearchParams();
  if (city) sp.set('city', city);
  if (category) sp.set('category', category);
  if (from) sp.set('from', from);
  if (to) sp.set('to', to);
  if (q) sp.set('q', q);
  const { data, loading, error, reload } = useFetch(`/events${sp.toString() ? `?${sp}` : ''}`);
  const { data: tripData } = useFetch('/trips');

  const today = ymd(new Date());
  const trips = useMemo(() => (tripData?.trips || []).filter((t) => t.end_date >= today).sort((a, b) => a.start_date.localeCompare(b.start_date)), [tripData, today]);

  // Detail modal, deep-linkable via ?event=<id>
  const eventParam = params.get('event');
  const [selected, setSelected] = useState(null);
  useEffect(() => {
    if (!eventParam) return;
    if (selected?.id === eventParam) return;
    const found = data?.events?.find((e) => e.id === eventParam);
    if (found) {
      setSelected(found);
      return;
    }
    if (!data) return; // wait for the list first — saves a request in the common case
    let cancelled = false;
    api
      .get(`/events/${eventParam}`)
      .then((r) => !cancelled && setSelected(r.event))
      .catch((err) => {
        if (cancelled) return;
        toast.error(err.status === 404 ? 'That event is no longer available' : err.message);
        setEventParam(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventParam, data]);

  function setEventParam(id) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set('event', id);
        else next.delete('event');
        return next;
      },
      { replace: true },
    );
  }

  const openEvent = (e) => {
    setSelected(e);
    setEventParam(e.id);
  };
  const closeEvent = useStableCallback(() => {
    setSelected(null);
    setEventParam(null);
  });

  // Checkout
  const [pay, setPay] = useState(null); // {booking, event, trip, qty}
  const paidRef = useRef(false);

  function onProposed(p) {
    paidRef.current = false;
    setSelected(null);
    setEventParam(null);
    setPay(p);
  }

  function closePay() {
    if (!paidRef.current && pay?.booking?.id) {
      // Dismissed before paying — drop the unpaid proposal so it doesn't linger in Bookings.
      api.post(`/bookings/${pay.booking.id}/cancel`, { reason: 'Checkout closed before payment' }).catch(() => {});
    }
    setPay(null);
  }

  const events = data?.events || [];
  const cities = data?.cities || [];
  const categories = data?.categories || Object.keys(EVENT_CATEGORY);
  const hasFilters = !!(city || category || range !== 'any' || q);

  const groups = useMemo(() => {
    const out = [];
    for (const e of events) {
      const key = dayjs(e.start_at).format('MMMM YYYY');
      const g = out.find((x) => x.key === key);
      if (g) g.items.push(e);
      else out.push({ key, items: [e] });
    }
    return out;
  }, [events]);

  const clearAll = () => {
    setCity('');
    setCategory('');
    setRange('any');
    setCustomFrom('');
    setCustomTo('');
    setText('');
  };

  return (
    <div className="animate-fade-up">
      <PageHeader
        eyebrow="Local experiences"
        title="Events & experiences"
        subtitle="Festivals, food trails and adventures where you’re headed — book with UPI and add them to your trip."
        actions={
          <Button variant="secondary" icon={Ticket} to="/app/bookings">
            My bookings
          </Button>
        }
      />

      {/* Filters */}
      <Card padded={false} className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Search aarti, kayaking, food walks…" className="input h-11 pl-10 pr-9" aria-label="Search events" />
            {text && (
              <button onClick={() => setText('')} className="absolute right-2.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-sand hover:text-ink" aria-label="Clear search">
                <X className="size-3.5" />
              </button>
            )}
          </div>
          <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0 lg:shrink-0">
            {RANGES.map((r) => (
              <button key={r.id} type="button" onClick={() => setRange(r.id)} className={cx('chip shrink-0', range === r.id && 'chip-active')}>
                {r.id === 'custom' && <CalendarDays className="size-3.5" />}
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {range === 'custom' && (
          <div className="grid max-w-md grid-cols-2 gap-3 animate-fade-up">
            <Field label="From">
              <Input type="date" value={customFrom} min={today} onChange={(e) => setCustomFrom(e.target.value)} />
            </Field>
            <Field label="To">
              <Input type="date" value={customTo} min={customFrom || today} onChange={(e) => setCustomTo(e.target.value)} />
            </Field>
          </div>
        )}

        <ChipRow label="City">
          <button type="button" onClick={() => setCity('')} className={cx('chip shrink-0', !city && 'chip-active')}>
            All cities
          </button>
          {cities.map((c) => (
            <button key={c} type="button" onClick={() => setCity(city === c ? '' : c)} className={cx('chip shrink-0', city === c && 'chip-active')}>
              <MapPin className="size-3.5" /> {c}
            </button>
          ))}
        </ChipRow>

        <ChipRow label="Type">
          <button type="button" onClick={() => setCategory('')} className={cx('chip shrink-0', !category && 'chip-active')}>
            Everything
          </button>
          {categories.map((c) => (
            <button key={c} type="button" onClick={() => setCategory(category === c ? '' : c)} className={cx('chip shrink-0', category === c && 'chip-active')}>
              <span aria-hidden="true">{EVENT_CATEGORY[c]?.emoji || '🎟️'}</span> {EVENT_CATEGORY[c]?.plural || c}
            </button>
          ))}
        </ChipRow>
      </Card>

      {/* Results */}
      <div className="mb-3 mt-6 flex min-h-8 flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          {!data ? (
            'Finding experiences…'
          ) : (
            <>
              <span className="font-bold text-ink">{events.length}</span> {events.length === 1 ? 'experience' : 'experiences'}
              {city && <> in {city}</>}
              {from && (
                <>
                  {' '}
                  · {fmtRange(from, to || undefined)}
                  {!to && ' onwards'}
                </>
              )}
            </>
          )}
        </p>
        {hasFilters && (
          <Button size="xs" variant="ghost" icon={X} onClick={clearAll}>
            Clear filters
          </Button>
        )}
      </div>

      {error && !data ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !data ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <EventCardSkeleton key={i} />
          ))}
        </div>
      ) : events.length === 0 ? (
        <EmptyState
          emoji="🎪"
          title="Nothing on for these filters"
          description="Try another city, a wider date range or a different kind of experience."
          action={
            hasFilters && (
              <Button variant="secondary" onClick={clearAll}>
                Clear filters
              </Button>
            )
          }
        />
      ) : (
        <div className={cx('space-y-8 transition-opacity', loading && 'pointer-events-none opacity-60')}>
          {groups.map((g) => (
            <section key={g.key}>
              <h2 className="mb-3 flex items-baseline gap-2 font-display text-lg font-bold text-ink">
                {g.key}
                <span className="text-[13px] font-semibold text-muted">{plural(g.items.length, 'event')}</span>
              </h2>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {g.items.map((e) => (
                  <EventCard key={e.id} event={e} trip={matchTrip(trips, e)} onOpen={() => openEvent(e)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <EventModal event={selected} onClose={closeEvent} trips={trips} onProposed={onProposed} />

      <UpiPaySheet
        open={!!pay}
        onClose={closePay}
        amount={pay?.booking?.total || 0}
        title="Confirm your tickets"
        lines={
          pay
            ? [
                { label: 'Event', value: pay.event.title },
                { label: 'When', value: dayjs(pay.event.start_at).format('ddd, D MMM · h:mm A') },
                { label: 'Tickets', value: `${pay.qty} × ${inr(pay.event.price)} = ${inr(pay.booking.amount)}` },
                { label: 'Convenience fee', value: inr(pay.booking.fee) },
                ...(pay.trip ? [{ label: 'Added to', value: pay.trip.name }] : []),
              ]
            : []
        }
        note="Tickets are issued by the organiser — your confirmation arrives in a few seconds."
        payLabel={pay ? `Pay ${inr(pay.booking.total)}` : undefined}
        onPay={async ({ upi_app, pin }) => {
          try {
            return await api.post(`/bookings/${pay.booking.id}/confirm`, { upi_app, pin });
          } catch (err) {
            toast.error(err.message);
            throw err;
          }
        }}
        onDone={() => {
          paidRef.current = true;
          toast.success('Booking requested — confirmation arrives in a few seconds', {
            action: { label: 'View bookings', onClick: () => navigate('/app/bookings') },
            duration: 7000,
          });
          setTimeout(() => reload(), 4000);
        }}
      />
    </div>
  );
}

function ChipRow({ label, children }) {
  return (
    <div className="flex items-start gap-3">
      <span className="hidden w-10 shrink-0 pt-2 text-[12px] font-bold uppercase tracking-wider text-muted sm:block">{label}</span>
      <div className="no-scrollbar -mx-4 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">{children}</div>
    </div>
  );
}

function Spots({ event, className }) {
  const left = spotsLeft(event);
  if (left === 0) return <Badge tone="red" className={className}>Sold out</Badge>;
  const tone = left <= 5 ? 'red' : left <= 15 ? 'marigold' : 'green';
  return (
    <Badge tone={tone} dot className={className}>
      {left} {left === 1 ? 'spot' : 'spots'} left
    </Badge>
  );
}

function DateTile({ date, className }) {
  const d = dayjs(date);
  return (
    <div className={cx('w-14 rounded-xl bg-white/95 py-1.5 text-center leading-none shadow-soft', className)}>
      <div className="text-[10.5px] font-bold uppercase tracking-wider text-marigold-600">{d.format('MMM')}</div>
      <div className="mt-0.5 font-display text-[22px] font-extrabold text-ink">{d.format('D')}</div>
      <div className="mt-0.5 text-[10px] font-semibold text-muted">{d.format('ddd')}</div>
    </div>
  );
}

function EventCard({ event: e, trip, onOpen }) {
  const cat = EVENT_CATEGORY[e.category] || { label: e.category, emoji: '🎟️' };
  const soldOut = spotsLeft(e) === 0;
  return (
    <button type="button" onClick={onOpen} className="group h-full rounded-[22px] text-left outline-offset-4">
      <article className="flex h-full flex-col overflow-hidden rounded-[22px] border border-line bg-white shadow-soft transition duration-300 group-hover:-translate-y-1 group-hover:border-plum-200 group-hover:shadow-lift">
        <div className="overflow-hidden">
          <CoverArt theme={e.cover_theme} seed={e.id} rounded={false} className={cx('aspect-[16/9] transition-transform duration-700 group-hover:scale-[1.035]', soldOut && 'grayscale-[60%]')}>
            <div className="flex h-full items-start justify-between p-3">
              <DateTile date={e.start_at} />
              <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11.5px] font-bold text-ink/80 shadow-sm">
                <span aria-hidden="true">{cat.emoji}</span> {cat.label}
              </span>
            </div>
          </CoverArt>
        </div>
        <div className="flex flex-1 flex-col p-4">
          {trip && (
            <span className="mb-2 inline-flex w-fit items-center gap-1 rounded-full bg-plum-50 px-2 py-0.5 text-[11.5px] font-semibold text-plum-700 ring-1 ring-inset ring-plum-100">
              <Luggage className="size-3" /> During {trip.name}
            </span>
          )}
          <h3 className="line-clamp-2 font-display text-[16.5px] font-bold leading-snug text-ink transition-colors group-hover:text-plum-800">{e.title}</h3>
          <div className="mt-1.5 space-y-0.5 text-[13px] text-muted">
            <div className="flex items-center gap-1.5">
              <MapPin className="size-3.5 shrink-0" />
              <span className="truncate">
                {e.venue ? `${e.venue}, ` : ''}
                {e.city}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="size-3.5 shrink-0" />
              <span className="truncate">{timeLabel(e)}</span>
            </div>
          </div>
          <div className="mt-auto flex items-end justify-between gap-2 pt-4">
            <div>
              <span className="font-display text-[19px] font-extrabold text-ink">{e.price > 0 ? inr(e.price) : 'Free'}</span>
              {e.price > 0 && <span className="text-[12px] text-muted"> / person</span>}
            </div>
            <Spots event={e} />
          </div>
        </div>
      </article>
    </button>
  );
}

function EventCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[22px] border border-line bg-white shadow-soft">
      <Skeleton className="aspect-[16/9] rounded-none" />
      <div className="space-y-2.5 p-4">
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-3.5 w-3/5" />
        <Skeleton className="h-3.5 w-2/5" />
        <div className="flex justify-between pt-3">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
      </div>
    </div>
  );
}

function EventModal({ event, onClose, trips, onProposed }) {
  const config = useConfig();
  const [qty, setQty] = useState(2);
  const [tripId, setTripId] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!event) return;
    setQty(Math.min(2, Math.max(1, spotsLeft(event))));
    setTripId(matchTrip(trips, event)?.id || '');
    setBusy(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id, trips.length]);

  if (!event) return null;
  const e = event;
  const cat = EVENT_CATEGORY[e.category] || { label: e.category, emoji: '🎟️' };
  const left = spotsLeft(e);
  const past = isPast(e);
  const canBook = left > 0 && !past;
  const maxQty = Math.max(1, Math.min(10, left));
  const amount = e.price * qty;
  const feePct = Number(config.booking_fee_pct);
  const feeEst = Number.isFinite(feePct) ? Math.round((amount * feePct) / 100) : null;
  const matched = matchTrip(trips, e);
  const chosenTrip = trips.find((t) => t.id === tripId) || null;
  const mapsUrl = e.lat != null && e.lng != null ? `https://www.google.com/maps/search/?api=1&query=${e.lat},${e.lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${e.venue} ${e.city}`)}`;

  async function share() {
    const url = `${window.location.origin}/app/events?event=${e.id}`;
    try {
      if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ title: e.title, text: `${e.title} · ${dayjs(e.start_at).format('D MMM')} in ${e.city}`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success('Event link copied');
    } catch (err) {
      if (err?.name !== 'AbortError') toast.error('Couldn’t copy the link');
    }
  }

  async function book() {
    setBusy(true);
    try {
      const { booking } = await api.post('/bookings/propose', { ...(tripId ? { trip_id: tripId } : {}), event_id: e.id, quantity: qty });
      onProposed({ booking, event: e, trip: chosenTrip, qty });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={!!event}
      onClose={onClose}
      size="lg"
      title={e.title}
      description={`${cat.emoji} ${cat.label} · ${e.city}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          {canBook ? (
            <Button icon={Ticket} loading={busy} onClick={book}>
              Book {plural(qty, 'ticket')} · {inr(amount + (feeEst || 0))}
            </Button>
          ) : (
            <Button disabled>{past ? 'This event has ended' : 'Sold out'}</Button>
          )}
        </>
      }
    >
      <CoverArt theme={e.cover_theme} seed={e.id} className="aspect-[2/1] sm:aspect-[21/8]">
        <div className="flex h-full flex-col justify-between p-3">
          <div className="flex justify-end">
            {/* data-autofocus keeps the Modal's initial focus at the top instead of scrolling to the form */}
            <Button size="xs" variant="secondary" icon={Share2} data-autofocus="" onClick={share} className="border-white/60 bg-white/90 backdrop-blur">
              Share
            </Button>
          </div>
          <div className="flex items-end justify-between gap-2">
            <DateTile date={e.start_at} />
            <span className="rounded-full bg-ink/85 px-3 py-1 font-display text-[15px] font-bold text-white backdrop-blur">
              {e.price > 0 ? `${inr(e.price)} / person` : 'Free'}
            </span>
          </div>
        </div>
      </CoverArt>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <InfoRow icon={CalendarDays} label="When">
          {dayjs(e.start_at).format('dddd, D MMMM')}
          <span className="block text-[12.5px] font-medium text-muted">{timeLabel(e)}</span>
        </InfoRow>
        <InfoRow icon={MapPin} label="Where">
          {e.venue || e.city}
          <a href={mapsUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[12.5px] font-semibold text-plum-700 hover:underline">
            {e.city} · Open in Maps <ExternalLink className="size-3" />
          </a>
        </InfoRow>
        <InfoRow icon={Users} label="Availability" className="sm:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <Spots event={e} />
            <span className="text-[12px] font-medium text-muted">
              {e.booked_count} of {e.capacity} booked
            </span>
          </div>
          <Progress value={e.booked_count} max={e.capacity} tone={left <= 5 ? 'red' : 'marigold'} className="mt-2 h-1.5" />
        </InfoRow>
      </dl>

      {e.description && <p className="mt-4 text-[14.5px] leading-relaxed text-ink/85">{e.description}</p>}

      {canBook && (
        <div className="mt-5 rounded-2xl bg-paper p-4 ring-1 ring-inset ring-line/70">
          <div className="text-[14px] font-bold text-ink">Book tickets</div>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <div className="label">Tickets</div>
              <div className="flex h-11 items-center justify-between rounded-xl border border-line bg-white px-1.5">
                <button type="button" onClick={() => setQty((n) => Math.max(1, n - 1))} disabled={qty <= 1} className="grid size-8 place-items-center rounded-lg text-ink hover:bg-sand disabled:opacity-40" aria-label="Fewer tickets">
                  <Minus className="size-4" />
                </button>
                <span className="font-display text-[18px] font-bold tabular-nums text-ink" aria-live="polite">
                  {qty}
                </span>
                <button type="button" onClick={() => setQty((n) => Math.min(maxQty, n + 1))} disabled={qty >= maxQty} className="grid size-8 place-items-center rounded-lg text-ink hover:bg-sand disabled:opacity-40" aria-label="More tickets">
                  <Plus className="size-4" />
                </button>
              </div>
              <p className="mt-1.5 text-xs text-muted">Up to {maxQty} per booking</p>
            </div>
            <Field
              label="Add to a trip"
              hint={chosenTrip ? (matched?.id === chosenTrip.id ? `Matches your ${chosenTrip.destination} dates — it’ll show in the trip plan & budget` : 'It’ll show in the trip plan & budget') : 'Just tickets for you — no trip attached'}
            >
              <Select value={tripId} onChange={(ev) => setTripId(ev.target.value)}>
                <option value="">No trip</option>
                {trips.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} · {fmtRange(t.start_date, t.end_date)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="mt-4 space-y-1.5 border-t border-line pt-3 text-[13.5px]">
            <div className="flex justify-between text-ink/80">
              <span>
                {qty} × {inr(e.price)}
              </span>
              <span className="font-semibold text-ink">{inr(amount)}</span>
            </div>
            <div className="flex justify-between text-ink/80">
              <span>Convenience fee{Number.isFinite(feePct) ? ` (${feePct}%)` : ''}</span>
              <span className="font-semibold text-ink">{feeEst != null ? inr(feeEst) : 'At checkout'}</span>
            </div>
            <div className="flex justify-between pt-1 text-[15px] font-bold text-ink">
              <span>Total</span>
              <span className="font-display">{inr(amount + (feeEst || 0))}</span>
            </div>
            <p className="pt-1 text-[12px] text-muted">You’ll review everything before paying with UPI.</p>
          </div>
        </div>
      )}
    </Modal>
  );
}

function InfoRow({ icon: Icon, label, children, className }) {
  return (
    <div className={cx('flex gap-3 rounded-xl bg-white p-3 ring-1 ring-inset ring-line', className)}>
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-plum-50 text-plum-700">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <dt className="text-[11.5px] font-bold uppercase tracking-wider text-muted">{label}</dt>
        <dd className="text-[14px] font-semibold text-ink">{children}</dd>
      </div>
    </div>
  );
}
