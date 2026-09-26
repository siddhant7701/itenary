import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { Ban, CircleCheck, CreditCard, ExternalLink, MapPin, RefreshCw, RotateCcw, ShieldCheck, Sparkles, TriangleAlert, Undo2, X } from 'lucide-react';
import { Badge, Button, ErrorState, Skeleton, Textarea, useConfirm, cx } from '../../components/ui';
import { adminApi } from '../../lib/api';
import { useFetch } from '../../lib/hooks';
import { CATEGORY, UPI_APPS, fmtDateTime, fmtRange, inr, timeAgo } from '../../lib/format';
import { BOOKING_STATUS_ADMIN, CopyText, Drawer, MiniStat, PAYMENT_PURPOSE, PAYMENT_STATUS, StatusBadge, UserCell, humanize, parseMaybeJson, useAdmin, usePrompt } from './kit';

// ---------------------------------------------------------------- Audit vocabulary (shared with the Audit page)
export const AUDIT_ACTIONS = {
  proposed: { label: 'Proposed', title: 'Concierge proposed', icon: Sparkles, tone: 'plum', dot: 'bg-plum-500' },
  confirmed: { label: 'Confirmed', title: 'Traveller confirmed & paid', icon: CreditCard, tone: 'blue', dot: 'bg-sky-500' },
  executed: { label: 'Executed', title: 'Provider confirmed booking', icon: CircleCheck, tone: 'green', dot: 'bg-emerald-500' },
  failed: { label: 'Failed', title: 'Provider failed', icon: TriangleAlert, tone: 'red', dot: 'bg-rose-500' },
  cancelled: { label: 'Cancelled', title: 'Cancelled', icon: Ban, tone: 'neutral', dot: 'bg-ink/40' },
  dismissed: { label: 'Dismissed', title: 'Proposal dismissed', icon: X, tone: 'neutral', dot: 'bg-ink/30' },
  resolved: { label: 'Resolved', title: 'Resolved by admin', icon: ShieldCheck, tone: 'marigold', dot: 'bg-marigold-500' },
};

const RESOLVE_LABEL = { confirm: 'Confirmed manually', retry: 'Retried provider', cancel_refund: 'Cancelled & refunded' };

export function auditSummary(a) {
  const d = a.detail || {};
  switch (a.action) {
    case 'proposed':
      return [d.provider, d.total != null ? inr(d.total) : null, d.source ? `via ${d.source}` : null].filter(Boolean).join(' · ');
    case 'confirmed':
      return [d.total != null ? `${inr(d.total)} paid` : null, d.upi_app ? UPI_APPS[d.upi_app]?.label || d.upi_app : null, d.upi_ref ? `UPI ref ${d.upi_ref}` : null].filter(Boolean).join(' · ');
    case 'executed':
      return d.provider_ref ? `Provider ref ${d.provider_ref}` : 'Provider accepted the booking';
    case 'failed':
      return d.reason || 'Provider could not complete the booking';
    case 'cancelled':
      return [d.reason, d.refund ? `refunded ${inr(d.refund)}` : null, d.by_admin ? 'by admin' : null].filter(Boolean).join(' · ');
    case 'dismissed':
      return d.reason || 'Traveller dismissed the proposal';
    case 'resolved':
      return `${RESOLVE_LABEL[d.action] || humanize(d.action || 'resolved')}${d.note ? ` — “${d.note}”` : ''}`;
    default:
      return Object.entries(d)
        .filter(([, v]) => v !== null && v !== undefined && typeof v !== 'object')
        .map(([k, v]) => `${humanize(k)}: ${v}`)
        .join(' · ');
  }
}

