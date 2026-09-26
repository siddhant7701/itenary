import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import {
  ArrowRight, Bot, Camera, Check, GitFork, Heart, IndianRupee, MapPinned, MessageCircle, ShieldCheck, Siren, Sparkles, Users, Vote, Wallet, Zap,
} from 'lucide-react';
import Logo from '../components/Logo';
import CoverArt from '../components/CoverArt';
import { Avatar, Badge, Button, Stars } from '../components/ui';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { inr, num } from '../lib/format';

const PILLARS = [
  { icon: Users, title: 'Plan together, live', body: 'One shared trip hub with presence, a day-by-day timeline, a drag-and-drop Stash, group votes and chat — no more 200-message WhatsApp threads.', tone: 'bg-plum-50 text-plum-700' },
  { icon: Bot, title: 'Yatri books it', body: 'Ask in plain Hinglish-friendly English. Yatri finds cabs, food and stays, then waits for your OK before a single rupee moves via UPI.', tone: 'bg-marigold-50 text-marigold-700' },
  { icon: GitFork, title: 'Fork real itineraries', body: 'Browse trips by real Indian travellers — Budget, Solo Female, Foodie — and fork one into your own plan in one tap.', tone: 'bg-emerald-50 text-emerald-700' },
  { icon: Wallet, title: 'Split & settle in-app', body: 'Every booking and expense lands in the shared ledger. See who owes whom and settle with a UPI request.', tone: 'bg-sky-50 text-sky-700' },
  { icon: Camera, title: 'A zine, not a camera roll', body: 'Everyone’s photos flow into a shared album that becomes a scrapbook-style Digital Zine you can post as a Story.', tone: 'bg-rose-50 text-rose-700' },
];

