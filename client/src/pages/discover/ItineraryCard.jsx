import { Link } from 'react-router';
import { CalendarDays, Crown, GitFork, Heart, LockOpen, MapPin, Sparkles, Star } from 'lucide-react';
import CoverArt from '../../components/CoverArt';
import { Avatar, Skeleton, VerifiedBadge, cx } from '../../components/ui';
import { inr, num } from '../../lib/format';
import { useAuth } from '../../lib/auth';
import { TAG_EMOJI } from './constants';

/**
 * The hero card of the community feed. Whole card links to the itinerary.
 * Works with feed rows (`/feed`), detail `more` rows and profile rows (pass `creator` in).
 */
export default function ItineraryCard({ itinerary: it, compact = false, className }) {
  const { user } = useAuth();
  if (!it) return null;
  const premium = Number(it.price) > 0;
  const tags = (it.tags || []).slice(0, compact ? 2 : 3);
  const forks = it.fork_count || 0;
  const creator = it.creator;
  const mine = !!user && (creator?.id || it.creator_id) === user.id;

  return (
    <Link
      to={`/app/itineraries/${it.id}`}
      className={cx('group block h-full rounded-[22px] outline-offset-4', className)}
      aria-label={`${it.title} — ${it.destination}`}
    >
      <article className="flex h-full flex-col overflow-hidden rounded-[22px] border border-line bg-white shadow-soft transition duration-300 group-hover:-translate-y-1 group-hover:border-plum-200 group-hover:shadow-lift">
        {/* Cover */}
        <div className="relative overflow-hidden">
          <CoverArt theme={it.cover_theme} seed={it.id} rounded={false} className="aspect-[16/10] transition-transform duration-700 ease-out group-hover:scale-[1.035]">
            <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-plum-950/75 via-plum-950/20 to-transparent" />
            <div className={cx('relative flex h-full flex-col justify-between', compact ? 'p-2.5' : 'p-3')}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 flex-wrap gap-1.5">
                  {it.featured && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-marigold-300 px-2 py-0.5 text-[11px] font-bold text-plum-950 shadow-sm">
                      <Sparkles className="size-3" /> Featured
                    </span>
                  )}
                  {it.verified_premium && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-bold text-plum-800 shadow-sm">
                      <Crown className="size-3 fill-marigold-300 text-marigold-500" /> Verified premium
                    </span>
                  )}
                </div>
                <PricePill price={it.price} premium={premium} purchased={it.purchased && !mine} />
              </div>

              <div className="flex items-end justify-between gap-2 text-white">
                <span className="flex min-w-0 items-center gap-1 text-[13px] font-semibold drop-shadow-[0_1px_2px_rgb(0_0_0/0.35)]">
                  <MapPin className="size-3.5 shrink-0" />
                  <span className="truncate">{it.destination}</span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[11.5px] font-semibold ring-1 ring-white/25 backdrop-blur-md">
                  <CalendarDays className="size-3" />
                  {it.days_count} {it.days_count === 1 ? 'day' : 'days'}
                  {!compact && it.budget_estimate > 0 && <span className="text-white/80">· ~{inr(it.budget_estimate, { compact: true })}</span>}
                </span>
              </div>
            </div>
          </CoverArt>
        </div>

        {/* Body */}
        <div className={cx('flex flex-1 flex-col', compact ? 'p-3.5' : 'p-4')}>
          <h3 className={cx('line-clamp-2 font-display font-bold leading-snug text-ink transition-colors group-hover:text-plum-800', compact ? 'text-[15px]' : 'text-[17px]')}>
            {it.title}
          </h3>
          {!compact && it.summary && <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted">{it.summary}</p>}

          {tags.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded-full bg-sand px-2 py-0.5 text-[11.5px] font-semibold text-ink/70">
                  <span aria-hidden="true">{TAG_EMOJI[t] || '•'}</span>
                  {t}
                </span>
              ))}
            </div>
          )}

          {/* Social proof */}
          <div className={cx('mb-3 mt-3 flex items-center justify-between gap-2', compact ? 'text-[12px]' : 'text-[12.5px]')}>
            <span className={cx('inline-flex min-w-0 items-center gap-1.5 font-semibold', forks > 0 ? 'text-plum-700' : 'text-muted')}>
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-plum-50">
                <GitFork className="size-3" />
              </span>
              <span className="truncate">{forks > 0 ? `Forked by ${num(forks)} ${forks === 1 ? 'traveller' : 'travellers'}` : 'Be the first to fork'}</span>
            </span>
            {it.rating_count > 0 && (
              <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-ink/80" title={`${it.rating_count} reviews`}>
                <Star className="size-3.5 fill-marigold-400 text-marigold-400" />
                {Number(it.rating_avg).toFixed(1)}
                <span className="font-medium text-muted">({it.rating_count})</span>
              </span>
            )}
          </div>

          <div className="mt-auto flex items-center justify-between gap-2 border-t border-line/70 pt-3">
            {creator ? (
              <span className="flex min-w-0 items-center gap-2">
                <Avatar user={creator} size={compact ? 22 : 26} />
                <span className="truncate text-[13px] font-semibold text-ink/85">{creator.name}</span>
                {creator.verified && <VerifiedBadge className="size-3.5" />}
              </span>
            ) : (
              <span />
            )}
            <span className={cx('inline-flex shrink-0 items-center gap-1 text-[12.5px] font-semibold', it.liked ? 'text-rose-600' : 'text-muted')} title="Likes">
              <Heart className={cx('size-3.5', it.liked && 'fill-rose-500 text-rose-500')} />
              {num(it.like_count)}
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}

function PricePill({ price, premium, purchased }) {
  if (!premium) {
    return <span className="shrink-0 rounded-full bg-white/95 px-2.5 py-1 text-[12px] font-bold text-emerald-700 shadow-sm">Free</span>;
  }
  if (purchased) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-[12px] font-bold text-white shadow-sm">
        <LockOpen className="size-3" /> Unlocked
      </span>
    );
  }
  return <span className="shrink-0 rounded-full bg-ink/90 px-2.5 py-1 font-display text-[13px] font-bold text-white shadow-sm backdrop-blur">{inr(price)}</span>;
}

export function ItineraryCardSkeleton({ compact = false }) {
  return (
    <div className="overflow-hidden rounded-[22px] border border-line bg-white shadow-soft">
      <Skeleton className="aspect-[16/10] rounded-none" />
      <div className={cx('space-y-2.5', compact ? 'p-3.5' : 'p-4')}>
        <Skeleton className="h-5 w-4/5" />
        {!compact && <Skeleton className="h-3.5 w-full" />}
        <div className="flex gap-1.5 pt-1">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <div className="flex items-center gap-2 border-t border-line/70 pt-3">
          <Skeleton className="size-6 rounded-full" />
          <Skeleton className="h-3.5 w-24" />
        </div>
      </div>
    </div>
  );
}
