import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import clsx from 'clsx';
import { Bot, Camera, CalendarDays, MessageCircle, BookOpen, Map as MapIcon, Settings, Ticket, Wallet, X } from 'lucide-react';
import { ErrorState, PageLoader, Tabs } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { getSocket, useSocketEvent } from '../../lib/socket';
import { useMediaQuery } from '../../lib/hooks';
import TripHeader from './TripHeader';
import PlanTab from './PlanTab';
import ChatPanel from './ChatPanel';
import BookingsTab from './BookingsTab';
import BudgetTab from './BudgetTab';
import MapTab from './MapTab';
import AlbumTab from './AlbumTab';
import ZineTab from './ZineTab';
import SettingsTab from './SettingsTab';
import InviteModal from './InviteModal';

function sortItems(items) {
  return [...items].sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));
}

export default function TripHub() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [presence, setPresence] = useState([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [autoPrompt, setAutoPrompt] = useState(null);
  const reloadTimer = useRef(null);
  const wide = useMediaQuery('(min-width: 1280px)');
  const tab = params.get('tab') || 'plan';
  const setTab = (t) => setParams((p) => {
    const n = new URLSearchParams(p);
    n.set('tab', t);
    n.delete('welcome');
    return n;
  }, { replace: true });

  const load = useCallback(async () => {
    try {
      const d = await api.get(`/trips/${id}`);
      setData(d);
      setError(null);
    } catch (err) {
      setError(err);
    }
  }, [id]);

  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  // Join the realtime channel for this trip (and re-join after reconnects)
  useEffect(() => {
    const s = getSocket();
    if (!s) return;
    const join = () => s.emit('trip:join', { tripId: id }, (ack) => ack?.users && setPresence(ack.users));
    join();
    s.on('connect', join);
    return () => {
      s.off('connect', join);
      s.emit('trip:leave', { tripId: id });
    };
  }, [id]);

  // Welcome flows
  useEffect(() => {
    const w = params.get('welcome');
    if (!data || !w) return;
    if (w === 'new') setInviteOpen(true);
    if (w === 'fork') {
      setAutoPrompt(`We just forked this itinerary. Personalise it for our group: check the dates (${data.trip.start_date} → ${data.trip.end_date}), our budget and our vibe, suggest what to change, and add anything important that's missing.`);
      setTab('concierge');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.trip?.id]);

  useSocketEvent('presence', (p) => p.tripId === id && setPresence(p.users));

  useSocketEvent('trip:event', (ev) => {
    if (ev.tripId !== id) return;
    const { type, data: payload } = ev;
    setData((d) => {
      if (!d) return d;
      switch (type) {
        case 'item:upsert': {
          const it = payload.item;
          return { ...d, days: d.days.map((day) => ({ ...day, items: day.id === it.day_id ? sortItems([...day.items.filter((x) => x.id !== it.id), it]) : day.items.filter((x) => x.id !== it.id) })) };
        }
        case 'item:delete':
          return { ...d, days: d.days.map((day) => ({ ...day, items: day.items.filter((x) => x.id !== payload.id) })) };
        case 'day:update':
          return { ...d, days: d.days.map((day) => (day.id === payload.day.id ? { ...day, ...payload.day } : day)) };
        case 'stash:upsert':
          return { ...d, stash: [payload.item, ...d.stash.filter((s) => s.id !== payload.item.id)] };
        case 'stash:delete':
          return { ...d, stash: d.stash.filter((s) => s.id !== payload.id) };
        case 'poll:upsert':
          return { ...d, polls: d.polls.some((p) => p.id === payload.poll.id) ? d.polls.map((p) => (p.id === payload.poll.id ? payload.poll : p)) : [payload.poll, ...d.polls] };
        case 'poll:delete':
          return { ...d, polls: d.polls.filter((p) => p.id !== payload.id) };
        case 'vibe':
          return { ...d, trip: { ...d.trip, vibe_score: payload.vibe_score }, members: d.members.map((m) => (m.user_id === payload.user_id ? { ...m, vibe: payload.vibe } : m)), me: payload.user_id === user.id ? { ...d.me, vibe: payload.vibe } : d.me };
        case 'members':
          return { ...d, members: payload.members, me: (() => { const m = payload.members.find((x) => x.user_id === user.id); return m ? { ...d.me, role: m.role, share_location: m.share_location } : d.me; })() };
        case 'trip:update':
          return { ...d, trip: { ...d.trip, ...payload.trip, invite_code: d.trip.invite_code } };
        default:
          return d;
      }
    });
    if (type === 'days:reload') load();
    if (type === 'members' && !payload.members.some((m) => m.user_id === user.id)) {
      toast.error('You are no longer a member of this trip');
      navigate('/app/trips');
    }
    if (type === 'trip:deleted') {
      toast('This trip was deleted by its owner');
      navigate('/app/trips');
    }
    if (type === 'sos' && ev.by !== user.id) {
      toast.error(`🚨 SOS from ${payload.name}`, { description: payload.alert?.message || 'Check the map for their live location.', duration: 30000, action: { label: 'Open map', onClick: () => setTab('map') } });
    }
    if (type === 'booking') {
      // refresh counters (proposals awaiting approval, totals) once a burst of booking events settles
      clearTimeout(reloadTimer.current);
      reloadTimer.current = setTimeout(load, 900);
    }
  });

  const onlineIds = useMemo(() => new Set(presence.map((p) => p.user_id)), [presence]);

  if (error) return <div className="px-4 pt-8"><ErrorState error={error} onRetry={load} /></div>;
  if (!data) return <PageLoader label="Opening trip hub…" />;

  const ctx = { data, setData, reload: load, presence, onlineIds, user, tripId: id, isOwner: data.me?.role === 'owner', setTab };
  const tabs = [
    { id: 'plan', label: 'Plan', icon: CalendarDays },
    { id: 'chat', label: 'Chat', icon: MessageCircle },
    { id: 'concierge', label: 'Yatri', icon: Bot, count: data.stats.unread_proposals || 0 },
    { id: 'bookings', label: 'Bookings', icon: Ticket },
    { id: 'budget', label: 'Budget', icon: Wallet },
    { id: 'map', label: 'Map', icon: MapIcon },
    { id: 'album', label: 'Album', icon: Camera },
    { id: 'zine', label: 'Zine', icon: BookOpen },
    { id: 'settings', label: 'People & settings', icon: Settings },
  ];
  const showSideChat = wide && chatOpen && !['chat', 'concierge'].includes(tab);

  return (
    <div className="pb-6">
      <TripHeader ctx={ctx} onInvite={() => setInviteOpen(true)} onToggleChat={() => (wide ? setChatOpen((o) => !o) : setTab('chat'))} chatOpen={showSideChat} />
      <div className="sticky top-16 z-10 -mt-px border-b border-line bg-paper/90 px-4 py-2 backdrop-blur sm:rounded-b-2xl sm:px-2">
        <Tabs tabs={tabs} value={tab} onChange={setTab} size="sm" />
      </div>
      <div className={clsx('mt-5 px-4 sm:px-0', showSideChat && 'grid grid-cols-[minmax(0,1fr)_380px] gap-5')}>
        <div className="min-w-0">
          {tab === 'plan' && <PlanTab ctx={ctx} />}
          {tab === 'chat' && <div className="mx-auto max-w-3xl"><ChatPanel ctx={ctx} channel="group" tall /></div>}
          {tab === 'concierge' && <div className="mx-auto max-w-3xl"><ChatPanel ctx={ctx} channel="concierge" tall autoPrompt={autoPrompt} onAutoPromptSent={() => setAutoPrompt(null)} /></div>}
          {tab === 'bookings' && <BookingsTab ctx={ctx} />}
          {tab === 'budget' && <BudgetTab ctx={ctx} />}
          {tab === 'map' && <MapTab ctx={ctx} />}
          {tab === 'album' && <AlbumTab ctx={ctx} />}
          {tab === 'zine' && <ZineTab ctx={ctx} />}
          {tab === 'settings' && <SettingsTab ctx={ctx} onInvite={() => setInviteOpen(true)} />}
        </div>
        {showSideChat && (
          <aside className="sticky top-32 h-[calc(100dvh-9rem)]">
            <div className="relative h-full">
              <button onClick={() => setChatOpen(false)} className="absolute right-3 top-3 z-10 grid size-7 place-items-center rounded-lg text-muted hover:bg-sand" aria-label="Close chat"><X className="size-4" /></button>
              <ChatPanel ctx={ctx} channel="group" switchable fill />
            </div>
          </aside>
        )}
      </div>
      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} ctx={ctx} />
    </div>
  );
}
