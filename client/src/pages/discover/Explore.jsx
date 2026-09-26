import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { ArrowRight, Crown, GitFork, Gift, Search, Sparkles, Users, Wand2, X } from 'lucide-react';
import CoverArt from '../../components/CoverArt';
import { Button, EmptyState, ErrorState, PageHeader, Select, Tabs, cx } from '../../components/ui';
import { api } from '../../lib/api';
import { useConfig } from '../../lib/config';
import { useDebounced } from '../../lib/hooks';
import { num } from '../../lib/format';
import ItineraryCard, { ItineraryCardSkeleton } from './ItineraryCard';
import { FALLBACK_TAGS, TAG_EMOJI } from './constants';

const PAGE_SIZE = 24;

const TYPES = [
  { id: 'all', label: 'Community', icon: Users },
  { id: 'premium', label: 'Premium marketplace', icon: Crown },
  { id: 'free', label: 'Free', icon: Gift },
];

const SORTS = [
  { value: 'trending', label: 'Trending' },
  { value: 'forks', label: 'Most forked' },
  { value: 'new', label: 'Newest' },
  { value: 'rating', label: 'Top rated' },
  { value: 'price_low', label: 'Price: low to high' },
  { value: 'price_high', label: 'Price: high to low' },
];

const DEFAULTS = { type: 'all', sort: 'trending', tags: '', q: '' };

