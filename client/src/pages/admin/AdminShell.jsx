import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { toast } from 'sonner';
import {
  Bot,
  CalendarDays,
  CreditCard,
  ExternalLink,
  HandCoins,
  LayoutDashboard,
  LogOut,
  Map as MapIcon,
  Menu,
  MessageSquareWarning,
  PlugZap,
  ScrollText,
  Settings as SettingsIcon,
  Siren,
  Store,
  Ticket,
  Users as UsersIcon,
  X,
} from 'lucide-react';
import Logo from '../../components/Logo';
import { Avatar, PageLoader, cx } from '../../components/ui';
import { adminApi } from '../../lib/api';
import { useAdminAuth } from '../../lib/auth';
import { getAdminSocket, useSocketEvent } from '../../lib/socket';
import { AdminCtx, PromptProvider } from './kit';

const NAV = [
  { group: 'Overview', items: [{ to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true }] },
  {
    group: 'Operations',
    items: [
      { to: '/admin/bookings', label: 'Bookings', icon: Ticket, queue: 'needs_attention', urgent: true },
      { to: '/admin/safety', label: 'Safety & verification', icon: Siren, queue: ['sos_active', 'verifications'], urgent: 'sos_active' },
      { to: '/admin/trips', label: 'Trips', icon: MapIcon },
      { to: '/admin/providers', label: 'Providers', icon: PlugZap },
    ],
  },
  {
    group: 'People',
    items: [{ to: '/admin/users', label: 'Users', icon: UsersIcon }],
  },
  {
    group: 'Money',
    items: [
      { to: '/admin/payments', label: 'Payments', icon: CreditCard },
      { to: '/admin/payouts', label: 'Creator payouts', icon: HandCoins, queue: 'payouts' },
    ],
  },
  {
    group: 'Community',
    items: [
      { to: '/admin/marketplace', label: 'Marketplace', icon: Store },
      { to: '/admin/reviews', label: 'Reviews', icon: MessageSquareWarning, queue: 'flagged_reviews' },
      { to: '/admin/events', label: 'Events', icon: CalendarDays },
    ],
  },
  {
    group: 'System',
    items: [
      { to: '/admin/audit', label: 'Audit trail', icon: ScrollText },
      { to: '/admin/settings', label: 'Settings', icon: SettingsIcon },
    ],
  },
];

const FLAT_NAV = NAV.flatMap((g) => g.items);

function queueCount(queues, key) {
  if (!queues || !key) return 0;
  const keys = Array.isArray(key) ? key : [key];
  return keys.reduce((s, k) => s + (Number(queues[k]) || 0), 0);
}

