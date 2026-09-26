import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import clsx from 'clsx';
import { toast } from 'sonner';
import { Bell, CalendarHeart, Compass, Home, LogOut, Map, Megaphone, Sparkles, Ticket, User, WifiOff, X, BarChart3, CheckCheck } from 'lucide-react';
import Logo from './Logo';
import { Avatar, Badge, Button, VerifiedBadge } from './ui';
import { useAuth } from '../lib/auth';
import { useConfig } from '../lib/config';
import { api } from '../lib/api';
import { useSocketEvent } from '../lib/socket';
import { useLocalState, useOnline } from '../lib/hooks';
import { timeAgo } from '../lib/format';

const NAV = [
  { to: '/app', label: 'Home', icon: Home, end: true },
  { to: '/app/trips', label: 'My trips', icon: Map },
  { to: '/app/explore', label: 'Explore', icon: Compass },
  { to: '/app/events', label: 'Events', icon: CalendarHeart },
  { to: '/app/bookings', label: 'Bookings', icon: Ticket },
  { to: '/app/creator', label: 'Creator studio', icon: BarChart3 },
];

const MOBILE_NAV = [
  { to: '/app', label: 'Home', icon: Home, end: true },
  { to: '/app/trips', label: 'Trips', icon: Map },
  { to: '/app/explore', label: 'Explore', icon: Compass },
  { to: '/app/bookings', label: 'Bookings', icon: Ticket },
  { to: '/app/profile', label: 'Me', icon: User },
];

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ notifications: [], unread: 0 });
  const ref = useRef(null);
  const navigate = useNavigate();

  const load = () => api.get('/notifications').then(setData).catch(() => {});
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    if (!open) return;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  useSocketEvent('notification', (n) => {
    setData((d) => ({ notifications: [n, ...d.notifications].slice(0, 60), unread: d.unread + 1 }));
    const isSos = n.type === 'sos';
    (isSos ? toast.error : toast)(n.title, { description: n.body, action: n.link ? { label: 'View', onClick: () => navigate(n.link) } : undefined, duration: isSos ? 20000 : 5000 });
  });

  const markAll = async () => {
    await api.post('/notifications/read-all').catch(() => {});
    setData((d) => ({ notifications: d.notifications.map((n) => ({ ...n, read: true })), unread: 0 }));
  };

  const openItem = (n) => {
    if (!n.read) api.post(`/notifications/${n.id}/read`).catch(() => {});
    setData((d) => ({ notifications: d.notifications.map((x) => (x.id === n.id ? { ...x, read: true } : x)), unread: Math.max(0, d.unread - (n.read ? 0 : 1)) }));
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="relative grid size-10 place-items-center rounded-xl text-ink/80 hover:bg-white hover:text-ink" aria-label="Notifications">
        <Bell className="size-5" />
        {data.unread > 0 && <span className="absolute right-1.5 top-1.5 grid min-w-4 place-items-center rounded-full bg-marigold-500 px-1 text-[10px] font-bold text-white">{data.unread > 9 ? '9+' : data.unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-line bg-white shadow-lift animate-pop">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div className="font-bold">Notifications</div>
            {data.unread > 0 && (
              <button onClick={markAll} className="inline-flex items-center gap-1 text-xs font-semibold text-plum-700 hover:underline">
                <CheckCheck className="size-3.5" /> Mark all read
              </button>
            )}
          </div>
          <div className="scrollbar-thin max-h-[60vh] overflow-y-auto">
            {data.notifications.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted">You’re all caught up ✨</p>}
            {data.notifications.slice(0, 15).map((n) => (
              <button key={n.id} onClick={() => openItem(n)} className={clsx('flex w-full gap-3 border-b border-line/60 px-4 py-3 text-left transition hover:bg-paper', !n.read && 'bg-plum-50/50')}>
                <span className={clsx('mt-1.5 size-2 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-marigold-500')} />
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-semibold leading-snug text-ink">{n.title}</span>
                  {n.body && <span className="mt-0.5 line-clamp-2 block text-[12.5px] text-muted">{n.body}</span>}
                  <span className="mt-1 block text-[11px] text-muted/80">{timeAgo(n.created_at)}</span>
                </span>
              </button>
            ))}
          </div>
          <button onClick={() => { setOpen(false); navigate('/app/notifications'); }} className="w-full py-2.5 text-center text-[13px] font-semibold text-plum-700 hover:bg-paper">
            See all
          </button>
        </div>
      )}
    </div>
  );
}