// ---------------------------------------------------------------- Detail formatting
const LABELS = {
  pickup: 'Pickup',
  drop: 'Drop',
  km: 'Distance',
  minutes: 'Drive time',
  vehicle_class: 'Vehicle class',
  vehicle_model: 'Vehicle',
  seats: 'Seats',
  passengers: 'Passengers',
  driver_name: 'Driver',
  driver_phone: 'Driver phone',
  vehicle_plate: 'Number plate',
  ride_otp: 'Ride OTP',
  driver_rating: 'Driver rating',
  property: 'Property',
  tier: 'Tier',
  location: 'Location',
  check_in: 'Check-in',
  check_out: 'Check-out',
  nights: 'Nights',
  guests: 'Guests',
  units: 'Rooms',
  per_night: 'Per room / night',
  amenities: 'Amenities',
  confirmation_code: 'Confirmation code',
  check_in_time: 'Check-in time',
  check_out_time: 'Check-out time',
  restaurant: 'Restaurant',
  cuisine: 'Cuisine',
  dishes: 'Dishes',
  party_size: 'Party size',
  per_person: 'Per person',
  meal: 'Meal',
  delivery_fee: 'Delivery fee',
  deliver_to: 'Deliver to',
  rider_name: 'Delivery rider',
  eta_minutes: 'ETA',
  event_id: 'Event ID',
  venue: 'Venue',
  city: 'City',
  quantity: 'Tickets',
  unit_price: 'Ticket price',
  category: 'Event category',
  ticket_code: 'Ticket code',
  rating: 'Provider rating',
};
const MONEY = new Set(['per_night', 'per_person', 'delivery_fee', 'unit_price', 'price', 'subtotal']);
const FULFILMENT = new Set(['driver_name', 'driver_phone', 'vehicle_plate', 'ride_otp', 'driver_rating', 'confirmation_code', 'check_in_time', 'check_out_time', 'rider_name', 'eta_minutes', 'ticket_code']);
const HIDDEN = new Set(['subtitle', 'lat', 'lng', 'pickup_lat', 'pickup_lng', 'drop_lat', 'drop_lng']);
const MONO = new Set(['ride_otp', 'vehicle_plate', 'confirmation_code', 'ticket_code', 'event_id']);

function formatValue(key, v) {
  if (Array.isArray(v)) {
    if (v.every((x) => typeof x !== 'object')) {
      return (
        <span className="flex flex-wrap gap-1">
          {v.map((x, i) => (
            <span key={i} className="rounded-md bg-sand px-1.5 py-0.5 text-[12px] font-medium text-ink/80">
              {String(x)}
            </span>
          ))}
        </span>
      );
    }
    return <pre className="whitespace-pre-wrap font-mono text-[11.5px] text-ink/80">{JSON.stringify(v, null, 2)}</pre>;
  }
  if (v && typeof v === 'object') return <pre className="whitespace-pre-wrap font-mono text-[11.5px] text-ink/80">{JSON.stringify(v, null, 2)}</pre>;
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (MONEY.has(key)) return inr(v);
  if (key === 'km') return `${v} km`;
  if (key === 'minutes' || key === 'eta_minutes') return `~${v} min`;
  if ((key === 'rating' || key === 'driver_rating') && v) return `★ ${v}`;
  if (key === 'driver_phone')
    return (
      <a href={`tel:${String(v).replace(/\s/g, '')}`} className="text-plum-700 hover:underline">
        {v}
      </a>
    );
  if (MONO.has(key)) return <CopyText value={String(v)} />;
  return String(v);
}

function DetailList({ entries }) {
  return (
    <dl className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
      {entries.map(([k, v]) => (
        <div key={k} className={cx('min-w-0', (Array.isArray(v) || (v && typeof v === 'object')) && 'sm:col-span-2')}>
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted">{LABELS[k] || humanize(k)}</dt>
          <dd className="mt-0.5 break-words text-[13.5px] font-medium text-ink">{formatValue(k, v)}</dd>
        </div>
      ))}
    </dl>
  );
}