function Sidebar({ queues, ai, onNavigate, onClose }) {
  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-plum-950 via-plum-950 to-[#170a24] text-white">
      <div className="flex items-center gap-2.5 px-5 pb-5 pt-5">
        <Logo to="/admin" light size={30} />
        <span className="rounded-md bg-marigold-400 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-plum-950">Admin</span>
        {onClose && (
          <button onClick={onClose} className="-mr-2 ml-auto grid size-9 shrink-0 place-items-center rounded-xl text-white/70 hover:bg-white/10 hover:text-white" aria-label="Close menu">
            <X className="size-5" />
          </button>
        )}
      </div>
      <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 pb-4" aria-label="Admin">
        {NAV.map((g) => (
          <div key={g.group} className="mb-4">
            <div className="px-3 pb-1.5 text-[10.5px] font-bold uppercase tracking-[0.16em] text-white/35">{g.group}</div>
            <div className="flex flex-col gap-0.5">
              {g.items.map(({ to, label, icon: Icon, end, queue, urgent }) => {
                const count = queueCount(queues, queue);
                const isUrgent = count > 0 && (urgent === true || (typeof urgent === 'string' && Number(queues?.[urgent]) > 0));
                return (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cx(
                        'group relative flex items-center gap-3 rounded-xl px-3 py-2 text-[14px] font-semibold transition',
                        isActive ? 'bg-white/[0.11] text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06)]' : 'text-white/65 hover:bg-white/[0.06] hover:text-white',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && <span className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-marigold-400" />}
                        <Icon className={cx('size-[18px] shrink-0', isActive ? 'text-marigold-300' : 'text-white/55 group-hover:text-white/80')} />
                        <span className="flex-1 truncate">{label}</span>
                        {count > 0 && (
                          <span className={cx('grid min-w-5 place-items-center rounded-full px-1.5 py-px text-[11px] font-bold tabular-nums', isUrgent ? 'bg-rose-500 text-white' : 'bg-marigold-400 text-plum-950')}>
                            {count > 99 ? '99+' : count}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-white/10 px-4 py-4">
        <Link to="/admin/settings" onClick={onNavigate} className="flex items-center gap-3 rounded-xl bg-white/[0.06] px-3 py-2.5 transition hover:bg-white/10">
          <span className={cx('grid size-8 place-items-center rounded-lg', ai?.engine === 'claude' ? 'bg-emerald-400/15 text-emerald-300' : 'bg-marigold-400/15 text-marigold-300')}>
            <Bot className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[12.5px] font-semibold text-white">AI concierge</span>
            <span className="block truncate text-[11.5px] text-white/55">{!ai ? 'Checking…' : !ai.enabled ? 'Disabled' : ai.engine === 'claude' ? `Claude · ${ai.model}` : 'Built-in engine'}</span>
          </span>
          <span className={cx('size-2 rounded-full', !ai ? 'bg-white/30' : ai.enabled ? (ai.engine === 'claude' ? 'bg-emerald-400' : 'bg-marigold-400') : 'bg-rose-400')} />
        </Link>
      </div>
    </div>
  );
}

function useLiveStatus() {
  const [connected, setConnected] = useState(() => !!getAdminSocket()?.connected);
  useEffect(() => {
    const s = getAdminSocket();
    if (!s) return;
    if (s.disconnected) s.connect();
    const on = () => setConnected(true);
    const off = () => setConnected(false);
    s.on('connect', on);
    s.on('disconnect', off);
    setConnected(s.connected);
    return () => {
      s.off('connect', on);
      s.off('disconnect', off);
    };
  }, []);
  return connected;
}

export default function AdminShell() {
  const { user, logout } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawer, setDrawer] = useState(false);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const live = useLiveStatus();

  const refresh = useCallback(async () => {
    try {
      const s = await adminApi.get('/admin/stats');
      setStats(s);
      setError(null);
      setUpdatedAt(new Date());
    } catch (err) {
      setError(err);
    }
  }, []);

  // Debounced refresh for bursts of realtime events.
  const timer = useRef(null);
  const refreshSoon = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(refresh, 700);
  }, [refresh]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 60_000);
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(id);
      clearTimeout(timer.current);
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);

  useEffect(() => {
    setDrawer(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useSocketEvent(
    'sos',
    (a) => {
      if (a?.status === 'active') {
        toast.error(`🆘 SOS from ${a.user_name || 'a traveller'}`, {
          description: a.message || 'A traveller needs help right now.',
          duration: 30_000,
          action: { label: 'Respond', onClick: () => navigate('/admin/safety') },
        });
      }
      refreshSoon();
    },
    { admin: true },
  );
  useSocketEvent(
    'attention',
    (b) => {
      toast.error(`Booking needs a human: ${b?.title || 'booking'}`, {
        description: b?.failure_reason || 'The provider could not complete this booking.',
        duration: 15_000,
        action: b?.id ? { label: 'Resolve', onClick: () => navigate(`/admin/bookings?tab=attention&open=${b.id}`) } : undefined,
      });
      refreshSoon();
    },
    { admin: true },
  );
  useSocketEvent('booking', () => refreshSoon(), { admin: true });
  useSocketEvent(
    'verification',
    (v) => {
      toast(`${v?.name || 'A traveller'} requested verification`, {
        action: { label: 'Review', onClick: () => navigate('/admin/safety#verifications') },
      });
      refreshSoon();
    },
    { admin: true },
  );

  const queues = stats?.queues;
  const current = useMemo(() => {
    const path = location.pathname.replace(/\/+$/, '') || '/admin';
    return FLAT_NAV.filter((n) => (n.end ? path === n.to : path === n.to || path.startsWith(n.to + '/'))).sort((a, b) => b.to.length - a.to.length)[0];
  }, [location.pathname]);

  const signOut = () => {
    getAdminSocket()?.disconnect();
    logout();
    navigate('/admin/login', { replace: true });
  };

  const ctx = useMemo(() => ({ stats, queues: queues || {}, refresh, error, updatedAt }), [stats, queues, refresh, error, updatedAt]);
  const sos = Number(queues?.sos_active) || 0;

  return (
    <AdminCtx.Provider value={ctx}>
      <PromptProvider>
        <style>{`@keyframes tc-admin-slide{from{transform:translateX(28px);opacity:0}to{transform:none;opacity:1}}@keyframes tc-admin-drawer{from{transform:translateX(-100%)}to{transform:none}}`}</style>
        <div className="min-h-dvh bg-paper">
          {/* Desktop sidebar */}
          <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
            <Sidebar queues={queues} ai={stats?.ai} />
          </aside>

          {/* Mobile drawer */}
          {drawer && (
            <div className="fixed inset-0 z-[800] lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
              <div className="absolute inset-0 bg-plum-950/50 backdrop-blur-[2px]" onClick={() => setDrawer(false)} />
              <div className="absolute inset-y-0 left-0 w-[min(88vw,320px)] shadow-lift animate-[tc-admin-drawer_0.22s_ease-out]">
                <Sidebar queues={queues} ai={stats?.ai} onNavigate={() => setDrawer(false)} onClose={() => setDrawer(false)} />
              </div>
            </div>
          )}

          <div className="lg:pl-64">
            <header className="sticky top-0 z-20 border-b border-line/80 bg-paper/85 backdrop-blur">
              <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
                <button onClick={() => setDrawer(true)} className="-ml-1 grid size-10 place-items-center rounded-xl text-ink/80 hover:bg-white lg:hidden" aria-label="Open menu">
                  <Menu className="size-5" />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="hidden text-[11px] font-bold uppercase tracking-[0.14em] text-muted sm:block">Itenary admin</div>
                  <div className="truncate font-display text-[17px] font-bold leading-tight text-ink">{current?.label || 'Admin'}</div>
                </div>
                <span
                  className={cx('hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold sm:inline-flex', live ? 'bg-emerald-50 text-emerald-700' : 'bg-sand text-muted')}
                  title={live ? 'Receiving live SOS and booking alerts' : 'Realtime connection is offline — data refreshes every minute'}
                >
                  <span className="relative flex size-2">
                    {live && <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
                    <span className={cx('relative inline-flex size-2 rounded-full', live ? 'bg-emerald-500' : 'bg-muted/50')} />
                  </span>
                  {live ? 'Live' : 'Offline'}
                </span>
                <a
                  href="/app"
                  target="_blank"
                  rel="noreferrer"
                  className="hidden h-9 items-center gap-1.5 rounded-xl border border-line bg-white px-3 text-[13px] font-semibold text-ink transition hover:border-plum-300 hover:text-plum-800 md:inline-flex"
                >
                  Open traveller app <ExternalLink className="size-3.5" />
                </a>
                <div className="flex items-center gap-2 border-l border-line pl-3">
                  <Avatar user={user} size={34} />
                  <div className="hidden min-w-0 leading-tight sm:block">
                    <div className="max-w-40 truncate text-[13px] font-bold text-ink">{user?.name}</div>
                    <div className="max-w-40 truncate text-[11.5px] text-muted">{user?.email}</div>
                  </div>
                  <button onClick={signOut} className="grid size-9 place-items-center rounded-lg text-muted transition hover:bg-rose-50 hover:text-rose-600" title="Sign out" aria-label="Sign out">
                    <LogOut className="size-4" />
                  </button>
                </div>
              </div>
              {sos > 0 && !location.pathname.startsWith('/admin/safety') && (
                <Link to="/admin/safety" className="flex items-center justify-center gap-2 bg-rose-600 px-4 py-2 text-center text-[13px] font-semibold text-white hover:bg-rose-700">
                  <span className="relative flex size-2.5">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-70" />
                    <span className="relative inline-flex size-2.5 rounded-full bg-white" />
                  </span>
                  {sos === 1 ? '1 open SOS alert' : `${sos} open SOS alerts`} — respond now →
                </Link>
              )}
            </header>

            <main className="mx-auto w-full max-w-[1440px] px-4 pb-16 pt-6 sm:px-6 lg:px-8">
              <Suspense fallback={<PageLoader />}>
                <Outlet />
              </Suspense>
              <div className="mt-10 flex justify-center md:hidden">
                <a href="/app" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-plum-700">
                  Open traveller app <ExternalLink className="size-3.5" />
                </a>
              </div>
            </main>
          </div>
        </div>
      </PromptProvider>
    </AdminCtx.Provider>
  );
}
