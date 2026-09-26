import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { Eye, EyeOff, Flag, MessageSquareWarning, Trash2 } from 'lucide-react';
import { Avatar, Badge, Button, EmptyState, ErrorState, PageHeader, Stars, Tabs, useConfirm, cx } from '../../components/ui';
import { adminApi } from '../../lib/api';
import { useFetch } from '../../lib/hooks';
import { fmtDate, timeAgo } from '../../lib/format';
import { REVIEW_STATUS, SearchBox, StatusBadge, useAdmin, useQueryParams } from './kit';

const DEFAULTS = { tab: 'all', q: '' };

export default function Reviews() {
  const [f, setF] = useQueryParams(DEFAULTS);
  const { data, loading, error, reload, setData } = useFetch('/admin/reviews', { scope: 'admin' });
  const { refresh } = useAdmin();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(null);

  const reviews = data?.reviews || [];
  const counts = useMemo(() => ({ flagged: reviews.filter((r) => r.status === 'flagged').length, hidden: reviews.filter((r) => r.status === 'hidden').length, visible: reviews.filter((r) => r.status === 'visible').length }), [reviews]);
  const shown = useMemo(() => {
    const q = f.q.toLowerCase();
    return reviews.filter((r) => (f.tab === 'all' || r.status === f.tab) && (!q || `${r.text} ${r.user_name} ${r.itinerary_title}`.toLowerCase().includes(q)));
  }, [reviews, f.tab, f.q]);

  const setStatus = async (r, status) => {
    setBusy(r.id);
    try {
      await adminApi.patch(`/admin/reviews/${r.id}`, { status });
      setData((d) => ({ ...d, reviews: d.reviews.map((x) => (x.id === r.id ? { ...x, status, report_count: status === 'visible' ? 0 : x.report_count } : x)) }));
      toast.success(status === 'hidden' ? 'Review hidden from the itinerary page' : 'Review restored');
      refresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  };

  const remove = async (r) => {
    if (!(await confirm({ title: 'Delete this review permanently?', description: `${r.user_name}’s ${r.rating}★ review on “${r.itinerary_title}” will be deleted and the rating recalculated.`, confirmLabel: 'Delete review', tone: 'danger' }))) return;
    setBusy(r.id);
    try {
      await adminApi.del(`/admin/reviews/${r.id}`);
      setData((d) => ({ ...d, reviews: d.reviews.filter((x) => x.id !== r.id) }));
      toast.success('Review deleted');
      refresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PageHeader title="Reviews" subtitle="Reviews reported three or more times are flagged automatically. Hide spam and abuse; restore anything flagged unfairly." />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs
          value={f.tab}
          onChange={(tab) => setF({ tab })}
          tabs={[
            { id: 'all', label: 'All', count: reviews.length },
            { id: 'flagged', label: 'Flagged', icon: Flag, count: counts.flagged },
            { id: 'visible', label: 'Visible', count: counts.visible },
            { id: 'hidden', label: 'Hidden', count: counts.hidden },
          ]}
        />
        <SearchBox value={f.q} onChange={(q) => setF({ q })} placeholder="Search text, reviewer or itinerary" className="lg:w-80" />
      </div>

      {error && !data ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading && !data ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-40 rounded-2xl" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <EmptyState icon={MessageSquareWarning} title={f.tab === 'flagged' ? 'No flagged reviews' : 'No reviews found'} description={f.tab === 'flagged' ? 'The community hasn’t reported anything. Nice.' : 'Try another tab or search.'} />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {shown.map((r) => (
            <article key={r.id} className={cx('card flex flex-col p-4', r.status === 'flagged' && 'border-rose-200 bg-rose-50/30', r.status === 'hidden' && 'opacity-75')}>
              <div className="flex items-start justify-between gap-3">
                <Link to={`/admin/users/${r.user_id}`} className="flex min-w-0 items-center gap-2.5 hover:text-plum-700">
                  <Avatar user={{ id: r.user_id, name: r.user_name }} size={34} />
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-semibold text-ink">{r.user_name}</span>
                    <span className="block text-[12px] text-muted" title={fmtDate(r.created_at)}>
                      {timeAgo(r.created_at)}
                    </span>
                  </span>
                </Link>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <StatusBadge map={REVIEW_STATUS} value={r.status} />
                  {r.report_count > 0 && (
                    <Badge tone="red" icon={Flag}>
                      {r.report_count} report{r.report_count === 1 ? '' : 's'}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Stars value={r.rating} />
                <a href={`/app/itineraries/${r.itinerary_id}`} target="_blank" rel="noreferrer" className="truncate text-[12.5px] font-semibold text-plum-700 hover:underline">
                  {r.itinerary_title}
                </a>
              </div>
              <p className={cx('mt-2 flex-1 text-[14px] leading-relaxed text-ink/85', !r.text && 'italic text-muted')}>{r.text || 'No written review — rating only.'}</p>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-line/70 pt-3">
                {r.status === 'hidden' || r.status === 'flagged' ? (
                  <Button size="xs" variant="soft" icon={Eye} loading={busy === r.id} onClick={() => setStatus(r, 'visible')}>
                    {r.status === 'flagged' ? 'Keep (clear reports)' : 'Restore'}
                  </Button>
                ) : null}
                {r.status !== 'hidden' && (
                  <Button size="xs" variant={r.status === 'flagged' ? 'danger' : 'secondary'} icon={EyeOff} loading={busy === r.id} onClick={() => setStatus(r, 'hidden')}>
                    Hide
                  </Button>
                )}
                <Button size="xs" variant="ghost" icon={Trash2} disabled={busy === r.id} onClick={() => remove(r)} className="ml-auto text-rose-600 hover:bg-rose-50 hover:text-rose-700">
                  Delete
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
