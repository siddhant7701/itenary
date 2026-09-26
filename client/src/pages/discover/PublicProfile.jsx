import { useState } from 'react';
import { useParams } from 'react-router';
import { toast } from 'sonner';
import { BarChart3, CalendarDays, Compass, MapPin, Pencil, Sparkles, UserCheck, UserPlus } from 'lucide-react';
import CoverArt from '../../components/CoverArt';
import { Avatar, Badge, Button, EmptyState, ErrorState, SectionTitle, Skeleton, VerifiedBadge, cx } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useFetch } from '../../lib/hooks';
import { fmtDate, num } from '../../lib/format';
import ItineraryCard, { ItineraryCardSkeleton } from './ItineraryCard';
import { TAG_EMOJI, plural } from './constants';

export default function PublicProfile() {
  const { id } = useParams();
  const { user: me } = useAuth();
  const { data, loading, error, reload, setData } = useFetch(`/users/${id}`);
  const [busy, setBusy] = useState(false);

  const stale = data && data.user?.id !== id;
  if ((loading && (!data || stale)) || (!data && !error)) return <ProfileSkeleton />;
  if (error && (!data || stale)) return <ErrorState error={error} onRetry={reload} />;

  const { user, stats, is_following, itineraries } = data;
  const isSelf = me?.id === user.id;
  const first = user.name?.split(' ')[0] || 'This traveller';
  const bannerTheme = itineraries[0]?.cover_theme || 'festival';

  async function toggleFollow() {
    setBusy(true);
    try {
      const r = await api.post(`/users/${user.id}/follow`);
      setData((d) => ({ ...d, is_following: r.following, stats: { ...d.stats, followers: r.followers } }));
      toast.success(r.following ? `You’re following ${first} — you’ll hear about new itineraries` : `Unfollowed ${first}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  const statList = [
    { label: 'Followers', value: stats.followers },
    { label: 'Following', value: stats.following },
    { label: 'Itineraries', value: stats.itineraries },
    { label: 'Forks', value: stats.forks },
    { label: 'Trips', value: stats.trips },
  ];

  return (
    <div className="animate-fade-up">
      <section className="overflow-hidden rounded-3xl border border-line bg-white shadow-soft">
        <CoverArt theme={bannerTheme} seed={`profile-${user.id}`} rounded={false} className="h-28 sm:h-40" />
        <div className="px-5 pb-5 sm:px-7 sm:pb-7">
          <div className="relative -mt-11 flex items-end justify-between gap-3 sm:-mt-12">
            <span className="shrink-0 rounded-full bg-white p-1 shadow-soft">
              <Avatar user={user} size={88} />
            </span>
            <div className="flex flex-wrap justify-end gap-2 pb-1">
              {isSelf ? (
                <>
                  <Button variant="secondary" size="sm" icon={Pencil} to="/app/profile">
                    Edit profile
                  </Button>
                  <Button variant="soft" size="sm" icon={BarChart3} to="/app/creator" className="hidden sm:inline-flex">
                    Creator studio
                  </Button>
                </>
              ) : (
                <Button className="min-w-32" variant={is_following ? 'secondary' : 'primary'} icon={is_following ? UserCheck : UserPlus} loading={busy} onClick={toggleFollow}>
                  {is_following ? 'Following' : 'Follow'}
                </Button>
              )}
            </div>
          </div>

          <div className="mt-3">
            <h1 className="flex flex-wrap items-center gap-1.5 font-display text-[24px] font-extrabold leading-tight text-ink sm:text-[28px]">
              <span className="min-w-0 break-words">{user.name}</span>
              {user.verified && <VerifiedBadge className="size-5" />}
              {user.plan === 'plus' && (
                <Badge tone="marigold" icon={Sparkles}>
                  Plus
                </Badge>
              )}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-muted">
              {user.home_city && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" /> {user.home_city}
                </span>
              )}
              {user.created_at && (
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="size-3.5" /> Joined {fmtDate(user.created_at, 'MMMM YYYY')}
                </span>
              )}
            </div>
          </div>

          {user.bio && <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink/85">{user.bio}</p>}

          {user.travel_style?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {user.travel_style.map((s) => (
                <span key={s} className="inline-flex items-center gap-1 rounded-full bg-plum-50 px-2.5 py-1 text-[12.5px] font-semibold text-plum-800 ring-1 ring-inset ring-plum-100">
                  <span aria-hidden="true">{TAG_EMOJI[s] || '•'}</span> {s}
                </span>
              ))}
            </div>
          )}

          <dl className="mt-5 grid grid-cols-5 divide-x divide-line rounded-2xl bg-paper py-3 ring-1 ring-inset ring-line/70">
            {statList.map((s) => (
              <div key={s.label} className="flex min-w-0 flex-col-reverse px-1 text-center">
                <dt className="truncate text-[10.5px] font-semibold text-muted sm:text-[12px]">{s.label}</dt>
                <dd className="font-display text-[18px] font-extrabold leading-tight text-ink sm:text-[22px]">{num(s.value)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="mt-8">
        <SectionTitle
          title={isSelf ? 'Your published itineraries' : `${first}’s itineraries`}
          subtitle={itineraries.length ? `${plural(itineraries.length, 'plan')} · forked ${plural(stats.forks, 'time')}` : undefined}
        />
        {itineraries.length === 0 ? (
          <EmptyState
            icon={Compass}
            title={isSelf ? 'You haven’t published anything yet' : 'No published itineraries yet'}
            description={isSelf ? 'Publish any trip for free from its Share tab — travellers can fork it and you can earn from unlocks and tips.' : `When ${first} publishes a trip, it’ll show up here.`}
            action={
              isSelf && (
                <Button to="/app/trips" icon={Sparkles}>
                  Publish a trip
                </Button>
              )
            }
          />
        ) : (
          <div className={cx('grid gap-5 sm:grid-cols-2 xl:grid-cols-3', loading && 'opacity-60')}>
            {itineraries.map((it) => (
              <ItineraryCard key={it.id} itinerary={{ ...it, creator: it.creator || user }} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div>
      <div className="overflow-hidden rounded-3xl border border-line bg-white">
        <Skeleton className="h-28 rounded-none sm:h-40" />
        <div className="space-y-3 px-5 pb-6 sm:px-7">
          <Skeleton className="-mt-11 size-24 rounded-full ring-4 ring-white" />
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72 max-w-full" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
      </div>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <ItineraryCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
