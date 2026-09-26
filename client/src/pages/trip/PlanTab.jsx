import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { toast } from 'sonner';
import { ArrowDownUp, Bot, Clock, ExternalLink, GripVertical, MapPin, Pencil, Plus, Sparkles, Ticket, Trash2 } from 'lucide-react';
import { Avatar, Button, Field, Input, Menu, Modal, Select, Textarea, useConfirm } from '../../components/ui';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { useDebounced } from '../../lib/hooks';
import { ITEM_TYPES, fmtDay, fmtTime, inr } from '../../lib/format';
import { PollsPanel, StashPanel, VibeCheck } from './PlanSide';

function setEditing(tripId, target) {
  getSocket()?.emit('presence:editing', { tripId, target });
}

export function positionAt(items, index) {
  const prev = items[index - 1]?.position;
  const next = items[index]?.position;
  if (prev == null && next == null) return 1;
  if (prev == null) return next - 1;
  if (next == null) return prev + 1;
  return (prev + next) / 2;
}

function PlaceSearch({ value, onChange, onPick, near }) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState([]);
  const q = useDebounced(value, 250);
  useEffect(() => {
    if (!open || !q || q.length < 2) return setResults([]);
    let alive = true;
    api.get(`/places/search?q=${encodeURIComponent(q)}&near=${encodeURIComponent(near || '')}`).then((r) => alive && setResults(r.results)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [q, open, near]);
  return (
    <div className="relative">
      <Input icon={MapPin} value={value} onChange={(e) => { onChange(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} placeholder="Search a place, e.g. Naini Lake" />
      {open && results.length > 0 && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-line bg-white py-1 shadow-lift">
          {results.map((r, i) => (
            <button key={i} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onPick(r); setOpen(false); }} className="flex w-full items-start gap-2.5 px-3 py-2 text-left hover:bg-paper">
              <MapPin className="mt-0.5 size-4 shrink-0 text-plum-500" />
              <span>
                <span className="block text-sm font-semibold">{r.name}</span>
                <span className="block text-xs text-muted">{r.subtitle}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ItemModal({ open, onClose, ctx, day, item }) {
  const { data, tripId } = ctx;
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      title: item?.title || '',
      type: item?.type || 'place',
      start_time: item?.start_time || '',
      duration_min: item?.duration_min || '',
      place_name: item?.place_name || '',
      lat: item?.lat ?? null,
      lng: item?.lng ?? null,
      cost: item?.cost || '',
      description: item?.description || '',
      url: item?.url || '',
      day_id: item?.day_id || day?.id,
    });
    setEditing(tripId, `day:${item?.day_id || day?.id}`);
    return () => setEditing(tripId, null);
    // Only reset when the modal opens or targets a different item — live updates re-create `day`/`item` objects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id, day?.id, tripId]);

  if (!form) return null;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const body = {
      title: form.title,
      type: form.type,
      start_time: form.start_time || null,
      duration_min: form.duration_min ? Number(form.duration_min) : undefined,
      place_name: form.place_name || null,
      lat: form.lat,
      lng: form.lng,
      cost: Number(String(form.cost).replace(/\D/g, '')) || 0,
      description: form.description,
      url: form.url || null,
    };
    try {
      if (item) {
        await api.patch(`/trips/${tripId}/items/${item.id}`, { ...body, day_id: form.day_id });
      } else {
        await api.post(`/trips/${tripId}/days/${form.day_id}/items`, body);
      }
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={item ? 'Edit stop' : `Add to Day ${day?.day_number}`} size="md">
      <form onSubmit={submit} className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(ITEM_TYPES).map(([k, v]) => (
            <button key={k} type="button" onClick={() => setForm((f) => ({ ...f, type: k }))} className={clsx('chip', form.type === k && 'chip-active')}>{v.emoji} {v.label}</button>
          ))}
        </div>
        <Field label="What’s the plan?"><Input value={form.title} onChange={set('title')} placeholder="e.g. Sunset at Snow View Point" required maxLength={140} /></Field>
        <Field label="Where" hint={form.lat ? '📍 Pinned on the map' : 'Pick a suggestion to pin it on the map'}>
          <PlaceSearch value={form.place_name} near={data.trip.destination} onChange={(v) => setForm((f) => ({ ...f, place_name: v, lat: null, lng: null }))} onPick={(r) => setForm((f) => ({ ...f, place_name: r.name, lat: r.lat, lng: r.lng, title: f.title || r.name }))} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Time"><Input type="time" value={form.start_time} onChange={set('start_time')} /></Field>
          <Field label="Mins"><Input inputMode="numeric" value={form.duration_min} onChange={set('duration_min')} placeholder="90" /></Field>
          <Field label="Cost ₹"><Input inputMode="numeric" value={form.cost} onChange={set('cost')} placeholder="0" /></Field>
        </div>
        {item && (
          <Field label="Day">
            <Select value={form.day_id} onChange={set('day_id')}>
              {data.days.map((d) => <option key={d.id} value={d.id}>Day {d.day_number} · {fmtDay(d.date)}{d.title ? ` — ${d.title}` : ''}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Notes"><Textarea value={form.description} onChange={set('description')} rows={2} placeholder="Tips, booking refs, what to carry…" maxLength={1000} /></Field>
        <Field label="Link"><Input value={form.url} onChange={set('url')} placeholder="https://" /></Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={busy}>{item ? 'Save' : 'Add stop'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function ItemRow({ item, ctx, day, onEdit, onDragStart, onDragOverRow, dropBefore }) {
  const confirm = useConfirm();
  const t = ITEM_TYPES[item.type] || ITEM_TYPES.activity;
  const adder = ctx.data.members.find((m) => m.user_id === item.added_by);

  async function remove() {
    if (!(await confirm({ title: `Remove “${item.title}”?`, confirmLabel: 'Remove', tone: 'danger' }))) return;
    try {
      await api.del(`/trips/${ctx.tripId}/items/${item.id}`);
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function moveTo(dayId) {
    const target = ctx.data.days.find((d) => d.id === dayId);
    try {
      await api.patch(`/trips/${ctx.tripId}/items/${item.id}`, { day_id: dayId, position: positionAt(target.items, target.items.length) });
      toast.success(`Moved to Day ${target.day_number}`);
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div onDragOver={onDragOverRow} className="relative">
      {dropBefore && <div className="absolute -top-1.5 left-0 right-0 h-1 rounded-full bg-plum-400" />}
      <div
        draggable
        onDragStart={onDragStart}
        className="group flex gap-3 rounded-2xl border border-transparent bg-white p-3 transition hover:border-line hover:shadow-soft"
      >
        <div className="flex w-14 shrink-0 flex-col items-center pt-0.5 text-center">
          <span className="text-[12px] font-bold text-ink/80">{item.start_time ? fmtTime(item.start_time) : '—'}</span>
          <span className="mt-1.5 grid size-9 place-items-center rounded-xl text-lg" style={{ background: `${t.color}14` }}>{t.emoji}</span>
        </div>
        <button onClick={onEdit} className="min-w-0 flex-1 text-left">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[15px] font-semibold leading-snug">{item.title}</span>
            {item.booking_id && <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10.5px] font-bold text-emerald-700"><Ticket className="size-3" /> Booked</span>}
            {item.added_by_agent && <span className="inline-flex items-center gap-0.5 rounded-full bg-plum-50 px-1.5 py-0.5 text-[10.5px] font-bold text-plum-700"><Sparkles className="size-3" /> Yatri</span>}
          </div>
          {item.place_name && item.place_name !== item.title && <div className="mt-0.5 flex items-center gap-1 text-[12.5px] text-muted"><MapPin className="size-3" />{item.place_name}</div>}
          {item.description && <p className="mt-1 line-clamp-2 text-[13px] text-ink/70">{item.description}</p>}
          <div className="mt-1.5 flex flex-wrap items-center gap-2.5 text-[11.5px] font-medium text-muted">
            {item.duration_min ? <span className="inline-flex items-center gap-1"><Clock className="size-3" />{item.duration_min >= 60 ? `${Math.floor(item.duration_min / 60)}h${item.duration_min % 60 ? ` ${item.duration_min % 60}m` : ''}` : `${item.duration_min}m`}</span> : null}
            {item.cost > 0 && <span className="font-semibold text-ink/70">{inr(item.cost)}</span>}
            {adder && <span className="inline-flex items-center gap-1"><Avatar user={{ ...adder, id: adder.user_id }} size={14} />{adder.name.split(' ')[0]}</span>}
            {item.url && <a href={item.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-0.5 text-plum-700 hover:underline"><ExternalLink className="size-3" />Link</a>}
          </div>
        </button>
        <div className="flex shrink-0 flex-col items-center gap-1">
          <span className="hidden cursor-grab text-muted/50 group-hover:block sm:block" title="Drag to reorder"><GripVertical className="size-4" /></span>
          <Menu
            items={[
              { label: 'Edit', icon: Pencil, onClick: onEdit },
              ...ctx.data.days.filter((d) => d.id !== day.id).map((d) => ({ label: `Move to Day ${d.day_number}`, icon: ArrowDownUp, onClick: () => moveTo(d.id) })),
              { label: 'Remove', icon: Trash2, danger: true, onClick: remove },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function DayCard({ day, ctx, drag, setDrag, onDrop }) {
  const { tripId, presence, data, user } = ctx;
  const [adding, setAdding] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [title, setTitle] = useState(day.title);
  const [notes, setNotes] = useState(day.notes);
  const [over, setOver] = useState(null); // index where a drop would land
  const listRef = useRef(null);
  const editors = presence.filter((p) => p.editing === `day:${day.id}` && p.user_id !== user.id).map((p) => data.members.find((m) => m.user_id === p.user_id)).filter(Boolean);
  const total = day.items.reduce((s, i) => s + (i.cost || 0), 0);

  useEffect(() => setTitle(day.title), [day.title]);
  useEffect(() => setNotes(day.notes), [day.notes]);

  async function saveDay(fields) {
    try {
      await api.patch(`/trips/${tripId}/days/${day.id}`, fields);
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function sortByTime() {
    const sorted = [...day.items].sort((a, b) => (a.start_time || '99:99').localeCompare(b.start_time || '99:99'));
    await Promise.all(sorted.map((it, i) => (it.position !== i + 1 ? api.patch(`/trips/${tripId}/items/${it.id}`, { position: i + 1 }) : null)));
  }

  const dragOverRow = (index) => (e) => {
    if (!drag) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setOver(e.clientY > rect.top + rect.height / 2 ? index + 1 : index);
  };

  return (
    <section
      className={clsx('card overflow-hidden p-0 transition', drag && 'ring-2 ring-transparent', over !== null && drag && 'ring-plum-300')}
      onDragOver={(e) => {
        if (!drag) return;
        e.preventDefault();
        if (over === null) setOver(day.items.length);
      }}
      onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget) && setOver(null)}
      onDrop={(e) => {
        e.preventDefault();
        const index = over ?? day.items.length;
        setOver(null);
        onDrop(day, index);
      }}
    >
      <div className="flex items-start gap-3 border-b border-line bg-paper/60 px-4 py-3">
        <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-plum-700 text-center text-white">
          <div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-white/70">Day</div>
            <div className="-mt-0.5 font-display text-xl font-extrabold leading-none">{day.day_number}</div>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-semibold text-muted">{fmtDay(day.date)}{total > 0 && ` · ${inr(total)} planned`}</div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onFocus={() => setEditing(tripId, `day:${day.id}`)}
            onBlur={() => {
              setEditing(tripId, null);
              if (title !== day.title) saveDay({ title });
            }}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            placeholder="Name this day…"
            maxLength={80}
            className="w-full bg-transparent font-display text-lg font-bold outline-none placeholder:text-muted/50"
          />
        </div>
        {editors.length > 0 && (
          <div className="flex items-center gap-1 rounded-full bg-emerald-50 py-0.5 pl-0.5 pr-2 text-[11px] font-semibold text-emerald-700">
            <Avatar user={{ ...editors[0], id: editors[0].user_id }} size={18} /> editing
          </div>
        )}
        <Menu items={[{ label: 'Sort by time', icon: Clock, onClick: sortByTime }, { label: 'Add a stop', icon: Plus, onClick: () => setAdding(true) }]} />
      </div>
      <div ref={listRef} className="space-y-1 p-2">
        {day.items.length === 0 && !drag && (
          <button onClick={() => setAdding(true)} className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line py-6 text-sm font-semibold text-muted transition hover:border-plum-300 hover:text-plum-700">
            <Plus className="size-4" /> Plan something — or drag from the Stash
          </button>
        )}
        {day.items.map((item, i) => (
          <ItemRow
            key={item.id}
            item={item}
            day={day}
            ctx={ctx}
            onEdit={() => setEditItem(item)}
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', item.id);
              setDrag({ kind: 'item', id: item.id });
            }}
            onDragOverRow={dragOverRow(i)}
            dropBefore={drag && over === i}
          />
        ))}
        {drag && (
          <div className={clsx('rounded-2xl border-2 border-dashed py-3 text-center text-xs font-semibold transition', over === day.items.length ? 'border-plum-400 bg-plum-50 text-plum-700' : 'border-line text-muted')}>
            Drop here
          </div>
        )}
        {day.items.length > 0 && !drag && (
          <button onClick={() => setAdding(true)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-semibold text-muted hover:bg-paper hover:text-plum-700">
            <Plus className="size-4" /> Add a stop
          </button>
        )}
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes !== day.notes && saveDay({ notes })}
          rows={1}
          placeholder="Day notes (train times, reminders…)"
          className="mt-1 border-transparent bg-paper/70 text-[13px] focus:bg-white"
        />
      </div>
      <ItemModal open={adding} onClose={() => setAdding(false)} ctx={ctx} day={day} />
      <ItemModal open={!!editItem} onClose={() => setEditItem(null)} ctx={ctx} day={day} item={editItem} />
    </section>
  );
}

export default function PlanTab({ ctx }) {
  const { data, setData, tripId, reload, setTab } = ctx;
  const [drag, setDrag] = useState(null);

  useEffect(() => {
    const end = () => setTimeout(() => setDrag(null), 50);
    window.addEventListener('dragend', end);
    window.addEventListener('drop', end);
    return () => {
      window.removeEventListener('dragend', end);
      window.removeEventListener('drop', end);
    };
  }, []);

  async function onDrop(day, index) {
    if (!drag) return;
    const d = drag;
    setDrag(null);
    if (d.kind === 'item') {
      const others = day.items.filter((x) => x.id !== d.id);
      const srcIndex = day.items.findIndex((x) => x.id === d.id);
      const idx = srcIndex >= 0 && srcIndex < index ? index - 1 : index;
      const position = positionAt(others, idx);
      // optimistic move
      setData((prev) => {
        const moving = prev.days.flatMap((x) => x.items).find((x) => x.id === d.id);
        if (!moving) return prev;
        const updated = { ...moving, day_id: day.id, position };
        return { ...prev, days: prev.days.map((x) => ({ ...x, items: (x.id === day.id ? [...x.items.filter((i) => i.id !== d.id), updated] : x.items.filter((i) => i.id !== d.id)).sort((a, b) => a.position - b.position) })) };
      });
      try {
        await api.patch(`/trips/${tripId}/items/${d.id}`, { day_id: day.id, position });
      } catch (err) {
        toast.error(err.message);
        reload();
      }
    } else if (d.kind === 'stash') {
      setData((prev) => ({ ...prev, stash: prev.stash.filter((s) => s.id !== d.id) }));
      try {
        await api.post(`/trips/${tripId}/stash/${d.id}/assign`, { day_id: day.id, position: positionAt(day.items, index) });
        toast.success(`Added to Day ${day.day_number}`);
      } catch (err) {
        toast.error(err.message);
        reload();
      }
    }
  }

  const empty = data.days.every((d) => d.items.length === 0);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        {empty && (
          <div className="flex flex-col items-start gap-3 rounded-3xl bg-gradient-to-br from-plum-700 to-plum-900 p-5 text-white sm:flex-row sm:items-center">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/15"><Bot className="size-6 text-marigold-300" /></div>
            <div className="flex-1">
              <div className="font-bold">Blank page? Let Yatri draft it.</div>
              <div className="text-sm text-white/75">Set everyone’s Vibe Check first — Yatri uses it to pick chill or adventurous stops.</div>
            </div>
            <Button variant="accent" onClick={() => setTab('concierge')}>Ask Yatri to plan</Button>
          </div>
        )}
        {data.days.map((day) => <DayCard key={day.id} day={day} ctx={ctx} drag={drag} setDrag={setDrag} onDrop={onDrop} />)}
      </div>
      <div className="space-y-4">
        <VibeCheck ctx={ctx} />
        <StashPanel ctx={ctx} setDrag={setDrag} />
        <PollsPanel ctx={ctx} />
      </div>
    </div>
  );
}
