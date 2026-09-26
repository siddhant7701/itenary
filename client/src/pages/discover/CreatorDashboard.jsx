import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Crown,
  Eye,
  GitFork,
  HandCoins,
  IndianRupee,
  LockOpen,
  Pencil,
  Percent,
  Plus,
  Receipt,
  Share2,
  ShoppingBag,
  Star,
  User,
  Users,
  Wallet,
} from 'lucide-react';
import CoverArt from '../../components/CoverArt';
import { Badge, Button, Card, ErrorState, Field, Input, Modal, PageHeader, Progress, SectionTitle, Skeleton, StatCard, cx } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useFetch } from '../../lib/hooks';
import { fmtDate, inr, num, timeAgo } from '../../lib/format';
import EditListingModal from './EditListingModal';
import { PAYOUT_STATUS, plural, useStableCallback } from './constants';

const PLUM = '#7439a8';
const MARIGOLD = '#dd6505';
const GRID = '#efe9e1';
const AXIS = { fontSize: 11, fill: '#6b6178' };

export default function CreatorDashboard() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useFetch('/creator/dashboard');
  const [editing, setEditing] = useState(null);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const closeEdit = useStableCallback(() => setEditing(null));
  const closePayout = useStableCallback(() => setPayoutOpen(false));

  const header = (
    <PageHeader
      eyebrow="Creator studio"
      title="Your creator dashboard"
      subtitle="Publish trips, grow a following and earn from every unlock and tip."
      actions={
        <>
          {user && (
            <Button variant="secondary" icon={User} to={`/app/u/${user.id}`}>
              Public profile
            </Button>
          )}
          <Button icon={Plus} to="/app/trips">
            Publish a trip
          </Button>
        </>
      }
    />
  );

  if (loading && !data) {
    return (
      <div>
        {header}
        <DashboardSkeleton />
      </div>
    );
  }
  if (error && !data) {
    return (
      <div>
        {header}
        <ErrorState error={error} onRetry={reload} />
      </div>
    );
  }

  const { totals, balance, fees, series, itineraries, recent, payouts, upi_id } = data;

  if (!itineraries.length) {
    return (
      <div className="animate-fade-up">
        {header}
        <EmptyStudio fees={fees} />
      </div>
    );
  }

  const earned30 = series.reduce((a, s) => a + (s.earnings || 0), 0);
  const followerGain = series.length ? series[series.length - 1].followers - series[0].followers : 0;

  return (
    <div className="animate-fade-up space-y-8">
      {header}

      {/* KPIs */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-plum-800 via-plum-900 to-plum-950 p-6 text-white shadow-lift">
          <div className="absolute -right-10 -top-10 size-40 rounded-full bg-marigold-400/20 blur-2xl" aria-hidden="true" />
          <div className="relative">
            <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.14em] text-marigold-200">
              <IndianRupee className="size-4" /> Net earnings
            </div>
            <div className="mt-2 font-display text-[44px] font-extrabold leading-none">{inr(totals.net)}</div>
            <p className="mt-3 text-[13px] leading-relaxed text-white/75">
              {inr(totals.sales_gross)} from {plural(totals.sales, 'sale')} + {inr(totals.tips)} in tips, after {inr(totals.platform_fee)} platform fees.
            </p>
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[12.5px] font-semibold ring-1 ring-white/15">
              <Wallet className="size-3.5 text-marigold-300" /> {inr(balance.available)} ready to withdraw
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:col-span-2">
          <StatCard label="Sales" value={num(totals.sales)} hint={`${inr(totals.sales_gross)} gross`} icon={ShoppingBag} tone="plum" />
          <StatCard label="Tips" value={inr(totals.tips)} hint="From grateful travellers" icon={HandCoins} tone="marigold" />
          <StatCard label="Platform fee paid" value={inr(totals.platform_fee)} hint={`${fees.marketplace_fee_pct}% sales · ${fees.tip_fee_pct}% tips`} icon={Percent} tone="red" />
          <StatCard label="Followers" value={num(totals.followers)} hint={followerGain > 0 ? `+${followerGain} in 30 days` : 'People following your plans'} icon={Users} tone="blue" />
          <StatCard label="Forks" value={num(totals.forks)} hint="Trips built from yours" icon={GitFork} tone="green" />
          <StatCard label="Views" value={num(totals.views)} hint={`Across ${plural(itineraries.length, 'itinerary', 'itineraries')}`} icon={Eye} tone="plum" />
        </div>
      </section>

      {/* Charts + payouts */}
      <section className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card className="min-w-0">
            <ChartHeader title="Earnings per day" caption="Your share after fees · last 30 days" value={inr(earned30)} />
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap={2}>
                  <CartesianGrid vertical={false} stroke={GRID} />
                  <XAxis dataKey="date" tickFormatter={(d) => dayjs(d).format('D MMM')} tick={AXIS} axisLine={false} tickLine={false} minTickGap={28} />
                  <YAxis tickFormatter={(v) => inr(v, { compact: true })} tick={AXIS} axisLine={false} tickLine={false} width={48} allowDecimals={false} />
                  <Tooltip cursor={{ fill: 'rgb(116 57 168 / 0.07)' }} content={<ChartTip kind="earnings" />} />
                  <Bar dataKey="earnings" name="Earnings" fill={PLUM} radius={[4, 4, 0, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card className="min-w-0">
            <ChartHeader title="Follower growth" caption="Total followers · last 30 days" value={followerGain > 0 ? `+${num(followerGain)}` : num(totals.followers)} />
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="tc-followers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor={MARIGOLD} stopOpacity={0.22} />
                      <stop offset="1" stopColor={MARIGOLD} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke={GRID} />
                  <XAxis dataKey="date" tickFormatter={(d) => dayjs(d).format('D MMM')} tick={AXIS} axisLine={false} tickLine={false} minTickGap={28} />
                  <YAxis tick={AXIS} axisLine={false} tickLine={false} width={36} allowDecimals={false} domain={[(min) => Math.max(0, Math.floor(min * 0.9)), (max) => Math.ceil(max * 1.05) + 1]} />
                  <Tooltip cursor={{ stroke: MARIGOLD, strokeOpacity: 0.35, strokeWidth: 1 }} content={<ChartTip kind="followers" />} />
                  <Area type="monotone" dataKey="followers" name="Followers" stroke={MARIGOLD} strokeWidth={2} fill="url(#tc-followers)" activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <PayoutPanel balance={balance} fees={fees} upiId={upi_id} onRequest={() => setPayoutOpen(true)} />
          <Explainer fees={fees} />
        </div>
      </section>

      {/* Itineraries */}
      <section>
        <SectionTitle
          title="My itineraries"
          subtitle={`${plural(itineraries.length, 'listing')} · edit price, tags and visibility any time`}
          action={
            <Button size="sm" variant="soft" icon={Plus} to="/app/trips">
              Publish another
            </Button>
          }
        />
        <ItineraryTable itineraries={itineraries} fees={fees} onEdit={setEditing} />
      </section>

      {/* Activity */}
      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="min-w-0">
          <h2 className="text-lg font-bold text-ink">Recent sales & tips</h2>
          <p className="text-[13px] text-muted">What you earned after fees</p>
          {recent.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">No sales or tips yet — share your itineraries to get the first one.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line/70">
              {recent.map((r) => {
                const sale = r.kind === 'purchase';
                return (
                  <li key={r.id} className="flex items-center gap-3 py-3">
                    <span className={cx('grid size-9 shrink-0 place-items-center rounded-xl', sale ? 'bg-plum-50 text-plum-700' : 'bg-marigold-50 text-marigold-700')}>
                      {sale ? <LockOpen className="size-4" /> : <HandCoins className="size-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] text-ink/85">
                        <span className="font-semibold text-ink">{r.buyer_name}</span> {sale ? 'unlocked' : 'tipped you for'} <span className="font-semibold text-ink">{r.itinerary_title}</span>
                      </div>
                      <div className="text-[12px] text-muted">
                        {timeAgo(r.created_at)} · paid {inr(r.amount)} · {inr(r.platform_fee)} fee
                      </div>
                    </div>
                    <span className="shrink-0 font-display text-[15px] font-bold text-emerald-700">+{inr(r.creator_earning)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="min-w-0">
          <h2 className="text-lg font-bold text-ink">Payout history</h2>
          <p className="text-[13px] text-muted">Transfers to your UPI ID</p>
          {payouts.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">No payouts yet. Once you have {inr(fees.min_payout)} available, request your first one.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line/70">
              {payouts.map((p) => {
                const st = PAYOUT_STATUS[p.status] || { label: p.status, tone: 'neutral' };
                return (
                  <li key={p.id} className="flex items-start gap-3 py-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                      <Banknote className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-[15px] font-bold text-ink">{inr(p.amount)}</span>
                        <Badge tone={st.tone} dot>
                          {st.label}
                        </Badge>
                      </div>
                      <div className="truncate text-[12px] text-muted">
                        Requested {fmtDate(p.created_at)} · to {p.upi_id}
                        {p.processed_at && p.status === 'paid' && <> · sent {fmtDate(p.processed_at)}</>}
                      </div>
                      {p.note && <div className={cx('mt-1 text-[12.5px]', p.status === 'rejected' ? 'text-rose-700' : 'text-ink/70')}>{p.note}</div>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </section>

      <EditListingModal open={!!editing} onClose={closeEdit} itinerary={editing} feePct={fees.marketplace_fee_pct} onSaved={() => reload()} />
      <PayoutModal open={payoutOpen} onClose={closePayout} balance={balance} fees={fees} upiId={upi_id} onDone={reload} />
    </div>
  );
}

// ------------------------------------------------------------------ Charts

function ChartHeader({ title, caption, value }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-[16px] font-bold text-ink">{title}</h2>
        <p className="text-[12.5px] text-muted">{caption}</p>
      </div>
      <div className="font-display text-[22px] font-extrabold leading-none text-ink">{value}</div>
    </div>
  );
}

function ChartTip({ active, payload, kind }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-xl border border-line bg-white px-3 py-2 text-[12.5px] shadow-lift">
      <div className="font-semibold text-muted">{dayjs(p.date).format('ddd, D MMM')}</div>
      {kind === 'earnings' ? (
        <>
          <div className="mt-0.5 font-display text-[16px] font-bold text-ink">{inr(p.earnings)}</div>
          <div className="text-muted">
            {plural(p.sales, 'payment')}
            {p.forks ? ` · ${plural(p.forks, 'fork')}` : ''}
          </div>
        </>
      ) : (
        <>
          <div className="mt-0.5 font-display text-[16px] font-bold text-ink">{plural(p.followers, 'follower')}</div>
          {p.forks > 0 && <div className="text-muted">{plural(p.forks, 'fork')} that day</div>}
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Payouts

function PayoutPanel({ balance, fees, upiId, onRequest }) {
  const canRequest = !!upiId && balance.available >= fees.min_payout;
  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="text-[16px] font-bold text-ink">Payouts</h2>
        <Badge tone="green" icon={Wallet}>
          UPI
        </Badge>
      </div>
      <div className="mt-3 rounded-2xl bg-gradient-to-br from-emerald-50 to-white p-4 ring-1 ring-inset ring-emerald-100">
        <div className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-emerald-800">Available to withdraw</div>
        <div className="mt-1 font-display text-[34px] font-extrabold leading-none text-ink">{inr(balance.available)}</div>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        {[
          ['Earned', balance.earned],
          ['Pending', balance.pending_payouts],
          ['Paid out', balance.paid],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-paper px-1 py-2 ring-1 ring-inset ring-line/70">
            <dt className="text-[11px] font-semibold text-muted">{k}</dt>
            <dd className="font-display text-[14.5px] font-bold text-ink">{inr(v)}</dd>
          </div>
        ))}
      </dl>

      {upiId ? (
        <p className="mt-3 text-[12.5px] text-muted">
          Payouts go to <span className="font-semibold text-ink">{upiId}</span> ·{' '}
          <Link to="/app/profile" className="font-semibold text-plum-700 hover:underline">
            Change
          </Link>
        </p>
      ) : (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-marigold-50 px-3 py-2.5 text-[12.5px] text-marigold-900 ring-1 ring-inset ring-marigold-100">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            Add your UPI ID to receive payouts.{' '}
            <Link to="/app/profile" className="font-bold underline">
              Add it in your profile
            </Link>
          </span>
        </div>
      )}

      <Button className="mt-4 w-full" icon={Banknote} disabled={!canRequest} onClick={onRequest}>
        Request payout
      </Button>
      <p className="mt-2 text-center text-[11.5px] text-muted">
        Minimum payout {inr(fees.min_payout)}
        {upiId && balance.available < fees.min_payout ? ` · ${inr(fees.min_payout - balance.available)} to go` : ''}
      </p>
    </Card>
  );
}

function PayoutModal({ open, onClose, balance, fees, upiId, onDone }) {
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    // reset each time the modal opens
    setLastOpen(open);
    if (open) setAmount(String(balance.available));
  }
  const n = Number(amount);
  const error = amount === '' ? '' : !Number.isInteger(n) ? 'Whole rupees only' : n < fees.min_payout ? `Minimum payout is ${inr(fees.min_payout)}` : n > balance.available ? `You can withdraw up to ${inr(balance.available)}` : '';
  const valid = amount !== '' && !error;

  async function submit(e) {
    e?.preventDefault();
    if (!valid) return;
    setBusy(true);
    try {
      await api.post('/creator/payouts', { amount: n });
      toast.success(`Payout of ${inr(n)} requested — we’ll notify you when it’s sent`);
      onClose();
      onDone?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  const presets = [...new Set([fees.min_payout, Math.floor(balance.available / 2), balance.available])].filter((v) => v >= fees.min_payout && v <= balance.available);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Request payout"
      description={`Sent to ${upiId} after a quick review.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button icon={Banknote} loading={busy} disabled={!valid} onClick={submit}>
            Request {valid ? inr(n) : ''}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-3">
        <Field label="Amount" error={error} hint={`Available ${inr(balance.available)} · minimum ${inr(fees.min_payout)}`}>
          <Input type="number" inputMode="numeric" min={fees.min_payout} max={balance.available} step={1} value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))} className="font-display text-lg font-bold" />
        </Field>
        {presets.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <button key={p} type="button" onClick={() => setAmount(String(p))} className={cx('chip', n === p && 'chip-active')}>
                {p === balance.available ? `All · ${inr(p)}` : inr(p)}
              </button>
            ))}
          </div>
        )}
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

// ------------------------------------------------------------------ Itineraries

function ItineraryTable({ itineraries, fees, onEdit }) {
  return (
    <>
      {/* Desktop table */}
      <Card padded={false} className="hidden overflow-hidden md:block">
        <table className="w-full text-left text-[13.5px]">
          <thead className="border-b border-line bg-paper/70 text-[11.5px] font-bold uppercase tracking-wider text-muted">
            <tr>
              <th className="w-full px-5 py-3">Itinerary</th>
              <th className="px-3 py-3 text-right">Forks</th>
              <th className="px-3 py-3 text-right">Sales</th>
              <th className="px-3 py-3 text-right">Gross</th>
              <th className="px-3 py-3 text-right">Net</th>
              <th className="px-3 py-3 text-right">Rating</th>
              <th className="px-5 py-3 text-right">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/70">
            {itineraries.map((i) => (
              <tr key={i.id} className="transition hover:bg-paper/60">
                <td className="w-full max-w-0 px-5 py-3">
                  <div className="flex items-center gap-3">
                    <CoverArt theme={i.cover_theme} seed={i.id} rounded={false} className="size-12 shrink-0 rounded-xl" />
                    <div className="min-w-0">
                      <Link to={`/app/itineraries/${i.id}`} className="block truncate font-semibold text-ink hover:text-plum-700">
                        {i.title}
                      </Link>
                      <ListingMeta i={i} />
                      <PromoteProgress i={i} fees={fees} />
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 text-right font-semibold tabular-nums">{num(i.fork_count)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{num(i.sales_count)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{inr(i.gross)}</td>
                <td className="px-3 py-3 text-right font-bold tabular-nums text-emerald-700">{inr(i.net)}</td>
                <td className="px-3 py-3 text-right tabular-nums">
                  {i.rating_count ? (
                    <span className="inline-flex items-center gap-1">
                      <Star className="size-3.5 fill-marigold-400 text-marigold-400" />
                      {Number(i.rating_avg).toFixed(1)}
                    </span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="px-5 py-3 text-right">
                  <Button size="xs" variant="secondary" icon={Pencil} onClick={() => onEdit(i)}>
                    Edit
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {itineraries.map((i) => (
          <Card key={i.id} padded={false} className="p-4">
            <div className="flex items-start gap-3">
              <CoverArt theme={i.cover_theme} seed={i.id} rounded={false} className="size-14 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1">
                <Link to={`/app/itineraries/${i.id}`} className="line-clamp-2 font-semibold leading-snug text-ink">
                  {i.title}
                </Link>
                <ListingMeta i={i} />
              </div>
              <Button size="icon-sm" variant="secondary" icon={Pencil} onClick={() => onEdit(i)} aria-label={`Edit ${i.title}`} />
            </div>
            <PromoteProgress i={i} fees={fees} />
            <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
              {[
                ['Forks', num(i.fork_count)],
                ['Sales', num(i.sales_count)],
                ['Gross', inr(i.gross, { compact: true })],
                ['Net', inr(i.net, { compact: true })],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-paper py-1.5 ring-1 ring-inset ring-line/70">
                  <dt className="text-[10.5px] font-semibold text-muted">{k}</dt>
                  <dd className={cx('font-display text-[14px] font-bold', k === 'Net' ? 'text-emerald-700' : 'text-ink')}>{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
        ))}
      </div>
    </>
  );
}

function ListingMeta({ i }) {
  return (
    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
      {i.status === 'published' ? (
        <Badge tone="green" dot>
          Live
        </Badge>
      ) : (
        <Badge tone="neutral" dot>
          {i.status === 'unpublished' ? 'Unpublished' : i.status}
        </Badge>
      )}
      {i.verified_premium && (
        <Badge tone="marigold" icon={Crown}>
          Verified premium
        </Badge>
      )}
      <span className="font-semibold text-ink/80">{i.price > 0 ? inr(i.price) : 'Free'}</span>
      <span>· {plural(i.view_count, 'view')}</span>
    </div>
  );
}

function PromoteProgress({ i, fees }) {
  if (i.verified_premium || !fees.auto_promote_forks || i.fork_count >= fees.auto_promote_forks) return null;
  return (
    <div className="mt-2 max-w-64">
      <div className="mb-1 flex justify-between text-[11px] font-semibold text-muted">
        <span>
          {i.fork_count}/{fees.auto_promote_forks} forks to Verified Premium
        </span>
      </div>
      <Progress value={i.fork_count} max={fees.auto_promote_forks} tone="marigold" className="h-1.5" />
    </div>
  );
}

// ------------------------------------------------------------------ Explainer & empty

function steps(fees) {
  return [
    { icon: Share2, title: 'Publish for free', text: 'Publish any trip for free from its Share tab — every stop, tip and cost carries over.' },
    {
      icon: IndianRupee,
      title: 'Earn from unlocks & tips',
      text: `Set a price to earn via unlock fees and tips. You keep ${100 - fees.marketplace_fee_pct}% of every sale and ${100 - fees.tip_fee_pct}% of tips.`,
    },
    { icon: Crown, title: 'Get promoted', text: `Itineraries with ≥ ${fees.auto_promote_forks} forks get auto-promoted to Verified Premium.` },
  ];
}

function Explainer({ fees }) {
  return (
    <Card className="bg-gradient-to-br from-marigold-50 via-white to-plum-50">
      <h2 className="text-[16px] font-bold text-ink">How creators earn</h2>
      <ol className="mt-3 space-y-3">
        {steps(fees).map((s, idx) => (
          <li key={s.title} className="flex gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-white text-plum-700 shadow-soft ring-1 ring-line">
              <s.icon className="size-4" />
            </span>
            <div>
              <div className="text-[13.5px] font-bold text-ink">
                {idx + 1}. {s.title}
              </div>
              <p className="text-[12.5px] leading-relaxed text-muted">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function EmptyStudio({ fees }) {
  return (
    <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
      <div className="relative overflow-hidden rounded-3xl bg-plum-900 p-6 text-white shadow-lift sm:p-8">
        <div className="pointer-events-none absolute inset-y-0 right-0 w-full opacity-40 [mask-image:linear-gradient(to_right,transparent,black_60%)]" aria-hidden="true">
          <CoverArt theme="festival" seed="creator-empty" rounded={false} className="size-full" />
        </div>
        <div className="relative max-w-md">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11.5px] font-bold uppercase tracking-[0.12em] text-marigold-200 ring-1 ring-white/15">
            <Receipt className="size-3.5" /> Creator studio
          </span>
          <h2 className="mt-3 font-display text-[28px] font-extrabold leading-tight sm:text-[34px]">Your trips could pay for your next one.</h2>
          <p className="mt-2 text-[14.5px] leading-relaxed text-white/80">
            Publish a trip you’ve planned and other travellers can fork it. Charge a small unlock fee or keep it free and collect tips — paid out straight to your UPI ID.
          </p>
          <Button variant="accent" size="lg" className="mt-5" iconRight={ArrowRight} to="/app/trips">
            Choose a trip to publish
          </Button>
        </div>
      </div>
      <Explainer fees={fees} />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-52 rounded-3xl" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:col-span-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Skeleton className="h-72 rounded-2xl xl:col-span-2" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}