export default function Explore() {
  const config = useConfig();
  const [params, setParams] = useSearchParams();

  const type = TYPES.some((t) => t.id === params.get('type')) ? params.get('type') : 'all';
  const sort = SORTS.some((s) => s.value === params.get('sort')) ? params.get('sort') : 'trending';
  const tagsParam = params.get('tags') || '';
  const q = params.get('q') || '';
  const selected = useMemo(() => (tagsParam ? tagsParam.split(',').filter(Boolean) : []), [tagsParam]);

  const [serverTags, setServerTags] = useState(null);
  const allTags = serverTags?.length ? serverTags : config.itinerary_tags?.length ? config.itinerary_tags : FALLBACK_TAGS;

  const [text, setText] = useState(q);
  const debounced = useDebounced(text.trim(), 350);

  const update = (patch) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) {
          if (!v || v === DEFAULTS[k]) next.delete(k);
          else next.set(k, v);
        }
        return next;
      },
      { replace: true },
    );

  // Debounced search → URL
  useEffect(() => {
    if (debounced !== q) update({ q: debounced });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  // URL → input (back/forward, "clear filters")
  useEffect(() => {
    if (q !== debounced) setText(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const [feed, setFeed] = useState({ items: [], total: 0, page: 1, loading: true, more: false, error: null });

  const pathFor = (page) => {
    const sp = new URLSearchParams({ type, sort, page: String(page), limit: String(PAGE_SIZE) });
    if (tagsParam) sp.set('tags', tagsParam);
    if (q) sp.set('q', q);
    return `/feed?${sp}`;
  };

  const key = `${type}|${sort}|${tagsParam}|${q}`;
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const ctrl = new AbortController();
    setFeed((f) => ({ ...f, loading: true, error: null }));
    api
      .get(pathFor(1), { signal: ctrl.signal })
      .then((d) => {
        setFeed({ items: d.itineraries, total: d.total, page: 1, loading: false, more: false, error: null });
        if (d.tags?.length) setServerTags(d.tags);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setFeed((f) => ({ ...f, loading: false, error: err }));
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  async function loadMore() {
    setFeed((f) => ({ ...f, more: true }));
    try {
      const d = await api.get(pathFor(feed.page + 1));
      setFeed((f) => {
        const seen = new Set(f.items.map((i) => i.id));
        return { ...f, items: [...f.items, ...d.itineraries.filter((i) => !seen.has(i.id))], total: d.total, page: f.page + 1, more: false };
      });
    } catch (err) {
      toast.error(err.message);
      setFeed((f) => ({ ...f, more: false }));
    }
  }

  const toggleTag = (t) => {
    const next = selected.includes(t) ? selected.filter((x) => x !== t) : [...selected, t];
    update({ tags: next.join(',') });
  };

  const hasFilters = selected.length > 0 || !!q;
  const clearAll = () => {
    setText('');
    update({ tags: '', q: '' });
  };

  const initial = feed.loading && feed.items.length === 0;

  return (
    <div className="animate-fade-up">
      <PageHeader
        eyebrow="Community"
        title="Explore itineraries"
        subtitle="Tried-and-tested plans from travellers across Bharat — fork one and make it yours."
        actions={
          <Button variant="soft" icon={Sparkles} to="/app/creator">
            Publish yours & earn
          </Button>
        }
      />

      <ForkHero />

      {/* Controls */}
      <div className="mt-7 space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Tabs tabs={TYPES} value={type} onChange={(v) => update({ type: v })} className="-mx-1 px-1" />
          <div className="flex gap-2 md:w-auto">
            <div className="relative min-w-0 flex-1 md:w-64 md:flex-none">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input
                type="search"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Search places, treks…"
                className="input h-11 pl-10 pr-9"
                aria-label="Search itineraries"
              />
              {text && (
                <button onClick={() => setText('')} className="absolute right-2.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-sand hover:text-ink" aria-label="Clear search">
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            <Select value={sort} onChange={(e) => update({ sort: e.target.value })} className="h-11 w-[9.5rem] shrink-0 py-0 text-sm sm:w-44" aria-label="Sort itineraries">
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Vibe chips */}
        <div className="-mx-4 sm:mx-0">
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-1 sm:flex-wrap sm:overflow-visible sm:px-0">
            {allTags.map((t) => {
              const on = selected.includes(t);
              return (
                <button key={t} type="button" onClick={() => toggleTag(t)} aria-pressed={on} className={cx('chip shrink-0', on && 'chip-active')}>
                  <span aria-hidden="true">{TAG_EMOJI[t] || '•'}</span>
                  {t}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {type === 'premium' && (
        <div className="mt-5 flex items-start gap-3 rounded-2xl bg-gradient-to-r from-marigold-50 to-white px-4 py-3 ring-1 ring-marigold-100">
          <Crown className="mt-0.5 size-5 shrink-0 fill-marigold-200 text-marigold-600" />
          <p className="text-[13.5px] text-marigold-900">
            <span className="font-bold">Premium plans are paid once and yours for life.</span> Unlock with UPI, fork as often as you like — and most of what you pay goes straight to the creator.
          </p>
        </div>
      )}

      {/* Results */}
      <div className="mb-4 mt-6 flex min-h-8 flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          {initial ? (
            'Finding itineraries…'
          ) : (
            <>
              <span className="font-bold text-ink">{num(feed.total)}</span> {feed.total === 1 ? 'itinerary' : 'itineraries'}
              {q && (
                <>
                  {' '}
                  for “<span className="font-semibold text-ink">{q}</span>”
                </>
              )}
              {selected.length > 0 && <> · {selected.join(', ')}</>}
            </>
          )}
        </p>
        {hasFilters && (
          <Button size="xs" variant="ghost" icon={X} onClick={clearAll}>
            Clear filters
          </Button>
        )}
      </div>

      {feed.error && feed.items.length === 0 ? (
        <ErrorState error={feed.error} onRetry={() => setAttempt((a) => a + 1)} />
      ) : initial ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <ItineraryCardSkeleton key={i} />
          ))}
        </div>
      ) : feed.items.length === 0 ? (
        <EmptyState
          emoji="🧭"
          title="No itineraries match — yet"
          description={hasFilters ? 'Try fewer vibes or a different search. Or be the first: publish your own trip for this crowd.' : 'Nothing listed here right now. Publish one of your trips and start the collection.'}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {hasFilters && (
                <Button variant="secondary" onClick={clearAll}>
                  Clear filters
                </Button>
              )}
              <Button to="/app/trips" iconRight={ArrowRight}>
                Publish a trip
              </Button>
            </div>
          }
        />
      ) : (
        <>
          <div className={cx('grid gap-5 transition-opacity sm:grid-cols-2 xl:grid-cols-3', feed.loading && 'pointer-events-none opacity-60')}>
            {feed.items.map((it) => (
              <ItineraryCard key={it.id} itinerary={it} />
            ))}
            {feed.more && Array.from({ length: 3 }).map((_, i) => <ItineraryCardSkeleton key={`s${i}`} />)}
          </div>
          <div className="mt-8 flex flex-col items-center gap-2">
            <p className="text-[13px] text-muted">
              Showing {num(feed.items.length)} of {num(feed.total)}
            </p>
            {feed.items.length < feed.total && (
              <Button variant="secondary" onClick={loadMore} loading={feed.more} className="min-w-40">
                Load more
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ForkHero() {
  const steps = [
    { icon: Search, title: 'Find a plan', text: 'Filter by vibe, budget & destination' },
    { icon: GitFork, title: 'Fork it', text: 'Every stop copied into your own trip' },
    { icon: Wand2, title: 'Yatri personalises', text: 'Dates, budget & group — adjusted for you' },
  ];
  return (
    <section className="relative overflow-hidden rounded-3xl bg-plum-900 text-white shadow-lift">
      <div className="pointer-events-none absolute inset-y-0 right-0 w-full opacity-35 [mask-image:linear-gradient(to_right,transparent,black_55%)] sm:w-[70%] sm:opacity-60" aria-hidden="true">
        <CoverArt theme="mountains" seed="explore-hero-7" rounded={false} className="size-full" />
      </div>
      <div className="absolute inset-0 bg-grain opacity-40" aria-hidden="true" />
      <div className="relative grid gap-6 p-5 sm:p-7 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11.5px] font-bold uppercase tracking-[0.12em] text-marigold-200 ring-1 ring-white/15">
            <GitFork className="size-3.5" /> Fork, don’t start from scratch
          </span>
          <h2 className="mt-3 text-balance font-display text-[26px] font-extrabold leading-[1.1] sm:text-[32px]">
            Someone’s already planned your <span className="text-marigold-300">perfect trip.</span>
          </h2>
          <p className="mt-2 max-w-xl text-[14.5px] leading-relaxed text-white/80">
            Fork any itinerary into your own trip — Yatri (the AI concierge) personalises it to your dates, budget and group.
          </p>
        </div>
        <ol className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
          {steps.map((s, i) => (
            <li key={s.title} className="flex items-center gap-3 rounded-2xl bg-white/10 px-3.5 py-2.5 ring-1 ring-white/15 backdrop-blur-sm">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-marigold-300 text-plum-950">
                <s.icon className="size-[18px]" />
              </span>
              <span className="min-w-0">
                <span className="block text-[13.5px] font-bold">
                  <span className="text-marigold-200">{i + 1}.</span> {s.title}
                </span>
                <span className="block text-[12px] leading-snug text-white/70">{s.text}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
