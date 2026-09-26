import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowRight, Bot, CalendarHeart, Compass, Plus, Sparkles, Ticket } from 'lucide-react';
import TripCard from '../components/TripCard';
import BookingRow from '../components/BookingRow';
import CoverArt from '../components/CoverArt';
import ItineraryCard from './discover/ItineraryCard';
import { Badge, Button, Card, EmptyState, SectionTitle, Skeleton } from '../components/ui';
import CreateTripModal from './trip/CreateTripModal';
import { JoinTripModal } from './Trips';
import { useAuth } from '../lib/auth';
import { useFetch } from '../lib/hooks';
import { fmtDay, inr } from '../lib/format';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const trips = useFetch('/trips');
  const bookings = useFetch('/bookings?status=proposed,requested,confirmed,needs_attention');
  const feed = useFetch('/feed?sort=trending&limit=3');
  const events = useFetch('/events');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  const active = useMemo(() => (trips.data?.trips || []).filter((t) => ['planning', 'booked', 'ongoing'].includes(t.status)), [trips.data]);
  const next = active[0];
  const proposals = (bookings.data?.bookings || []).filter((b) => b.status === 'proposed' && Date.now() - new Date(b.created_at).getTime() < 30 * 60 * 1000);
  const upcoming = (bookings.data?.bookings || []).filter((b) => b.status !== 'proposed' && (!b.scheduled_at || new Date(b.scheduled_at) > new Date())).slice(0, 4);
  const tripCities = new Set(active.map((t) => t.destination?.toLowerCase()));
  const suggestedEvents = (events.data?.events || []).sort((a, b) => (tripCities.has(b.city.toLowerCase()) ? 1 : 0) - (tripCities.has(a.city.toLowerCase()) ? 1 : 0)).slice(0, 4);

  return (
    <div className="space-y-10">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-marigold-600">{greeting()}, {user?.name?.split(' ')[0]} 👋</p>
          <h1 className="mt-1 text-[32px] font-extrabold leading-tight">{next ? 'Your next adventure is taking shape' : 'Where to next?'}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={Ticket} onClick={() => setJoining(true)}>Join</Button>
          <Button icon={Plus} onClick={() => setCreating(true)}>New trip</Button>
        </div>
      </div>

      {trips.loading ? (
        <Skeleton className="h-72" />
      ) : next ? (
        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <TripCard trip={next} large />
          <Card className="flex flex-col bg-gradient-to-br from-plum-800 to-plum-950 text-white">
            <div className="flex items-center gap-2 text-sm font-bold text-marigold-300"><Sparkles className="size-4" /> Ask Yatri</div>
            <p className="mt-2 font-display text-2xl font-bold leading-snug">“Book a cab from the station to our hotel on day 1 at 11am.”</p>
            <p className="mt-2 text-sm text-white/70">Yatri checks your trip, finds options and waits for your OK before anything is paid.</p>
            <div className="mt-auto flex flex-wrap gap-2 pt-6">
              <Button variant="accent" icon={Bot} onClick={() => navigate(`/app/trips/${next.id}?tab=concierge`)}>Open concierge</Button>
              <Button variant="ghost" className="text-white hover:bg-white/10 hover:text-white" onClick={() => navigate(`/app/trips/${next.id}`)}>Open trip hub</Button>
            </div>
          </Card>
        </div>
      ) : (
        <CoverArt theme="beach" seed={user?.id || 'home'} className="h-64">
          <div className="flex h-64 flex-col items-start justify-end gap-3 p-6">
            <h2 className="max-w-md font-display text-3xl font-extrabold text-white drop-shadow-[0_2px_10px_rgb(0_0_0/0.35)]">Start a trip and invite your crew — it takes 30 seconds.</h2>
            <div className="flex gap-2">
              <Button variant="dark" icon={Plus} onClick={() => setCreating(true)}>Plan a trip</Button>
              <Button variant="secondary" icon={Compass} to="/app/explore">Fork an itinerary</Button>
            </div>
          </div>
        </CoverArt>
      )}

      {proposals.length > 0 && (
        <section>
          <SectionTitle title="Waiting for your OK" subtitle="Yatri found these — nothing is charged until you approve." />
          <div className="grid gap-3 md:grid-cols-2">
            {proposals.slice(0, 4).map((b) => (
              <Link key={b.id} to={`/app/trips/${b.trip_id}?tab=concierge`} className="card flex items-center gap-3 p-4 transition hover:border-plum-300">
                <BookingRow booking={b} compact />
                <Badge tone="marigold">{inr(b.total)}</Badge>
              </Link>
            ))}
          </div>
        </section>
      )}

      {active.length > 1 && (
        <section>
          <SectionTitle title="All upcoming trips" action={<Link to="/app/trips" className="text-sm font-semibold text-plum-700 hover:underline">See all</Link>} />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {active.slice(1, 4).map((t) => <TripCard key={t.id} trip={t} />)}
          </div>
        </section>
      )}

      {upcoming.length > 0 && (
        <section>
          <SectionTitle title="Upcoming bookings" action={<Link to="/app/bookings" className="text-sm font-semibold text-plum-700 hover:underline">All bookings</Link>} />
          <Card padded={false} className="divide-y divide-line">
            {upcoming.map((b) => (
              <Link key={b.id} to={b.trip_id ? `/app/trips/${b.trip_id}?tab=bookings` : '/app/bookings'} className="block px-4 py-3.5 hover:bg-paper">
                <BookingRow booking={b} />
              </Link>
            ))}
          </Card>
        </section>
      )}

      <section>
        <SectionTitle title="Trending in the community" subtitle="Fork one and Yatri will personalise it for your group." action={<Link to="/app/explore" className="inline-flex items-center gap-1 text-sm font-semibold text-plum-700 hover:underline">Explore <ArrowRight className="size-4" /></Link>} />
        {feed.loading ? (
          <div className="grid gap-5 md:grid-cols-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-72" />)}</div>
        ) : (
          <div className="grid gap-5 md:grid-cols-3">
            {(feed.data?.itineraries || []).map((it) => <ItineraryCard key={it.id} itinerary={it} />)}
          </div>
        )}
      </section>

      <section>
        <SectionTitle title="Experiences & festivals" subtitle={active.length ? 'Picked for your upcoming destinations first' : 'Bookable local experiences across India'} action={<Link to="/app/events" className="inline-flex items-center gap-1 text-sm font-semibold text-plum-700 hover:underline">Event finder <ArrowRight className="size-4" /></Link>} />
        {suggestedEvents.length === 0 ? (
          <EmptyState icon={CalendarHeart} title="No events yet" description="Check back soon for festivals and experiences." />
        ) : (
          <div className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 lg:grid-cols-4">
            {suggestedEvents.map((e) => (
              <Link key={e.id} to={`/app/events?event=${e.id}`} className="card w-64 shrink-0 snap-start overflow-hidden p-0 transition hover:-translate-y-0.5 hover:shadow-lift sm:w-auto">
                <CoverArt theme={e.cover_theme} seed={e.id} className="h-28" rounded={false}>
                  <div className="p-3"><Badge tone="dark" className="bg-ink/70">{fmtDay(e.start_at)}</Badge></div>
                </CoverArt>
                <div className="p-3.5">
                  <div className="line-clamp-2 text-[14.5px] font-bold leading-snug">{e.title}</div>
                  <div className="mt-1 flex items-center justify-between text-[12.5px] text-muted">
                    <span>{e.city}</span>
                    <span className="font-bold text-ink">{e.price ? inr(e.price) : 'Free'}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <CreateTripModal open={creating} onClose={() => setCreating(false)} onCreated={(t) => navigate(`/app/trips/${t.id}?welcome=new`)} />
      <JoinTripModal open={joining} onClose={() => setJoining(false)} />
    </div>
  );
}
