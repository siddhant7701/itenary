import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, Clock, Loader2, ShieldCheck, Star, XCircle } from 'lucide-react';
import { Badge, Button, Modal, Spinner, useConfirm } from './ui';
import UpiPaySheet from './UpiPaySheet';
import { api } from '../lib/api';
import { BOOKING_STATUS, CATEGORY, fmtDateTime, inr, timeAgo } from '../lib/format';

export function StatusBadge({ status }) {
  const s = BOOKING_STATUS[status] || { label: status, tone: 'neutral' };
  const Icon = status === 'requested' ? Loader2 : status === 'confirmed' ? CheckCircle2 : status === 'needs_attention' ? AlertTriangle : status === 'cancelled' ? XCircle : status === 'proposed' ? Clock : null;
  return (
    <Badge tone={s.tone}>
      {Icon && <Icon className={clsx('size-3', status === 'requested' && 'animate-spin')} />}
      {s.label}
    </Badge>
  );
}

export function CategoryTile({ category, size = 44 }) {
  const c = CATEGORY[category] || { emoji: '🎫', color: '#6b6178' };
  return (
    <span className="grid shrink-0 place-items-center rounded-xl" style={{ width: size, height: size, background: `${c.color}14`, fontSize: size * 0.48 }}>
      {c.emoji}
    </span>
  );
}

export default function BookingRow({ booking: b, compact = false, showTrip = false }) {
  const d = b.details || {};
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <CategoryTile category={b.category} size={compact ? 40 : 44} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[14.5px] font-semibold">{b.title}</span>
        </div>
        <div className="truncate text-[12.5px] text-muted">
          {showTrip && b.trip_name ? `${b.trip_name} · ` : ''}
          {b.scheduled_at ? fmtDateTime(b.scheduled_at) : ''}
          {!compact && d.subtitle ? ` · ${d.subtitle.split(' · ').slice(0, 2).join(' · ')}` : ''}
        </div>
      </div>
      {!compact && (
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-sm font-bold">{inr(b.total)}</span>
          <StatusBadge status={b.status} />
        </div>
      )}
    </div>
  );
}

function DetailLine({ label, value }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="flex justify-between gap-4 py-1.5 text-[13.5px]">
      <span className="text-muted">{label}</span>
      <span className="text-right font-semibold">{value}</span>
    </div>
  );
}

const AUDIT_LABEL = {
  proposed: 'Yatri proposed this booking',
  confirmed: 'Approved & paid via UPI',
  executed: 'Confirmed by provider',
  failed: 'Provider hit a problem — sent to a specialist',
  resolved: 'Resolved by Itenary support',
  cancelled: 'Cancelled & refunded',
  dismissed: 'Dismissed',
};

