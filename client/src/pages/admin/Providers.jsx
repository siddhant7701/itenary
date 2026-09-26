import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { Pencil, Plus, PlugZap, Star, TriangleAlert } from 'lucide-react';
import { Badge, Button, EmptyState, ErrorState, Field, Input, Modal, PageHeader, Select, Textarea, Toggle, cx } from '../../components/ui';
import { adminApi } from '../../lib/api';
import { useFetch } from '../../lib/hooks';
import { CATEGORY, inr, num } from '../../lib/format';

const EMPTY = { category: 'cab', name: '', description: '', commission_pct: '8', failure_pct: '5', rating: '4.5', price_factor: '1' };

function ProviderModal({ provider, open, onClose, onSaved }) {
  const editing = !!provider?.id;
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [lastKey, setLastKey] = useState(null);
  const key = open ? provider?.id || `new-${provider?.category || ''}` : null;
  if (key !== lastKey) {
    setLastKey(key);
    if (open) {
      setError('');
      setForm(
        editing
          ? {
              category: provider.category,
              name: provider.name,
              description: provider.description || '',
              commission_pct: String(provider.commission_pct),
              failure_pct: String(Math.round(provider.failure_rate * 1000) / 10),
              rating: String(provider.rating),
              price_factor: String(provider.price_factor),
            }
          : { ...EMPTY, category: provider?.category || 'cab' },
      );
    }
  }
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e?.preventDefault();
    setError('');
    const commission = Number(form.commission_pct);
    const failure = Number(form.failure_pct) / 100;
    const rating = Number(form.rating);
    const factor = Number(form.price_factor);
    if (!form.name.trim()) return setError('Name is required.');
    if (!(commission >= 0 && commission <= 50)) return setError('Commission must be between 0% and 50%.');
    if (!(failure >= 0 && failure <= 1)) return setError('Failure rate must be between 0% and 100%.');
    if (!(rating >= 1 && rating <= 5)) return setError('Rating must be between 1 and 5.');
    if (!(factor >= 0.5 && factor <= 2)) return setError('Price factor must be between 0.5× and 2×.');
    const body = { name: form.name.trim(), description: form.description.trim(), commission_pct: commission, failure_rate: Math.round(failure * 1000) / 1000, rating, price_factor: factor };
    setBusy(true);
    try {
      if (editing) await adminApi.patch(`/admin/providers/${provider.id}`, body);
      else await adminApi.post('/admin/providers', { ...body, category: form.category });
      toast.success(editing ? `${body.name} updated` : `${body.name} connected — it’s live for the concierge`);
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const failurePct = Number(form.failure_pct) || 0;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Edit ${provider.name}` : 'Add provider connector'}
      description={editing ? `${CATEGORY[provider.category]?.label} connector` : 'New connectors start enabled and appear in concierge search results immediately.'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy} icon={editing ? Pencil : Plus}>
            {editing ? 'Save changes' : 'Add provider'}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        {!editing && (
          <Field label="Category" className="sm:col-span-2">
            <Select value={form.category} onChange={set('category')}>
              {Object.entries(CATEGORY).map(([v, c]) => (
                <option key={v} value={v}>
                  {c.emoji} {c.label}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Name" className="sm:col-span-2">
          <Input value={form.name} onChange={set('name')} maxLength={60} placeholder="e.g. Sawari Cabs" />
        </Field>
        <Field label="Description" className="sm:col-span-2">
          <Textarea value={form.description} onChange={set('description')} maxLength={300} rows={2} placeholder="What this provider is best at" />
        </Field>
        <Field label="Commission (%)" hint="Our cut of the booking amount (0–50).">
          <Input type="number" step="0.5" min={0} max={50} value={form.commission_pct} onChange={set('commission_pct')} />
        </Field>
        <Field label="Sandbox failure rate (%)" hint="Share of bookings that fail and go to the human queue.">
          <Input type="number" step="1" min={0} max={100} value={form.failure_pct} onChange={set('failure_pct')} />
        </Field>
        <Field label="Rating (1–5)" hint="Shown to travellers on proposals.">
          <Input type="number" step="0.1" min={1} max={5} value={form.rating} onChange={set('rating')} />
        </Field>
        <Field label="Price factor (0.5–2×)" hint="Multiplier on quoted prices. 0.9 = 10% cheaper.">
          <Input type="number" step="0.05" min={0.5} max={2} value={form.price_factor} onChange={set('price_factor')} />
        </Field>
        {failurePct > 20 && (
          <p className="flex items-start gap-2 rounded-xl bg-marigold-50 px-3 py-2 text-[12.5px] text-marigold-900 ring-1 ring-marigold-100 sm:col-span-2">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" /> A {failurePct}% failure rate will send many paid bookings to the needs-attention queue.
          </p>
        )}
        {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-[13px] font-medium text-rose-700 sm:col-span-2">{error}</p>}
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

function Metric({ label, value, warn }) {
  return (
    <div className="rounded-xl bg-paper px-3 py-2">
      <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted">{label}</div>
      <div className={cx('mt-0.5 text-[15px] font-bold tabular-nums', warn ? 'text-rose-600' : 'text-ink')}>{value}</div>
    </div>
  );
}

function ProviderCard({ p, onEdit, onToggle, busy }) {
  const failurePct = Math.round(p.failure_rate * 1000) / 10;
  return (
    <article className={cx('card flex flex-col p-4 transition', !p.enabled && 'bg-paper/80 opacity-80')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[15.5px] font-bold text-ink">{p.name}</h3>
            {p.enabled ? (
              <Badge tone="green" dot>
                Live
              </Badge>
            ) : (
              <Badge>Disabled</Badge>
            )}
          </div>
          <p className="mt-0.5 line-clamp-2 text-[12.5px] text-muted">{p.description || 'No description'}</p>
        </div>
        <Toggle checked={p.enabled} disabled={busy} onChange={(v) => onToggle(p, v)} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label="Commission" value={`${p.commission_pct}%`} />
        <Metric label="Failure rate" value={`${failurePct}%`} warn={failurePct > 15} />
        <Metric
          label="Rating"
          value={
            <span className="inline-flex items-center gap-1">
              <Star className="size-3.5 fill-marigold-400 text-marigold-400" />
              {p.rating}
            </span>
          }
        />
        <Metric label="Price" value={`${p.price_factor}×`} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line/70 pt-3 text-[12.5px]">
        <span className="text-muted">
          <b className="text-ink">{num(p.bookings)}</b> bookings
        </span>
        <span className="text-muted">
          <b className="text-ink">{inr(p.commission_earned)}</b> commission earned
        </span>
        {p.attention > 0 && (
          <Link to="/admin/bookings?tab=attention" className="inline-flex items-center gap-1 font-semibold text-rose-600 hover:underline">
            <TriangleAlert className="size-3.5" /> {p.attention} need attention
          </Link>
        )}
        <Button size="xs" variant="ghost" icon={Pencil} onClick={() => onEdit(p)} className="ml-auto">
          Edit
        </Button>
      </div>
    </article>
  );
}

export default function Providers() {
  const { data, loading, error, reload, setData } = useFetch('/admin/providers', { scope: 'admin' });
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(null);

  const toggle = async (p, enabled) => {
    setBusy(p.id);
    setData((d) => ({ ...d, providers: d.providers.map((x) => (x.id === p.id ? { ...x, enabled } : x)) }));
    try {
      await adminApi.patch(`/admin/providers/${p.id}`, { enabled });
      toast.success(enabled ? `${p.name} is live for the concierge` : `${p.name} disabled — the concierge won’t propose it`);
    } catch (err) {
      setData((d) => ({ ...d, providers: d.providers.map((x) => (x.id === p.id ? { ...x, enabled: !enabled } : x)) }));
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  };

  const providers = data?.providers || [];
  const live = providers.filter((p) => p.enabled).length;

  return (
    <div>
      <PageHeader
        title="Providers"
        subtitle={data ? `${live} of ${providers.length} booking connectors live. Sandbox connectors mirror real cab, food, stay and experience APIs.` : 'Booking connectors used by the AI concierge'}
        actions={
          <Button icon={Plus} onClick={() => setEditing({})}>
            Add provider
          </Button>
        }
      />
      {error && !data ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading && !data ? (
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-52 rounded-2xl" />
          ))}
        </div>
      ) : providers.length === 0 ? (
        <EmptyState icon={PlugZap} title="No providers connected" description="Add a connector so the concierge can make bookings." action={<Button icon={Plus} onClick={() => setEditing({})}>Add provider</Button>} />
      ) : (
        <div className="space-y-8">
          {Object.entries(CATEGORY).map(([cat, meta]) => {
            const list = providers.filter((p) => p.category === cat);
            const enabled = list.filter((p) => p.enabled).length;
            return (
              <section key={cat}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-9 place-items-center rounded-xl bg-white text-xl shadow-soft ring-1 ring-line">{meta.emoji}</span>
                    <div>
                      <h2 className="text-[16px] font-bold text-ink">{meta.label}</h2>
                      <p className="text-[12.5px] text-muted">
                        {list.length} connector{list.length === 1 ? '' : 's'} · {enabled} live
                      </p>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" icon={Plus} onClick={() => setEditing({ category: cat })}>
                    Add {meta.label.toLowerCase()} provider
                  </Button>
                </div>
                {list.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-line bg-white/60 px-4 py-6 text-center text-sm text-muted">No {meta.label.toLowerCase()} providers yet.</p>
                ) : (
                  <>
                    {enabled === 0 && (
                      <p className="mb-2 flex items-center gap-1.5 text-[12.5px] font-semibold text-rose-600">
                        <TriangleAlert className="size-3.5" /> Every {meta.label.toLowerCase()} provider is disabled — the concierge can’t book {meta.label.toLowerCase()}s.
                      </p>
                    )}
                    <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                      {list.map((p) => (
                        <ProviderCard key={p.id} p={p} busy={busy === p.id} onEdit={setEditing} onToggle={toggle} />
                      ))}
                    </div>
                  </>
                )}
              </section>
            );
          })}
        </div>
      )}
      <ProviderModal open={!!editing} provider={editing} onClose={() => setEditing(null)} onSaved={reload} />
    </div>
  );
}
