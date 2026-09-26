import { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { CircleCheck, Clock, PartyPopper, RefreshCw, Ticket, TriangleAlert, Undo2 } from 'lucide-react';
import { Button, EmptyState, ErrorState, PageHeader, Tabs, useConfirm, cx } from '../../components/ui';
import { adminApi } from '../../lib/api';
import { useFetch } from '../../lib/hooks';
import { useSocketEvent } from '../../lib/socket';
import { CATEGORY, fmtDateTime, inr, timeAgo } from '../../lib/format';
import DataTable from './DataTable';
import BookingDrawer from './BookingDrawer';
import { BOOKING_STATUS_ADMIN, FilterBar, FilterSelect, Pagination, SearchBox, StatusBadge, UserCell, qs, useAdmin, useQueryParams } from './kit';

const DEFAULTS = { tab: '', status: '', category: '', q: '', page: 1, open: '' };
const LIMIT = 30;

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  ...Object.entries(BOOKING_STATUS_ADMIN).map(([value, s]) => ({ value, label: s.label })),
];
const CATEGORY_OPTIONS = [{ value: '', label: 'All categories' }, ...Object.entries(CATEGORY).map(([value, c]) => ({ value, label: `${c.emoji} ${c.label}` }))];

function AttentionCard({ b, onOpen, onDone }) {
  const [busy, setBusy] = useState(null);
  const confirm = useConfirm();
  const cat = CATEGORY[b.category];
  const act = async (action) => {
    if (action === 'cancel_refund') {
      const ok = await confirm({ title: 'Cancel and refund?', description: `${inr(b.total)} will be refunded to ${b.user_name || 'the traveller'} over UPI.`, confirmLabel: 'Cancel & refund', tone: 'danger' });
      if (!ok) return;
    }
    setBusy(action);
    try {
      const { booking } = await adminApi.post(`/admin/bookings/${b.id}/resolve`, { action });
      if (booking?.status === 'confirmed') toast.success(`Confirmed: ${b.title}`);
      else if (booking?.status === 'cancelled') toast.success(`Cancelled — ${inr(b.total)} refund initiated`);
      else toast.warning('Provider failed again', { description: booking?.failure_reason });
      onDone();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  };
  return (
    <article className="card flex flex-col overflow-hidden border-rose-200/80">
      <div className="flex items-start gap-3 p-4 pb-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-rose-50 text-2xl">{cat?.emoji || '🎫'}</span>
        <div className="min-w-0 flex-1">
          <button onClick={onOpen} className="block max-w-full truncate text-left text-[15px] font-bold text-ink hover:text-plum-700">
            {b.title}
          </button>
          <div className="mt-0.5 truncate text-[12.5px] text-muted">
            {b.provider_name} · {b.trip_name || 'No trip'}
          </div>
        </div>
        <div className="text-right">
          <div className="font-display text-lg font-extrabold tabular-nums text-ink">{inr(b.total)}</div>
          <div className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-rose-600">
            <Clock className="size-3" /> {timeAgo(b.updated_at)}
          </div>
        </div>
      </div>
      <div className="mx-4 rounded-xl bg-rose-50 px-3 py-2 text-[13px] text-rose-900 ring-1 ring-rose-100">
        <TriangleAlert className="mr-1.5 inline size-3.5 -translate-y-px text-rose-600" />
        {b.failure_reason || 'Provider could not complete the booking'}
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <UserCell name={b.user_name} user={{ id: b.user_id, name: b.user_name }} sub={b.user_phone} to={b.user_id ? `/admin/users/${b.user_id}` : undefined} size={28} />
        {b.scheduled_at && <span className="shrink-0 text-[12px] text-muted">For {fmtDateTime(b.scheduled_at)}</span>}
      </div>
      <div className="mt-auto flex flex-wrap gap-2 border-t border-line/80 bg-paper/60 px-4 py-3">
        <Button size="sm" variant="success" icon={CircleCheck} loading={busy === 'confirm'} disabled={!!busy} onClick={() => act('confirm')}>
          Confirm manually
        </Button>
        <Button size="sm" variant="secondary" icon={RefreshCw} loading={busy === 'retry'} disabled={!!busy} onClick={() => act('retry')}>
          Retry
        </Button>
        <Button size="sm" variant="danger-soft" icon={Undo2} loading={busy === 'cancel_refund'} disabled={!!busy} onClick={() => act('cancel_refund')}>
          Refund
        </Button>
        <Button size="sm" variant="ghost" onClick={onOpen} className="ml-auto">
          Details & note
        </Button>
      </div>
    </article>
  );
}

export default function Bookings() {
  const { queues, stats, refresh } = useAdmin();
  const [f, setF] = useQueryParams(DEFAULTS);
  const tab = f.tab || (f.status || f.open ? 'all' : stats && queues.needs_attention > 0 ? 'attention' : 'all');
  const attention = tab === 'attention';

  const path = attention
    ? `/admin/bookings${qs({ status: 'needs_attention', category: f.category, q: f.q, limit: 100 })}`
    : `/admin/bookings${qs({ status: f.status, category: f.category, q: f.q, page: f.page, limit: LIMIT })}`;
  const { data, loading, error, reload } = useFetch(path, { scope: 'admin' });

  const timer = useRef(null);
  const reloadSoon = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => reload(), 600);
  }, [reload]);
  useSocketEvent('booking', reloadSoon, { admin: true });
  useSocketEvent('attention', reloadSoon, { admin: true });

  const filtered = f.status || f.category || f.q;

  const columns = [
    {
      key: 'title',
      header: 'Booking',
      mobile: 'title',
      render: (b) => (
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-sand text-lg">{CATEGORY[b.category]?.emoji || '🎫'}</span>
          <div className="min-w-0 max-w-[260px]">
            <div className="truncate font-semibold text-ink">{b.title}</div>
            <div className="truncate text-xs text-muted">
              {b.provider_name}
              {b.provider_ref ? ` · ${b.provider_ref}` : ''}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'user',
      header: 'Traveller',
      render: (b) => (
        <div className="min-w-0 max-w-[180px]">
          <div className="truncate font-medium text-ink">{b.user_name || '—'}</div>
          <div className="truncate text-xs text-muted">{b.user_phone}</div>
        </div>
      ),
    },
    { key: 'trip', header: 'Trip', render: (b) => <span className="block max-w-[160px] truncate text-ink/80">{b.trip_name || <span className="text-muted">—</span>}</span> },
    { key: 'total', header: 'Total', align: 'right', render: (b) => <span className="font-semibold tabular-nums">{inr(b.total)}</span> },
    {
      key: 'status',
      header: 'Status',
      render: (b) => (
        <div>
          <StatusBadge map={BOOKING_STATUS_ADMIN} value={b.status} />
          {b.status === 'needs_attention' && b.failure_reason && <div className="mt-1 max-w-[200px] truncate text-[11.5px] text-rose-600">{b.failure_reason}</div>}
        </div>
      ),
    },
    {
      key: 'scheduled_at',
      header: 'Scheduled',
      render: (b) => (
        <div className="whitespace-nowrap">
          <div className="text-ink/85">{b.scheduled_at ? fmtDateTime(b.scheduled_at) : '—'}</div>
          <div className="text-[11.5px] text-muted">updated {timeAgo(b.updated_at)}</div>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Bookings"
        subtitle="Every provider booking made through the AI concierge, with the human-in-the-loop queue for failures."
        actions={
          <Button variant="secondary" size="sm" icon={RefreshCw} onClick={() => reload()}>
            Refresh
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs
          value={tab}
          onChange={(t) => setF({ tab: t, status: '', page: 1 })}
          tabs={[
            { id: 'attention', label: 'Needs attention', icon: TriangleAlert, count: queues.needs_attention },
            { id: 'all', label: 'All bookings', icon: Ticket },
          ]}
          className={cx('rounded-2xl bg-sand/70 p-1', attention && queues.needs_attention > 0 && 'ring-2 ring-rose-200')}
        />
        <FilterBar className="mb-0">
          <SearchBox value={f.q} onChange={(q) => setF({ q })} placeholder="Search title, traveller, ID or ref" className="sm:w-72" />
          <div className="flex flex-wrap gap-2">
            {!attention && <FilterSelect label="Status" value={f.status} onChange={(status) => setF({ status, tab: 'all' })} options={STATUS_OPTIONS} />}
            <FilterSelect label="Category" value={f.category} onChange={(category) => setF({ category })} options={CATEGORY_OPTIONS} />
          </div>
        </FilterBar>
      </div>

      {error && !data ? (
        <ErrorState error={error} onRetry={reload} />
      ) : attention ? (
        <>
          {data && data.bookings.length > 0 && (
            <p className="mb-3 text-[13px] text-muted">
              These travellers have <b className="text-ink">already paid</b>. The provider failed after payment — confirm manually, retry, or refund. Oldest first matters.
            </p>
          )}
          {!data && loading ? (
            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="skeleton h-56 rounded-2xl" />
              ))}
            </div>
          ) : data?.bookings.length ? (
            <div className={cx('grid gap-3 md:grid-cols-2 2xl:grid-cols-3', loading && 'opacity-60')}>
              {[...data.bookings]
                .sort((a, b) => a.updated_at.localeCompare(b.updated_at))
                .map((b) => (
                  <AttentionCard
                    key={b.id}
                    b={b}
                    onOpen={() => setF({ open: b.id, tab: 'attention' })}
                    onDone={() => {
                      reload();
                      refresh();
                    }}
                  />
                ))}
            </div>
          ) : (
            <EmptyState
              icon={PartyPopper}
              title={filtered ? 'No matching bookings in the queue' : 'The queue is clear'}
              description="When a provider fails after a traveller has paid, the booking lands here for a human to resolve. You’ll get a live alert."
              action={
                <Button variant="secondary" onClick={() => setF({ tab: 'all' })}>
                  View all bookings
                </Button>
              }
            />
          )}
        </>
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={data?.bookings}
            loading={loading}
            onRowClick={(b) => setF({ open: b.id, page: f.page, tab: 'all' })}
            rowClassName={(b) => (b.status === 'needs_attention' ? 'bg-rose-50/50' : '')}
            empty={<EmptyState icon={Ticket} title="No bookings found" description={filtered ? 'Try a different filter.' : 'Bookings made by travellers will appear here.'} />}
          />
          <Pagination page={f.page} limit={LIMIT} total={data?.total || 0} onChange={(page) => setF({ page })} />
        </>
      )}

      <p className="mt-6 text-center text-[12.5px] text-muted">
        Looking for the AI decision log? See the <Link to="/admin/audit" className="font-semibold text-plum-700 hover:underline">audit trail</Link>.
      </p>

      <BookingDrawer
        id={f.open || null}
        onClose={() => setF({ open: '', page: f.page, tab })}
        onChanged={() => reload()}
      />
    </div>
  );
}