/** Full booking details: provider info, payment refs and the audit trail. */
export function BookingDetailModal({ bookingId, open, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const confirm = useConfirm();

  useEffect(() => {
    if (!open || !bookingId) return;
    setData(null);
    api.get(`/bookings/${bookingId}`).then(setData).catch((e) => toast.error(e.message));
  }, [open, bookingId]);

  const b = data?.booking;
  const d = b?.details || {};

  async function cancel() {
    const ok = await confirm({ title: 'Cancel this booking?', description: b.status === 'proposed' ? 'This proposal will be dismissed.' : `You’ll be refunded ${inr(b.total)} to your UPI account in 3–5 working days.`, confirmLabel: 'Cancel booking', tone: 'danger' });
    if (!ok) return;
    setBusy(true);
    try {
      await api.post(`/bookings/${b.id}/cancel`, {});
      toast.success(b.status === 'proposed' ? 'Proposal dismissed' : 'Booking cancelled — refund initiated');
      onChanged?.();
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={b ? b.title : 'Booking'} description={b ? `${b.provider_name}${b.provider_ref ? ' · ' + b.provider_ref : ''}` : ''} size="md">
      {!b ? (
        <div className="grid h-40 place-items-center"><Spinner /></div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center justify-between rounded-2xl bg-paper p-4">
            <div className="flex items-center gap-3">
              <CategoryTile category={b.category} />
              <div>
                <div className="font-display text-2xl font-extrabold">{inr(b.total)}</div>
                <div className="text-xs text-muted">{inr(b.amount)} + {inr(b.fee)} convenience fee</div>
              </div>
            </div>
            <StatusBadge status={b.status} />
          </div>

          {b.status === 'needs_attention' && (
            <div className="flex gap-3 rounded-2xl bg-rose-50 p-4 text-[13.5px] text-rose-900">
              <AlertTriangle className="mt-0.5 size-5 shrink-0" />
              <div><span className="font-bold">{b.failure_reason}.</span> Your payment is safe — an Itenary specialist is fixing this now and will confirm or fully refund you.</div>
            </div>
          )}

          {b.category === 'cab' && b.status === 'confirmed' && d.driver_name && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Your driver</div>
                  <div className="mt-0.5 text-lg font-bold">{d.driver_name} <span className="text-sm font-semibold text-muted"><Star className="inline size-3.5 fill-marigold-400 text-marigold-400" /> {d.driver_rating}</span></div>
                  <div className="text-sm text-muted">{d.vehicle_model} · <span className="font-mono font-semibold text-ink">{d.vehicle_plate}</span></div>
                </div>
                <div className="text-center">
                  <div className="text-[11px] font-semibold uppercase text-muted">Ride OTP</div>
                  <div className="font-mono text-2xl font-extrabold tracking-widest text-emerald-700">{d.ride_otp}</div>
                </div>
              </div>
              {d.driver_phone && <a href={`tel:${d.driver_phone.replace(/\s/g, '')}`} className="mt-3 inline-block text-sm font-semibold text-emerald-700 hover:underline">Call {d.driver_phone}</a>}
            </div>
          )}

          <div className="divide-y divide-line rounded-2xl border border-line px-4 py-1">
            <DetailLine label="When" value={b.scheduled_at && fmtDateTime(b.scheduled_at)} />
            <DetailLine label="Pickup" value={d.pickup} />
            <DetailLine label="Drop" value={d.drop} />
            <DetailLine label="Distance" value={d.km && `${d.km} km · ~${d.minutes} min`} />
            <DetailLine label="Vehicle" value={d.vehicle_class && `${d.vehicle_class} (${d.seats} seats)`} />
            <DetailLine label="Property" value={d.property} />
            <DetailLine label="Stay" value={d.check_in && `${d.check_in} → ${d.check_out} · ${d.nights} night${d.nights > 1 ? 's' : ''}`} />
            <DetailLine label="Room type" value={d.tier && `${d.tier} · ${d.units} ${d.tier === 'Hostel dorm' ? 'bed' : 'room'}${d.units > 1 ? 's' : ''}`} />
            <DetailLine label="Confirmation" value={d.confirmation_code || d.ticket_code} />
            <DetailLine label="Restaurant" value={d.restaurant && `${d.restaurant} · ${d.cuisine}`} />
            <DetailLine label="Order" value={d.dishes && d.dishes.join(', ') + ` for ${d.party_size}`} />
            <DetailLine label="Rider" value={d.rider_name && `${d.rider_name} · ETA ${d.eta_minutes} min`} />
            <DetailLine label="Venue" value={d.venue && `${d.venue}, ${d.city}`} />
            <DetailLine label="Tickets" value={d.quantity && `${d.quantity} × ${inr(d.unit_price)}`} />
          </div>

          {data.payments?.length > 0 && (
            <div>
              <div className="label">Payments</div>
              <div className="space-y-1.5">
                {data.payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-xl bg-paper px-3 py-2 text-[13px]">
                    <span className="capitalize">{p.purpose} · <span className="font-mono text-muted">UPI {p.upi_ref}</span></span>
                    <span className={clsx('font-bold', p.purpose === 'refund' && 'text-emerald-700')}>{p.purpose === 'refund' ? '+' : ''}{inr(p.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.audit?.length > 0 && (
            <div>
              <div className="label flex items-center gap-1.5"><ShieldCheck className="size-4 text-plum-600" /> Audit trail</div>
              <ol className="relative ml-2 space-y-3 border-l-2 border-plum-100 pl-5">
                {data.audit.map((a, i) => (
                  <li key={i} className="relative text-[13px]">
                    <span className={clsx('absolute -left-[27px] top-1 size-3 rounded-full ring-4 ring-white', a.action === 'failed' ? 'bg-rose-500' : a.action === 'executed' ? 'bg-emerald-500' : 'bg-plum-500')} />
                    <div className="font-semibold">{AUDIT_LABEL[a.action] || a.action}</div>
                    <div className="text-xs text-muted">{a.user_name ? `${a.user_name} · ` : ''}{timeAgo(a.created_at)}{a.detail?.reason ? ` · ${a.detail.reason}` : ''}{a.detail?.note ? ` · ${a.detail.note}` : ''}</div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {['proposed', 'requested', 'confirmed', 'needs_attention'].includes(b.status) && (
            <Button variant="danger-soft" className="w-full" loading={busy} onClick={cancel}>{b.status === 'proposed' ? 'Dismiss proposal' : 'Cancel & refund'}</Button>
          )}
        </div>
      )}
    </Modal>
  );
}

/** A booking proposal card (from Yatri or manual search) with the confirm-before-pay flow. */
export function ProposalCard({ booking: b, onChanged, tripLimit }) {
  const [paying, setPaying] = useState(false);
  const [details, setDetails] = useState(false);
  const [busy, setBusy] = useState(false);
  const d = b.details || {};
  const expired = b.status === 'proposed' && Date.now() - new Date(b.created_at).getTime() > 30 * 60 * 1000;
  const overLimit = tripLimit && b.total > tripLimit;

  async function dismiss() {
    setBusy(true);
    try {
      await api.post(`/bookings/${b.id}/cancel`, {});
      onChanged?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={clsx('rounded-2xl border bg-white p-3.5 shadow-soft transition', b.status === 'proposed' ? 'border-plum-200' : b.status === 'confirmed' ? 'border-emerald-200' : b.status === 'needs_attention' ? 'border-rose-200' : 'border-line')}>
      <div className="flex items-start gap-3">
        <CategoryTile category={b.category} size={40} />
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-bold leading-snug">{b.title}</div>
          <div className="mt-0.5 line-clamp-2 text-[12px] text-muted">{d.subtitle}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11.5px] text-muted">
            <span className="font-semibold text-ink/70">{b.provider_name}</span>
            {d.rating && <span>· ⭐ {d.rating}</span>}
            {b.scheduled_at && <span>· {fmtDateTime(b.scheduled_at)}</span>}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[15px] font-extrabold">{inr(b.total)}</div>
          <div className="text-[10.5px] text-muted">incl. {inr(b.fee)} fee</div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <StatusBadge status={expired ? 'cancelled' : b.status} />
        {b.status === 'proposed' && !expired ? (
          <div className="flex gap-1.5">
            <Button size="xs" variant="ghost" loading={busy} onClick={dismiss}>Dismiss</Button>
            <Button size="xs" onClick={() => setPaying(true)} disabled={overLimit} title={overLimit ? 'Above the trip’s per-booking limit' : undefined}>Review & pay</Button>
          </div>
        ) : (
          <Button size="xs" variant="ghost" onClick={() => setDetails(true)}>Details</Button>
        )}
      </div>
      {overLimit && b.status === 'proposed' && <p className="mt-2 text-[11.5px] font-medium text-rose-600">Above this trip’s per-booking limit of {inr(tripLimit)}.</p>}
      <UpiPaySheet
        open={paying}
        onClose={() => setPaying(false)}
        amount={b.total}
        title="Review & pay"
        lines={[
          { label: 'Booking', value: b.title.length > 32 ? b.title.slice(0, 30) + '…' : b.title },
          { label: 'Provider', value: b.provider_name },
          b.scheduled_at && { label: 'When', value: fmtDateTime(b.scheduled_at) },
          { label: 'Price', value: inr(b.amount) },
          { label: 'Convenience fee', value: inr(b.fee) },
        ].filter(Boolean)}
        note="Yatri will send this to the provider only after your payment is authorised. If anything fails, a specialist steps in — you’re never charged silently."
        onPay={(auth) => api.post(`/bookings/${b.id}/confirm`, auth)}
        onDone={() => {
          toast.success('Paid! Confirming with the provider…');
          onChanged?.();
        }}
      />
      <BookingDetailModal bookingId={b.id} open={details} onClose={() => setDetails(false)} onChanged={onChanged} />
    </div>
  );
}
