import { useState } from 'react';
import { Link } from 'react-router';
import { Bot, ScrollText, ShieldUser } from 'lucide-react';
import { Badge, EmptyState, ErrorState, PageHeader, Tabs, cx } from '../../components/ui';
import { useFetch } from '../../lib/hooks';
import { fmtDateTime, timeAgo } from '../../lib/format';
import DataTable from './DataTable';
import BookingDrawer, { AUDIT_ACTIONS, auditSummary } from './BookingDrawer';
import { CopyText, Pagination, humanize, qs, useQueryParams } from './kit';

const DEFAULTS = { tab: 'ai', action: '', page: 1 };
const LIMIT = 50;

function When({ at }) {
  return (
    <div className="whitespace-nowrap">
      <div className="text-[13px] text-ink">{fmtDateTime(at)}</div>
      <div className="text-[11.5px] text-muted">{timeAgo(at)}</div>
    </div>
  );
}

function detailText(detail) {
  if (!detail || typeof detail !== 'object') return '';
  return Object.entries(detail)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${humanize(k)}: ${Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v) : v}`)
    .join(' · ');
}

function targetLink(log) {
  const [kind] = String(log.action).split('.');
  if (!log.target) return null;
  if (kind === 'user' || kind === 'admin') return `/admin/users/${log.target}`;
  if (kind === 'booking') return `/admin/bookings?open=${log.target}`;
  if (kind === 'itinerary') return `/app/itineraries/${log.target}`;
  if (kind === 'sos') return '/admin/safety';
  if (kind === 'payout') return '/admin/payouts';
  if (kind === 'provider') return '/admin/providers';
  if (kind === 'event') return '/admin/events';
  if (kind === 'review') return '/admin/reviews';
  return null;
}

const LOG_TONE = { delete: 'red', cancel: 'red', refund: 'marigold', rejected: 'red', suspended: 'red', create: 'green', paid: 'green', approved: 'blue', resolved: 'green', acknowledged: 'marigold', hide: 'neutral' };

function AiAudit({ f, setF }) {
  const [open, setOpen] = useState(null);
  const { data, loading, error, reload } = useFetch(`/admin/audit${qs({ action: f.action, page: f.page, limit: LIMIT })}`, { scope: 'admin' });
  const columns = [
    { key: 'created_at', header: 'When', render: (a) => <When at={a.created_at} /> },
    {
      key: 'action',
      header: 'Event',
      mobile: 'title',
      render: (a) => {
        const m = AUDIT_ACTIONS[a.action];
        return (
          <Badge tone={m?.tone || 'neutral'} icon={m?.icon}>
            {m?.label || humanize(a.action)}
          </Badge>
        );
      },
    },
    {
      key: 'booking',
      header: 'Booking',
      render: (a) => (a.booking_title ? <span className="block max-w-[220px] truncate font-semibold text-ink">{a.booking_title}</span> : <span className="text-muted">—</span>),
    },
    {
      key: 'detail',
      header: 'Detail',
      wide: true,
      render: (a) => <span className={cx('block max-w-[360px] text-[13px]', a.action === 'failed' ? 'text-rose-700' : 'text-ink/80')}>{auditSummary(a) || '—'}</span>,
    },
    { key: 'user_name', header: 'By', render: (a) => <span className="block max-w-[150px] truncate text-ink/85">{a.user_name || <span className="text-muted">System</span>}</span> },
    {
      key: 'trip',
      header: 'Trip',
      stop: true,
      render: (a) =>
        a.trip_id && a.trip_name ? (
          <Link to={`/admin/trips/${a.trip_id}`} className="block max-w-[180px] truncate text-plum-700 hover:underline">
            {a.trip_name}
          </Link>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
  ];
  return (
    <>
      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
        <button type="button" onClick={() => setF({ action: '' })} className={cx('chip shrink-0', !f.action && 'chip-active')}>
          All events
        </button>
        {Object.entries(AUDIT_ACTIONS).map(([k, m]) => {
          const Icon = m.icon;
          return (
            <button key={k} type="button" onClick={() => setF({ action: f.action === k ? '' : k })} className={cx('chip shrink-0', f.action === k && 'chip-active')}>
              <Icon className="size-3.5" /> {m.label}
            </button>
          );
        })}
      </div>
      {error && !data ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={data?.audit}
            loading={loading}
            onRowClick={(a) => a.booking_id && setOpen(a.booking_id)}
            rowClassName={(a) => (a.action === 'failed' ? 'bg-rose-50/40' : '')}
            empty={<EmptyState icon={Bot} title="No audit events" description={f.action ? 'No events of this type yet.' : 'Every concierge proposal, confirmation and provider result is logged here.'} />}
          />
          <Pagination page={f.page} limit={LIMIT} total={data?.total || 0} onChange={(page) => setF({ page })} />
        </>
      )}
      <BookingDrawer id={open} onClose={() => setOpen(null)} onChanged={() => reload()} />
    </>
  );
}

function AdminLogs({ f, setF }) {
  const { data, loading, error, reload } = useFetch(`/admin/logs${qs({ page: f.page, limit: LIMIT })}`, { scope: 'admin' });
  const columns = [
    { key: 'created_at', header: 'When', render: (l) => <When at={l.created_at} /> },
    { key: 'admin_name', header: 'Admin', mobile: 'title', render: (l) => <span className="font-semibold text-ink">{l.admin_name || 'Deleted admin'}</span> },
    {
      key: 'action',
      header: 'Action',
      render: (l) => {
        const verb = String(l.action).split('.').pop();
        return (
          <Badge tone={LOG_TONE[verb] || 'plum'} className="font-mono">
            {l.action}
          </Badge>
        );
      },
    },
    {
      key: 'target',
      header: 'Target',
      stop: true,
      render: (l) => {
        const to = targetLink(l);
        if (!l.target) return <span className="text-muted">—</span>;
        if (!to) return <CopyText value={l.target} />;
        return to.startsWith('/app') ? (
          <a href={to} target="_blank" rel="noreferrer" className="font-mono text-[12px] text-plum-700 hover:underline">
            {l.target}
          </a>
        ) : (
          <Link to={to} className="font-mono text-[12px] text-plum-700 hover:underline">
            {l.target}
          </Link>
        );
      },
    },
    { key: 'detail', header: 'Detail', wide: true, render: (l) => <span className="block max-w-[420px] text-[12.5px] text-ink/75">{detailText(l.detail) || '—'}</span> },
  ];
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  return (
    <>
      <DataTable columns={columns} rows={data?.logs} loading={loading} empty={<EmptyState icon={ShieldUser} title="No admin activity yet" description="Every change an admin makes is recorded here." />} />
      <Pagination page={f.page} limit={LIMIT} total={data?.total || 0} onChange={(page) => setF({ page })} />
    </>
  );
}

export default function Audit() {
  const [f, setF] = useQueryParams(DEFAULTS);
  return (
    <div>
      <PageHeader title="Audit trail" subtitle="Every proposal, payment confirmation and provider result from the AI concierge, plus every action taken by admins." />
      <Tabs
        className="mb-4"
        value={f.tab}
        onChange={(tab) => setF({ tab, action: '' })}
        tabs={[
          { id: 'ai', label: 'AI concierge audit', icon: Bot },
          { id: 'admin', label: 'Admin activity', icon: ScrollText },
        ]}
      />
      {f.tab === 'admin' ? <AdminLogs f={f} setF={setF} /> : <AiAudit f={f} setF={setF} />}
    </div>
  );
}
