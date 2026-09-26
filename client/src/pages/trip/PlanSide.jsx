import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { toast } from 'sonner';
import { Check, GripVertical, Image as ImageIcon, Link2, Lock, MapPin, Plus, StickyNote, Trash2, Vote, X } from 'lucide-react';
import { Avatar, Button, Card, Field, Input, Menu, Modal, Textarea, Toggle, useConfirm } from '../../components/ui';
import { api, assetUrl } from '../../lib/api';
import { vibeLabel, timeAgo } from '../../lib/format';
import { positionAt } from './PlanTab';

// ---------------------------------------------------------------- Vibe Check
export function VibeCheck({ ctx }) {
  const { data, tripId, user } = ctx;
  const [value, setValue] = useState(data.me?.vibe ?? 50);
  const timer = useRef(null);
  useEffect(() => setValue(data.me?.vibe ?? 50), [data.me?.vibe]);

  const onChange = (v) => {
    setValue(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => api.post(`/trips/${tripId}/vibe-check`, { value: v }).catch((e) => toast.error(e.message)), 350);
  };

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <div className="font-bold">Vibe Check</div>
          <div className="text-xs text-muted">Yatri uses the group average to pick plans</div>
        </div>
        <div className="text-right">
          <div className="font-display text-2xl font-extrabold text-plum-700">{data.trip.vibe_score}</div>
          <div className="text-[11px] font-semibold text-muted">{vibeLabel(data.trip.vibe_score)}</div>
        </div>
      </div>
      <div className="relative mt-5 pb-6">
        <div className="h-2.5 rounded-full bg-gradient-to-r from-sky-200 via-plum-200 to-marigold-300" />
        {data.members.filter((m) => m.user_id !== user.id).map((m) => (
          <span key={m.user_id} className="absolute -top-2 -translate-x-1/2 transition-all" style={{ left: `${m.vibe}%` }} title={`${m.name}: ${m.vibe}`}>
            <Avatar user={{ ...m, id: m.user_id }} size={18} ring />
          </span>
        ))}
        <span className="absolute top-[-5px] h-5 w-0.5 -translate-x-1/2 rounded bg-plum-900/60" style={{ left: `${data.trip.vibe_score}%` }} title="Group average" />
        <input type="range" min={0} max={100} value={value} onChange={(e) => onChange(Number(e.target.value))} className="absolute inset-x-0 top-[-6px] h-6 w-full cursor-pointer appearance-none bg-transparent accent-plum-700 [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-plum-700 [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-plum-700" aria-label="Your vibe" />
        <div className="absolute inset-x-0 top-5 flex justify-between text-[11px] font-semibold text-muted">
          <span>🧘 Chill</span>
          <span>You: {value}</span>
          <span>Adventure 🪂</span>
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- Stash
const STASH_ICON = { place: MapPin, link: Link2, note: StickyNote, photo: ImageIcon };

export function StashPanel({ ctx, setDrag }) {
  const { data, tripId } = ctx;
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ type: 'place', title: '', url: '', note: '', image_url: '' });
  const [busy, setBusy] = useState(false);

  async function add(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`/trips/${tripId}/stash`, { ...form, url: form.url || undefined, image_url: form.image_url || undefined });
      setForm({ type: form.type, title: '', url: '', note: '', image_url: '' });
      setAdding(false);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function assign(item, dayId) {
    const day = data.days.find((d) => d.id === dayId);
    try {
      await api.post(`/trips/${tripId}/stash/${item.id}/assign`, { day_id: dayId, position: positionAt(day.items, day.items.length) });
      toast.success(`Added to Day ${day.day_number}`);
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <div className="font-bold">Stash <span className="text-sm font-semibold text-muted">· {data.stash.length}</span></div>
          <div className="text-xs text-muted">Saved places, links & photos — drag onto a day</div>
        </div>
        <Button size="icon-sm" variant="soft" icon={Plus} onClick={() => setAdding(true)} aria-label="Add to stash" />
      </div>
      <div className="mt-3 space-y-2">
        {data.stash.length === 0 && <p className="rounded-xl bg-paper px-3 py-4 text-center text-[13px] text-muted">Found something cool on Instagram? Stash it here.</p>}
        {data.stash.map((s) => {
          const Icon = STASH_ICON[s.type] || MapPin;
          const adder = data.members.find((m) => m.user_id === s.added_by);
          return (
            <div
              key={s.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', s.id);
                setDrag({ kind: 'stash', id: s.id });
              }}
              className="group flex cursor-grab items-start gap-2.5 rounded-xl border border-line bg-white p-2.5 transition hover:border-plum-300 active:cursor-grabbing"
            >
              {s.image_url ? <img src={assetUrl(s.image_url)} alt="" className="size-10 shrink-0 rounded-lg object-cover" /> : <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-plum-50 text-plum-600"><Icon className="size-4" /></span>}
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-semibold">{s.title}</div>
                {s.note && <div className="line-clamp-2 text-[12px] text-muted">{s.note}</div>}
                <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted">
                  {adder && <><Avatar user={{ ...adder, id: adder.user_id }} size={14} />{adder.name.split(' ')[0]} · </>}{timeAgo(s.created_at)}
                  {s.url && <a href={s.url} target="_blank" rel="noreferrer" className="font-semibold text-plum-700 hover:underline">open</a>}
                </div>
              </div>
              <div className="flex flex-col items-center gap-1">
                <GripVertical className="size-4 text-muted/40" />
                <Menu
                  items={[
                    ...data.days.map((d) => ({ label: `Add to Day ${d.day_number}`, icon: Plus, onClick: () => assign(s, d.id) })),
                    { label: 'Delete', icon: Trash2, danger: true, onClick: () => api.del(`/trips/${tripId}/stash/${s.id}`).catch((e) => toast.error(e.message)) },
                  ]}
                />
              </div>
            </div>
          );
        })}
      </div>
      <Modal open={adding} onClose={() => setAdding(false)} title="Add to Stash" size="sm">
        <form onSubmit={add} className="space-y-4">
          <div className="grid grid-cols-4 gap-1.5">
            {Object.entries(STASH_ICON).map(([k, Icon]) => (
              <button key={k} type="button" onClick={() => setForm((f) => ({ ...f, type: k }))} className={clsx('flex flex-col items-center gap-1 rounded-xl border py-2.5 text-xs font-semibold capitalize', form.type === k ? 'border-plum-600 bg-plum-50 text-plum-800' : 'border-line text-muted')}>
                <Icon className="size-4" />{k}
              </button>
            ))}
          </div>
          <Field label={form.type === 'place' ? 'Place name' : 'Title'}><Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required maxLength={140} placeholder={form.type === 'place' ? 'e.g. Tiffin Top' : 'e.g. Best cafés blog'} /></Field>
          {(form.type === 'link' || form.type === 'place') && <Field label="Link (optional)"><Input value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} placeholder="https://instagram.com/…" /></Field>}
          {form.type === 'photo' && <Field label="Image URL"><Input value={form.image_url} onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))} placeholder="https://…" required /></Field>}
          <Field label="Note"><Textarea value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} rows={2} maxLength={1000} placeholder="Why should we go?" /></Field>
          <Button type="submit" className="w-full" loading={busy}>Save to Stash</Button>
        </form>
      </Modal>
    </Card>
  );
}

