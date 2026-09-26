import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { Bot, ExternalLink, Trash2 } from 'lucide-react';
import { Avatar, Badge, Button, EmptyState, ErrorState, PageHeader, Skeleton, VerifiedBadge, useConfirm } from '../../components/ui';
import { adminApi } from '../../lib/api';
import { useFetch } from '../../lib/hooks';
import { CATEGORY, ITEM_TYPES, fmtDate, fmtDateTime, fmtDay, fmtRange, fmtTime, inr, tripLength, vibeLabel } from '../../lib/format';
import DataTable from './DataTable';
import BookingDrawer from './BookingDrawer';
import { BOOKING_STATUS_ADMIN, CopyText, KeyValues, MiniStat, Panel, StatusBadge, TRIP_STATUS, useAdmin, usePrompt } from './kit';

export default function TripDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useFetch(`/admin/trips/${id}`, { scope: 'admin' });
  const { refresh } = useAdmin();
  const confirm = useConfirm();
  const prompt = usePrompt();
  const [openBooking, setOpenBooking] = useState(null);
  const [deleting, setDeleting] = useState(false);

  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (loading && !data)
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  if (!data) return null;

  const { trip, members, days, stats, bookings, published, polls, stash, chat_count } = data;
  const itemCount = days.reduce((s, d) => s + d.items.length, 0);
  // listMembers() selects `m.role, …, u.*`, so `role` comes back as the account role — use owner_id instead.
  const isOwner = (m) => m.user_id === trip.owner_id;
  const owner = members.find(isOwner);

  const remove = async () => {
    const reason = await prompt({
      title: `Delete “${trip.name}”?`,
      description: `The trip, its itinerary, chat, polls and photos will be permanently removed for all ${members.length} member${members.length === 1 ? '' : 's'}. They’ll be notified with your reason.`,
      label: 'Reason (sent to members)',
      placeholder: 'e.g. This trip violated our community guidelines',
      confirmLabel: 'Continue',
      tone: 'danger',
      maxLength: 200,
    });
    if (reason === null) return;
    const ok = await confirm({ title: 'This can’t be undone', description: `Permanently delete “${trip.name}” and everything in it?`, confirmLabel: 'Delete trip', tone: 'danger' });
    if (!ok) return;
    setDeleting(true);
    try {
      await adminApi.del(`/admin/trips/${trip.id}`, { reason: reason || undefined });
      toast.success('Trip deleted and members notified');
      refresh();
      navigate('/admin/trips', { replace: true });
    } catch (err) {
      toast.error(err.message);
      setDeleting(false);
    }
  };

  return (
    <div>
      <PageHeader
        back="/admin/trips"
        eyebrow={trip.destination || 'Trip'}
        title={trip.name}
        subtitle={`${fmtRange(trip.start_date, trip.end_date)} · ${tripLength(trip.start_date, trip.end_date)} days · created ${fmtDate(trip.created_at)}`}
        actions={
          <>
            <StatusBadge map={TRIP_STATUS} value={trip.status} className="h-7 px-3 text-[12.5px]" />
            <Button variant="danger-soft" size="sm" icon={Trash2} loading={deleting} onClick={remove}>
              Delete trip
            </Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <MiniStat label="Members" value={members.length} hint={owner ? `Owner: ${owner.name}` : undefined} />
        <MiniStat label="Plan items" value={itemCount} hint={`${days.length} days`} />
        <MiniStat label="Bookings" value={stats.bookings} hint={inr(stats.booked_total) + ' booked'} />
        <MiniStat label="Spent" value={inr(stats.spent)} hint={trip.budget ? `of ${inr(trip.budget)} budget` : 'No budget set'} />
        <MiniStat label="Photos" value={stats.photos} />
        <MiniStat label="Chat messages" value={chat_count} hint={stats.unread_proposals ? `${stats.unread_proposals} open proposals` : undefined} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Panel title="Itinerary" subtitle="Day-by-day plan as the group sees it" bodyClassName="p-0">
            {days.length === 0 ? (
              <div className="p-5">
                <EmptyState emoji="🗓️" title="No days planned" />
              </div>
            ) : (
              <ol className="divide-y divide-line/70">
                {days.map((d) => (
                  <li key={d.id} className="px-5 py-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="flex items-baseline gap-2">
                        <span className="rounded-md bg-plum-700 px-1.5 py-0.5 text-[11px] font-bold text-white">Day {d.day_number}</span>
                        <span className="font-bold text-ink">{d.title || 'Untitled day'}</span>
                      </div>
                      <span className="shrink-0 text-[12px] text-muted">{fmtDay(d.date)}</span>
                    </div>
                    {d.notes && <p className="mt-1 text-[13px] text-muted">{d.notes}</p>}
                    {d.items.length === 0 ? (
                      <p className="mt-2 text-[13px] text-muted">Nothing planned yet.</p>
                    ) : (
                      <ul className="mt-3 space-y-2">
                        {d.items.map((it) => {
                          const t = ITEM_TYPES[it.type] || ITEM_TYPES.note;
                          return (
                            <li key={it.id} className="flex items-start gap-3 rounded-xl border border-line/70 bg-paper/50 px-3 py-2.5">
                              <span className="w-14 shrink-0 pt-0.5 text-[12px] font-semibold tabular-nums text-muted">{it.start_time ? fmtTime(it.start_time) : '—'}</span>
                              <span className="text-base leading-none" title={t.label}>
                                {t.emoji}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-[13.5px] font-semibold text-ink">{it.title}</span>
                                  {it.added_by_agent && (
                                    <Badge tone="plum" icon={Bot}>
                                      AI
                                    </Badge>
                                  )}
                                  {it.booking_id && (
                                    <button onClick={() => setOpenBooking(it.booking_id)} className="rounded-full">
                                      <Badge tone="green">Booked</Badge>
                                    </button>
                                  )}
                                </div>
                                {it.description && <p className="mt-0.5 line-clamp-2 text-[12.5px] text-muted">{it.description}</p>}
                              </div>
                              {it.cost > 0 && <span className="shrink-0 text-[12.5px] font-semibold tabular-nums text-ink/80">{inr(it.cost)}</span>}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Panel>

          <div>
            <h2 className="mb-3 text-[15px] font-bold text-ink">Bookings ({bookings.length})</h2>
            <DataTable
              sticky={false}
              rows={bookings}
              onRowClick={(b) => setOpenBooking(b.id)}
              rowClassName={(b) => (b.status === 'needs_attention' ? 'bg-rose-50/50' : '')}
              empty={<EmptyState emoji="🎫" title="No bookings on this trip" description="Proposals from the AI concierge and paid bookings appear here." />}
              columns={[
                {
                  key: 'title',
                  header: 'Booking',
                  mobile: 'title',
                  render: (b) => (
                    <span className="flex min-w-0 items-center gap-2">
                      <span>{CATEGORY[b.category]?.emoji}</span>
                      <span className="truncate font-semibold text-ink">{b.title}</span>
                    </span>
                  ),
                },
                { key: 'provider_name', header: 'Provider', render: (b) => <span className="text-ink/80">{b.provider_name}</span> },
                { key: 'total', header: 'Total', align: 'right', render: (b) => <span className="font-semibold tabular-nums">{inr(b.total)}</span> },
                { key: 'status', header: 'Status', render: (b) => <StatusBadge map={BOOKING_STATUS_ADMIN} value={b.status} /> },
                { key: 'scheduled_at', header: 'Scheduled', render: (b) => <span className="whitespace-nowrap text-muted">{b.scheduled_at ? fmtDateTime(b.scheduled_at) : '—'}</span> },
              ]}
            />
          </div>
        </div>

        <aside className="space-y-4">
          <Panel title={`Members (${members.length})`} bodyClassName="p-0">
            <ul className="divide-y divide-line/70">
              {members.map((m) => (
                <li key={m.user_id}>
                  <Link to={`/admin/users/${m.user_id}`} className="flex items-center gap-3 px-5 py-3 transition hover:bg-plum-50/40">
                    <Avatar user={m} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1 truncate text-[13.5px] font-semibold text-ink">
                        <span className="truncate">{m.name}</span>
                        {m.verified && <VerifiedBadge className="size-3.5" />}
                      </div>
                      <div className="truncate text-[12px] text-muted">
                        {m.phone || m.home_city || '—'} · vibe {vibeLabel(m.vibe).toLowerCase()}
                      </div>
                    </div>
                    <Badge tone={isOwner(m) ? 'plum' : 'neutral'}>{isOwner(m) ? 'Owner' : 'Member'}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Trip settings">
            <KeyValues
              cols={1}
              items={[
                { label: 'Invite code', value: <CopyText value={trip.invite_code} /> },
                { label: 'Budget', value: trip.budget ? inr(trip.budget) : 'Not set' },
                { label: 'Group vibe', value: `${trip.vibe_score}/100 · ${vibeLabel(trip.vibe_score)}` },
                { label: 'Per-booking spend limit', value: inr(trip.spend_limit_booking) },
                { label: 'Trip spend limit', value: inr(trip.spend_limit_trip) },
                { label: 'Polls', value: `${polls.length} (${polls.filter((p) => !p.closed).length} open)` },
                { label: 'Idea stash', value: `${stash.length} saved` },
                {
                  label: 'Forked from',
                  value: trip.source_itinerary_id ? (
                    <a href={`/app/itineraries/${trip.source_itinerary_id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-plum-700 hover:underline">
                      Marketplace itinerary <ExternalLink className="size-3" />
                    </a>
                  ) : null,
                },
                {
                  label: 'Published as',
                  value: published ? (
                    <a href={`/app/itineraries/${published.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-plum-700 hover:underline">
                      {published.price ? inr(published.price) : 'Free'} itinerary · {published.fork_count} forks <ExternalLink className="size-3" />
                    </a>
                  ) : null,
                },
                { label: 'Trip ID', value: <CopyText value={trip.id} /> },
              ]}
            />
          </Panel>
        </aside>
      </div>

      <BookingDrawer id={openBooking} onClose={() => setOpenBooking(null)} onChanged={() => reload()} />
    </div>
  );
}

