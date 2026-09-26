import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Bell, Bot, Eye, EyeOff, KeyRound, Megaphone, Pencil, Plus, Save, Send, Settings as SettingsIcon, ShieldUser, Trash2, UserCog } from 'lucide-react';
import { Avatar, Badge, Button, ErrorState, Field, Input, Modal, PageHeader, Segmented, Select, Skeleton, Tabs, Textarea, Toggle, useConfirm, cx } from '../../components/ui';
import { adminApi } from '../../lib/api';
import { useAdminAuth } from '../../lib/auth';
import { useFetch } from '../../lib/hooks';
import { fmtDateTime, timeAgo } from '../../lib/format';
import { CreateAdminModal } from './Users';
import { Panel, useAdmin, useQueryParams } from './kit';

const DEFAULTS = { tab: 'platform' };
const MODELS = [
  { value: 'claude-opus-5', label: 'Claude Opus 5 — most capable (default)' },
  { value: 'claude-sonnet-5', label: 'Claude Sonnet 5 — balanced speed & cost' },
  { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 — fastest, lowest cost' },
];
const NUMBER_FIELDS = [
  'booking_fee_pct',
  'marketplace_fee_pct',
  'tip_fee_pct',
  'free_concierge_daily',
  'plus_price_monthly',
  'auto_promote_forks',
  'auto_promote_price',
  'default_spend_limit_booking',
  'default_spend_limit_trip',
  'proposal_ttl_minutes',
  'min_payout',
];

function NumField({ label, hint, value, onChange, suffix, prefix, min = 0, max, step = 1 }) {
  return (
    <Field label={label} hint={hint}>
      <div className="relative">
        {prefix && <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] font-semibold text-muted">{prefix}</span>}
        <input type="number" inputMode="decimal" min={min} max={max} step={step} value={value} onChange={(e) => onChange(e.target.value)} className={cx('input tabular-nums', prefix && 'pl-8', suffix && 'pr-16')} />
        {suffix && <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[13px] font-medium text-muted">{suffix}</span>}
      </div>
    </Field>
  );
}

// ---------------------------------------------------------------- Platform settings
function PlatformSettings() {
  const { data, loading, error, reload, setData } = useFetch('/admin/settings', { scope: 'admin' });
  const { refresh } = useAdmin();
  const [form, setForm] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const confirm = useConfirm();

  useEffect(() => {
    if (data?.settings) {
      const s = { ...data.settings };
      for (const k of NUMBER_FIELDS) s[k] = String(s[k] ?? '');
      setForm(s);
    }
  }, [data]);

  const original = data?.settings;
  const changed = useMemo(() => {
    if (!form || !original) return {};
    const out = {};
    for (const [k, v] of Object.entries(form)) {
      if (k === 'anthropic_api_key') continue;
      const o = original[k];
      const nv = NUMBER_FIELDS.includes(k) ? Number(v) : v;
      if (nv !== o) out[k] = nv;
    }
    if (apiKey.trim()) out.anthropic_api_key = apiKey.trim();
    return out;
  }, [form, original, apiKey]);
  const dirty = Object.keys(changed).length > 0;

  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !form)
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-72 rounded-2xl" />
        ))}
      </div>
    );

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const ai = data.ai;

  const save = async () => {
    for (const k of NUMBER_FIELDS) {
      if (k in changed && (!Number.isFinite(changed[k]) || changed[k] < 0 || form[k] === '')) return toast.error(`${k.replace(/_/g, ' ')} must be a number ≥ 0`);
    }
    if (changed.ai_enabled === false && !(await confirm({ title: 'Turn off the AI concierge?', description: 'Travellers won’t be able to ask Yatri to plan or book anything until you turn it back on.', confirmLabel: 'Turn off', tone: 'danger' }))) return;
    setSaving(true);
    try {
      const res = await adminApi.patch('/admin/settings', changed);
      setData(res);
      setApiKey('');
      toast.success('Settings saved');
      refresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const removeKey = async () => {
    if (!(await confirm({ title: 'Remove the stored API key?', description: 'The concierge falls back to the built-in engine unless an ANTHROPIC_API_KEY environment variable is set on the server.', confirmLabel: 'Remove key', tone: 'danger' }))) return;
    try {
      const res = await adminApi.patch('/admin/settings', { anthropic_api_key: '' });
      setData(res);
      setApiKey('');
      toast.success('API key removed');
      refresh();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const modelOptions = MODELS.some((m) => m.value === form.ai_model) ? MODELS : [...MODELS, { value: form.ai_model, label: form.ai_model }];

  return (
    <div className="pb-24">
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel
          title="AI concierge (Yatri)"
          subtitle="The assistant that plans itineraries and proposes bookings"
          className="xl:row-span-2"
          action={
            !ai?.enabled ? (
              <Badge tone="red" dot>
                Disabled
              </Badge>
            ) : ai.engine === 'claude' ? (
              <Badge tone="green" dot>
                Claude live
              </Badge>
            ) : (
              <Badge tone="marigold" dot>
                Built-in engine
              </Badge>
            )
          }
        >
          <div className="space-y-5">
            <div className={cx('flex items-start gap-3 rounded-xl p-3.5 text-[13px]', ai?.engine === 'claude' ? 'bg-emerald-50 text-emerald-900 ring-1 ring-emerald-100' : 'bg-marigold-50 text-marigold-900 ring-1 ring-marigold-100')}>
              <Bot className="mt-0.5 size-4 shrink-0" />
              <div>
                {ai?.engine === 'claude' ? (
                  <>
                    Running on <b>Anthropic Claude</b> (<span className="font-mono">{ai.model}</span>). Bookings still require the traveller’s explicit UPI confirmation and respect trip spend limits.
                  </>
                ) : ai?.enabled ? (
                  <>No Anthropic API key found, so Yatri uses the <b>built-in engine</b> (deterministic planning, no LLM). Add a key below to switch to Claude.</>
                ) : (
                  <>The concierge is <b>switched off</b> for everyone.</>
                )}
              </div>
            </div>
            <Toggle checked={form.ai_enabled} onChange={set('ai_enabled')} label="Enable AI concierge" description="When off, the concierge chat is unavailable to all travellers." />
            <Field label="Claude model">
              <Select value={form.ai_model} onChange={(e) => set('ai_model')(e.target.value)}>
                {modelOptions.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Reasoning effort" hint="Higher effort plans more carefully but responds more slowly and costs more.">
              <Segmented
                value={form.ai_effort}
                onChange={set('ai_effort')}
                options={[
                  { value: 'low', label: 'Low' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'high', label: 'High' },
                ]}
              />
            </Field>
            <Field
              label="Anthropic API key"
              hint={original.anthropic_api_key ? `A key ending in ${original.anthropic_api_key.replace(/•/g, '')} is stored. Type a new key to replace it. The ANTHROPIC_API_KEY env var, if set, takes precedence.` : 'Optional. The ANTHROPIC_API_KEY environment variable takes precedence over this.'}
            >
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={original.anthropic_api_key || 'sk-ant-…'}
                    autoComplete="off"
                    spellCheck={false}
                    className="input pl-10 pr-11 font-mono text-[13px]"
                  />
                  <button type="button" onClick={() => setShowKey((s) => !s)} className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted hover:bg-sand" aria-label={showKey ? 'Hide key' : 'Show key'}>
                    {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {original.anthropic_api_key && (
                  <Button variant="danger-soft" size="md" onClick={removeKey}>
                    Remove
                  </Button>
                )}
              </div>
            </Field>
            <NumField label="Free concierge requests per day" hint="Plus members are unlimited." value={form.free_concierge_daily} onChange={set('free_concierge_daily')} suffix="/ day" />
          </div>
        </Panel>

        <Panel title="Fees & pricing" subtitle="How Itenary earns">
          <div className="grid gap-4 sm:grid-cols-2">
            <NumField label="Booking convenience fee" hint="Added on top of every AI booking." value={form.booking_fee_pct} onChange={set('booking_fee_pct')} suffix="%" step={0.5} max={50} />
            <NumField label="Marketplace fee" hint="Platform share of premium itinerary sales." value={form.marketplace_fee_pct} onChange={set('marketplace_fee_pct')} suffix="%" max={100} />
            <NumField label="Tip fee" hint="Platform share of creator tips." value={form.tip_fee_pct} onChange={set('tip_fee_pct')} suffix="%" max={100} />
            <NumField label="Plus price" hint="Monthly subscription." value={form.plus_price_monthly} onChange={set('plus_price_monthly')} prefix="₹" suffix="/ month" />
          </div>
        </Panel>

        <Panel title="Creators & marketplace">
          <div className="grid gap-4 sm:grid-cols-3">
            <NumField label="Auto-promote at" hint="Forks before a free itinerary becomes Verified Premium." value={form.auto_promote_forks} onChange={set('auto_promote_forks')} suffix="forks" />
            <NumField label="Auto-promote price" hint="Price set on promotion." value={form.auto_promote_price} onChange={set('auto_promote_price')} prefix="₹" />
            <NumField label="Minimum payout" hint="Smallest withdrawal creators can request." value={form.min_payout} onChange={set('min_payout')} prefix="₹" />
          </div>
        </Panel>

        <Panel title="Booking safety" subtitle="Defaults for new trips — owners can change them per trip">
          <div className="grid gap-4 sm:grid-cols-3">
            <NumField label="Per-booking limit" value={form.default_spend_limit_booking} onChange={set('default_spend_limit_booking')} prefix="₹" step={500} />
            <NumField label="Per-trip limit" value={form.default_spend_limit_trip} onChange={set('default_spend_limit_trip')} prefix="₹" step={1000} />
            <NumField label="Quote validity" hint="Proposals expire after this." value={form.proposal_ttl_minutes} onChange={set('proposal_ttl_minutes')} suffix="min" min={1} />
          </div>
        </Panel>

        <Panel title="Platform">
          <div className="space-y-5">
            <Toggle checked={form.signup_open} onChange={set('signup_open')} label="Open sign-ups" description="When off, only existing travellers can sign in." />
            <Field label="Support WhatsApp number" hint="Shown to travellers who need help.">
              <Input value={form.support_whatsapp} onChange={(e) => set('support_whatsapp')(e.target.value)} maxLength={30} />
            </Field>
          </div>
        </Panel>
      </div>

      {/* Sticky save bar */}
      <div className={cx('fixed inset-x-0 bottom-0 z-30 transition lg:left-64', dirty ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0')}>
        <div className="mx-auto max-w-[1440px] px-4 pb-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-ink px-4 py-3 text-white shadow-lift">
            <span className="text-[13.5px] font-semibold">
              {Object.keys(changed).length} unsaved change{Object.keys(changed).length === 1 ? '' : 's'}
            </span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-white/80 hover:bg-white/10 hover:text-white"
                onClick={() => {
                  const s = { ...data.settings };
                  for (const k of NUMBER_FIELDS) s[k] = String(s[k] ?? '');
                  setForm(s);
                  setApiKey('');
                }}
              >
                Discard
              </Button>
              <Button variant="accent" size="sm" icon={Save} loading={saving} onClick={save}>
                Save changes
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Announcements
const LEVELS = {
  info: { label: 'Info', cls: 'bg-plum-50 text-plum-900 ring-1 ring-plum-100', tone: 'plum' },
  success: { label: 'Success', cls: 'bg-emerald-50 text-emerald-900 ring-1 ring-emerald-100', tone: 'green' },
  warning: { label: 'Warning', cls: 'bg-marigold-50 text-marigold-900 ring-1 ring-marigold-100', tone: 'marigold' },
};

function BannerPreview({ title, body, level }) {
  return (
    <div className={cx('flex items-start gap-3 rounded-2xl px-4 py-3 text-[13.5px]', LEVELS[level]?.cls || LEVELS.info.cls)}>
      <Megaphone className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">
        <span className="font-bold">{title || 'Announcement title'}</span> {body && <span className="opacity-85">— {body}</span>}
      </div>
    </div>
  );
}

function AnnouncementModal({ open, onClose, item, onSaved }) {
  const editing = !!item?.id;
  const [form, setForm] = useState({ title: '', body: '', level: 'info' });
  const [busy, setBusy] = useState(false);
  const [lastKey, setLastKey] = useState(null);
  const key = open ? item?.id || 'new' : null;
  if (key !== lastKey) {
    setLastKey(key);
    if (open) setForm(editing ? { title: item.title, body: item.body || '', level: item.level } : { title: '', body: '', level: 'info' });
  }
  const submit = async (e) => {
    e?.preventDefault();
    if (!form.title.trim()) return toast.error('Title is required');
    setBusy(true);
    try {
      if (editing) await adminApi.patch(`/admin/announcements/${item.id}`, { title: form.title.trim(), body: form.body.trim() });
      else await adminApi.post('/admin/announcements', { title: form.title.trim(), body: form.body.trim(), level: form.level });
      toast.success(editing ? 'Announcement updated' : 'Announcement is live in the traveller app');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit announcement' : 'New announcement'}
      description="Shown as a dismissible banner at the top of the traveller app."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy} icon={editing ? Pencil : Megaphone}>
            {editing ? 'Save' : 'Publish'}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Title">
          <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} maxLength={120} placeholder="e.g. Monsoon advisory for the hills" />
        </Field>
        <Field label="Message (optional)">
          <Textarea value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} maxLength={500} rows={3} />
        </Field>
        <Field label="Level" hint={editing ? 'The level is fixed once published — create a new announcement to change it.' : undefined}>
          {editing ? (
            <Badge tone={LEVELS[form.level]?.tone}>{LEVELS[form.level]?.label}</Badge>
          ) : (
            <Segmented value={form.level} onChange={(level) => setForm((f) => ({ ...f, level }))} options={Object.entries(LEVELS).map(([value, l]) => ({ value, label: l.label }))} />
          )}
        </Field>
        <div>
          <div className="label">Preview</div>
          <BannerPreview {...form} />
        </div>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

function Announcements() {
  const { data, loading, error, reload, setData } = useFetch('/admin/announcements', { scope: 'admin' });
  const confirm = useConfirm();
  const [editing, setEditing] = useState(null);

  const toggle = async (a, active) => {
    setData((d) => ({ ...d, announcements: d.announcements.map((x) => (x.id === a.id ? { ...x, active: active ? 1 : 0 } : x)) }));
    try {
      await adminApi.patch(`/admin/announcements/${a.id}`, { active });
      toast.success(active ? 'Announcement is live' : 'Announcement hidden');
    } catch (err) {
      toast.error(err.message);
      reload();
    }
  };
  const remove = async (a) => {
    if (!(await confirm({ title: 'Delete announcement?', description: `“${a.title}” will be removed permanently.`, confirmLabel: 'Delete', tone: 'danger' }))) return;
    try {
      await adminApi.del(`/admin/announcements/${a.id}`);
      setData((d) => ({ ...d, announcements: d.announcements.filter((x) => x.id !== a.id) }));
      toast.success('Announcement deleted');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const list = data?.announcements || [];
  return (
    <Panel
      title="Announcements"
      subtitle="Banners shown at the top of the traveller app. Only the newest active one is shown at a time."
      action={
        <Button size="sm" icon={Plus} onClick={() => setEditing({})}>
          New
        </Button>
      }
    >
      {error && !data ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading && !data ? (
        <Skeleton className="h-32 rounded-xl" />
      ) : list.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">No announcements yet.</p>
      ) : (
        <ul className="space-y-3">
          {list.map((a) => (
            <li key={a.id} className={cx('rounded-2xl border border-line p-3', !a.active && 'opacity-60')}>
              <BannerPreview title={a.title} body={a.body} level={a.level} />
              <div className="mt-3 flex flex-wrap items-center gap-3 px-1">
                <Toggle checked={!!a.active} onChange={(v) => toggle(a, v)} />
                <span className="text-[12.5px] font-semibold text-ink">{a.active ? 'Live' : 'Hidden'}</span>
                <span className="text-[12px] text-muted">Created {timeAgo(a.created_at)}</span>
                <div className="ml-auto flex gap-1">
                  <Button size="xs" variant="ghost" icon={Pencil} onClick={() => setEditing(a)}>
                    Edit
                  </Button>
                  <Button size="xs" variant="ghost" icon={Trash2} onClick={() => remove(a)} className="text-rose-600 hover:bg-rose-50 hover:text-rose-700">
                    Delete
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <AnnouncementModal open={!!editing} item={editing} onClose={() => setEditing(null)} onSaved={reload} />
    </Panel>
  );
}

// ---------------------------------------------------------------- Broadcast
const AUDIENCES = [
  { value: 'all', label: 'All active travellers' },
  { value: 'plus', label: 'Plus members' },
  { value: 'creators', label: 'Creators with published itineraries' },
  { value: 'active_trips', label: 'Travellers on active trips' },
];

function Broadcast() {
  const confirm = useConfirm();
  const [form, setForm] = useState({ title: '', body: '', link: '', audience: 'all' });
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const send = async (e) => {
    e?.preventDefault();
    if (!form.title.trim()) return toast.error('Title is required');
    if (form.link && !form.link.startsWith('/') && !/^https?:\/\//.test(form.link)) return toast.error('Link should be an app path like /app/explore or a full https:// URL');
    const audience = AUDIENCES.find((a) => a.value === form.audience)?.label.toLowerCase();
    if (!(await confirm({ title: 'Send this notification?', description: `It goes to ${audience} immediately, in-app and in real time. This can’t be unsent.`, confirmLabel: 'Send now' }))) return;
    setBusy(true);
    try {
      const { recipients } = await adminApi.post('/admin/broadcast', { title: form.title.trim(), body: form.body.trim(), link: form.link.trim() || undefined, audience: form.audience });
      toast.success(`Sent to ${recipients.toLocaleString('en-IN')} traveller${recipients === 1 ? '' : 's'}`);
      setLast({ ...form, recipients, at: new Date().toISOString() });
      setForm({ title: '', body: '', link: '', audience: form.audience });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel title="Broadcast notification" subtitle="Push an in-app notification to a group of travellers.">
      <form onSubmit={send} className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Field label="Audience">
            <Select value={form.audience} onChange={set('audience')}>
              {AUDIENCES.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Title">
            <Input value={form.title} onChange={set('title')} maxLength={120} placeholder="e.g. Diwali weekend: 20% off stays in Jaipur" />
          </Field>
          <Field label="Message (optional)">
            <Textarea value={form.body} onChange={set('body')} maxLength={500} rows={3} />
          </Field>
          <Field label="Link (optional)" hint="Where tapping the notification goes, e.g. /app/events">
            <Input value={form.link} onChange={set('link')} maxLength={200} placeholder="/app/explore" />
          </Field>
          <Button type="submit" icon={Send} loading={busy}>
            Send broadcast
          </Button>
        </div>
        <div>
          <div className="label">Preview</div>
          <div className="rounded-2xl border border-line bg-white p-3 shadow-soft">
            <div className="flex gap-3">
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-marigold-500" />
              <div className="min-w-0">
                <div className="text-[13.5px] font-semibold leading-snug text-ink">{form.title || 'Notification title'}</div>
                {form.body && <div className="mt-0.5 line-clamp-3 text-[12.5px] text-muted">{form.body}</div>}
                <div className="mt-1 text-[11px] text-muted/80">just now</div>
              </div>
            </div>
          </div>
          {last && (
            <div className="mt-4 rounded-xl bg-emerald-50 px-3 py-2.5 text-[12.5px] text-emerald-900 ring-1 ring-emerald-100">
              <Bell className="mr-1 inline size-3.5" /> Last sent “{last.title}” to <b>{last.recipients}</b> travellers at {fmtDateTime(last.at)}.
            </div>
          )}
        </div>
      </form>
    </Panel>
  );
}

// ---------------------------------------------------------------- Account
function Account() {
  const { user } = useAdminAuth();
  const [pw, setPw] = useState({ password: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (pw.password.length < 8) return toast.error('Use at least 8 characters');
    if (pw.password !== pw.confirm) return toast.error('Passwords don’t match');
    setBusy(true);
    try {
      await adminApi.post('/admin/me/password', { password: pw.password });
      toast.success('Password changed — use it next time you sign in');
      setPw({ password: '', confirm: '' });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };
  const weak = pw.password && (pw.password.length < 10 || !/\d/.test(pw.password) || !/[A-Za-z]/.test(pw.password));
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Panel title="Your account">
        <div className="flex items-center gap-4">
          <Avatar user={user} size={56} />
          <div className="min-w-0">
            <div className="truncate text-lg font-bold text-ink">{user?.name}</div>
            <div className="truncate text-[13.5px] text-muted">{user?.email}</div>
            <Badge tone="dark" icon={ShieldUser} className="mt-1.5">
              Admin
            </Badge>
          </div>
        </div>
        {user?.email === 'admin@itenary.com' && (
          <p className="mt-4 rounded-xl bg-marigold-50 px-3.5 py-2.5 text-[12.5px] text-marigold-900 ring-1 ring-marigold-100">
            You’re using the default demo admin account. Change its password now, and create named accounts for each staff member.
          </p>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line/80 pt-4">
          <Button variant="secondary" size="sm" icon={UserCog} onClick={() => setCreating(true)}>
            Create another admin
          </Button>
          <span className="text-[12.5px] text-muted">Every admin action is recorded in the audit trail.</span>
        </div>
      </Panel>
      <Panel title="Change password">
        <form onSubmit={submit} className="space-y-4">
          <Field label="New password" hint={weak ? 'Tip: 10+ characters with letters and numbers is stronger.' : 'At least 8 characters.'}>
            <Input type="password" autoComplete="new-password" icon={KeyRound} value={pw.password} onChange={(e) => setPw((p) => ({ ...p, password: e.target.value }))} maxLength={200} />
          </Field>
          <Field label="Confirm new password" error={pw.confirm && pw.confirm !== pw.password ? 'Passwords don’t match' : undefined}>
            <Input type="password" autoComplete="new-password" icon={KeyRound} value={pw.confirm} onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} maxLength={200} />
          </Field>
          <Button type="submit" loading={busy} disabled={!pw.password || !pw.confirm}>
            Update password
          </Button>
        </form>
      </Panel>
      <CreateAdminModal open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

export default function Settings() {
  const [f, setF] = useQueryParams(DEFAULTS);
  return (
    <div>
      <PageHeader title="Settings" subtitle="Platform configuration, AI concierge, announcements and your admin account." />
      <Tabs
        className="mb-5"
        value={f.tab}
        onChange={(tab) => setF({ tab })}
        tabs={[
          { id: 'platform', label: 'Platform & AI', icon: SettingsIcon },
          { id: 'announcements', label: 'Announcements', icon: Megaphone },
          { id: 'broadcast', label: 'Broadcast', icon: Send },
          { id: 'account', label: 'Account', icon: KeyRound },
        ]}
      />
      {f.tab === 'announcements' ? <Announcements /> : f.tab === 'broadcast' ? <Broadcast /> : f.tab === 'account' ? <Account /> : <PlatformSettings />}
    </div>
  );
}