function BookingDetails({ booking }) {
  const d = booking.details || {};
  const entries = Object.entries(d).filter(([k, v]) => !HIDDEN.has(k) && v !== null && v !== undefined && v !== '');
  const fulfil = entries.filter(([k]) => FULFILMENT.has(k));
  const rest = entries.filter(([k]) => !FULFILMENT.has(k));
  const mapLinks = [];
  if (d.pickup_lat != null && d.pickup_lng != null) mapLinks.push({ label: 'Pickup on map', href: `https://maps.google.com/?q=${d.pickup_lat},${d.pickup_lng}` });
  if (d.drop_lat != null && d.drop_lng != null) mapLinks.push({ label: 'Drop on map', href: `https://maps.google.com/?q=${d.drop_lat},${d.drop_lng}` });
  if (d.lat != null && d.lng != null) mapLinks.push({ label: 'Location on map', href: `https://maps.google.com/?q=${d.lat},${d.lng}` });

  return (
    <div className="space-y-4">
      {d.subtitle && <p className="text-[13.5px] text-ink/80">{d.subtitle}</p>}
      {fulfil.length > 0 && (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
          <div className="mb-3 text-[11.5px] font-bold uppercase tracking-wider text-emerald-800">Provider fulfilment</div>
          <DetailList entries={fulfil} />
        </div>
      )}
      {rest.length > 0 && <DetailList entries={rest} />}
      {mapLinks.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {mapLinks.map((m) => (
            <a key={m.href} href={m.href} target="_blank" rel="noreferrer" className="chip">
              <MapPin className="size-3.5" /> {m.label} <ExternalLink className="size-3" />
            </a>
          ))}
        </div>
      )}
      {entries.length === 0 && <p className="text-sm text-muted">No extra details recorded.</p>}
    </div>
  );
}

export function AuditTimeline({ audit, user }) {
  if (!audit?.length) return <p className="text-sm text-muted">No audit entries for this booking.</p>;
  return (
    <ol className="relative space-y-4 pl-7 before:absolute before:bottom-2 before:left-[11px] before:top-2 before:w-px before:bg-line">
      {audit.map((a) => {
        const meta = AUDIT_ACTIONS[a.action] || { title: humanize(a.action), icon: Sparkles, dot: 'bg-ink/40' };
        const Icon = meta.icon;
        const who = a.user_name || (user && a.user_id === user.id ? user.name : a.action === 'resolved' ? 'Admin' : null);
        return (
          <li key={a.id} className="relative">
            <span className={cx('absolute -left-7 top-0 grid size-6 place-items-center rounded-full text-white ring-4 ring-white', meta.dot)}>
              <Icon className="size-3.5" />
            </span>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="text-[13.5px] font-bold text-ink">{meta.title}</span>
              <span className="text-[11.5px] text-muted" title={fmtDateTime(a.created_at)}>
                {fmtDateTime(a.created_at)} · {timeAgo(a.created_at)}
              </span>
            </div>
            <p className="mt-0.5 text-[13px] text-ink/75">{auditSummary(a) || '—'}</p>
            {who && <p className="mt-0.5 text-[11.5px] text-muted">by {who}</p>}
          </li>
        );
      })}
    </ol>
  );
}

