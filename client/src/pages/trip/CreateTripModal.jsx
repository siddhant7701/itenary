import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { toast } from 'sonner';
import clsx from 'clsx';
import { Button, Field, Input, Modal } from '../../components/ui';
import CoverArt from '../../components/CoverArt';
import { api } from '../../lib/api';
import { useConfig } from '../../lib/config';
import { fmtRange, inr, tripLength } from '../../lib/format';

const POPULAR = ['Goa', 'Manali', 'Jaipur', 'Rishikesh', 'Nainital', 'Udaipur', 'Coorg', 'Pondicherry', 'Varanasi', 'Leh'];

export default function CreateTripModal({ open, onClose, onCreated, initial }) {
  const { destinations } = useConfig();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(() => ({
    name: '',
    destination: '',
    start_date: dayjs().add(14, 'day').format('YYYY-MM-DD'),
    end_date: dayjs().add(17, 'day').format('YYYY-MM-DD'),
    budget: '',
  }));

  useEffect(() => {
    if (open && initial) setForm((f) => ({ ...f, ...initial }));
  }, [open, initial]);

  const dest = useMemo(() => destinations.find((d) => d.name.toLowerCase() === form.destination.trim().toLowerCase()), [destinations, form.destination]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const days = form.start_date && form.end_date ? tripLength(form.start_date, form.end_date) : 0;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const { trip } = await api.post('/trips', {
        ...form,
        name: form.name.trim() || `${form.destination.trim()} trip`,
        budget: Number(String(form.budget).replace(/[^\d]/g, '')) || 0,
      });
      toast.success('Trip created! Invite your crew next 🎉');
      onClose();
      onCreated?.(trip);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Plan a new trip" description="You can change everything later — together." size="md">
      <form id="create-trip" onSubmit={submit} className="space-y-4">
        <CoverArt theme={dest?.theme || 'mountains'} seed={form.destination || 'new'} className="h-28">
          <div className="flex h-28 items-end p-3">
            <div className="rounded-xl bg-white/85 px-3 py-1.5 text-sm font-bold backdrop-blur">
              {form.name || (form.destination ? `${form.destination} trip` : 'Your next adventure')}
              {days > 0 && <span className="ml-2 font-medium text-muted">{fmtRange(form.start_date, form.end_date)} · {days} day{days > 1 ? 's' : ''}</span>}
            </div>
          </div>
        </CoverArt>
        <Field label="Where to?">
          <Input list="tc-destinations" value={form.destination} onChange={set('destination')} placeholder="e.g. Nainital, Goa, Spiti…" required maxLength={80} />
          <datalist id="tc-destinations">
            {destinations.map((d) => <option key={d.name} value={d.name}>{d.state}</option>)}
          </datalist>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {POPULAR.map((p) => (
              <button type="button" key={p} onClick={() => setForm((f) => ({ ...f, destination: p }))} className={clsx('chip px-2.5 py-1 text-xs', form.destination === p && 'chip-active')}>{p}</button>
            ))}
          </div>
        </Field>
        <Field label="Trip name" hint="Optional — we’ll name it after the destination">
          <Input value={form.name} onChange={set('name')} placeholder="e.g. Goa with the Gang" maxLength={80} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date"><Input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value, end_date: f.end_date < e.target.value ? e.target.value : f.end_date }))} required /></Field>
          <Field label="End date"><Input type="date" value={form.end_date} min={form.start_date} onChange={set('end_date')} required /></Field>
        </div>
        <Field label="Total group budget (₹)" hint={form.budget ? `${inr(Number(String(form.budget).replace(/\D/g, '')))} in total` : 'Helps Yatri pick options that fit'}>
          <Input inputMode="numeric" value={form.budget} onChange={set('budget')} placeholder="40000" />
        </Field>
      </form>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit" form="create-trip" loading={busy} disabled={!form.destination.trim()}>Create trip</Button>
      </div>
    </Modal>
  );
}