function HeroMock() {
  const people = [
    { id: 'a1', name: 'Aarav Sharma' },
    { id: 'p2', name: 'Priya Iyer' },
    { id: 'r3', name: 'Rohan Mehta' },
  ];
  return (
    <div className="relative mx-auto w-full max-w-[520px]">
      <div className="absolute -inset-6 -z-10 rounded-[40px] bg-gradient-to-br from-marigold-200/60 via-plum-200/50 to-transparent blur-2xl" />
      <div className="card overflow-hidden p-0 shadow-lift">
        <CoverArt theme="mountains" seed="hero-nainital" className="h-40" rounded={false}>
          <div className="flex h-40 flex-col justify-between p-4">
            <div className="flex items-center justify-between">
              <Badge tone="dark" className="bg-ink/70 backdrop-blur">In 12 days</Badge>
              <div className="flex items-center gap-1.5 rounded-full bg-white/85 px-2 py-1 text-[11px] font-semibold backdrop-blur">
                <span className="size-2 animate-pulse rounded-full bg-emerald-500" /> 3 planning now
              </div>
            </div>
            <div>
              <div className="font-display text-2xl font-extrabold text-white drop-shadow">Nainital & Bhimtal Getaway</div>
              <div className="text-[13px] font-medium text-white/90 drop-shadow">4 days · Uttarakhand · ₹42,000 budget</div>
            </div>
          </div>
        </CoverArt>
        <div className="space-y-3 p-4">
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {people.map((p) => <Avatar key={p.id} user={p} size={30} ring />)}
            </div>
            <div className="flex-1">
              <div className="flex justify-between text-[11px] font-semibold text-muted"><span>Chill</span><span>Vibe check · 66</span><span>Adventure</span></div>
              <div className="relative mt-1 h-2 rounded-full bg-gradient-to-r from-sky-200 via-plum-200 to-marigold-300">
                <span className="absolute top-1/2 size-4 -translate-y-1/2 rounded-full border-2 border-white bg-plum-700 shadow" style={{ left: '62%' }} />
              </div>
            </div>
          </div>
          <div className="rounded-2xl bg-paper p-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted">Day 3 · Bhimtal adventure</div>
            <div className="mt-2 space-y-1.5 text-[13px]">
              <div className="flex items-center gap-2"><span className="w-14 text-muted">9:30 AM</span>🎯 Bhimtal Lake Kayaking</div>
              <div className="flex items-center gap-2"><span className="w-14 text-muted">1:30 PM</span>🍛 Picnic lunch at Sattal</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card absolute -bottom-10 -left-4 w-[260px] p-3.5 shadow-lift sm:-left-10 animate-fade-up">
        <div className="flex items-center gap-2 text-[12px] font-bold text-plum-700"><Sparkles className="size-3.5" /> Yatri · AI concierge</div>
        <p className="mt-1.5 text-[13px] leading-snug">Found a Sedan from Kathgodam to Nainital at 11:45 AM for 3 of you.</p>
        <div className="mt-2.5 flex items-center justify-between rounded-xl border border-line p-2.5">
          <div>
            <div className="text-[12.5px] font-semibold">🚕 Sedan · Dzire</div>
            <div className="text-[11px] text-muted">Sawari Cabs · 35 km</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-extrabold">₹1,480</div>
            <div className="text-[10px] font-bold text-plum-700">Review & pay</div>
          </div>
        </div>
      </div>

      <div className="card absolute -right-3 -top-8 w-[210px] p-3.5 shadow-lift sm:-right-10 animate-fade-up">
        <div className="flex items-center gap-1.5 text-[12px] font-bold"><Vote className="size-3.5 text-marigold-600" /> Where do we stay?</div>
        <div className="mt-2 space-y-1.5">
          <div className="relative overflow-hidden rounded-lg bg-sand px-2.5 py-1.5 text-[12px] font-semibold"><span className="absolute inset-y-0 left-0 w-2/3 bg-plum-200/70" /><span className="relative">Pine Crest Homestay · 2</span></div>
          <div className="relative overflow-hidden rounded-lg bg-sand px-2.5 py-1.5 text-[12px] font-semibold"><span className="absolute inset-y-0 left-0 w-1/3 bg-marigold-200/70" /><span className="relative">Lakeview Villa · 1</span></div>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [feed, setFeed] = useState([]);

  useEffect(() => {
    api.get('/stats/public').then(setStats).catch(() => {});
    api.get('/feed?sort=trending&limit=3').then((d) => setFeed(d.itineraries || [])).catch(() => {});
  }, []);

  const cta = user ? { to: '/app', label: 'Open my trips' } : { to: '/login', label: 'Start planning — it’s free' };

  return (
    <div className="min-h-dvh overflow-x-hidden bg-paper">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-line/60 bg-paper/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-7 text-sm font-semibold text-ink/70 md:flex">
            <a href="#features" className="hover:text-plum-700">Features</a>
            <a href="#how" className="hover:text-plum-700">How it works</a>
            <a href="#community" className="hover:text-plum-700">Community</a>
            <a href="#safety" className="hover:text-plum-700">Safety</a>
          </nav>
          <div className="flex items-center gap-2">
            {!user && <Button variant="ghost" size="sm" to="/login">Sign in</Button>}
            <Button size="sm" to={cta.to}>{user ? 'Open app' : 'Get started'}</Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        <div className="bg-grain absolute inset-0 -z-10 opacity-70" />
        <div className="mx-auto grid max-w-6xl items-center gap-16 px-4 pb-24 pt-12 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-20">
          <div className="animate-fade-up">
            <Badge tone="marigold" className="mb-5 px-3 py-1 text-[12px]">🇮🇳 Built for Bharat · WhatsApp login · UPI payments</Badge>
            <h1 className="text-balance text-[42px] font-extrabold leading-[1.02] text-ink sm:text-[58px]">
              Plan trips <span className="relative whitespace-nowrap text-plum-700">together<svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 12" preserveAspectRatio="none"><path d="M2 9 Q 50 2 100 7 T 198 5" stroke="#ffc04c" strokeWidth="5" fill="none" strokeLinecap="round" /></svg></span>.<br />
              Let Yatri book the rest.
            </h1>
            <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-muted">
              Itenary is the shared trip hub for friends, couples and families — plan in real time, vote on the hard choices, and let our AI concierge book cabs, food and stays. You approve every payment.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button size="lg" to={cta.to} iconRight={ArrowRight}>{cta.label}</Button>
              <Button size="lg" variant="secondary" to={user ? '/app/explore' : '/login?next=/app/explore'} icon={GitFork}>Browse itineraries</Button>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] font-medium text-muted">
              <span className="flex items-center gap-1.5"><Check className="size-4 text-emerald-600" /> Free for groups</span>
              <span className="flex items-center gap-1.5"><Check className="size-4 text-emerald-600" /> Confirm-before-pay</span>
              <span className="flex items-center gap-1.5"><Check className="size-4 text-emerald-600" /> Works on patchy networks</span>
            </div>
          </div>
          <div className="pb-8 lg:pb-0">
            <HeroMock />
          </div>
        </div>
      </section>

      {/* Stats */}
      {stats && (
        <section className="border-y border-line bg-white/60">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-8 sm:px-6 md:grid-cols-4">
            {[
              ['Travellers', stats.travellers],
              ['Trips planned', stats.trips],
              ['Community itineraries', stats.itineraries],
              ['Bookings by Yatri', stats.bookings],
            ].map(([label, v]) => (
              <div key={label} className="text-center">
                <div className="font-display text-3xl font-extrabold text-plum-800">{num(v)}+</div>
                <div className="mt-1 text-[13px] font-medium text-muted">{label}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Pillars */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <div className="max-w-2xl">
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-marigold-600">Five things, one app</div>
          <h2 className="mt-3 text-balance text-4xl font-extrabold leading-tight">Everything your group chat was trying to be.</h2>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PILLARS.map(({ icon: Icon, title, body, tone }, i) => (
            <div key={title} className={`card p-6 transition hover:-translate-y-1 hover:shadow-lift ${i === 0 ? 'lg:row-span-2 lg:flex lg:flex-col' : ''}`}>
              <div className={`grid size-12 place-items-center rounded-2xl ${tone}`}><Icon className="size-6" /></div>
              <h3 className="mt-5 text-xl font-bold">{title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">{body}</p>
              {i === 0 && (
                <div className="mt-6 space-y-2 rounded-2xl bg-paper p-4 lg:mt-auto">
                  {['🟢 Priya is editing Day 2', '🗳️ Rohan started a vote: Paragliding on Day 3?', '📌 Aarav moved “Tiffin Top hike” from the Stash'].map((t) => (
                    <div key={t} className="rounded-xl bg-white px-3 py-2 text-[13px] font-medium shadow-sm">{t}</div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="bg-plum-950 text-white">
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-marigold-300">How it works</div>
          <h2 className="mt-3 max-w-2xl text-balance text-4xl font-extrabold">From “we should go somewhere” to booked — in one evening.</h2>
          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {[
              { n: '01', icon: MessageCircle, t: 'Sign in with WhatsApp', d: 'No passwords. Create a trip and drop the invite link in your group — everyone lands in the same hub.' },
              { n: '02', icon: MapPinned, t: 'Plan it together', d: 'Set the Vibe Check, stash places, vote on stays and build the day-by-day plan. Or fork a community itinerary.' },
              { n: '03', icon: Zap, t: 'Ask Yatri to book', d: '“Cab from Kathgodam at 11:45 for 3.” Review the card, approve with UPI, and it’s in your timeline and ledger.' },
            ].map(({ n, icon: Icon, t, d }) => (
              <div key={n} className="relative rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                <div className="font-display text-5xl font-extrabold text-white/10">{n}</div>
                <Icon className="mt-2 size-7 text-marigold-300" />
                <h3 className="mt-4 text-xl font-bold">{t}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-white/65">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Community */}
      <section id="community" className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div className="max-w-xl">
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-marigold-600">Community-led discovery</div>
            <h2 className="mt-3 text-balance text-4xl font-extrabold leading-tight">Trips by real travellers, not listicles.</h2>
            <p className="mt-3 text-muted">Filter by vibe, see how many people forked it, and make it yours. Creators earn when you unlock their premium guides or leave a tip.</p>
          </div>
          <Button variant="secondary" to={user ? '/app/explore' : '/login?next=/app/explore'} iconRight={ArrowRight}>See all itineraries</Button>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {feed.map((it) => (
            <Link key={it.id} to={user ? `/app/itineraries/${it.id}` : `/login?next=/app/itineraries/${it.id}`} className="card group overflow-hidden p-0 transition hover:-translate-y-1 hover:shadow-lift">
              <CoverArt theme={it.cover_theme} seed={it.id} className="aspect-[16/10]" rounded={false}>
                <div className="flex h-full items-start justify-between p-3">
                  <Badge tone={it.price ? 'marigold' : 'green'} className="shadow-sm">{it.price ? inr(it.price) : 'Free'}</Badge>
                  <span className="rounded-full bg-white/85 px-2 py-0.5 text-[11px] font-bold backdrop-blur"><GitFork className="mr-1 inline size-3" />Forked by {it.fork_count}</span>
                </div>
              </CoverArt>
              <div className="p-4">
                <h3 className="line-clamp-1 text-lg font-bold group-hover:text-plum-700">{it.title}</h3>
                <p className="mt-0.5 text-[13px] text-muted">{it.destination} · {it.days_count} days</p>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[13px] font-semibold"><Avatar user={it.creator} size={24} />{it.creator?.name}</div>
                  {it.rating_count > 0 ? <Stars value={it.rating_avg} size={12} /> : <span className="flex items-center gap-1 text-xs text-muted"><Heart className="size-3" />{it.like_count}</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Safety */}
      <section id="safety" className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <div className="card grid gap-10 overflow-hidden p-8 md:grid-cols-2 md:p-12">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-marigold-600">Trust & safety</div>
            <h2 className="mt-3 text-balance text-3xl font-extrabold leading-tight">An AI that spends money should ask first. Ours always does.</h2>
            <p className="mt-3 text-muted">Built with solo female travellers and first-time groups in mind.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: ShieldCheck, t: 'Confirm before pay', d: 'Every AI booking is a proposal until you approve the UPI payment.' },
              { icon: IndianRupee, t: 'Spending limits', d: 'Per-booking and per-trip caps enforced on our servers.' },
              { icon: Siren, t: 'SOS & live location', d: 'One tap alerts your emergency contact, your group and our safety desk.' },
              { icon: Sparkles, t: 'Humans in the loop', d: 'If a provider fails, a specialist fixes it or refunds you. Never silent.' },
            ].map(({ icon: Icon, t, d }) => (
              <div key={t} className="rounded-2xl bg-paper p-4">
                <Icon className="size-5 text-plum-700" />
                <div className="mt-2 font-bold">{t}</div>
                <p className="mt-1 text-[13px] leading-relaxed text-muted">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-4 pb-20 sm:px-6">
        <CoverArt theme="festival" seed="cta" className="mx-auto max-w-6xl rounded-[32px]">
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <h2 className="max-w-2xl text-balance text-4xl font-extrabold text-white drop-shadow sm:text-5xl">Your next trip starts in the group chat. Finish it here.</h2>
            <Button size="lg" variant="dark" className="mt-8" to={cta.to} iconRight={ArrowRight}>{cta.label}</Button>
          </div>
        </CoverArt>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-[13px] text-muted sm:flex-row sm:px-6">
          <Logo size={26} />
          <p>© {new Date().getFullYear()} Itenary · Made in India for the whole world · <Link to="/admin" className="hover:text-plum-700">Admin</Link></p>
        </div>
      </footer>
    </div>
  );
}
