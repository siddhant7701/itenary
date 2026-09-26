import { Link } from 'react-router';
import clsx from 'clsx';
import { CalendarDays, MapPin, Ticket } from 'lucide-react';
import CoverArt from './CoverArt';
import { AvatarStack, Badge } from './ui';
import { fmtRange, tripCountdown, tripLength } from '../lib/format';

const STATUS_TONE = { ongoing: 'green', planning: 'plum', booked: 'blue', completed: 'neutral', archived: 'neutral' };

export default function TripCard({ trip, large = false, className }) {
  return (
    <Link to={`/app/trips/${trip.id}`} className={clsx('card group block overflow-hidden p-0 transition hover:-translate-y-0.5 hover:shadow-lift', className)}>
      <CoverArt theme={trip.cover_theme} seed={trip.id} className={large ? 'h-48 sm:h-56' : 'h-32'} rounded={false}>
        <div className={clsx('flex h-full flex-col justify-between p-3.5', large ? 'h-48 sm:h-56' : 'h-32')}>
          <div className="flex items-center justify-between gap-2">
            <Badge tone={STATUS_TONE[trip.status] || 'plum'} className="shadow-sm">{trip.status === 'ongoing' ? '● Happening now' : tripCountdown(trip.start_date, trip.end_date)}</Badge>
            {trip.my_role === 'owner' && <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-ink/70 backdrop-blur">Owner</span>}
          </div>
          {large && (
            <div>
              <div className="font-display text-3xl font-extrabold leading-tight text-white drop-shadow-[0_2px_8px_rgb(0_0_0/0.35)]">{trip.name}</div>
              <div className="mt-1 text-sm font-semibold text-white/90 drop-shadow">{trip.destination}</div>
            </div>
          )}
        </div>
      </CoverArt>
      <div className="p-4">
        {!large && <h3 className="line-clamp-1 text-[17px] font-bold group-hover:text-plum-700">{trip.name}</h3>}
        <div className={clsx('flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted', !large && 'mt-1')}>
          <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" />{trip.destination}</span>
          <span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5" />{fmtRange(trip.start_date, trip.end_date)} · {tripLength(trip.start_date, trip.end_date)}d</span>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <AvatarStack users={trip.members || []} size={28} max={5} />
          <div className="flex items-center gap-3 text-xs font-semibold text-muted">
            <span>{trip.item_count} stops</span>
            {trip.booking_count > 0 && <span className="inline-flex items-center gap-1"><Ticket className="size-3.5" />{trip.booking_count}</span>}
          </div>
        </div>
      </div>
    </Link>
  );
}
