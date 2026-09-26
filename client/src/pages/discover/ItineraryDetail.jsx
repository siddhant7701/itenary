import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronLeft,
  Crown,
  Eye,
  EyeOff,
  Flag,
  GitFork,
  HandCoins,
  Heart,
  Lock,
  LockOpen,
  MapPin,
  Pencil,
  Route,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  UserCheck,
  UserPlus,
  Wallet,
} from 'lucide-react';
import CoverArt from '../../components/CoverArt';
import UpiPaySheet from '../../components/UpiPaySheet';
import { Avatar, Badge, Button, Card, ErrorState, Field, Input, Modal, SectionTitle, Skeleton, Stars, Textarea, VerifiedBadge, cx, useConfirm } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useFetch } from '../../lib/hooks';
import { ITEM_TYPES, fmtRange, fmtTime, inr, num, timeAgo } from '../../lib/format';
import ItineraryCard from './ItineraryCard';
import ItineraryMap from './ItineraryMap';
import EditListingModal from './EditListingModal';
import { TAG_EMOJI, fmtDuration, plural, useStableCallback } from './constants';

export default function ItineraryDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data, loading, error, reload, setData } = useFetch(`/itineraries/${id}`);

  const [forkOpen, setForkOpen] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const [tipOpen, setTipOpen] = useState(false);
  const [tipAmount, setTipAmount] = useState(0);
  const [tipPayOpen, setTipPayOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  const it = data?.itinerary;
  const days = useMemo(() => it?.content || [], [it]);

  // Numbered map pins for every stop with coordinates (shared numbering with the timeline).
  const { points, pinFor } = useMemo(() => {
    const pts = [];
    const pins = {};
    days.forEach((d) =>
      (d.items || []).forEach((x, idx) => {
        if (x.lat == null || x.lng == null || !Number.isFinite(Number(x.lat)) || !Number.isFinite(Number(x.lng))) return;
        const n = pts.length + 1;
        pins[`${d.day_number}-${idx}`] = n;
        pts.push({ lat: Number(x.lat), lng: Number(x.lng), title: x.title, type: x.type, day: d.day_number, start_time: x.start_time, n });
      }),
    );
    return { points: pts, pinFor: pins };
  }, [days]);

  const closeFork = useStableCallback(() => setForkOpen(false));
  const closeTip = useStableCallback(() => setTipOpen(false));
  const closeEdit = useStableCallback(() => setEditOpen(false));

  const stale = !!it && it.id !== id;
  if ((loading && (!data || stale)) || (!data && !error)) return <DetailSkeleton />;
  if (error && (!data || stale)) return <ErrorState error={error} onRetry={reload} />;

  const creator = it.creator || {};
  const isOwner = !!user && user.id === creator.id;
  const locked = !!it.locked;
  const premium = Number(it.price) > 0;
  const totalStops = days.reduce((a, d) => a + (d.locked ? d.item_count || 0 : (d.items || []).length), 0);
  const listedCost = days.reduce((a, d) => a + (d.items || []).reduce((s, x) => s + (Number(x.cost) || 0), 0), 0);
  const reviewedAlready = !!user && data.reviews.some((r) => r.user_id === user.id);

  const patchIt = (p) => setData((d) => ({ ...d, itinerary: { ...d.itinerary, ...p } }));

  async function toggleLike() {
    const prev = { liked: it.liked, like_count: it.like_count };
    patchIt({ liked: !prev.liked, like_count: Math.max(0, prev.like_count + (prev.liked ? -1 : 1)) });
    try {
      const r = await api.post(`/itineraries/${it.id}/like`);
      patchIt({ liked: r.liked, like_count: r.like_count });
    } catch (err) {
      patchIt(prev);
      toast.error(err.message);
    }
  }

  async function toggleFollow() {
    setFollowBusy(true);
    try {
      const r = await api.post(`/users/${creator.id}/follow`);
      setData((d) => ({ ...d, is_following: r.following, creator_stats: { ...d.creator_stats, followers: r.followers } }));
      toast.success(r.following ? `You’re following ${creator.name}` : `Unfollowed ${creator.name}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setFollowBusy(false);
    }
  }

  async function share() {
    const url = `${window.location.origin}/app/itineraries/${it.id}`;
    try {
      if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ title: it.title, text: `${it.title} — a ${it.days_count}-day ${it.destination} plan on Itenary`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success('Link copied — send it to your group');
    } catch (err) {
      if (err?.name !== 'AbortError') toast.error('Couldn’t copy the link. Copy it from the address bar instead.');
    }
  }

  return (
    <div className="animate-fade-up">
      <Link to="/app/explore" className="mb-3 inline-flex items-center gap-1 text-[13px] font-semibold text-muted hover:text-plum-700">
        <ChevronLeft className="size-4" /> Explore
      </Link>

      {isOwner && it.status !== 'published' && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-sand px-4 py-3 text-[13.5px] text-ink/80">
          <EyeOff className="size-4 shrink-0" />
          <span className="flex-1">This listing is unpublished — only you can see it.</span>
          <Button size="xs" variant="secondary" onClick={() => setEditOpen(true)}>
            Publish
          </Button>
        </div>
      )}

      <Hero it={it} totalStops={totalStops} />

      {it.tags?.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {it.tags.map((t) => (
            <Link key={t} to={`/app/explore?tags=${encodeURIComponent(t)}`} className="chip">
              <span aria-hidden="true">{TAG_EMOJI[t] || '•'}</span> {t}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* Sidebar (first on mobile) */}
        <aside className="space-y-4 xl:sticky xl:top-24 xl:order-2 xl:self-start">
          <ActionCard
            it={it}
            isOwner={isOwner}
            locked={locked}
            premium={premium}
            onFork={() => setForkOpen(true)}
            onUnlock={() => setBuyOpen(true)}
            onLike={toggleLike}
            onTip={() => setTipOpen(true)}
            onShare={share}
            onEdit={() => setEditOpen(true)}
          />
          <CreatorCard creator={creator} stats={data.creator_stats} following={data.is_following} isOwner={isOwner} busy={followBusy} onFollow={toggleFollow} />
        </aside>

        {/* Main column */}
        <div className="min-w-0 space-y-8 xl:order-1">
          <About it={it} totalStops={totalStops} />

          <section>
            <SectionTitle
              title="Day by day"
              subtitle={`${plural(days.length, 'day')} · ${plural(totalStops, 'stop')}${listedCost > 0 && !locked ? ` · ~${inr(listedCost)} in listed costs` : ''}`}
            />
            <div className="space-y-4">
              {days.map((d, idx) => (
                <DayCard key={d.day_number} day={d} preview={locked && idx === 0} pinFor={pinFor} />
              ))}
              {locked && !isOwner && (
                <UnlockBanner
                  price={it.price}
                  lockedDays={days.filter((d) => d.locked).length}
                  lockedStops={days.reduce((a, d) => a + (d.locked ? d.item_count || 0 : 0), 0)}
                  onUnlock={() => setBuyOpen(true)}
                />
              )}
              {days.length === 0 && <p className="rounded-2xl border border-dashed border-line bg-white/60 px-5 py-8 text-center text-sm text-muted">The creator hasn’t added any days yet.</p>}
            </div>
          </section>

          {points.length > 0 && (
            <section>
              <SectionTitle title="On the map" subtitle={locked ? 'Showing the free preview — unlock to see every stop' : `${plural(points.length, 'mapped stop')} in order`} />
              <div className="relative z-0 overflow-hidden rounded-2xl border border-line shadow-soft">
                <ItineraryMap key={`${it.id}-${points.length}`} points={points} className="h-72 sm:h-80" />
              </div>
            </section>
          )}

          <Reviews
            it={it}
            reviews={data.reviews}
            canReview={data.can_review}
            isOwner={isOwner}
            reviewedAlready={reviewedAlready}
            userId={user?.id}
            locked={locked}
            onPosted={reload}
          />
        </div>
      </div>

      {data.more?.length > 0 && (
        <section className="mt-12">
          <SectionTitle
            title="More like this"
            subtitle={`More from ${creator.name?.split(' ')[0] || 'this creator'} and ${it.destination}`}
            action={
              <Link to="/app/explore" className="inline-flex items-center gap-1 text-[13px] font-semibold text-plum-700 hover:underline">
                Explore all <ArrowRight className="size-3.5" />
              </Link>
            }
          />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {data.more.map((m) => (
              <ItineraryCard key={m.id} itinerary={m} compact />
            ))}
          </div>
        </section>
      )}

      {/* Flows */}
      <ForkModal open={forkOpen} onClose={closeFork} itinerary={it} totalStops={totalStops} onNeedPurchase={() => setBuyOpen(true)} />

      <UpiPaySheet
        open={buyOpen}
        onClose={() => setBuyOpen(false)}
        amount={it.price}
        title="Unlock itinerary"
        lines={[
          { label: 'Itinerary', value: it.title },
          { label: 'Creator', value: creator.name },
          { label: 'Access', value: 'Lifetime · fork unlimited times' },
        ]}
        note={`One-time payment. Every day unlocks instantly and most of it goes straight to ${creator.name?.split(' ')[0] || 'the creator'}.`}
        payLabel={`Unlock for ${inr(it.price)}`}
        onPay={({ upi_app, pin }) => api.post(`/itineraries/${it.id}/purchase`, { upi_app, pin })}
        onDone={() => {
          toast.success('Unlocked! Every day is yours — fork it into a trip whenever you’re ready.');
          reload();
        }}
      />

      <TipModal
        open={tipOpen}
        onClose={closeTip}
        creator={creator}
        onContinue={(amt) => {
          setTipOpen(false);
          setTipAmount(amt);
          setTipPayOpen(true);
        }}
      />
      <UpiPaySheet
        open={tipPayOpen}
        onClose={() => setTipPayOpen(false)}
        amount={tipAmount}
        title={`Tip ${creator.name?.split(' ')[0] || 'the creator'}`}
        lines={[
          { label: 'To', value: creator.name },
          { label: 'For', value: it.title },
        ]}
        note="Tips go straight to the creator’s Itenary earnings (a small platform fee applies)."
        payLabel={`Send ${inr(tipAmount)} tip`}
        onPay={({ upi_app, pin }) => api.post(`/itineraries/${it.id}/tip`, { amount: tipAmount, upi_app, pin })}
        onDone={() => toast.success(`Thank you! ${creator.name?.split(' ')[0] || 'The creator'} will be thrilled 🙏`)}
      />

      {isOwner && <EditListingModal open={editOpen} onClose={closeEdit} itinerary={it} onSaved={() => reload()} />}
    </div>
  );
}

// ------------------------------------------------------------------ Hero & about

function Hero({ it, totalStops }) {
  return (
    <CoverArt theme={it.cover_theme} seed={it.id} rounded={false} className="rounded-3xl shadow-lift">
      <div className="relative flex min-h-[300px] flex-col justify-end p-5 sm:min-h-[380px] sm:p-8">
        <div className="absolute inset-0 bg-gradient-to-t from-plum-950/90 via-plum-950/35 to-transparent" aria-hidden="true" />
        <div className="relative">
          <div className="mb-3 flex flex-wrap gap-1.5">
            {it.featured && (
              <span className="inline-flex items-center gap-1 rounded-full bg-marigold-300 px-2.5 py-1 text-[12px] font-bold text-plum-950">
                <Sparkles className="size-3.5" /> Featured
              </span>
            )}
            {it.verified_premium && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[12px] font-bold text-plum-800">
                <Crown className="size-3.5 fill-marigold-300 text-marigold-500" /> Verified premium
              </span>
            )}
            {Number(it.price) === 0 && <span className="rounded-full bg-emerald-500 px-2.5 py-1 text-[12px] font-bold text-white">Free to fork</span>}
          </div>
          <h1 className="max-w-3xl text-balance font-display text-[30px] font-extrabold leading-[1.05] text-white sm:text-[44px]">{it.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13.5px] font-semibold text-white/90">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-4" /> {it.destination}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4" /> {plural(it.days_count, 'day')}
            </span>
            {totalStops > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <Route className="size-4" /> {plural(totalStops, 'stop')}
              </span>
            )}
            {it.budget_estimate > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <Wallet className="size-4" /> ~{inr(it.budget_estimate)} budget
              </span>
            )}
          </div>
        </div>
      </div>
    </CoverArt>
  );
}

function About({ it, totalStops }) {
  const facts = [
    { label: 'Destination', value: it.destination, icon: MapPin },
    { label: 'Duration', value: plural(it.days_count, 'day'), icon: CalendarDays },
    { label: 'Budget estimate', value: it.budget_estimate > 0 ? `~${inr(it.budget_estimate)}` : '—', icon: Wallet },
    { label: 'Stops', value: totalStops || '—', icon: Route },
  ];
  return (
    <section>
      <SectionTitle title="About this plan" />
      <Card>
        {it.summary ? <p className="text-[15px] leading-relaxed text-ink/85">{it.summary}</p> : <p className="text-sm text-muted">No summary yet.</p>}
        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {facts.map((f) => (
            <div key={f.label} className="rounded-xl bg-paper px-3 py-2.5 ring-1 ring-inset ring-line/70">
              <dt className="flex items-center gap-1 text-[11.5px] font-semibold text-muted">
                <f.icon className="size-3.5" /> {f.label}
              </dt>
              <dd className="mt-0.5 truncate font-display text-[16px] font-bold text-ink">{f.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 flex items-start gap-2 text-[13px] text-muted">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-marigold-500" />
          Fork it and Yatri, your AI concierge, reshapes it around your dates, budget and group — nothing is booked until you confirm.
        </p>
      </Card>
    </section>
  );
}

// ------------------------------------------------------------------ Sidebar

function ActionCard({ it, isOwner, locked, premium, onFork, onUnlock, onLike, onTip, onShare, onEdit }) {
  let caption;
  if (isOwner) caption = premium ? `Your listing · ${plural(it.sales_count || 0, 'sale')} so far` : 'Your listing · free to fork';
  else if (locked) caption = 'One-time UPI payment · lifetime access · fork it as often as you like. Day 1 is a free preview.';
  else if (premium) caption = 'You own this plan — fork it as many times as you like.';
  else caption = 'Fork it, tweak it, make it yours. No payment needed.';

  const stats = [
    { label: 'Forks', value: num(it.fork_count), icon: GitFork },
    { label: 'Likes', value: num(it.like_count), icon: Heart },
    { label: 'Views', value: num(it.view_count), icon: Eye },
    { label: 'Rating', value: it.rating_count ? Number(it.rating_avg).toFixed(1) : '—', icon: Star },
  ];

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-muted">{premium ? (locked ? 'Unlock price' : isOwner ? 'Listed at' : 'Unlocked') : 'Price'}</div>
          <div className="mt-1 font-display text-[34px] font-extrabold leading-none text-ink">{premium ? inr(it.price) : 'Free'}</div>
        </div>
        {premium && !locked && !isOwner ? (
          <Badge tone="green" icon={LockOpen}>
            Yours for life
          </Badge>
        ) : it.verified_premium ? (
          <Badge tone="marigold" icon={Crown}>
            Verified
          </Badge>
        ) : null}
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-muted">{caption}</p>

      <div className="mt-4">
        {locked && !isOwner ? (
          <Button size="lg" className="w-full" icon={Lock} onClick={onUnlock}>
            Unlock for {inr(it.price)}
          </Button>
        ) : (
          <Button size="lg" className="w-full" icon={GitFork} onClick={onFork}>
            Fork into my trip
          </Button>
        )}
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2">
        <Button variant="secondary" size="sm" onClick={onLike} aria-pressed={!!it.liked} className={cx(it.liked && 'border-rose-200 bg-rose-50 text-rose-600 hover:border-rose-300 hover:text-rose-700')}>
          <Heart className={cx('size-4', it.liked && 'fill-rose-500 text-rose-500')} />
          {num(it.like_count)}
        </Button>
        {isOwner ? (
          <Button variant="secondary" size="sm" icon={Pencil} onClick={onEdit}>
            Edit
          </Button>
        ) : (
          <Button variant="secondary" size="sm" icon={HandCoins} onClick={onTip}>
            Tip
          </Button>
        )}
        <Button variant="secondary" size="sm" icon={Share2} onClick={onShare}>
          Share
        </Button>
      </div>

      {isOwner && (
        <Button variant="soft" size="sm" className="mt-2 w-full" icon={Pencil} onClick={onEdit}>
          Edit listing
        </Button>
      )}

      <dl className="mt-4 grid grid-cols-4 divide-x divide-line rounded-xl bg-paper py-2.5 text-center ring-1 ring-inset ring-line/70">
        {stats.map((s) => (
          <div key={s.label} className="px-1">
            <dt className="flex items-center justify-center gap-1 text-[11px] font-semibold text-muted">
              <s.icon className="size-3" /> {s.label}
            </dt>
            <dd className="mt-0.5 font-display text-[16px] font-bold text-ink">{s.value}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-3 flex items-center gap-1.5 text-[11.5px] text-muted">
        <ShieldCheck className="size-3.5 shrink-0 text-emerald-600" />
        {isOwner ? (
          <span>
            Track sales & tips in{' '}
            <Link to="/app/creator" className="font-semibold text-plum-700 hover:underline">
              Creator studio
            </Link>
          </span>
        ) : (
          'Secure UPI payments · nothing is booked until you confirm'
        )}
      </p>
    </Card>
  );
}

function CreatorCard({ creator, stats, following, isOwner, busy, onFollow }) {
  if (!creator?.id) return null;
  return (
    <Card>
      <div className="mb-3 text-[11.5px] font-bold uppercase tracking-[0.12em] text-muted">Created by</div>
      <div className="flex items-center gap-3">
        <Link to={`/app/u/${creator.id}`} className="shrink-0">
          <Avatar user={creator} size={52} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link to={`/app/u/${creator.id}`} className="flex items-center gap-1 font-bold text-ink hover:text-plum-700">
            <span className="truncate">{creator.name}</span>
            {creator.verified && <VerifiedBadge />}
          </Link>
          <div className="text-[12.5px] text-muted">
            {creator.home_city && <>{creator.home_city} · </>}
            {plural(stats?.followers || 0, 'follower')} · {plural(stats?.itineraries || 0, 'itinerary', 'itineraries')}
          </div>
        </div>
      </div>
      {creator.bio && <p className="mt-3 line-clamp-3 text-[13.5px] leading-relaxed text-ink/80">{creator.bio}</p>}
      <div className="mt-4 flex gap-2">
        {!isOwner && (
          <Button className="flex-1" size="sm" variant={following ? 'secondary' : 'primary'} icon={following ? UserCheck : UserPlus} loading={busy} onClick={onFollow}>
            {following ? 'Following' : 'Follow'}
          </Button>
        )}
        <Button size="sm" variant="ghost" to={`/app/u/${creator.id}`} iconRight={ArrowRight} className={isOwner ? 'flex-1' : ''}>
          View profile
        </Button>
      </div>
    </Card>
  );
}

// ------------------------------------------------------------------ Timeline

function DayCard({ day, preview, pinFor }) {
  const items = day.items || [];
  const count = day.locked ? day.item_count || 0 : items.length;
  const dayCost = items.reduce((s, x) => s + (Number(x.cost) || 0), 0);
  return (
    <Card padded={false} className="overflow-hidden">
      <div className="flex items-center gap-3 border-b border-line/70 bg-paper/60 px-4 py-3 sm:px-5">
        <div className={cx('flex size-11 shrink-0 flex-col items-center justify-center rounded-xl leading-none text-white', day.locked ? 'bg-ink/80' : 'bg-plum-700')}>
          <span className="text-[9px] font-bold uppercase tracking-wider opacity-70">Day</span>
          <span className="font-display text-[18px] font-extrabold">{day.day_number}</span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-bold text-ink">{day.title || `Day ${day.day_number}`}</h3>
          <p className="text-[12.5px] text-muted">
            {day.locked ? 'Included when you unlock' : plural(count, 'stop')}
            {dayCost > 0 && <> · {inr(dayCost)}</>}
          </p>
        </div>
        {day.locked ? (
          <Badge tone="dark" icon={Lock}>
            Locked
          </Badge>
        ) : preview ? (
          <Badge tone="green" icon={Eye}>
            Free preview
          </Badge>
        ) : null}
      </div>
      <div className="px-4 py-4 sm:px-5">
        {day.notes && !day.locked && <p className="mb-4 rounded-xl bg-marigold-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-marigold-900">📝 {day.notes}</p>}
        {day.locked ? (
          <LockedDay count={count} />
        ) : items.length ? (
          <ol>
            {items.map((x, idx) => (
              <ItemRow key={idx} item={x} last={idx === items.length - 1} pin={pinFor[`${day.day_number}-${idx}`]} />
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted">A free day — wander at your own pace.</p>
        )}
      </div>
    </Card>
  );
}

function ItemRow({ item, last, pin }) {
  const t = ITEM_TYPES[item.type] || ITEM_TYPES.place;
  const cost = Number(item.cost) || 0;
  return (
    <li className={cx('relative flex gap-3', !last && 'pb-5')}>
      {!last && <span className="absolute bottom-0 left-[19px] top-11 w-0.5 rounded-full bg-line" aria-hidden="true" />}
      <span className="relative grid size-10 shrink-0 place-items-center rounded-2xl text-[18px]" style={{ background: `${t.color}14`, boxShadow: `inset 0 0 0 1px ${t.color}30` }} aria-hidden="true">
        {t.emoji}
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11.5px] font-bold">
              <span className="uppercase tracking-wider" style={{ color: t.color }}>
                {t.label}
              </span>
              {pin && (
                <span className="inline-grid size-4 place-items-center rounded-full text-[9.5px] text-white" style={{ background: t.color }} title={`Pin ${pin} on the map`}>
                  {pin}
                </span>
              )}
              {item.start_time && <span className="font-semibold text-muted">· {fmtTime(item.start_time)}</span>}
              {item.duration_min > 0 && <span className="font-semibold text-muted">· {fmtDuration(item.duration_min)}</span>}
            </div>
            <div className="mt-0.5 font-semibold leading-snug text-ink">{item.title}</div>
          </div>
          {cost > 0 && <span className="shrink-0 rounded-lg bg-sand px-2 py-0.5 text-[12.5px] font-bold text-ink/80">{inr(cost)}</span>}
        </div>
        {item.place_name && item.place_name !== item.title && (
          <div className="mt-0.5 flex items-center gap-1 text-[12.5px] text-muted">
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate">{item.place_name}</span>
          </div>
        )}
        {item.description && <p className="mt-1 text-[13.5px] leading-relaxed text-ink/75">{item.description}</p>}
      </div>
    </li>
  );
}

function LockedDay({ count }) {
  return (
    <div className="relative overflow-hidden rounded-xl">
      <div className="pointer-events-none flex select-none gap-3 p-1 blur-[5px]" aria-hidden="true">
        <span className="size-10 shrink-0 rounded-2xl bg-plum-100" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-2.5 w-24 rounded bg-marigold-200" />
          <div className="h-3.5 w-3/4 rounded bg-ink/20" />
        </div>
      </div>
      <div className="absolute inset-0 flex items-center justify-center gap-2 bg-white/60 px-4 text-center">
        <Lock className="size-4 shrink-0 text-plum-700" />
        <p className="text-[13.5px] font-semibold text-ink">{plural(count, 'stop')} — unlock to see</p>
      </div>
    </div>
  );
}

function UnlockBanner({ price, lockedDays, lockedStops, onUnlock }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-plum-800 to-plum-950 p-5 text-white shadow-lift sm:flex sm:items-center sm:justify-between sm:gap-6">
      <div className="absolute -right-8 -top-10 size-36 rounded-full bg-marigold-400/25 blur-2xl" aria-hidden="true" />
      <div className="relative">
        <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.12em] text-marigold-200">
          <Lock className="size-3.5" /> {plural(lockedDays, 'more day')} · {plural(lockedStops, 'stop')}
        </div>
        <p className="mt-1 font-display text-[20px] font-extrabold leading-snug">Unlock the full plan, fork it forever.</p>
        <p className="mt-0.5 text-[13px] text-white/75">Timings, costs, local tips and map pins for every stop — one UPI payment.</p>
      </div>
      <Button variant="accent" size="lg" icon={LockOpen} onClick={onUnlock} className="relative mt-4 w-full sm:mt-0 sm:w-auto">
        Unlock for {inr(price)}
      </Button>
    </div>
  );
}

// ------------------------------------------------------------------ Reviews

function Reviews({ it, reviews, canReview, isOwner, reviewedAlready, userId, locked, onPosted }) {
  const confirm = useConfirm();
  const [reported, setReported] = useState(() => new Set());

  async function report(r) {
    const ok = await confirm({
      title: 'Report this review?',
      description: 'Our team checks every report. Reviews reported by several travellers are hidden automatically.',
      confirmLabel: 'Report',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await api.post(`/reviews/${r.id}/report`);
      setReported((s) => new Set(s).add(r.id));
      toast.success('Thanks — we’ll take a look');
    } catch (err) {
      toast.error(err.message);
    }
  }

  const counts = [5, 4, 3, 2, 1].map((n) => ({ n, c: reviews.filter((r) => r.rating === n).length }));

  return (
    <section id="reviews">
      <SectionTitle title="Reviews" subtitle={it.rating_count ? `From travellers who forked or unlocked this plan` : 'Only travellers who forked or unlocked this plan can review it'} />
      <Card>
        {it.rating_count > 0 && (
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3 sm:block sm:w-36 sm:shrink-0">
              <div className="font-display text-[44px] font-extrabold leading-none text-ink">{Number(it.rating_avg).toFixed(1)}</div>
              <div>
                <Stars value={it.rating_avg} size={16} className="sm:mt-2" />
                <div className="mt-1 text-[12.5px] text-muted">{plural(it.rating_count, 'review')}</div>
              </div>
            </div>
            <div className="flex-1 space-y-1">
              {counts.map(({ n, c }) => (
                <div key={n} className="flex items-center gap-2 text-[12px] text-muted">
                  <span className="w-3 text-right font-semibold">{n}</span>
                  <Star className="size-3 fill-marigold-400 text-marigold-400" />
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sand">
                    <div className="h-full rounded-full bg-marigold-400" style={{ width: `${reviews.length ? (c / reviews.length) * 100 : 0}%` }} />
                  </div>
                  <span className="w-5 text-right">{c}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {canReview && <ReviewForm itineraryId={it.id} onPosted={onPosted} />}
        {!canReview && !isOwner && !reviewedAlready && (
          <p className="mb-4 flex items-center gap-2 rounded-xl bg-paper px-3.5 py-2.5 text-[13px] text-muted ring-1 ring-inset ring-line/70">
            <GitFork className="size-4 shrink-0 text-plum-600" />
            {locked ? 'Unlock' : 'Fork'} this itinerary to leave a review after your trip.
          </p>
        )}

        {reviews.length === 0 ? (
          <div className="py-6 text-center">
            <div className="text-3xl" aria-hidden="true">
              ✍️
            </div>
            <p className="mt-2 text-sm font-semibold text-ink">No reviews yet</p>
            <p className="text-[13px] text-muted">Be the first to share how it went.</p>
          </div>
        ) : (
          <ul className="divide-y divide-line/70">
            {reviews.map((r) => (
              <li key={r.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex items-start gap-3">
                  <Avatar user={{ id: r.user_id, name: r.name, avatar_url: r.avatar_url }} size={38} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <Link to={`/app/u/${r.user_id}`} className="flex items-center gap-1 text-[14px] font-semibold text-ink hover:text-plum-700">
                        {r.name}
                        {r.verified && <VerifiedBadge className="size-3.5" />}
                      </Link>
                      <span className="text-[12px] text-muted">{timeAgo(r.created_at)}</span>
                    </div>
                    <Stars value={r.rating} size={13} className="mt-0.5" />
                    {r.text && <p className="mt-1.5 text-[14px] leading-relaxed text-ink/85">{r.text}</p>}
                  </div>
                  {userId && r.user_id !== userId && (
                    <button
                      onClick={() => report(r)}
                      disabled={reported.has(r.id)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-semibold text-muted transition hover:bg-rose-50 hover:text-rose-600 disabled:pointer-events-none disabled:opacity-60"
                    >
                      {reported.has(r.id) ? <Check className="size-3.5" /> : <Flag className="size-3.5" />}
                      {reported.has(r.id) ? 'Reported' : 'Report'}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}

const RATING_WORDS = ['', 'Not great', 'Okay', 'Good', 'Great', 'Loved it!'];

function ReviewForm({ itineraryId, onPosted }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const shown = hover || rating;

  async function submit(e) {
    e.preventDefault();
    if (!rating) {
      toast.error('Tap a star to rate this itinerary');
      return;
    }
    setBusy(true);
    try {
      await api.post(`/itineraries/${itineraryId}/reviews`, { rating, text: text.trim() });
      toast.success('Thanks for reviewing! It helps the next traveller.');
      setRating(0);
      setText('');
      onPosted?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mb-5 rounded-2xl bg-plum-50/60 p-4 ring-1 ring-inset ring-plum-100">
      <div className="text-[14px] font-bold text-ink">How was the trip?</div>
      <div className="mt-2 flex items-center gap-3">
        <div className="flex" onMouseLeave={() => setHover(0)} role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} star${n > 1 ? 's' : ''}`}
              onMouseEnter={() => setHover(n)}
              onClick={() => setRating(n)}
              className="p-0.5 transition active:scale-90"
            >
              <Star className={cx('size-7 transition', n <= shown ? 'fill-marigold-400 text-marigold-400' : 'fill-white text-line')} />
            </button>
          ))}
        </div>
        <span className="text-[13px] font-semibold text-marigold-700">{RATING_WORDS[shown]}</span>
      </div>
      <Textarea className="mt-3 bg-white" rows={3} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} placeholder="What worked, what you’d change, tips for the next traveller…" />
      <div className="mt-3 flex justify-end">
        <Button type="submit" size="sm" loading={busy}>
          Post review
        </Button>
      </div>
    </form>
  );
}

