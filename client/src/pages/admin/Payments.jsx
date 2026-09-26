import { useState } from 'react';
import { toast } from 'sonner';
import { ArrowRight, CreditCard, RotateCcw } from 'lucide-react';
import { Button, EmptyState, ErrorState, PageHeader, cx } from '../../components/ui';
import { adminApi } from '../../lib/api';
import { useFetch } from '../../lib/hooks';
import { UPI_APPS, fmtDateTime, inr, num } from '../../lib/format';
import DataTable from './DataTable';
import BookingDrawer from './BookingDrawer';
import { CopyText, FilterBar, FilterSelect, PAYMENT_PURPOSE, PAYMENT_STATUS, Pagination, SearchBox, StatusBadge, qs, useAdmin, usePrompt, useQueryParams } from './kit';

const DEFAULTS = { purpose: '', q: '', page: 1 };
const LIMIT = 40;
const REFUNDABLE = ['booking', 'purchase', 'tip', 'subscription', 'settlement'];
const PURPOSE_OPTIONS = [{ value: '', label: 'All purposes' }, ...Object.entries(PAYMENT_PURPOSE).map(([value, p]) => ({ value, label: p.label }))];
const OUTFLOW = new Set(['refund', 'payout']);
const SHORT = { booking: 'Bookings', purchase: 'Itinerary sales', tip: 'Tips', subscription: 'Plus', settlement: 'Settlements', refund: 'Refunds', payout: 'Payouts' };

function parties(p) {
  if (p.purpose === 'refund') return ['Itenary', p.user_name || 'Traveller'];
  if (p.purpose === 'payout') return ['Itenary', p.payee_name || 'Creator'];
  return [p.user_name || 'Deleted user', p.payee_name || (p.purpose === 'booking' ? 'Provider via Itenary' : 'Itenary')];
}