function Section({ title, children, action }) {
  return (
    <section className="border-t border-line/80 pt-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-[12px] font-bold uppercase tracking-[0.12em] text-muted">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function DrawerSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex gap-3">
        <Skeleton className="size-12 rounded-2xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-32 rounded-xl" />
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
}

/** Booking detail drawer. `id` null → closed. */
export default function BookingDrawer({ id, onClose, onChanged }) {
  const { data, loading, error, reload } = useFetch(id ? `/admin/bookings/${id}` : null, { scope: 'admin' });
  const { refresh } = useAdmin();
  const confirm = useConfirm();
  const prompt = usePrompt();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    setNote('');
  }, [id]);

  const b = data?.booking?.id === id ? data.booking : null;
  const user = data?.user;
  const trip = data?.trip;
  const cat = b ? CATEGORY[b.category] : null;

  const after = async (result) => {
    await reload();
    refresh();
    onChanged?.(result);
  };

  const resolve = async (action) => {
    if (action === 'cancel_refund') {
      const ok = await confirm({
        title: 'Cancel and refund this booking?',
        description: `${inr(b.total)} will be refunded to ${user?.name || 'the traveller'} over UPI and they will be notified.`,
        confirmLabel: 'Cancel & refund',
        tone: 'danger',
      });
      if (!ok) return;
    }
    setBusy(action);
    try {
      const { booking } = await adminApi.post(`/admin/bookings/${b.id}/resolve`, { action, note: note.trim() || undefined });
      if (booking?.status === 'confirmed') toast.success('Booking confirmed', { description: 'The traveller and their trip group have been notified.' });
      else if (booking?.status === 'cancelled') toast.success(`Cancelled — ${inr(b.total)} refund initiated`);
      else if (booking?.status === 'needs_attention') toast.warning('Provider failed again', { description: booking.failure_reason || 'Try again, confirm manually, or refund.' });
      else toast.success('Booking updated');
      setNote('');
      await after(booking);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  };

  const cancelBooking = async () => {
    const reason = await prompt({
      title: 'Cancel & refund booking',
      description: `${inr(b.total)} will be refunded to ${user?.name || 'the traveller'} and the booking removed from their trip.`,
      label: 'Reason (shared with the traveller)',
      placeholder: 'e.g. Provider cancelled the stay due to flooding',
      confirmLabel: 'Cancel & refund',
      tone: 'danger',
      required: true,
      maxLength: 200,
    });
    if (reason === null) return;
    setBusy('cancel');
    try {
      const { booking } = await adminApi.post(`/admin/bookings/${b.id}/cancel`, { reason });
      toast.success(`Booking cancelled — ${inr(b.total)} refund initiated`);
      await after(booking);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  };

  const attention = b?.status === 'needs_attention';
  const cancellable = b && ['confirmed', 'requested'].includes(b.status);

  const footer = b && (attention || cancellable) && (
    <div className="space-y-3">
      {attention && (
        <>
          <div className="flex items-center gap-2 text-[12.5px] font-bold text-rose-700">
            <TriangleAlert className="size-4" /> Human-in-the-loop resolution
          </div>
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Internal note — e.g. Called the property, room confirmed under booking ID 4471" className="text-sm" />
          <div className="flex flex-wrap gap-2">
            <Button variant="success" size="sm" icon={CircleCheck} loading={busy === 'confirm'} disabled={!!busy} onClick={() => resolve('confirm')}>
              Confirm manually
            </Button>
            <Button variant="secondary" size="sm" icon={RefreshCw} loading={busy === 'retry'} disabled={!!busy} onClick={() => resolve('retry')}>
              Retry provider
            </Button>
            <Button variant="danger-soft" size="sm" icon={Undo2} loading={busy === 'cancel_refund'} disabled={!!busy} onClick={() => resolve('cancel_refund')} className="sm:ml-auto">
              Cancel & refund
            </Button>
          </div>
        </>
      )}
      {!attention && cancellable && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12.5px] text-muted">Cancelling refunds {inr(b.total)} to the traveller via UPI.</p>
          <Button variant="danger-soft" size="sm" icon={RotateCcw} loading={busy === 'cancel'} onClick={cancelBooking}>
            Cancel & refund
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <Drawer
      open={!!id}
      onClose={onClose}
      title={
        b ? (
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-sand text-2xl">{cat?.emoji || '🎫'}</span>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold leading-tight text-ink">{b.title}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12.5px] text-muted">
                <StatusBadge map={BOOKING_STATUS_ADMIN} value={b.status} />
                <span>{cat?.label || b.category}</span>
                <span>·</span>
                <span>{b.provider_name}</span>
              </div>
            </div>
          </div>
        ) : (
          <h2 className="text-lg font-bold text-ink">Booking</h2>
        )
      }
      footer={footer}
    >
      {!b && error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !b || (loading && !data) ? (
        <DrawerSkeleton />
      ) : (
        <div className="space-y-5">
          {attention && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <div className="flex items-center gap-2 text-[13px] font-bold text-rose-800">
                <TriangleAlert className="size-4" /> Needs attention · {timeAgo(b.updated_at)}
              </div>
              <p className="mt-1 text-[13.5px] text-rose-900/90">{b.failure_reason || 'The provider could not complete this booking.'}</p>
              <p className="mt-2 text-[12px] text-rose-900/70">The traveller has paid {inr(b.total)}. Confirm it with the provider manually, retry the connector, or cancel and refund.</p>
            </div>
          )}
          {!attention && b.failure_reason && b.status === 'cancelled' && (
            <div className="rounded-xl bg-sand px-4 py-3 text-[13px] text-ink/80">
              <b>Cancellation reason:</b> {b.failure_reason}
            </div>
          )}
          {b.resolution_note && (
            <div className="rounded-xl bg-plum-50 px-4 py-3 text-[13px] text-plum-900 ring-1 ring-plum-100">
              <b>Admin note:</b> {b.resolution_note}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MiniStat label="Amount" value={inr(b.amount)} />
            <MiniStat label="Conv. fee" value={inr(b.fee)} />
            <MiniStat label="Total paid" value={inr(b.total)} />
            <MiniStat label="Commission" value={inr(b.commission)} />
          </div>

          <dl className="grid gap-x-5 gap-y-3 text-[13.5px] sm:grid-cols-2">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted">Scheduled for</dt>
              <dd className="mt-0.5 font-medium text-ink">{b.scheduled_at ? fmtDateTime(b.scheduled_at) : '—'}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted">Provider reference</dt>
              <dd className="mt-0.5 font-medium text-ink">
                <CopyText value={b.provider_ref} />
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted">Created</dt>
              <dd className="mt-0.5 font-medium text-ink">
                {fmtDateTime(b.created_at)} <span className="text-muted">· via {b.source}</span>
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted">Booking ID</dt>
              <dd className="mt-0.5 font-medium text-ink">
                <CopyText value={b.id} />
              </dd>
            </div>
          </dl>

          <Section title="Traveller & trip">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-line p-3">
                {user ? (
                  <>
                    <UserCell user={user} sub={user.phone || user.email} to={`/admin/users/${user.id}`} size={36} />
                    {user.emergency_phone && (
                      <p className="mt-2 text-[12px] text-muted">
                        Emergency: {user.emergency_name} · {user.emergency_phone}
                      </p>
                    )}
                  </>
                ) : (
                  <span className="text-sm text-muted">Traveller account deleted</span>
                )}
              </div>
              <div className="rounded-xl border border-line p-3">
                {trip ? (
                  <Link to={`/admin/trips/${trip.id}`} className="block hover:text-plum-700">
                    <div className="truncate text-[13.5px] font-semibold text-ink">{trip.name}</div>
                    <div className="text-[12px] text-muted">
                      {trip.destination} · {fmtRange(trip.start_date, trip.end_date)}
                    </div>
                  </Link>
                ) : (
                  <span className="text-sm text-muted">Not attached to a trip</span>
                )}
              </div>
            </div>
          </Section>

          <Section title="Booking details">
            <BookingDetails booking={b} />
          </Section>

          <Section title={`Payments (${data.payments?.length || 0})`}>
            {data.payments?.length ? (
              <ul className="divide-y divide-line/70 rounded-xl border border-line">
                {data.payments.map((p) => {
                  const meta = parseMaybeJson(p.meta);
                  return (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <StatusBadge map={PAYMENT_PURPOSE} value={p.purpose} />
                          <StatusBadge map={PAYMENT_STATUS} value={p.status} />
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[12px] text-muted">
                          <span>UPI ref</span> <CopyText value={p.upi_ref} />
                          {p.upi_app && <span>· {UPI_APPS[p.upi_app]?.label || p.upi_app}</span>}
                          <span>· {fmtDateTime(p.created_at)}</span>
                        </div>
                        {meta.reason && <div className="mt-0.5 text-[12px] text-muted">“{meta.reason}”</div>}
                      </div>
                      <span className={cx('font-display text-[16px] font-extrabold tabular-nums', p.purpose === 'refund' ? 'text-rose-600' : 'text-ink')}>
                        {p.purpose === 'refund' ? '−' : ''}
                        {inr(p.amount)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted">No money has moved for this booking yet.</p>
            )}
          </Section>

          <Section title="Audit trail" action={<Badge tone="plum">{data.audit?.length || 0} events</Badge>}>
            <AuditTimeline audit={data.audit} user={user} />
          </Section>

          <details className="group rounded-xl border border-line bg-paper/60">
            <summary className="cursor-pointer select-none px-4 py-2.5 text-[12.5px] font-semibold text-muted hover:text-ink">Raw booking JSON</summary>
            <pre className="scrollbar-thin max-h-72 overflow-auto border-t border-line px-4 py-3 font-mono text-[11.5px] leading-relaxed text-ink/80">{JSON.stringify(b, null, 2)}</pre>
          </details>
        </div>
      )}
    </Drawer>
  );
}
