import { useNavigate } from 'react-router';
import clsx from 'clsx';
import { Bell, CheckCheck } from 'lucide-react';
import { Button, Card, EmptyState, PageHeader, Skeleton } from '../components/ui';
import { api } from '../lib/api';
import { useFetch } from '../lib/hooks';
import { useSocketEvent } from '../lib/socket';
import { timeAgo } from '../lib/format';

const EMOJI = {
  booking_confirmed: '✅', booking_attention: '🛠️', refund: '💸', trip_invite: '💌', member_joined: '👋', poll: '🗳️', mention: '💬', media: '📸', settlement: '🤝',
  settlement_paid: '✅', sos: '🚨', sos_safe: '💚', sos_update: '🛟', sale: '💰', tip: '🙏', fork: '🍴', follow: '⭐', review: '📝', promoted: '🏅', featured: '⭐',
  payout: '🏦', verified: '✔️', plus: '✨', broadcast: '📣', welcome: '🇮🇳', new_itinerary: '🗺️', moderation: '⚠️',
};

export default function Notifications() {
  const { data, loading, reload, setData } = useFetch('/notifications');
  const navigate = useNavigate();
  useSocketEvent('notification', () => reload());

  const markAll = async () => {
    await api.post('/notifications/read-all');
    reload();
  };

  const open = (n) => {
    if (!n.read) api.post(`/notifications/${n.id}/read`).catch(() => {});
    setData((d) => ({ ...d, notifications: d.notifications.map((x) => (x.id === n.id ? { ...x, read: true } : x)) }));
    if (n.link) navigate(n.link);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Notifications" actions={data?.unread > 0 && <Button variant="secondary" size="sm" icon={CheckCheck} onClick={markAll}>Mark all read</Button>} />
      {loading ? (
        <div className="space-y-2">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : !data?.notifications?.length ? (
        <EmptyState icon={Bell} title="No notifications yet" description="Trip invites, votes, booking updates and creator sales will show up here." />
      ) : (
        <Card padded={false} className="divide-y divide-line overflow-hidden">
          {data.notifications.map((n) => (
            <button key={n.id} onClick={() => open(n)} className={clsx('flex w-full gap-3.5 px-4 py-3.5 text-left transition hover:bg-paper', !n.read && 'bg-plum-50/60')}>
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sand text-lg">{EMOJI[n.type] || '🔔'}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold">{n.title}</span>
                {n.body && <span className="mt-0.5 block text-[13px] text-muted">{n.body}</span>}
                <span className="mt-1 block text-[11.5px] text-muted/80">{timeAgo(n.created_at)}</span>
              </span>
              {!n.read && <span className="mt-2 size-2 shrink-0 rounded-full bg-marigold-500" />}
            </button>
          ))}
        </Card>
      )}
    </div>
  );
}