// ---------------------------------------------------------------- Polls
function PollCard({ poll, ctx }) {
  const { data, tripId, user, isOwner } = ctx;
  const confirm = useConfirm();
  const total = poll.options.reduce((s, o) => s + o.votes.length, 0);
  const max = Math.max(1, ...poll.options.map((o) => o.votes.length));
  const creator = data.members.find((m) => m.user_id === poll.created_by);
  const canManage = poll.created_by === user.id || isOwner;

  const vote = (optionId) => api.post(`/trips/${tripId}/polls/${poll.id}/vote`, { option_id: optionId }).catch((e) => toast.error(e.message));

  return (
    <div className={clsx('rounded-2xl border p-3.5', poll.closed ? 'border-line bg-paper/60' : 'border-plum-100 bg-white')}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[14.5px] font-bold leading-snug">{poll.question}</div>
          <div className="mt-0.5 text-[11.5px] text-muted">{creator?.name.split(' ')[0] || 'Someone'} · {total} vote{total === 1 ? '' : 's'}{poll.closed && ' · closed'}{poll.multi && ' · pick many'}</div>
        </div>
        {canManage && (
          <Menu
            items={[
              { label: poll.closed ? 'Reopen voting' : 'Close voting', icon: Lock, onClick: () => api.post(`/trips/${tripId}/polls/${poll.id}/close`).catch((e) => toast.error(e.message)) },
              { label: 'Delete', icon: Trash2, danger: true, onClick: async () => (await confirm({ title: 'Delete this vote?', tone: 'danger', confirmLabel: 'Delete' })) && api.del(`/trips/${tripId}/polls/${poll.id}`) },
            ]}
          />
        )}
      </div>
      <div className="mt-3 space-y-1.5">
        {poll.options.map((o) => {
          const mine = o.votes.includes(user.id);
          const pct = total ? Math.round((o.votes.length / total) * 100) : 0;
          const leading = poll.closed && o.votes.length === max && total > 0;
          return (
            <button key={o.id} disabled={poll.closed} onClick={() => vote(o.id)} className={clsx('relative w-full overflow-hidden rounded-xl border px-3 py-2 text-left transition', mine ? 'border-plum-400' : 'border-line hover:border-plum-200', poll.closed && 'cursor-default')}>
              <span className={clsx('absolute inset-y-0 left-0 transition-all', leading ? 'bg-emerald-100' : mine ? 'bg-plum-100' : 'bg-sand')} style={{ width: `${pct}%` }} />
              <span className="relative flex items-center justify-between gap-2">
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-[13.5px] font-semibold">{mine && <Check className="size-3.5 text-plum-700" />}{o.label}{leading && ' 🏆'}</span>
                  {o.detail && <span className="block truncate text-[11.5px] text-muted">{o.detail}</span>}
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <span className="flex -space-x-1.5">{o.votes.slice(0, 3).map((uid) => { const m = data.members.find((x) => x.user_id === uid); return m ? <Avatar key={uid} user={{ ...m, id: uid }} size={18} ring /> : null; })}</span>
                  <span className="text-[12px] font-bold text-ink/70">{pct}%</span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function PollsPanel({ ctx }) {
  const { data, tripId } = ctx;
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState([{ label: '', detail: '' }, { label: '', detail: '' }]);
  const [multi, setMulti] = useState(false);
  const [busy, setBusy] = useState(false);

  async function create(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`/trips/${tripId}/polls`, { question, options: options.filter((o) => o.label.trim()), multi });
      setOpen(false);
      setQuestion('');
      setOptions([{ label: '', detail: '' }, { label: '', detail: '' }]);
      setMulti(false);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  const templates = [
    { q: 'Where do we stay?', o: ['Homestay', 'Boutique hotel'] },
    { q: 'Which day for the big trek?', o: data.days.slice(0, 3).map((d) => `Day ${d.day_number}`) },
    { q: 'Dinner tonight?', o: ['Local thali', 'Café hopping', 'Order in'] },
  ];

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <div className="font-bold">Votes</div>
          <div className="text-xs text-muted">Decide together, not by whoever types fastest</div>
        </div>
        <Button size="icon-sm" variant="soft" icon={Vote} onClick={() => setOpen(true)} aria-label="New vote" />
      </div>
      <div className="mt-3 space-y-3">
        {data.polls.length === 0 && (
          <button onClick={() => setOpen(true)} className="w-full rounded-xl bg-paper px-3 py-4 text-center text-[13px] text-muted hover:text-plum-700">“Hotel A or B?” — start a vote</button>
        )}
        {data.polls.map((p) => <PollCard key={p.id} poll={p} ctx={ctx} />)}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Start a vote" size="sm">
        <form onSubmit={create} className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {templates.map((t) => (
              <button key={t.q} type="button" className="chip text-xs" onClick={() => { setQuestion(t.q); setOptions(t.o.map((l) => ({ label: l, detail: '' }))); }}>{t.q}</button>
            ))}
          </div>
          <Field label="Question"><Input value={question} onChange={(e) => setQuestion(e.target.value)} required maxLength={200} placeholder="Where do we stay?" /></Field>
          <div className="space-y-2">
            <div className="label">Options</div>
            {options.map((o, i) => (
              <div key={i} className="flex gap-2">
                <Input value={o.label} onChange={(e) => setOptions((os) => os.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder={`Option ${i + 1}`} maxLength={120} />
                <Input value={o.detail} onChange={(e) => setOptions((os) => os.map((x, j) => (j === i ? { ...x, detail: e.target.value } : x)))} placeholder="Detail (price, link…)" className="hidden sm:block" maxLength={200} />
                {options.length > 2 && <Button size="icon" variant="ghost" icon={X} onClick={() => setOptions((os) => os.filter((_, j) => j !== i))} aria-label="Remove option" />}
              </div>
            ))}
            {options.length < 8 && <Button variant="ghost" size="sm" icon={Plus} onClick={() => setOptions((os) => [...os, { label: '', detail: '' }])}>Add option</Button>}
          </div>
          <Toggle checked={multi} onChange={setMulti} label="Allow multiple choices" />
          <Button type="submit" className="w-full" loading={busy} disabled={options.filter((o) => o.label.trim()).length < 2}>Start vote</Button>
        </form>
      </Modal>
    </Card>
  );
}

