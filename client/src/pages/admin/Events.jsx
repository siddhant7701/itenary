import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { toast } from 'sonner';
import { CalendarDays, CalendarPlus, Eye, EyeOff, Pencil, Trash2 } from 'lucide-react';
import { Button, EmptyState, ErrorState, Field, Input, Menu, Modal, PageHeader, Progress, Segmented, Select, Textarea, useConfirm } from '../../components/ui';
import { adminApi } from '../../lib/api';
import { useFetch } from '../../lib/hooks';
import { inr, num } from '../../lib/format';
import DataTable from './DataTable';
import { ChipToggle, EVENT_CATEGORIES, FilterBar, FilterSelect, MiniStat, SearchBox, StatusBadge, useQueryParams } from './kit';

const DEFAULTS = { q: '', status: '', category: '', when: 'upcoming' };
const EVENT_STATUS = { active: { label: 'Active', tone: 'green' }, hidden: { label: 'Hidden', tone: 'neutral' } };
const toLocal = (iso) => (iso ? dayjs(iso).format('YYYY-MM-DDTHH:mm') : '');
const EMPTY = { title: '', description: '', city: '', venue: '', category: 'activity', start_at: '', end_at: '', price: '0', capacity: '50', status: 'active', image_url: '' };

function fmtWhen(e) {
  const s = dayjs(e.start_at);
  if (!e.end_at) return s.format('ddd, D MMM YYYY · h:mm A');
  const end = dayjs(e.end_at);
  return s.isSame(end, 'day') ? `${s.format('ddd, D MMM YYYY · h:mm')}–${end.format('h:mm A')}` : `${s.format('D MMM, h:mm A')} → ${end.format('D MMM YYYY, h:mm A')}`;
}

