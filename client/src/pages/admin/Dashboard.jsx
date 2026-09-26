import { useMemo } from 'react';
import { Link } from 'react-router';
import dayjs from 'dayjs';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  ArrowUpRight,
  Bot,
  CircleCheck,
  Crown,
  HandCoins,
  IndianRupee,
  Luggage,
  MapPin,
  MessageSquareWarning,
  Percent,
  RefreshCw,
  ShieldCheck,
  Siren,
  Sparkles,
  Ticket,
  TrendingUp,
  UserPlus,
  Users,
  Activity,
  Radio,
  Wallet,
} from 'lucide-react';
import { Badge, Button, ErrorState, Skeleton, VerifiedBadge, Avatar, cx } from '../../components/ui';
import { CATEGORY, inr, num, timeAgo } from '../../lib/format';
import { BOOKING_STATUS_ADMIN, StatusBadge, useAdmin } from './kit';

const PLUM = '#7439a8';

function Kpi({ label, value, hint, icon: Icon, tone = 'plum', to }) {
  const toneCls = {
    plum: 'bg-plum-50 text-plum-700',
    marigold: 'bg-marigold-50 text-marigold-700',
    green: 'bg-emerald-50 text-emerald-700',
    blue: 'bg-sky-50 text-sky-700',
    red: 'bg-rose-50 text-rose-700',
  }[tone];
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12.5px] font-semibold text-muted">{label}</span>
        {Icon && (
          <span className={cx('grid size-8 place-items-center rounded-lg', toneCls)}>
            <Icon className="size-4" />
          </span>
        )}
      </div>
      <div className="mt-1.5 truncate font-display text-[26px] font-extrabold leading-none text-ink">{value}</div>
      {hint && <div className="mt-1.5 truncate text-[12px] text-muted">{hint}</div>}
    </>
  );
  const cls = 'card block p-4 transition';
  return to ? (
    <Link to={to} className={cx(cls, 'hover:border-plum-200 hover:shadow-lift')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function ChartTip({ active, payload, label, format }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-white px-3 py-2 text-[12px] shadow-lift">
      <div className="font-semibold text-muted">{dayjs(label).format('ddd, D MMM')}</div>
      <div className="mt-0.5 flex items-center gap-1.5 font-bold text-ink">
        <span className="size-2 rounded-full" style={{ background: PLUM }} />
        {format(payload[0].value)}
      </div>
    </div>
  );
}

function TrendCard({ title, data, dataKey, format = num, axisFormat = num }) {
  const total = data.reduce((s, d) => s + (Number(d[dataKey]) || 0), 0);
  const last7 = data.slice(-7).reduce((s, d) => s + (Number(d[dataKey]) || 0), 0);
  const prev7 = data.slice(-14, -7).reduce((s, d) => s + (Number(d[dataKey]) || 0), 0);
  const delta = prev7 ? Math.round(((last7 - prev7) / prev7) * 100) : null;
  const gid = `grad-${dataKey}`;
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[12.5px] font-semibold text-muted">{title} · 30 days</div>
          <div className="mt-1 font-display text-[22px] font-extrabold leading-none text-ink">{format(total)}</div>
        </div>
        {delta !== null && (
          <span className={cx('rounded-full px-2 py-0.5 text-[11.5px] font-bold', delta >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700')} title="Last 7 days vs the 7 days before">
            {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}% wk
          </span>
        )}
      </div>
      <div className="mt-3 h-[150px]" role="img" aria-label={`${title} per day for the last 30 days, total ${format(total)}`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={PLUM} stopOpacity={0.16} />
                <stop offset="100%" stopColor={PLUM} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#efe9e1" />
            <XAxis dataKey="date" tickFormatter={(d) => dayjs(d).format('D MMM')} tick={{ fontSize: 11, fill: '#6b6178' }} axisLine={false} tickLine={false} minTickGap={28} />
            <YAxis width={44} tick={{ fontSize: 11, fill: '#6b6178' }} axisLine={false} tickLine={false} allowDecimals={false} tickFormatter={axisFormat} />
            <Tooltip content={<ChartTip format={format} />} cursor={{ stroke: '#c7ace5', strokeWidth: 1 }} />
            <Area type="monotone" dataKey={dataKey} stroke={PLUM} strokeWidth={2} fill={`url(#${gid})`} dot={false} isAnimationActive={false} activeDot={{ r: 4.5, strokeWidth: 2, stroke: '#fff', fill: PLUM }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function QueueCard({ label, count, to, icon: Icon, tone, description }) {
  const hot = count > 0;
  return (
    <Link
      to={to}
      className={cx(
        'group relative flex flex-col rounded-2xl border p-4 transition',
        hot
          ? tone === 'red'
            ? 'border-rose-200 bg-rose-50/80 hover:border-rose-300 hover:shadow-lift'
            : 'border-marigold-200 bg-marigold-50/70 hover:border-marigold-300 hover:shadow-lift'
          : 'border-line bg-white hover:border-plum-200',
      )}
    >
      <div className="flex items-center justify-between">
        <span className={cx('grid size-9 place-items-center rounded-xl', hot ? (tone === 'red' ? 'bg-rose-600 text-white' : 'bg-marigold-400 text-plum-950') : 'bg-sand text-muted')}>
          <Icon className="size-[18px]" />
        </span>
        <ArrowUpRight className="size-4 text-muted opacity-0 transition group-hover:opacity-100" />
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className={cx('font-display text-[28px] font-extrabold leading-none', hot ? (tone === 'red' ? 'text-rose-700' : 'text-marigold-800') : 'text-ink/40')}>{count}</span>
        {!hot && (
          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-700">
            <CircleCheck className="size-3.5" /> All clear
          </span>
        )}
      </div>
      <div className="mt-1 text-[13.5px] font-bold text-ink">{label}</div>
      <div className="text-[12px] text-muted">{description}</div>
    </Link>
  );
}

function BarRow({ label, value, max, right, sub }) {
  const pct = max ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div className="group" title={`${typeof label === 'string' ? label : ''} ${right}`}>
      <div className="flex items-center justify-between gap-3 text-[13px]">
        <span className="flex min-w-0 items-center gap-2 font-semibold text-ink">{label}</span>
        <span className="shrink-0 tabular-nums text-ink">
          <b className="font-bold">{right}</b>
          {sub && <span className="ml-1.5 text-muted">{sub}</span>}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-sand">
        <div className="h-full rounded-full bg-plum-600 transition-all group-hover:bg-plum-700" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-72" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-36 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-60 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function Dashboard() {
  const { stats, refresh, error, updatedAt } = useAdmin();
  const s = stats;

  const categoryMax = useMemo(() => Math.max(1, ...(s?.by_category || []).map((c) => c.gmv)), [s]);
  const statusTotal = useMemo(() => (s?.by_status || []).reduce((a, b) => a + b.count, 0), [s]);
  const statusMax = useMemo(() => Math.max(1, ...(s?.by_status || []).map((c) => c.count)), [s]);
  const destMax = useMemo(() => Math.max(1, ...(s?.top_destinations || []).map((c) => c.trips)), [s]);

  if (!s && error) return <ErrorState error={error} onRetry={refresh} />;
  if (!s) return <DashboardSkeleton />;

  const k = s.kpis;
  const q = s.queues;
  const revenueParts = [
    { label: 'Booking fees & commission', value: k.booking_revenue },
    { label: 'Marketplace (itinerary sales & tips)', value: k.marketplace_revenue },
    { label: 'Plus subscriptions', value: k.subscription_revenue },
  ];
  const statusOrder = ['needs_attention', 'proposed', 'requested', 'confirmed', 'completed', 'cancelled'];
  const byStatus = [...(s.by_status || [])].sort((a, b) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status));
  const openQueues = (q.needs_attention || 0) + (q.sos_active || 0) + (q.verifications || 0) + (q.payouts || 0) + (q.flagged_reviews || 0);

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.14em] text-marigold-600">{dayjs().format('dddd, D MMMM')}</div>
          <h1 className="text-[28px] font-extrabold leading-tight text-ink sm:text-[32px]">{greeting()} 👋</h1>
          <p className="mt-1 text-[15px] text-muted">
            {openQueues ? (
              <>
                <b className="text-ink">{openQueues}</b> item{openQueues === 1 ? '' : 's'} need your attention. Here’s how Itenary is doing.
              </>
            ) : (
              'All queues are clear. Here’s how Itenary is doing.'
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 text-[12.5px] text-muted">
          {updatedAt && <span>Updated {dayjs(updatedAt).format('h:mm A')}</span>}
          <Button size="sm" variant="secondary" icon={RefreshCw} onClick={refresh}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Needs attention */}
      <section>
        <h2 className="mb-3 text-[15px] font-bold text-ink">Needs your attention</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <QueueCard label="Bookings needing a human" description="Provider failures awaiting resolution" count={q.needs_attention} to="/admin/bookings?tab=attention" icon={Ticket} tone="red" />
          <QueueCard label="Active SOS alerts" description="Travellers who pressed SOS" count={q.sos_active} to="/admin/safety" icon={Siren} tone="red" />
          <QueueCard label="Verification requests" description="Travellers awaiting a badge" count={q.verifications} to="/admin/safety#verifications" icon={ShieldCheck} tone="marigold" />
          <QueueCard label="Payout requests" description="Creator earnings to send" count={q.payouts} to="/admin/payouts" icon={HandCoins} tone="marigold" />
          <QueueCard label="Flagged reviews" description="Reported by the community" count={q.flagged_reviews} to="/admin/reviews" icon={MessageSquareWarning} tone="marigold" />
        </div>
      </section>

      {/* Money headline */}
      <section className="grid gap-3 lg:grid-cols-[1.35fr_1fr_1fr]">
        <div className="card relative overflow-hidden p-5">
          <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-plum-100/60 blur-2xl" />
          <div className="relative flex items-center justify-between">
            <span className="text-[12.5px] font-semibold text-muted">Total platform revenue</span>
            <span className="grid size-8 place-items-center rounded-lg bg-plum-700 text-white">
              <Wallet className="size-4" />
            </span>
          </div>
          <div className="relative mt-1.5 font-display text-[40px] font-extrabold leading-none text-ink">{inr(k.total_revenue)}</div>
          <div className="relative mt-4 space-y-3">
            {revenueParts.map((p) => (
              <div key={p.label}>
                <div className="flex items-center justify-between text-[12.5px]">
                  <span className="text-muted">{p.label}</span>
                  <span className="font-bold tabular-nums text-ink">
                    {inr(p.value)} <span className="font-medium text-muted">· {k.total_revenue ? Math.round((p.value / k.total_revenue) * 100) : 0}%</span>
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sand">
                  <div className="h-full rounded-full bg-plum-600" style={{ width: `${k.total_revenue ? (p.value / k.total_revenue) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
          {k.refunds > 0 && <div className="relative mt-3 text-[12px] text-muted">Refunds issued: {inr(k.refunds)}</div>}
        </div>
        <div className="grid gap-3">
          <Kpi label="GMV (confirmed + completed)" value={inr(k.gmv)} hint={`${num(k.bookings)} live bookings`} icon={IndianRupee} tone="green" to="/admin/bookings" />
          <Kpi label="Bookings" value={num(k.bookings)} hint={`${num(k.proposals)} proposals from the concierge`} icon={Ticket} tone="plum" to="/admin/bookings" />
        </div>
        <div className="grid gap-3">
          <Kpi label="Proposal → booking conversion" value={`${k.conversion}%`} hint="Share of AI proposals travellers paid for" icon={Percent} tone="marigold" />
          <Kpi label="Online right now" value={num(k.online_now)} hint="Travellers with the app open" icon={Radio} tone="blue" />
        </div>
      </section>

      {/* People & trips KPIs */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 2xl:grid-cols-8">
        <Kpi label="Travellers" value={num(k.users)} hint="Registered accounts" icon={Users} to="/admin/users" />
        <Kpi label="New this week" value={num(k.users_new_7d)} hint="Signups, last 7 days" icon={UserPlus} tone="green" />
        <Kpi label="Active this week" value={num(k.active_7d)} hint={k.users ? `${Math.round((k.active_7d / k.users) * 100)}% of travellers` : '—'} icon={Activity} tone="blue" />
        <Kpi label="Plus members" value={num(k.plus_users)} hint="Active subscriptions" icon={Crown} tone="marigold" to="/admin/users?plan=plus" />
        <Kpi label="Creators" value={num(k.creators)} hint={`${num(k.itineraries)} published itineraries`} icon={Sparkles} tone="plum" to="/admin/marketplace" />
        <Kpi label="Forks" value={num(k.forks)} hint="Itineraries copied into trips" icon={TrendingUp} tone="green" />
        <Kpi label="Trips" value={num(k.trips)} hint="All time" icon={Luggage} to="/admin/trips" />
        <Kpi label="Active trips" value={num(k.trips_active)} hint="Planning, booked or ongoing" icon={MapPin} tone="blue" to="/admin/trips" />
      </section>

      {/* Trends */}
      <section>
        <h2 className="mb-3 text-[15px] font-bold text-ink">Last 30 days</h2>
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
          <TrendCard title="Signups" data={s.series} dataKey="signups" />
          <TrendCard title="Bookings" data={s.series} dataKey="bookings" />
          <TrendCard title="GMV" data={s.series} dataKey="gmv" format={(v) => inr(v)} axisFormat={(v) => inr(v, { compact: true })} />
          <TrendCard title="Revenue" data={s.series} dataKey="revenue" format={(v) => inr(v)} axisFormat={(v) => inr(v, { compact: true })} />
        </div>
      </section>

      {/* Breakdown */}
      <section className="grid gap-3 lg:grid-cols-3">
        <div className="card p-5">
          <h3 className="text-[15px] font-bold text-ink">Bookings by category</h3>
          <p className="text-[12.5px] text-muted">GMV of live bookings</p>
          <div className="mt-4 space-y-4">
            {(s.by_category || []).length === 0 && <p className="py-6 text-center text-sm text-muted">No bookings yet.</p>}
            {(s.by_category || []).map((c) => (
              <BarRow
                key={c.category}
                label={
                  <>
                    <span className="text-base leading-none">{CATEGORY[c.category]?.emoji || '•'}</span>
                    {CATEGORY[c.category]?.label || c.category}
                  </>
                }
                value={c.gmv}
                max={categoryMax}
                right={inr(c.gmv)}
                sub={`${num(c.count)} booking${c.count === 1 ? '' : 's'}`}
              />
            ))}
          </div>
        </div>
        <div className="card p-5">
          <h3 className="text-[15px] font-bold text-ink">Bookings by status</h3>
          <p className="text-[12.5px] text-muted">{num(statusTotal)} booking records incl. proposals</p>
          <div className="mt-4 space-y-3">
            {byStatus.map((b) => (
              <Link key={b.status} to={b.status === 'needs_attention' ? '/admin/bookings?tab=attention' : `/admin/bookings?status=${b.status}`} className="group block">
                <div className="flex items-center justify-between gap-3">
                  <StatusBadge map={BOOKING_STATUS_ADMIN} value={b.status} />
                  <span className="text-[13px] tabular-nums text-ink">
                    <b>{num(b.count)}</b> <span className="text-muted">· {statusTotal ? Math.round((b.count / statusTotal) * 100) : 0}%</span>
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-sand">
                  <div className={cx('h-full rounded-full', b.status === 'needs_attention' ? 'bg-rose-500' : 'bg-plum-400 group-hover:bg-plum-600')} style={{ width: `${(b.count / statusMax) * 100}%` }} />
                </div>
              </Link>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <h3 className="text-[15px] font-bold text-ink">Top destinations</h3>
          <p className="text-[12.5px] text-muted">By number of trips planned</p>
          <ol className="mt-4 space-y-3">
            {(s.top_destinations || []).length === 0 && <p className="py-6 text-center text-sm text-muted">No trips yet.</p>}
            {(s.top_destinations || []).map((d, i) => (
              <li key={d.destination} className="flex items-center gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-md bg-sand text-[11px] font-bold text-muted">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <BarRow label={d.destination} value={d.trips} max={destMax} right={`${d.trips} trip${d.trips === 1 ? '' : 's'}`} />
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Recent activity + AI */}
      <section className="grid gap-3 lg:grid-cols-[1.4fr_1fr_0.9fr]">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line/80 px-5 py-3.5">
            <h3 className="text-[15px] font-bold text-ink">Recent bookings</h3>
            <Link to="/admin/bookings" className="text-[12.5px] font-semibold text-plum-700 hover:underline">
              View all
            </Link>
          </div>
          <ul className="divide-y divide-line/70">
            {(s.recent_bookings || []).length === 0 && <li className="px-5 py-10 text-center text-sm text-muted">No bookings yet.</li>}
            {(s.recent_bookings || []).map((b) => (
              <li key={b.id}>
                <Link to={`/admin/bookings?open=${b.id}`} className="flex items-center gap-3 px-5 py-3 transition hover:bg-plum-50/40">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-sand text-lg">{CATEGORY[b.category]?.emoji || '🎫'}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold text-ink">{b.title}</span>
                    <span className="block truncate text-[12px] text-muted">
                      {b.user_name || 'Unknown'} · {timeAgo(b.created_at)}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-[13.5px] font-bold tabular-nums text-ink">{inr(b.total)}</span>
                    <StatusBadge map={BOOKING_STATUS_ADMIN} value={b.status} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line/80 px-5 py-3.5">
            <h3 className="text-[15px] font-bold text-ink">Recent signups</h3>
            <Link to="/admin/users" className="text-[12.5px] font-semibold text-plum-700 hover:underline">
              View all
            </Link>
          </div>
          <ul className="divide-y divide-line/70">
            {(s.recent_users || []).map((u) => (
              <li key={u.id}>
                <Link to={`/admin/users/${u.id}`} className="flex items-center gap-3 px-5 py-3 transition hover:bg-plum-50/40">
                  <Avatar user={u} size={34} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1 truncate text-[13.5px] font-semibold text-ink">
                      <span className="truncate">{u.name || 'New traveller'}</span>
                      {u.verified ? <VerifiedBadge className="size-3.5" /> : null}
                    </span>
                    <span className="block truncate text-[12px] text-muted">{u.phone}</span>
                  </span>
                  <span className="shrink-0 text-[12px] text-muted">{timeAgo(u.created_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className={cx('card relative overflow-hidden p-5', s.ai?.engine === 'claude' ? '' : '')}>
          <div className="flex items-center gap-3">
            <span className={cx('grid size-11 place-items-center rounded-2xl', s.ai?.engine === 'claude' ? 'bg-emerald-50 text-emerald-700' : 'bg-marigold-50 text-marigold-700')}>
              <Bot className="size-5" />
            </span>
            <div>
              <h3 className="text-[15px] font-bold text-ink">Yatri AI concierge</h3>
              <div className="mt-0.5">
                {!s.ai?.enabled ? (
                  <Badge tone="red" dot>
                    Disabled
                  </Badge>
                ) : s.ai.engine === 'claude' ? (
                  <Badge tone="green" dot>
                    Claude live
                  </Badge>
                ) : (
                  <Badge tone="marigold" dot>
                    Built-in engine
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <dl className="mt-5 space-y-2.5 text-[13px]">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Engine</dt>
              <dd className="font-semibold text-ink">{s.ai?.engine === 'claude' ? 'Anthropic Claude' : 'Built-in rules engine'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Configured model</dt>
              <dd className="font-mono text-[12px] font-semibold text-ink">{s.ai?.model}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Proposals made</dt>
              <dd className="font-semibold text-ink">{num(k.proposals)}</dd>
            </div>
          </dl>
          <p className="mt-4 rounded-xl bg-paper px-3 py-2.5 text-[12.5px] leading-relaxed text-muted">
            {s.ai?.engine === 'claude'
              ? 'The concierge is running on Claude. Every proposal still needs the traveller’s explicit UPI confirmation.'
              : s.ai?.enabled
                ? 'No Anthropic API key is configured, so the concierge uses the built-in engine. Add a key in Settings to switch to Claude.'
                : 'The AI concierge is switched off for all travellers.'}
          </p>
          <Button to="/admin/settings" size="sm" variant="soft" className="mt-4 w-full">
            AI settings
          </Button>
        </div>
      </section>
    </div>
  );
}
