import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import clsx from 'clsx';
import { toast } from 'sonner';
import { Crown, ExternalLink, GitFork, Globe, LogOut, ShieldCheck, Trash2, UserPlus, UserMinus } from 'lucide-react';
import { Avatar, Badge, Button, Card, Field, Input, Menu, SectionTitle, Select, Textarea, VerifiedBadge, useConfirm } from '../../components/ui';
import { api } from '../../lib/api';
import { useConfig } from '../../lib/config';
import { useFetch } from '../../lib/hooks';
import { inr, timeAgo, vibeLabel } from '../../lib/format';

const AUDIT = { proposed: '🤖 Proposed', confirmed: '✅ Approved & paid', executed: '🎟️ Confirmed by provider', failed: '⚠️ Provider failed → specialist', resolved: '🛠️ Resolved by support', cancelled: '↩️ Cancelled & refunded', dismissed: '✖️ Dismissed' };

function Members({ ctx, onInvite }) {
  const { data, setData, tripId, user, isOwner, onlineIds } = ctx;
  const confirm = useConfirm();
  const navigate = useNavigate();

  async function remove(m) {
    const self = m.user_id === user.id;
    if (!(await confirm({ title: self ? 'Leave this trip?' : `Remove ${m.name}?`, description: self ? 'You’ll lose access to the plan, chat and album.' : 'They’ll lose access to the plan, chat and album.', confirmLabel: self ? 'Leave trip' : 'Remove', tone: 'danger' }))) return;
    try {
      const r = await api.del(`/trips/${tripId}/members/${m.user_id}`);
      if (self) {
        toast.success('You left the trip');
        navigate('/app/trips');
      } else setData((d) => ({ ...d, members: r.members }));
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function makeOwner(m) {
    if (!(await confirm({ title: `Make ${m.name} the owner?`, description: 'Owners control invites, spending limits, dates and publishing. You’ll become a regular member.', confirmLabel: 'Transfer ownership' }))) return;
    try {
      const r = await api.patch(`/trips/${tripId}/members/${m.user_id}`, { role: 'owner' });
      setData((d) => ({ ...d, members: r.members, me: { ...d.me, role: 'member' } }));
      toast.success(`${m.name} is now the owner`);
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <Card>
      <SectionTitle title={`Travellers (${data.members.length})`} action={isOwner && <Button size="sm" icon={UserPlus} onClick={onInvite}>Invite</Button>} />
      <div className="divide-y divide-line">
        {data.members.map((m) => (
          <div key={m.user_id} className="flex items-center gap-3 py-3">
            <Avatar user={{ ...m, id: m.user_id }} size={40} online={onlineIds.has(m.user_id)} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[14.5px] font-semibold">
                {m.name}{m.user_id === user.id && <span className="text-muted">(you)</span>} {m.verified && <VerifiedBadge />}
                {m.role === 'owner' && <Badge tone="marigold" icon={Crown}>Owner</Badge>}
              </div>
              <div className="text-[12px] text-muted">Vibe {m.vibe} · {vibeLabel(m.vibe)}{m.home_city ? ` · ${m.home_city}` : ''}{m.share_location ? ' · 📍 sharing location' : ''}</div>
            </div>
            {(isOwner && m.user_id !== user.id) || (m.user_id === user.id && m.role !== 'owner') ? (
              <Menu
                items={[
                  isOwner && m.user_id !== user.id && { label: 'Make owner', icon: Crown, onClick: () => makeOwner(m) },
                  isOwner && m.user_id !== user.id && { label: 'Remove from trip', icon: UserMinus, danger: true, onClick: () => remove(m) },
                  m.user_id === user.id && { label: 'Leave trip', icon: LogOut, danger: true, onClick: () => remove(m) },
                ]}
              />
            ) : null}
          </div>
        ))}
      </div>
    </Card>
  );
}

function Details({ ctx }) {
  const { data, setData, tripId, isOwner } = ctx;
  const { trip } = data;
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => setForm({ name: trip.name, destination: trip.destination, budget: trip.budget, start_date: trip.start_date, end_date: trip.end_date, spend_limit_booking: trip.spend_limit_booking, spend_limit_trip: trip.spend_limit_trip, status: trip.status }), [trip]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    const body = { name: form.name, destination: form.destination, budget: Number(form.budget) || 0 };
    if (isOwner) Object.assign(body, { start_date: form.start_date, end_date: form.end_date, spend_limit_booking: Number(form.spend_limit_booking), spend_limit_trip: Number(form.spend_limit_trip), status: form.status });
    try {
      const r = await api.patch(`/trips/${tripId}`, body);
      setData((d) => ({ ...d, trip: { ...d.trip, ...r.trip, invite_code: r.trip.invite_code ?? d.trip.invite_code } }));
      toast.success('Trip updated');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <SectionTitle title="Trip details" subtitle={isOwner ? undefined : 'Only the owner can change dates, status and spending limits.'} />
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <Field label="Trip name"><Input value={form.name || ''} onChange={set('name')} maxLength={80} /></Field>
        <Field label="Destination"><Input value={form.destination || ''} onChange={set('destination')} maxLength={80} /></Field>
        <Field label="Start date"><Input type="date" value={form.start_date || ''} onChange={set('start_date')} disabled={!isOwner} /></Field>
        <Field label="End date"><Input type="date" value={form.end_date || ''} min={form.start_date} onChange={set('end_date')} disabled={!isOwner} /></Field>
        <Field label="Group budget (₹)"><Input inputMode="numeric" value={form.budget ?? ''} onChange={set('budget')} /></Field>
        <Field label="Status">
          <Select value={form.status || 'planning'} onChange={set('status')} disabled={!isOwner}>
            {['planning', 'booked', 'ongoing', 'completed', 'archived'].map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
          </Select>
        </Field>
        <div className="sm:col-span-2 rounded-2xl bg-paper p-4">
          <div className="flex items-center gap-2 text-sm font-bold"><ShieldCheck className="size-4 text-plum-600" /> AI spending limits</div>
          <p className="mt-0.5 text-[12.5px] text-muted">Our payment service blocks any booking above these, no matter who (or what) asks.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Max per booking (₹)"><Input inputMode="numeric" value={form.spend_limit_booking ?? ''} onChange={set('spend_limit_booking')} disabled={!isOwner} /></Field>
            <Field label="Max for the whole trip (₹)"><Input inputMode="numeric" value={form.spend_limit_trip ?? ''} onChange={set('spend_limit_trip')} disabled={!isOwner} /></Field>
          </div>
        </div>
        <div className="sm:col-span-2 flex justify-end"><Button type="submit" loading={busy}>Save changes</Button></div>
      </form>
    </Card>
  );
}

function Publish({ ctx }) {
  const { data, setData, tripId, isOwner } = ctx;
  const { itinerary_tags, booking_fee_pct } = useConfig();
  const pub = data.published;
  const [form, setForm] = useState({ title: data.trip.name, summary: '', tags: [], price: 0, budget_estimate: data.trip.budget });
  const [busy, setBusy] = useState(false);
  const items = data.days.reduce((s, d) => s + d.items.length, 0);

  async function publish(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.post(`/trips/${tripId}/publish`, { ...form, price: Number(form.price) || 0, budget_estimate: Number(form.budget_estimate) || 0 });
      toast.success(pub ? 'Published itinerary updated' : 'Published to the community! 🎉');
      setData((d) => ({ ...d, trip: { ...d.trip, published_itinerary_id: r.itinerary_id }, published: { id: r.itinerary_id, status: 'published', price: Number(form.price) || 0, fork_count: d.published?.fork_count || 0 } }));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function unpublish() {
    await api.post(`/trips/${tripId}/unpublish`);
    setData((d) => ({ ...d, published: { ...d.published, status: 'unpublished' } }));
    toast('Removed from the community feed');
  }

  return (
    <Card>
      <SectionTitle title="Share with the community" subtitle="Publish this plan so other travellers can fork it. Earn from unlock fees and tips." />
      {pub && pub.status !== 'unpublished' && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-emerald-50 p-4">
          <Globe className="size-5 text-emerald-700" />
          <div className="flex-1 text-[13.5px] text-emerald-900"><b>Live on the feed</b> · {pub.price ? `${inr(pub.price)} premium` : 'free'} · <GitFork className="inline size-3.5" /> {pub.fork_count} forks</div>
          <Button size="sm" variant="secondary" icon={ExternalLink} to={`/app/itineraries/${pub.id}`}>View</Button>
          {isOwner && <Button size="sm" variant="ghost" onClick={unpublish}>Unpublish</Button>}
        </div>
      )}
      {!isOwner ? (
        <p className="text-sm text-muted">Only the trip owner can publish this itinerary.</p>
      ) : items < 2 ? (
        <p className="rounded-2xl bg-paper p-4 text-sm text-muted">Add at least a couple of stops to your plan before publishing.</p>
      ) : (
        <form onSubmit={publish} className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" className="sm:col-span-2"><Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required maxLength={100} /></Field>
          <Field label="Summary" className="sm:col-span-2"><Textarea value={form.summary} onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))} rows={3} maxLength={1000} placeholder="Who is this trip for? What makes it special? Any tips?" /></Field>
          <div className="sm:col-span-2">
            <div className="label">Vibe tags</div>
            <div className="flex flex-wrap gap-1.5">
              {itinerary_tags.map((t) => {
                const on = form.tags.includes(t);
                return <button key={t} type="button" onClick={() => setForm((f) => ({ ...f, tags: on ? f.tags.filter((x) => x !== t) : [...f.tags, t].slice(0, 6) }))} className={clsx('chip', on && 'chip-active')}>{t}</button>;
              })}
            </div>
          </div>
          <Field label="Unlock price (₹)" hint="0 = free. Premium itineraries show day 1 as a preview."><Input inputMode="numeric" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value.replace(/\D/g, '') }))} /></Field>
          <Field label="Estimated budget (₹)"><Input inputMode="numeric" value={form.budget_estimate} onChange={(e) => setForm((f) => ({ ...f, budget_estimate: e.target.value.replace(/\D/g, '') }))} /></Field>
          <p className="text-xs text-muted sm:col-span-2">We publish a snapshot of your days and stops — never your chat, bookings, photos or members. Convenience fee on bookings is {booking_fee_pct}%; marketplace fees are shown in Creator studio.</p>
          <div className="sm:col-span-2 flex justify-end"><Button type="submit" loading={busy} icon={Globe}>{pub ? 'Update published version' : 'Publish to community'}</Button></div>
        </form>
      )}
    </Card>
  );
}

