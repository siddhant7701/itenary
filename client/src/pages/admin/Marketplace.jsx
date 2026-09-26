import { useState } from 'react';
import { toast } from 'sonner';
import { Ban, BadgeCheck, ExternalLink, EyeOff, IndianRupee, RotateCcw, Star, Store, Trash2 } from 'lucide-react';
import { EmptyState, ErrorState, Menu, PageHeader, Toggle, VerifiedBadge } from '../../components/ui';
import { adminApi } from '../../lib/api';
import { useFetch } from '../../lib/hooks';
import { inr, num } from '../../lib/format';
import DataTable from './DataTable';
import { ChipToggle, FilterBar, FilterSelect, ITINERARY_STATUS, MiniStat, SearchBox, StatusBadge, qs, usePrompt, useQueryParams } from './kit';

const DEFAULTS = { q: '', status: '', premium: '' };
const STATUS_OPTIONS = [{ value: '', label: 'All statuses' }, ...Object.entries(ITINERARY_STATUS).map(([value, s]) => ({ value, label: s.label }))];

export default function Marketplace() {
  const [f, setF] = useQueryParams(DEFAULTS);
  const { data, loading, error, reload, setData } = useFetch(`/admin/itineraries${qs({ q: f.q, status: f.status, premium: f.premium })}`, { scope: 'admin' });
  const prompt = usePrompt();
  const [busy, setBusy] = useState(null);

  const rows = data?.itineraries;
  const list = rows || [];

  const patch = async (it, body, success) => {
    const prev = data;
    setBusy(it.id);
    setData((d) => d && { ...d, itineraries: d.itineraries.map((x) => (x.id === it.id ? { ...x, ...body } : x)) });
    try {
      await adminApi.patch(`/admin/itineraries/${it.id}`, body);
      toast.success(success);
      if (body.status && f.status && body.status !== f.status) reload();
    } catch (err) {
      setData(prev);
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  };

  const setPrice = async (it) => {
    const v = await prompt({
      title: 'Set itinerary price',
      description: `Creators keep the majority of every sale. Use 0 to make “${it.title}” free.`,
      label: 'Price (₹, 0–2,999)',
      defaultValue: String(it.price ?? 0),
      multiline: false,
      type: 'number',
      required: true,
      confirmLabel: 'Save price',
    });
    if (v === null) return;
    const price = Math.round(Number(v));
    if (!Number.isFinite(price) || price < 0 || price > 2999) return toast.error('Price must be between ₹0 and ₹2,999');
    patch(it, { price }, price ? `Price set to ${inr(price)}` : 'Itinerary is now free');
  };

  const remove = async (it) => {
    const reason = await prompt({
      title: `Remove “${it.title}”?`,
      description: 'It disappears from the feed and search. The creator is notified with your reason. Existing buyers keep access to their forks.',
      label: 'Reason (sent to the creator)',
      placeholder: 'e.g. Contains misleading safety advice',
      confirmLabel: 'Remove itinerary',
      tone: 'danger',
      required: true,
      maxLength: 200,
    });
    if (reason === null) return;
    patch(it, { status: 'removed', reason }, 'Itinerary removed from the marketplace');
  };

  const columns = [
    {
      key: 'title',
      header: 'Itinerary',
      mobile: 'title',
      render: (i) => (
        <div className="min-w-0 max-w-[260px]">
          <a href={`/app/itineraries/${i.id}`} target="_blank" rel="noreferrer" className="group inline-flex max-w-full items-center gap-1 font-semibold text-ink hover:text-plum-700">
            <span className="truncate">{i.title}</span>
            <ExternalLink className="size-3 shrink-0 text-muted opacity-0 transition group-hover:opacity-100" />
          </a>
          <div className="truncate text-xs text-muted">
            📍 {i.destination} · {i.days_count} day{i.days_count === 1 ? '' : 's'}
            {i.tags?.length ? ` · ${i.tags.slice(0, 2).join(', ')}` : ''}
          </div>
        </div>
      ),
    },
    {
      key: 'creator',
      header: 'Creator',
      render: (i) => (
        <span className="inline-flex max-w-[140px] items-center gap-1 text-ink/85">
          <span className="truncate">{i.creator_name}</span>
          {i.creator_verified && <VerifiedBadge className="size-3.5" />}
        </span>
      ),
    },
    { key: 'price', header: 'Price', align: 'right', render: (i) => (i.price ? <span className="font-semibold tabular-nums">{inr(i.price)}</span> : <span className="text-muted">Free</span>) },
    {
      key: 'performance',
      header: 'Forks · sales',
      align: 'right',
      render: (i) => (
        <div className="whitespace-nowrap">
          <div className="tabular-nums text-ink">
            {num(i.fork_count)} · {num(i.sales_count)}
          </div>
          <div className="text-[11.5px] tabular-nums text-muted">{i.gross ? `${inr(i.gross)} gross` : 'no sales'}</div>
        </div>
      ),
    },
    {
      key: 'rating',
      header: 'Rating',
      render: (i) =>
        i.rating_count ? (
          <span className="inline-flex items-center gap-1 whitespace-nowrap">
            <Star className="size-3.5 fill-marigold-400 text-marigold-400" />
            <b className="tabular-nums">{Number(i.rating_avg).toFixed(1)}</b>
            <span className="text-muted">({i.rating_count})</span>
          </span>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    { key: 'status', header: 'Status', render: (i) => <StatusBadge map={ITINERARY_STATUS} value={i.status} /> },
    { key: 'featured', header: 'Featured', align: 'center', stop: true, render: (i) => <Toggle checked={i.featured} disabled={busy === i.id || i.status !== 'published'} onChange={(v) => patch(i, { featured: v }, v ? 'Featured on the feed' : 'Removed from featured')} /> },
    {
      key: 'verified_premium',
      header: 'Verified',
      align: 'center',
      stop: true,
      render: (i) => <Toggle checked={i.verified_premium} disabled={busy === i.id || i.status !== 'published'} onChange={(v) => patch(i, { verified_premium: v }, v ? 'Marked Verified Premium' : 'Verified Premium removed')} />,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      stop: true,
      render: (i) => (
        <Menu
          items={[
            { label: 'Open in traveller app', icon: ExternalLink, onClick: () => window.open(`/app/itineraries/${i.id}`, '_blank', 'noopener') },
            { label: 'Set price', icon: IndianRupee, onClick: () => setPrice(i) },
            i.status === 'published' && { label: 'Unpublish', icon: EyeOff, onClick: () => patch(i, { status: 'unpublished' }, 'Itinerary unpublished') },
            i.status !== 'published' && { label: 'Republish', icon: RotateCcw, onClick: () => patch(i, { status: 'published' }, 'Itinerary is live again') },
            i.status !== 'removed' && { label: 'Remove…', icon: Trash2, danger: true, onClick: () => remove(i) },
          ]}
        />
      ),
    },
  ];

  const published = list.filter((i) => i.status === 'published');
  return (
    <div>
      <PageHeader title="Marketplace" subtitle="Moderate community itineraries — feature the best, verify premium guides, and remove anything unsafe." />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <MiniStat label="Published" value={num(published.length)} hint={`${num(list.length)} shown`} />
        <MiniStat label="Premium (paid)" value={num(list.filter((i) => i.price > 0).length)} hint={`${num(list.filter((i) => i.verified_premium).length)} verified premium`} />
        <MiniStat label="Featured" value={num(list.filter((i) => i.featured).length)} />
        <MiniStat label="Gross sales" value={inr(list.reduce((s, i) => s + (i.gross || 0), 0))} hint={`${num(list.reduce((s, i) => s + i.sales_count, 0))} sales · ${num(list.reduce((s, i) => s + i.fork_count, 0))} forks`} />
      </div>
      <FilterBar>
        <SearchBox value={f.q} onChange={(q) => setF({ q })} placeholder="Search title, destination or creator" className="sm:w-80" />
        <FilterSelect label="Status" value={f.status} onChange={(status) => setF({ status })} options={STATUS_OPTIONS} />
        <ChipToggle icon={BadgeCheck} active={f.premium === '1'} onClick={() => setF({ premium: f.premium === '1' ? '' : '1' })}>
          Paid only
        </ChipToggle>
      </FilterBar>
      {error && !data ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          loading={loading}
          rowClassName={(i) => (i.status === 'removed' ? 'opacity-60' : '')}
          empty={<EmptyState icon={Store} title="No itineraries found" description={f.q || f.status || f.premium ? 'Try a different filter.' : 'Published community itineraries will show up here.'} />}
        />
      )}
      <p className="mt-4 flex items-center gap-1.5 text-[12.5px] text-muted">
        <Ban className="size-3.5" /> Featuring and Verified Premium are only available for published itineraries. The creator is notified when you feature, verify or remove their itinerary.
      </p>
    </div>
  );
}
