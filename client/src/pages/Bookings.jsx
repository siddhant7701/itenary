import { useMemo, useState } from 'react';
import { Ticket } from 'lucide-react';
import BookingRow, { BookingDetailModal } from '../components/BookingRow';
import { Card, EmptyState, ErrorState, PageHeader, Skeleton, Tabs } from '../components/ui';
import { useFetch } from '../lib/hooks';
import { useSocketEvent } from '../lib/socket';
import { inr } from '../lib/format';

export default function Bookings() {
  const { data, loading, error, reload } = useFetch('/bookings');
  const [tab, setTab] = useState('upcoming');
  const [open, setOpen] = useState(null);
  useSocketEvent('booking', () => reload());

  const groups = useMemo(() => {
    const all = (data?.bookings || []).filter((b) => b.status !== 'proposed');
    const now = Date.now();
    return {
      upcoming: all.filter((b) => ['requested', 'confirmed', 'needs_attention'].includes(b.status) && (!b.scheduled_at || new Date(b.scheduled_at).getTime() > now - 3 * 3600_000)).sort((a, b) => new Date(a.scheduled_at || 0) - new Date(b.scheduled_at || 0)),
      past: all.filter((b) => b.status === 'completed' || (b.status === 'confirmed' && b.scheduled_at && new Date(b.scheduled_at).getTime() <= now - 3 * 3600_000)),
      cancelled: all.filter((b) => b.status === 'cancelled'),
    };
  }, [data]);

  const list = groups[tab];
  const spent = [...groups.upcoming, ...groups.past].reduce((s, b) => s + b.total, 0);

  return (
    <div>
      <PageHeader title="Bookings" subtitle={data ? `${groups.upcoming.length + groups.past.length} bookings · ${inr(spent)} booked through Itenary` : 'Cabs, food, stays and experiences booked by you and your crews.'} />
      <Tabs
        className="mb-5"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'upcoming', label: 'Upcoming', count: groups.upcoming.length },
          { id: 'past', label: 'Past', count: groups.past.length },
          { id: 'cancelled', label: 'Cancelled', count: groups.cancelled.length },
        ]}
      />
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading ? (
        <div className="space-y-3">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : list.length === 0 ? (
        <EmptyState icon={Ticket} title={tab === 'upcoming' ? 'Nothing booked yet' : tab === 'past' ? 'No past bookings' : 'No cancellations'} description={tab === 'upcoming' ? 'Ask Yatri in any trip to book a cab, order food or find a stay.' : undefined} />
      ) : (
        <Card padded={false} className="divide-y divide-line overflow-hidden">
          {list.map((b) => (
            <button key={b.id} onClick={() => setOpen(b.id)} className="block w-full px-4 py-3.5 text-left transition hover:bg-paper">
              <BookingRow booking={b} showTrip />
            </button>
          ))}
        </Card>
      )}
      <BookingDetailModal bookingId={open} open={!!open} onClose={() => setOpen(null)} onChanged={reload} />
    </div>
  );
}
