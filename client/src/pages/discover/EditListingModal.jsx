import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Eye, EyeOff } from 'lucide-react';
import { Button, Field, Input, Modal, Textarea, cx } from '../../components/ui';
import { api } from '../../lib/api';
import { useConfig } from '../../lib/config';
import { inr } from '../../lib/format';
import { FALLBACK_TAGS, TAG_EMOJI, useStableCallback } from './constants';

const PRICE_PRESETS = [0, 99, 199, 299, 499, 999];
const MAX_TAGS = 6;

/** Creator-only listing editor: PATCH /itineraries/:id {title, summary, price, tags, status}. */
export default function EditListingModal({ open, onClose: onCloseProp, itinerary, onSaved, feePct }) {
  const onClose = useStableCallback(onCloseProp);
  const config = useConfig();
  const allTags = config.itinerary_tags?.length ? config.itinerary_tags : FALLBACK_TAGS;
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && itinerary) {
      setForm({
        title: itinerary.title || '',
        summary: itinerary.summary || '',
        price: String(itinerary.price ?? 0),
        tags: itinerary.tags || [],
        status: itinerary.status === 'unpublished' ? 'unpublished' : 'published',
      });
    }
    // Reset only when (re)opened or pointed at a different listing — not on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, itinerary?.id]);

  if (!open || !form) return null;
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const price = Number(form.price);
  const priceError = form.price === '' || !Number.isInteger(price) || price < 0 || price > 2999 ? 'Enter a whole rupee amount between ₹0 and ₹2,999' : '';
  const titleError = !form.title.trim() ? 'Give your itinerary a title' : '';

  const toggleTag = (t) =>
    setForm((f) => {
      if (f.tags.includes(t)) return { ...f, tags: f.tags.filter((x) => x !== t) };
      if (f.tags.length >= MAX_TAGS) {
        toast.message(`Pick up to ${MAX_TAGS} vibes`);
        return f;
      }
      return { ...f, tags: [...f.tags, t] };
    });

  async function save(e) {
    e?.preventDefault();
    if (titleError || priceError) return;
    setSaving(true);
    try {
      const { itinerary: updated } = await api.patch(`/itineraries/${itinerary.id}`, {
        title: form.title.trim(),
        summary: form.summary.trim(),
        price,
        tags: form.tags,
        status: form.status,
      });
      toast.success(form.status === 'published' ? 'Listing updated' : 'Listing saved and hidden from the feed');
      onSaved?.(updated);
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  const earn = feePct != null && price > 0 ? Math.round(price - (price * feePct) / 100) : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit listing"
      description="Changes show up in the community feed straight away."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={saving} disabled={!!titleError || !!priceError}>Save changes</Button>
        </>
      }
    >
      <form onSubmit={save} className="space-y-5">
        <Field label="Title" error={form.title && titleError}>
          <Input value={form.title} maxLength={100} onChange={(e) => set('title')(e.target.value)} placeholder="Kumaon Lakes in 4 Days" />
        </Field>
        <Field label="Summary" hint={`${form.summary.length}/1000 — what makes this plan worth forking?`}>
          <Textarea rows={3} maxLength={1000} value={form.summary} onChange={(e) => set('summary')(e.target.value)} placeholder="The loop I recommend to every first-timer…" />
        </Field>

        <div>
          <div className="label">Price</div>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {PRICE_PRESETS.map((p) => (
              <button key={p} type="button" onClick={() => set('price')(String(p))} className={cx('chip', price === p && form.price !== '' && 'chip-active')}>
                {p === 0 ? 'Free' : inr(p)}
              </button>
            ))}
          </div>
          <Field error={priceError} hint={price > 0 ? (earn != null ? `Buyers pay ${inr(price)} once — you earn about ${inr(earn)} per unlock after the ${feePct}% platform fee.` : 'Buyers pay once to unlock every day and fork it.') : 'Free itineraries get forked more — you can still earn tips.'}>
            <Input type="number" inputMode="numeric" min={0} max={2999} step={1} value={form.price} onChange={(e) => set('price')(e.target.value)} icon={RupeeGlyph} />
          </Field>
        </div>

        <div>
          <div className="label flex items-center justify-between">
            <span>Vibe tags</span>
            <span className="font-medium text-muted">{form.tags.length}/{MAX_TAGS}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {allTags.map((t) => (
              <button key={t} type="button" onClick={() => toggleTag(t)} className={cx('chip', form.tags.includes(t) && 'chip-active')}>
                <span aria-hidden="true">{TAG_EMOJI[t]}</span> {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="label">Visibility</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { v: 'published', icon: Eye, t: 'Published', d: 'Listed in Explore and on your profile' },
              { v: 'unpublished', icon: EyeOff, t: 'Unpublished', d: 'Hidden from Explore — trips already forked keep their copy' },
            ].map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => set('status')(o.v)}
                className={cx('flex items-start gap-3 rounded-2xl border p-3.5 text-left transition', form.status === o.v ? 'border-plum-600 bg-plum-50 ring-2 ring-plum-100' : 'border-line hover:border-plum-300')}
              >
                <o.icon className={cx('mt-0.5 size-4 shrink-0', form.status === o.v ? 'text-plum-700' : 'text-muted')} />
                <span>
                  <span className="block text-sm font-semibold text-ink">{o.t}</span>
                  <span className="block text-[12.5px] text-muted">{o.d}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

function RupeeGlyph({ className }) {
  return (
    <span className={cx(className, 'grid place-items-center text-[15px] font-semibold leading-none')} aria-hidden="true">
      ₹
    </span>
  );
}
