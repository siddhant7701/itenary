import { useNavigate } from 'react-router';
import { Luggage } from 'lucide-react';
import { EmptyState, ErrorState, PageHeader } from '../../components/ui';
import { useFetch } from '../../lib/hooks';
import { fmtRange, inr, timeAgo } from '../../lib/format';
import DataTable from './DataTable';
import { FilterBar, FilterSelect, Pagination, SearchBox, StatusBadge, TRIP_STATUS, qs, useQueryParams } from './kit';

const DEFAULTS = { q: '', status: '', page: 1 };
const LIMIT = 25;
const STATUS_OPTIONS = [{ value: '', label: 'All statuses' }, ...Object.entries(TRIP_STATUS).map(([value, s]) => ({ value, label: s.label }))];

export default function Trips() {
  const navigate = useNavigate();
  const [f, setF] = useQueryParams(DEFAULTS);
  const { data, loading, error, reload } = useFetch(`/admin/trips${qs({ q: f.q, status: f.status, page: f.page, limit: LIMIT })}`, { scope: 'admin' });
  const filtered = f.q || f.status;

  const columns = [
    {
      key: 'name',
      header: 'Trip',
      mobile: 'title',
      render: (t) => (
        <div className="min-w-0 max-w-[300px]">
          <div className="truncate font-semibold text-ink">{t.name}</div>
          <div className="truncate text-xs text-muted">📍 {t.destination || 'No destination'}</div>
        </div>
      ),
    },
    { key: 'owner_name', header: 'Owner', render: (t) => <span className="block max-w-[160px] truncate text-ink/85">{t.owner_name || '—'}</span> },
    { key: 'member_count', header: 'Members', align: 'right', render: (t) => <span className="tabular-nums">{t.member_count}</span> },
    { key: 'item_count', header: 'Plan items', align: 'right', render: (t) => <span className="tabular-nums">{t.item_count}</span> },
    { key: 'booked_total', header: 'Booked', align: 'right', render: (t) => <span className="font-semibold tabular-nums">{t.booked_total ? inr(t.booked_total) : <span className="font-normal text-muted">—</span>}</span> },
    { key: 'budget', header: 'Budget', align: 'right', render: (t) => <span className="tabular-nums text-muted">{t.budget ? inr(t.budget) : '—'}</span> },
    { key: 'dates', header: 'Dates', render: (t) => <span className="whitespace-nowrap text-ink/80">{fmtRange(t.start_date, t.end_date)}</span> },
    { key: 'status', header: 'Status', render: (t) => <StatusBadge map={TRIP_STATUS} value={t.status} /> },
    { key: 'updated_at', header: 'Last activity', render: (t) => <span className="whitespace-nowrap text-muted">{timeAgo(t.updated_at)}</span> },
  ];

  return (
    <div>
      <PageHeader title="Trips" subtitle={data ? `${data.total.toLocaleString('en-IN')} ${filtered ? 'matching trips' : 'trips planned on Itenary'}` : 'Every group trip on the platform'} />
      <FilterBar>
        <SearchBox value={f.q} onChange={(q) => setF({ q })} placeholder="Search trip name or destination" className="sm:w-80" />
        <FilterSelect label="Status" value={f.status} onChange={(status) => setF({ status })} options={STATUS_OPTIONS} />
      </FilterBar>
      {error && !data ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={data?.trips}
            loading={loading}
            onRowClick={(t) => navigate(`/admin/trips/${t.id}`)}
            empty={<EmptyState icon={Luggage} title="No trips found" description={filtered ? 'Try a different search or status.' : 'Trips will appear here as travellers plan them.'} />}
          />
          <Pagination page={f.page} limit={LIMIT} total={data?.total || 0} onChange={(page) => setF({ page })} />
        </>
      )}
    </div>
  );
}