function AuditLog({ ctx }) {
  const { data } = useFetch(`/trips/${ctx.tripId}/audit`);
  const rows = data?.audit || [];
  return (
    <Card>
      <SectionTitle title="Yatri audit trail" subtitle="Every AI proposal, approval and execution on this trip" />
      {rows.length === 0 ? (
        <p className="py-4 text-sm text-muted">No AI actions yet.</p>
      ) : (
        <div className="scrollbar-thin max-h-80 divide-y divide-line overflow-y-auto">
          {rows.map((a) => (
            <div key={a.id} className="flex items-start justify-between gap-3 py-2.5 text-[13px]">
              <div>
                <div className="font-semibold">{AUDIT[a.action] || a.action}</div>
                <div className="text-muted">{a.detail?.title || a.detail?.reason || a.detail?.provider_ref || ''}{a.detail?.total ? ` · ${inr(a.detail.total)}` : ''}{a.user_name ? ` · ${a.user_name}` : ''}</div>
              </div>
              <span className="shrink-0 text-xs text-muted">{timeAgo(a.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default function SettingsTab({ ctx, onInvite }) {
  const { tripId, isOwner, data } = ctx;
  const confirm = useConfirm();
  const navigate = useNavigate();

  async function deleteTrip() {
    if (!(await confirm({ title: `Delete “${data.trip.name}”?`, description: 'This permanently deletes the plan, chat, album and zine for everyone. This cannot be undone.', confirmLabel: 'Delete trip', tone: 'danger' }))) return;
    try {
      await api.del(`/trips/${tripId}`);
      toast.success('Trip deleted');
      navigate('/app/trips');
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="space-y-5">
        <Members ctx={ctx} onInvite={onInvite} />
        <AuditLog ctx={ctx} />
      </div>
      <div className="space-y-5">
        <Details ctx={ctx} />
        <Publish ctx={ctx} />
        {isOwner && (
          <Card className="border-rose-200">
            <SectionTitle title="Danger zone" />
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] text-muted">Delete this trip for everyone.</p>
              <Button variant="danger-soft" icon={Trash2} onClick={deleteTrip}>Delete trip</Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