export default function Payments() {
  const [f, setF] = useQueryParams(DEFAULTS);
  const { data, loading, error, reload } = useFetch(`/admin/payments${qs({ purpose: f.purpose, q: f.q, page: f.page, limit: LIMIT })}`, { scope: 'admin' });
  const { refresh } = useAdmin();
  const prompt = usePrompt();
  const [busy, setBusy] = useState(null);
  const [openBooking, setOpenBooking] = useState(null);

  const totals = data?.totals || [];
  const inflow = totals.filter((t) => !OUTFLOW.has(t.purpose)).reduce((s, t) => s + t.amount, 0);
  const outflow = totals.filter((t) => OUTFLOW.has(t.purpose)).reduce((s, t) => s + t.amount, 0);

  const refund = async (p) => {
    const reason = await prompt({
      title: `Refund ${inr(p.amount)}?`,
      description:
        p.purpose === 'booking'
          ? 'This cancels the linked booking and refunds the traveller in full over UPI. They will be notified.'
          : `The ${PAYMENT_PURPOSE[p.purpose]?.label.toLowerCase() || 'payment'} will be reversed and ${p.user_name || 'the payer'} refunded over UPI.`,
      label: 'Reason (shared with the traveller)',
      placeholder: 'e.g. Duplicate payment',
      confirmLabel: 'Issue refund',
      tone: 'danger',
      maxLength: 200,
    });
    if (reason === null) return;
    setBusy(p.id);
    try {
      await adminApi.post(`/admin/payments/${p.id}/refund`, { reason: reason || undefined });
      toast.success(`Refund of ${inr(p.amount)} initiated`);
      reload();
      refresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  };

  const columns = [
    {
      key: 'purpose',
      header: 'Purpose',
      mobile: 'title',
      render: (p) => (
        <div className="flex items-center justify-between gap-2 md:block">
          <StatusBadge map={PAYMENT_PURPOSE} value={p.purpose} />
          {p.booking_id && (
            <button onClick={(e) => (e.stopPropagation(), setOpenBooking(p.booking_id))} className="mt-1 block text-[11.5px] font-semibold text-plum-700 hover:underline">
              View booking
            </button>
          )}
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (p) => (
        <span className={cx('font-display text-[15px] font-extrabold tabular-nums', OUTFLOW.has(p.purpose) ? 'text-rose-600' : 'text-ink')}>
          {OUTFLOW.has(p.purpose) ? '−' : ''}
          {inr(p.amount)}
        </span>
      ),
    },
    {
      key: 'parties',
      header: 'From → to',
      wide: true,
      render: (p) => {
        const [from, to] = parties(p);
        return (
          <div className="min-w-0 max-w-[280px]">
            <div className="flex items-center gap-1.5 text-[13px]">
              <span className="truncate font-medium text-ink">{from}</span>
              <ArrowRight className="size-3 shrink-0 text-muted" />
              <span className="truncate text-ink/80">{to}</span>
            </div>
            {(p.meta?.reason || p.meta?.upi_id) && <div className="truncate text-[11.5px] text-muted">{p.meta.reason ? `“${p.meta.reason}”` : p.meta.upi_id}</div>}
          </div>
        );
      },
    },
    {
      key: 'upi_ref',
      header: 'UPI ref',
      stop: true,
      render: (p) => (
        <div>
          <CopyText value={p.upi_ref} />
          {p.upi_app && <div className="text-[11.5px] text-muted">{UPI_APPS[p.upi_app]?.label || p.upi_app}</div>}
        </div>
      ),
    },
    { key: 'status', header: 'Status', render: (p) => <StatusBadge map={PAYMENT_STATUS} value={p.status} /> },
    { key: 'created_at', header: 'Date', render: (p) => <span className="whitespace-nowrap text-muted">{fmtDateTime(p.created_at)}</span> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      stop: true,
      render: (p) =>
        p.status === 'success' && REFUNDABLE.includes(p.purpose) ? (
          <Button size="xs" variant="danger-soft" icon={RotateCcw} loading={busy === p.id} onClick={() => refund(p)}>
            Refund
          </Button>
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader title="Payments" subtitle="Sandbox UPI ledger — every collection, refund and payout." />

      <div className="mb-5 grid gap-3 lg:grid-cols-[280px_1fr]">
        <div className="card flex flex-col justify-between gap-3 p-4">
          <div>
            <div className="text-[12.5px] font-semibold text-muted">Money in</div>
            <div className="font-display text-[26px] font-extrabold leading-tight text-ink">{inr(inflow)}</div>
          </div>
          <div className="border-t border-line/80 pt-3">
            <div className="text-[12.5px] font-semibold text-muted">Money out (refunds + payouts)</div>
            <div className="font-display text-xl font-extrabold leading-tight text-rose-600">−{inr(outflow)}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
          {Object.entries(PAYMENT_PURPOSE).map(([purpose, meta]) => {
            const t = totals.find((x) => x.purpose === purpose);
            const active = f.purpose === purpose;
            return (
              <button
                key={purpose}
                type="button"
                onClick={() => setF({ purpose: active ? '' : purpose })}
                className={cx('rounded-2xl border p-3 text-left transition', active ? 'border-plum-600 bg-plum-50 ring-2 ring-plum-100' : 'border-line bg-white hover:border-plum-200')}
              >
                <div className="truncate text-[12px] font-semibold text-muted" title={meta.label}>{SHORT[purpose] || meta.label}</div>
                <div className={cx('mt-0.5 font-display text-[17px] font-extrabold tabular-nums', OUTFLOW.has(purpose) ? 'text-rose-600' : 'text-ink')}>{t ? inr(t.amount, { compact: true }) : '₹0'}</div>
                <div className="text-[11.5px] text-muted">{t ? num(t.count) : 0} txns</div>
              </button>
            );
          })}
        </div>
      </div>

      <FilterBar>
        <SearchBox value={f.q} onChange={(q) => setF({ q })} placeholder="Search UPI ref, name or ID" className="sm:w-80" />
        <FilterSelect label="Purpose" value={f.purpose} onChange={(purpose) => setF({ purpose })} options={PURPOSE_OPTIONS} />
      </FilterBar>

      {error && !data ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <>
          <DataTable columns={columns} rows={data?.payments} loading={loading} empty={<EmptyState icon={CreditCard} title="No payments found" description={f.q || f.purpose ? 'Try a different filter.' : 'Payments appear as travellers book and buy.'} />} />
          <Pagination page={f.page} limit={LIMIT} total={data?.total || 0} onChange={(page) => setF({ page })} />
        </>
      )}

      <BookingDrawer id={openBooking} onClose={() => setOpenBooking(null)} onChanged={() => reload()} />
    </div>
  );
}