// ------------------------------------------------------------------ Fork & tip modals

function ForkModal({ open, onClose, itinerary, totalStops, onNeedPurchase }) {
  const navigate = useNavigate();
  const [start, setStart] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setStart(dayjs().add(14, 'day').format('YYYY-MM-DD'));
      setName((itinerary?.title || '').slice(0, 80));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!itinerary) return null;
  const days = Math.max(1, itinerary.content?.length || itinerary.days_count || 1);
  const today = dayjs().format('YYYY-MM-DD');
  const validStart = start && dayjs(start).isValid();
  const end = validStart ? dayjs(start).add(days - 1, 'day').format('YYYY-MM-DD') : '';

  async function submit(e) {
    e?.preventDefault();
    if (!validStart) {
      toast.error('Pick a start date for your trip');
      return;
    }
    setBusy(true);
    try {
      const { trip } = await api.post(`/itineraries/${itinerary.id}/fork`, { start_date: start, name: name.trim() || undefined });
      toast.success('Forked! Your trip is ready — let’s make it yours.');
      navigate(`/app/trips/${trip.id}?welcome=fork`);
    } catch (err) {
      setBusy(false);
      if (err.status === 402) {
        onClose();
        onNeedPurchase?.();
      }
      toast.error(err.message);
    }
  }

  const perks = [
    `All ${plural(totalStops, 'stop')} copied into a new trip you own`,
    'Invite your group to plan, vote and chat together',
    'Yatri personalises it to your dates, budget and group',
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Fork into my trip"
      description="Make a private copy you can edit freely. The original stays as it is."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button icon={GitFork} loading={busy} onClick={submit}>
            Fork & open trip
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="flex items-center gap-3 rounded-2xl bg-paper p-2.5 ring-1 ring-inset ring-line/70">
          <CoverArt theme={itinerary.cover_theme} seed={itinerary.id} rounded={false} className="size-14 shrink-0 rounded-xl" />
          <div className="min-w-0">
            <div className="truncate text-[14px] font-bold text-ink">{itinerary.title}</div>
            <div className="text-[12.5px] text-muted">
              {itinerary.destination} · {plural(days, 'day')} · by {itinerary.creator?.name}
            </div>
          </div>
        </div>

        <Field label="Trip name">
          <Input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder={itinerary.title} />
        </Field>
        <Field label="Start date" hint={validStart ? `${fmtRange(start, end)} · ${plural(days, 'day')}` : 'When does your trip begin?'}>
          <Input type="date" min={today} value={start} onChange={(e) => setStart(e.target.value)} icon={CalendarDays} />
        </Field>

        <ul className="space-y-2 rounded-2xl bg-plum-50/60 p-3.5 ring-1 ring-inset ring-plum-100">
          {perks.map((p) => (
            <li key={p} className="flex items-start gap-2 text-[13px] text-plum-900">
              <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-plum-600 text-white">
                <Check className="size-3" />
              </span>
              {p}
            </li>
          ))}
        </ul>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

const TIP_PRESETS = [51, 101, 251];

function TipModal({ open, onClose, creator, onContinue }) {
  const [preset, setPreset] = useState(101);
  const [custom, setCustom] = useState('');

  useEffect(() => {
    if (open) {
      setPreset(101);
      setCustom('');
    }
  }, [open]);

  const usingCustom = custom !== '';
  const amount = usingCustom ? Number(custom) : preset;
  const valid = Number.isInteger(amount) && amount >= 10 && amount <= 10000;
  const first = creator?.name?.split(' ')[0] || 'the creator';

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={`Tip ${first}`}
      description="Say thanks for a plan that made your trip. Shagun-style amounts welcome 🙏"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button icon={HandCoins} disabled={!valid} onClick={() => onContinue(amount)}>
            Continue{valid ? ` · ${inr(amount)}` : ''}
          </Button>
        </>
      }
    >
      <div className="flex items-center gap-3 rounded-2xl bg-paper p-3 ring-1 ring-inset ring-line/70">
        <Avatar user={creator} size={40} />
        <div className="min-w-0">
          <div className="flex items-center gap-1 font-semibold text-ink">
            <span className="truncate">{creator?.name}</span>
            {creator?.verified && <VerifiedBadge className="size-3.5" />}
          </div>
          {creator?.home_city && <div className="text-[12.5px] text-muted">{creator.home_city}</div>}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {TIP_PRESETS.map((p) => {
          const on = !usingCustom && preset === p;
          return (
            <button
              key={p}
              type="button"
              data-autofocus={p === 101 ? '' : undefined}
              onClick={() => {
                setPreset(p);
                setCustom('');
              }}
              className={cx('rounded-2xl border py-3 font-display text-[20px] font-extrabold transition', on ? 'border-plum-600 bg-plum-50 text-plum-800 ring-2 ring-plum-100' : 'border-line text-ink hover:border-plum-300')}
            >
              {inr(p)}
            </button>
          );
        })}
      </div>
      <Field className="mt-3" label="Or enter an amount" error={usingCustom && !valid ? 'Tips can be ₹10 to ₹10,000' : ''}>
        <Input type="number" inputMode="numeric" min={10} max={10000} step={1} value={custom} onChange={(e) => setCustom(e.target.value.replace(/[^\d]/g, ''))} placeholder="Custom amount (₹)" />
      </Field>
    </Modal>
  );
}

// ------------------------------------------------------------------ Skeleton

function DetailSkeleton() {
  return (
    <div>
      <Skeleton className="mb-3 h-4 w-20" />
      <Skeleton className="h-[300px] rounded-3xl sm:h-[380px]" />
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4 xl:order-2">
          <Skeleton className="h-72 rounded-2xl" />
        </div>
        <div className="space-y-4 xl:order-1">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