function Announcements() {
  const { announcements } = useConfig();
  const [dismissed, setDismissed] = useLocalState('tc_dismissed_announcements', []);
  const visible = (announcements || []).filter((a) => !dismissed.includes(a.id));
  if (!visible.length) return null;
  const a = visible[0];
  return (
    <div className={clsx('mb-5 flex items-start gap-3 rounded-2xl px-4 py-3 text-[13.5px]', a.level === 'warning' ? 'bg-marigold-50 text-marigold-900 ring-1 ring-marigold-100' : a.level === 'success' ? 'bg-emerald-50 text-emerald-900 ring-1 ring-emerald-100' : 'bg-plum-50 text-plum-900 ring-1 ring-plum-100')}>
      <Megaphone className="mt-0.5 size-4 shrink-0" />
      <div className="flex-1">
        <span className="font-bold">{a.title}</span> {a.body && <span className="opacity-85">— {a.body}</span>}
      </div>
      <button onClick={() => setDismissed([...dismissed, a.id])} className="opacity-60 hover:opacity-100" aria-label="Dismiss">
        <X className="size-4" />
      </button>
    </div>
  );
}

export default function AppShell() {
  const { user, logout } = useAuth();
  const online = useOnline();
  const location = useLocation();
  const navigate = useNavigate();
  const fullBleed = /^\/app\/trips\/[^/]+/.test(location.pathname);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="min-h-dvh overflow-x-clip bg-paper">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-white/70 px-4 pb-4 pt-5 backdrop-blur lg:flex">
        <Logo to="/app" className="px-2" />
        <nav className="mt-8 flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => clsx('flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14.5px] font-semibold transition', isActive ? 'bg-plum-700 text-white shadow-glow' : 'text-ink/70 hover:bg-sand hover:text-ink')}
            >
              <Icon className="size-[18px]" />
              {label}
            </NavLink>
          ))}
        </nav>
        {user?.plan !== 'plus' && (
          <div className="mt-6 rounded-2xl bg-gradient-to-br from-plum-800 to-plum-950 p-4 text-white">
            <div className="flex items-center gap-2 text-sm font-bold">
              <Sparkles className="size-4 text-marigold-300" /> Itenary Plus
            </div>
            <p className="mt-1 text-xs text-white/70">Unlimited Yatri concierge requests and priority support.</p>
            <Button size="sm" variant="accent" className="mt-3 w-full" to="/app/profile#plus">Upgrade</Button>
          </div>
        )}
        <div className="mt-auto flex items-center gap-3 rounded-2xl p-2 hover:bg-sand">
          <NavLink to="/app/profile" className="flex min-w-0 flex-1 items-center gap-3">
            <Avatar user={user} size={38} />
            <div className="min-w-0">
              <div className="flex items-center gap-1 truncate text-sm font-bold">
                {user?.name}
                {user?.verified && <VerifiedBadge />}
              </div>
              <div className="text-xs text-muted">{user?.plan === 'plus' ? <Badge tone="marigold">Plus</Badge> : user?.home_city || 'Traveller'}</div>
            </div>
          </NavLink>
          <button
            onClick={() => {
              logout();
              navigate('/');
            }}
            className="grid size-9 place-items-center rounded-lg text-muted hover:bg-white hover:text-rose-600"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-line/70 bg-paper/85 px-4 backdrop-blur sm:px-6 lg:justify-end">
          <Logo to="/app" size={28} className="lg:hidden" />
          <div className="flex items-center gap-1.5">
            <NotificationBell />
            <NavLink to="/app/profile" className="lg:hidden">
              <Avatar user={user} size={34} />
            </NavLink>
          </div>
        </header>

        {!online && (
          <div className="flex items-center justify-center gap-2 bg-ink px-4 py-2 text-center text-[13px] font-medium text-white">
            <WifiOff className="size-4" /> You’re offline — showing saved trips. Messages will send when you reconnect.
          </div>
        )}

        <main className={clsx('mx-auto w-full pb-28 lg:pb-12', fullBleed ? 'max-w-[1400px] px-0 sm:px-4 lg:px-6' : 'max-w-6xl px-4 pt-6 sm:px-6 lg:pt-8')}>
          {!fullBleed && <Announcements />}
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5">
          {MOBILE_NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => clsx('flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold', isActive ? 'text-plum-700' : 'text-muted')}>
              {({ isActive }) => (
                <>
                  <span className={clsx('grid h-7 w-12 place-items-center rounded-full transition', isActive && 'bg-plum-100')}>
                    <Icon className="size-[19px]" />
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
