import { useMemo, useState } from 'react';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { toast } from 'sonner';
import { Bot, Plus, Search, ShieldCheck } from 'lucide-react';
import BookingRow, { BookingDetailModal, CategoryTile, ProposalCard } from '../../components/BookingRow';
import { Button, Card, EmptyState, Field, Input, Modal, Progress, SectionTitle, Select, Skeleton } from '../../components/ui';
import { api } from '../../lib/api';
import { useFetch } from '../../lib/hooks';
import { useSocketEvent } from '../../lib/socket';
import { CATEGORY, fmtDateTime, inr } from '../../lib/format';

function BookSheet({ open, onClose, ctx, onProposed }) {
  const { data, tripId } = ctx;
  const { trip, members } = data;
  const [category, setCategory] = useState('cab');
  const [params, setParams] = useState({});
  const [options, setOptions] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setParams((p) => ({ ...p, [k]: e.target.value }));
  const defaults = {
    cab: { pickup: trip.destination, drop: '', pickup_time: `${dayjs(trip.start_date).isAfter(dayjs()) ? trip.start_date : dayjs().add(1, 'day').format('YYYY-MM-DD')}T10:00`, passengers: members.length },
    food: { area: trip.destination, meal: 'dinner', party_size: members.length, cuisine: '' },
    stay: { location: trip.destination, check_in: trip.start_date, check_out: trip.end_date, guests: members.length, style: '' },
  };
  const p = { ...defaults[category], ...params };

  async function search(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.post('/bookings/search', { trip_id: tripId, category, params: p });
      setOptions(r.options);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function propose(o) {
    try {
      const r = await api.post('/bookings/propose', { trip_id: tripId, option_id: o.option_id });
      toast.success('Added to proposals — review & pay below');
      onProposed(r.booking);
      onClose();
      setOptions(null);
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Book it yourself" description="Search our partners directly. You’ll still review before paying." size="md">
      <div className="mb-4 grid grid-cols-3 gap-2">
        {['cab', 'food', 'stay'].map((c) => (
          <button key={c} onClick={() => { setCategory(c); setParams({}); setOptions(null); }} className={clsx('flex flex-col items-center gap-1 rounded-2xl border py-3 text-sm font-semibold transition', category === c ? 'border-plum-600 bg-plum-50 text-plum-800' : 'border-line hover:border-plum-300')}>
            <span className="text-2xl">{CATEGORY[c].emoji}</span>{CATEGORY[c].label}
          </button>
        ))}
      </div>
      <form onSubmit={search} className="grid grid-cols-2 gap-3">
        {category === 'cab' && (
          <>
            <Field label="Pickup" className="col-span-2 sm:col-span-1"><Input value={p.pickup} onChange={set('pickup')} required /></Field>
            <Field label="Drop" className="col-span-2 sm:col-span-1"><Input value={p.drop} onChange={set('drop')} placeholder="e.g. Bhimtal" required /></Field>
            <Field label="Pickup time"><Input type="datetime-local" value={p.pickup_time} onChange={set('pickup_time')} /></Field>
            <Field label="Passengers"><Input type="number" min={1} max={12} value={p.passengers} onChange={set('passengers')} /></Field>
          </>
        )}
        {category === 'food' && (
          <>
            <Field label="Deliver to"><Input value={p.area} onChange={set('area')} /></Field>
            <Field label="Meal"><Select value={p.meal} onChange={set('meal')}>{['breakfast', 'lunch', 'dinner', 'snacks'].map((m) => <option key={m} value={m}>{m}</option>)}</Select></Field>
            <Field label="Cuisine (optional)"><Input value={p.cuisine} onChange={set('cuisine')} placeholder="Pahadi, thali…" /></Field>
            <Field label="People"><Input type="number" min={1} max={20} value={p.party_size} onChange={set('party_size')} /></Field>
          </>
        )}
        {category === 'stay' && (
          <>
            <Field label="Location" className="col-span-2"><Input value={p.location} onChange={set('location')} /></Field>
            <Field label="Check-in"><Input type="date" value={p.check_in} onChange={set('check_in')} /></Field>
            <Field label="Check-out"><Input type="date" value={p.check_out} onChange={set('check_out')} /></Field>
            <Field label="Guests"><Input type="number" min={1} max={20} value={p.guests} onChange={set('guests')} /></Field>
            <Field label="Style"><Select value={p.style} onChange={set('style')}><option value="">Any</option>{['hostel', 'homestay', 'boutique', 'resort'].map((s) => <option key={s} value={s}>{s}</option>)}</Select></Field>
          </>
        )}
        <Button type="submit" className="col-span-2" icon={Search} loading={busy}>Search partners</Button>
      </form>
      {options && (
        <div className="mt-5 space-y-2">
          {options.length === 0 && <p className="py-4 text-center text-sm text-muted">No options found — try different details.</p>}
          {options.map((o) => (
            <div key={o.option_id} className="flex items-center gap-3 rounded-2xl border border-line p-3">
              <CategoryTile category={o.category} size={40} />
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-semibold">{o.title}</div>
                <div className="line-clamp-1 text-[12px] text-muted">{o.subtitle}</div>
                <div className="text-[11.5px] text-muted">{o.provider_name} · ⭐ {o.rating}{o.scheduled_at ? ` · ${fmtDateTime(o.scheduled_at)}` : ''}</div>
              </div>
              <div className="text-right">
                <div className="font-bold">{inr(o.amount)}</div>
                <Button size="xs" className="mt-1" onClick={() => propose(o)} disabled={o.amount > trip.spend_limit_booking}>Select</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

export default function BookingsTab({ ctx }) {
  const { data, tripId, setTab, isOwner } = ctx;
  const { data: res, loading, reload, setData } = useFetch(`/bookings?trip_id=${tripId}`);
  const [booking, setBooking] = useState(false);
  const [open, setOpen] = useState(null);

  useSocketEvent('trip:event', (ev) => {
    if (ev.tripId !== tripId || ev.type !== 'booking') return;
    setData((d) => {
      if (!d) return d;
      const b = ev.data.booking;
      const exists = d.bookings.some((x) => x.id === b.id);
      return { ...d, bookings: exists ? d.bookings.map((x) => (x.id === b.id ? { ...x, ...b } : x)) : [b, ...d.bookings] };
    });
  });

  const groups = useMemo(() => {
    const all = res?.bookings || [];
    const fresh = (b) => Date.now() - new Date(b.created_at).getTime() < 30 * 60 * 1000;
    return {
      proposed: all.filter((b) => b.status === 'proposed' && fresh(b)),
      active: all.filter((b) => ['requested', 'confirmed', 'needs_attention'].includes(b.status)).sort((a, b) => new Date(a.scheduled_at || 0) - new Date(b.scheduled_at || 0)),
      past: all.filter((b) => b.status === 'completed'),
      cancelled: all.filter((b) => b.status === 'cancelled' && b.failure_reason !== 'Dismissed' && b.failure_reason !== 'Quote expired'),
    };
  }, [res]);

  const booked = [...groups.active, ...groups.past].reduce((s, b) => s + b.total, 0);
  const { spend_limit_trip: limitTrip, spend_limit_booking: limitBooking } = data.trip;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}</div>
        ) : (
          <>
            {groups.proposed.length > 0 && (
              <section>
                <SectionTitle title="Waiting for approval" subtitle="Nothing is charged until someone reviews and pays." />
                <div className="grid gap-3 md:grid-cols-2">{groups.proposed.map((b) => <ProposalCard key={b.id} booking={b} tripLimit={limitBooking} onChanged={reload} />)}</div>
              </section>
            )}
            <section>
              <SectionTitle title="Booked" action={<Button size="sm" variant="secondary" icon={Plus} onClick={() => setBooking(true)}>Book manually</Button>} />
              {groups.active.length === 0 && groups.past.length === 0 ? (
                <EmptyState icon={Bot} title="No bookings yet" description="Ask Yatri to book cabs, food or stays — or search partners yourself." action={<div className="flex gap-2"><Button icon={Bot} onClick={() => setTab('concierge')}>Ask Yatri</Button><Button variant="secondary" onClick={() => setBooking(true)}>Book manually</Button></div>} />
              ) : (
                <Card padded={false} className="divide-y divide-line overflow-hidden">
                  {[...groups.active, ...groups.past].map((b) => (
                    <button key={b.id} onClick={() => setOpen(b.id)} className="block w-full px-4 py-3.5 text-left hover:bg-paper">
                      <BookingRow booking={b} />
                      {b.user_name && <div className="ml-14 mt-1 text-[11.5px] text-muted">Booked by {b.user_name}</div>}
                    </button>
                  ))}
                </Card>
              )}
            </section>
            {groups.cancelled.length > 0 && (
              <section>
                <SectionTitle title="Cancelled" />
                <Card padded={false} className="divide-y divide-line overflow-hidden opacity-80">
                  {groups.cancelled.map((b) => (
                    <button key={b.id} onClick={() => setOpen(b.id)} className="block w-full px-4 py-3 text-left hover:bg-paper"><BookingRow booking={b} /></button>
                  ))}
                </Card>
              </section>
            )}
          </>
        )}
      </div>
      <div className="space-y-4">
        <Card>
          <div className="flex items-center gap-2 font-bold"><ShieldCheck className="size-4 text-plum-600" /> Spending guardrails</div>
          <p className="mt-1 text-xs text-muted">Enforced by our payment service, independent of the AI.</p>
          <div className="mt-4">
            <div className="flex justify-between text-[13px]"><span className="text-muted">Booked on this trip</span><span className="font-bold">{inr(booked)} / {inr(limitTrip)}</span></div>
            <Progress value={booked} max={limitTrip} className="mt-1.5" tone={booked / limitTrip > 0.85 ? 'red' : 'plum'} />
          </div>
          <div className="mt-3 flex justify-between text-[13px]"><span className="text-muted">Max per booking</span><span className="font-bold">{inr(limitBooking)}</span></div>
          {isOwner && <Button variant="ghost" size="sm" className="mt-3 -ml-2" onClick={() => setTab('settings')}>Change limits</Button>}
        </Card>
        <Card className="bg-plum-50/60">
          <div className="font-bold">How booking works</div>
          <ol className="mt-2 space-y-2 text-[13px] text-ink/75">
            <li>1. Yatri (or you) finds options from our partners.</li>
            <li>2. Anyone on the trip reviews the card and pays via UPI.</li>
            <li>3. We confirm with the provider — driver, order or room details land here and in the plan.</li>
            <li>4. If a provider fails, a specialist fixes it or refunds you in full.</li>
          </ol>
        </Card>
      </div>
      <BookSheet open={booking} onClose={() => setBooking(false)} ctx={ctx} onProposed={() => reload()} />
      <BookingDetailModal bookingId={open} open={!!open} onClose={() => setOpen(null)} onChanged={reload} />
    </div>
  );
}