function EventModal({ event, open, onClose, onSaved }) {
  const editing = !!event?.id;
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [lastKey, setLastKey] = useState(null);
  const key = open ? event?.id || 'new' : null;
  if (key !== lastKey) {
    // reset the form whenever the modal opens for a different event
    setLastKey(key);
    if (open) {
      setError('');
      setForm(
        editing
          ? {
              title: event.title || '',
              description: event.description || '',
              city: event.city || '',
              venue: event.venue || '',
              category: event.category || 'activity',
              start_at: toLocal(event.start_at),
              end_at: toLocal(event.end_at),
              price: String(event.price ?? 0),
              capacity: String(event.capacity ?? 50),
              status: event.status || 'active',
              image_url: event.image_url || '',
            }
          : { ...EMPTY, start_at: dayjs().add(7, 'day').hour(18).minute(0).format('YYYY-MM-DDTHH:mm') },
      );
    }
  }
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e?.preventDefault();
    setError('');
    if (!form.title.trim() || !form.city.trim()) return setError('Title and city are required.');
    if (!form.start_at) return setError('Start time is required.');
    if (form.end_at && dayjs(form.end_at).isBefore(dayjs(form.start_at))) return setError('End time must be after the start time.');
    const price = Number(form.price || 0);
    const capacity = Number(form.capacity || 0);
    if (!Number.isFinite(price) || price < 0) return setError('Price must be ₹0 or more.');
    if (!Number.isFinite(capacity) || capacity < 1) return setError('Capacity must be at least 1.');
    if (editing && capacity < (event.booked_count || 0)) return setError(`Capacity can’t be below the ${event.booked_count} tickets already booked.`);
    const body = {
      title: form.title.trim(),
      description: form.description.trim(),
      city: form.city.trim(),
      venue: form.venue.trim(),
      category: form.category,
      start_at: new Date(form.start_at).toISOString(),
      end_at: form.end_at ? new Date(form.end_at).toISOString() : null,
      price: Math.round(price),
      capacity: Math.round(capacity),
      status: form.status,
      image_url: form.image_url.trim(),
    };
    if (!editing && !body.end_at) delete body.end_at;
    setBusy(true);
    try {
      if (editing) await adminApi.patch(`/admin/events/${event.id}`, body);
      else await adminApi.post('/admin/events', body);
      toast.success(editing ? 'Event updated' : 'Event published to the Events feed');
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={editing ? 'Edit event' : 'Create event'}
      description={editing ? `${event.booked_count || 0} tickets booked so far.` : 'Events show up in the traveller app and can be booked through the concierge.'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy} icon={editing ? Pencil : CalendarPlus}>
            {editing ? 'Save changes' : 'Create event'}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" className="sm:col-span-2">
          <Input value={form.title} onChange={set('title')} maxLength={120} placeholder="e.g. Ganga Aarti & Sunset Boat Ride" />
        </Field>
        <Field label="Description" className="sm:col-span-2">
          <Textarea value={form.description} onChange={set('description')} maxLength={2000} rows={3} placeholder="What travellers will do, what’s included, what to bring" />
        </Field>
        <Field label="City" hint="Known cities are pinned on the map automatically.">
          <Input value={form.city} onChange={set('city')} maxLength={60} placeholder="Rishikesh" />
        </Field>
        <Field label="Venue">
          <Input value={form.venue} onChange={set('venue')} maxLength={120} placeholder="Triveni Ghat" />
        </Field>
        <Field label="Category">
          <Select value={form.category} onChange={set('category')}>
            {Object.entries(EVENT_CATEGORIES).map(([v, c]) => (
              <option key={v} value={v}>
                {c.emoji} {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Visibility">
          <Segmented
            className="w-full"
            value={form.status}
            onChange={(status) => setForm((f) => ({ ...f, status }))}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'hidden', label: 'Hidden' },
            ]}
          />
        </Field>
        <Field label="Starts">
          <Input type="datetime-local" value={form.start_at} onChange={set('start_at')} />
        </Field>
        <Field label="Ends (optional)">
          <Input type="datetime-local" value={form.end_at} min={form.start_at || undefined} onChange={set('end_at')} />
        </Field>
        <Field label="Price per ticket (₹)" hint="Use 0 for free events.">
          <Input type="number" min={0} max={500000} step={1} value={form.price} onChange={set('price')} />
        </Field>
        <Field label="Capacity">
          <Input type="number" min={1} max={100000} step={1} value={form.capacity} onChange={set('capacity')} />
        </Field>
        <Field label="Cover image URL (optional)" className="sm:col-span-2">
          <Input type="url" value={form.image_url} onChange={set('image_url')} placeholder="https://…" />
        </Field>
        {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-[13px] font-medium text-rose-700 sm:col-span-2">{error}</p>}
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

export default function Events() {
  const [f, setF] = useQueryParams(DEFAULTS);
  const { data, loading, error, reload } = useFetch('/admin/events', { scope: 'admin' });
  const confirm = useConfirm();
  const [editing, setEditing] = useState(null); // event | {} for new | null

  const events = data?.events || [];
  const shown = useMemo(() => {
    const q = f.q.toLowerCase();
    const now = Date.now();
    return events
      .filter((e) => (!f.status || e.status === f.status) && (!f.category || e.category === f.category))
      .filter((e) => f.when === 'all' || (f.when === 'upcoming' ? Date.parse(e.end_at || e.start_at) >= now : Date.parse(e.end_at || e.start_at) < now))
      .filter((e) => !q || `${e.title} ${e.city} ${e.venue}`.toLowerCase().includes(q))
      .sort((a, b) => (f.when === 'past' ? b.start_at.localeCompare(a.start_at) : a.start_at.localeCompare(b.start_at)));
  }, [events, f]);

  const upcoming = events.filter((e) => Date.parse(e.end_at || e.start_at) >= Date.now());

  const setStatus = async (e, status) => {
    try {
      await adminApi.patch(`/admin/events/${e.id}`, { status });
      toast.success(status === 'hidden' ? 'Event hidden from travellers' : 'Event is visible again');
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const remove = async (e) => {
    const hasBookings = e.booked_count > 0;
    const ok = await confirm({
      title: hasBookings ? 'Hide this event?' : `Delete “${e.title}”?`,
      description: hasBookings ? `${e.booked_count} tickets are already booked, so the event will be hidden instead of deleted. Existing bookings are unaffected.` : 'The event will be permanently deleted.',
      confirmLabel: hasBookings ? 'Hide event' : 'Delete event',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      const res = await adminApi.del(`/admin/events/${e.id}`);
      toast.success(res.hidden ? 'Event hidden (it has bookings)' : 'Event deleted');
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const columns = [
    {
      key: 'title',
      header: 'Event',
      mobile: 'title',
      render: (e) => (
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-sand text-lg">{EVENT_CATEGORIES[e.category]?.emoji || '🎟️'}</span>
          <div className="min-w-0 max-w-[300px]">
            <div className="truncate font-semibold text-ink">{e.title}</div>
            <div className="truncate text-xs text-muted">
              {e.city}
              {e.venue ? ` · ${e.venue}` : ''} · {EVENT_CATEGORIES[e.category]?.label || e.category}
            </div>
          </div>
        </div>
      ),
    },
    { key: 'when', header: 'When', render: (e) => <span className="whitespace-nowrap text-ink/85">{fmtWhen(e)}</span> },
    { key: 'price', header: 'Price', align: 'right', render: (e) => (e.price ? <span className="font-semibold tabular-nums">{inr(e.price)}</span> : <span className="text-muted">Free</span>) },
    {
      key: 'capacity',
      header: 'Booked',
      render: (e) => (
        <div className="w-32">
          <div className="flex justify-between text-[12px]">
            <span className="font-semibold tabular-nums text-ink">
              {num(e.booked_count)}/{num(e.capacity)}
            </span>
            <span className="text-muted">{Math.round((e.booked_count / Math.max(1, e.capacity)) * 100)}%</span>
          </div>
          <Progress value={e.booked_count} max={e.capacity} className="mt-1 h-1.5" tone={e.booked_count >= e.capacity ? 'red' : 'plum'} />
        </div>
      ),
    },
    { key: 'status', header: 'Status', render: (e) => <StatusBadge map={EVENT_STATUS} value={e.status} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      stop: true,
      render: (e) => (
        <div className="flex items-center justify-end gap-1">
          <Button size="xs" variant="secondary" icon={Pencil} onClick={() => setEditing(e)}>
            Edit
          </Button>
          <Menu
            items={[
              e.status === 'active' ? { label: 'Hide from travellers', icon: EyeOff, onClick: () => setStatus(e, 'hidden') } : { label: 'Make visible', icon: Eye, onClick: () => setStatus(e, 'active') },
              { label: e.booked_count > 0 ? 'Delete (hides — has bookings)' : 'Delete', icon: Trash2, danger: true, onClick: () => remove(e) },
            ]}
          />
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Events"
        subtitle="Local festivals, food walks and adventures travellers can discover and book."
        actions={
          <Button icon={CalendarPlus} onClick={() => setEditing({})}>
            Create event
          </Button>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <MiniStat label="Upcoming" value={num(upcoming.length)} hint={`${num(events.length)} total`} />
        <MiniStat label="Tickets booked (upcoming)" value={num(upcoming.reduce((s, e) => s + e.booked_count, 0))} />
        <MiniStat label="Ticket value (upcoming)" value={inr(upcoming.reduce((s, e) => s + e.booked_count * e.price, 0))} />
        <MiniStat label="Hidden" value={num(events.filter((e) => e.status === 'hidden').length)} />
      </div>
      <FilterBar>
        <SearchBox value={f.q} onChange={(q) => setF({ q })} placeholder="Search title, city or venue" className="sm:w-72" />
        <Segmented
          value={f.when}
          onChange={(when) => setF({ when })}
          options={[
            { value: 'upcoming', label: 'Upcoming' },
            { value: 'past', label: 'Past' },
            { value: 'all', label: 'All' },
          ]}
        />
        <FilterSelect label="Category" value={f.category} onChange={(category) => setF({ category })} options={[{ value: '', label: 'All categories' }, ...Object.entries(EVENT_CATEGORIES).map(([value, c]) => ({ value, label: `${c.emoji} ${c.label}` }))]} />
        <ChipToggle icon={EyeOff} active={f.status === 'hidden'} onClick={() => setF({ status: f.status === 'hidden' ? '' : 'hidden' })}>
          Hidden only
        </ChipToggle>
      </FilterBar>
      {error && !data ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <DataTable
          columns={columns}
          rows={data ? shown : null}
          loading={loading}
          rowClassName={(e) => (e.status === 'hidden' ? 'opacity-60' : '')}
          empty={
            <EmptyState
              icon={CalendarDays}
              title="No events here"
              description={f.q || f.category || f.status ? 'Try a different filter.' : f.when === 'upcoming' ? 'Create an event to give travellers something to book.' : 'Nothing to show.'}
              action={
                <Button icon={CalendarPlus} onClick={() => setEditing({})}>
                  Create event
                </Button>
              }
            />
          }
        />
      )}
      <EventModal open={!!editing} event={editing} onClose={() => setEditing(null)} onSaved={reload} />
    </div>
  );
}
