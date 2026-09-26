// Shared building blocks for the admin console (status maps, filters, drawer, prompt, context).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useSearchParams } from 'react-router';
import { Check, ChevronLeft, ChevronRight, Copy, Search, X } from 'lucide-react';
import { Avatar, Badge, Button, Field, Input, Modal, Textarea, VerifiedBadge, cx } from '../../components/ui';
import { useDebounced } from '../../lib/hooks';

// ---------------------------------------------------------------- Admin context (queues, stats, prompt)
export const AdminCtx = createContext({ stats: null, queues: {}, refresh: () => {}, error: null });
export const useAdmin = () => useContext(AdminCtx);

// ---------------------------------------------------------------- Status vocabularies
export const BOOKING_STATUS_ADMIN = {
  proposed: { label: 'Proposed', tone: 'marigold' },
  requested: { label: 'Requested', tone: 'blue' },
  confirmed: { label: 'Confirmed', tone: 'green' },
  completed: { label: 'Completed', tone: 'plum' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  needs_attention: { label: 'Needs attention', tone: 'red', dot: true },
};

export const TRIP_STATUS = {
  planning: { label: 'Planning', tone: 'blue' },
  booked: { label: 'Booked', tone: 'plum' },
  ongoing: { label: 'Ongoing', tone: 'green', dot: true },
  completed: { label: 'Completed', tone: 'neutral' },
  archived: { label: 'Archived', tone: 'neutral' },
};

export const USER_STATUS = {
  active: { label: 'Active', tone: 'green' },
  suspended: { label: 'Suspended', tone: 'red' },
};

export const VERIFICATION_STATUS = {
  none: { label: 'Not verified', tone: 'neutral' },
  pending: { label: 'Pending review', tone: 'marigold', dot: true },
  approved: { label: 'Verified', tone: 'blue' },
  rejected: { label: 'Rejected', tone: 'red' },
};

export const PAYOUT_STATUS = {
  requested: { label: 'Requested', tone: 'marigold', dot: true },
  approved: { label: 'Approved', tone: 'blue' },
  paid: { label: 'Paid', tone: 'green' },
  rejected: { label: 'Rejected', tone: 'red' },
};

export const SOS_STATUS = {
  active: { label: 'Active', tone: 'red', dot: true },
  acknowledged: { label: 'Acknowledged', tone: 'marigold' },
  resolved: { label: 'Resolved', tone: 'green' },
};

export const REVIEW_STATUS = {
  visible: { label: 'Visible', tone: 'green' },
  flagged: { label: 'Flagged', tone: 'red', dot: true },
  hidden: { label: 'Hidden', tone: 'neutral' },
};

export const ITINERARY_STATUS = {
  published: { label: 'Published', tone: 'green' },
  unpublished: { label: 'Unpublished', tone: 'neutral' },
  removed: { label: 'Removed', tone: 'red' },
};

export const PAYMENT_PURPOSE = {
  booking: { label: 'Booking', tone: 'plum' },
  purchase: { label: 'Itinerary sale', tone: 'blue' },
  tip: { label: 'Creator tip', tone: 'marigold' },
  subscription: { label: 'Plus subscription', tone: 'green' },
  settlement: { label: 'Settlement', tone: 'neutral' },
  refund: { label: 'Refund', tone: 'red' },
  payout: { label: 'Creator payout', tone: 'dark' },
};

export const PAYMENT_STATUS = {
  success: { label: 'Success', tone: 'green' },
  refunded: { label: 'Refunded', tone: 'marigold' },
  failed: { label: 'Failed', tone: 'red' },
  pending: { label: 'Pending', tone: 'blue' },
};

export const EVENT_CATEGORIES = {
  festival: { label: 'Festival', emoji: '🪔' },
  activity: { label: 'Activity', emoji: '🎯' },
  food: { label: 'Food', emoji: '🍛' },
  culture: { label: 'Culture', emoji: '🏛️' },
  adventure: { label: 'Adventure', emoji: '🧗' },
  music: { label: 'Music', emoji: '🎶' },
};

export function StatusBadge({ map, value, className }) {
  if (!value) return null;
  const s = map[value] || { label: humanize(value), tone: 'neutral' };
  return (
    <Badge tone={s.tone} dot={s.dot} className={className}>
      {s.label}
    </Badge>
  );
}

// ---------------------------------------------------------------- Small utils
export function humanize(key = '') {
  const s = String(key).replace(/[_-]+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Build a query string, dropping empty values. */
export function qs(params) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export function parseMaybeJson(v, fallback = {}) {
  if (v && typeof v === 'object') return v;
  try {
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * URL-backed filter state. `defaults` must be a stable (module-level) object.
 * Changing any key other than `page` resets the page.
 */
export function useQueryParams(defaults) {
  const [sp, setSp] = useSearchParams();
  const values = useMemo(() => {
    const v = { ...defaults };
    for (const k of Object.keys(defaults)) {
      const x = sp.get(k);
      if (x !== null) v[k] = typeof defaults[k] === 'number' ? Number(x) || defaults[k] : x;
    }
    return v;
  }, [sp, defaults]);
  const set = useCallback(
    (patch) =>
      setSp(
        (prev) => {
          const n = new URLSearchParams(prev);
          for (const [k, val] of Object.entries(patch)) {
            if (val === '' || val === null || val === undefined || val === defaults[k]) n.delete(k);
            else n.set(k, String(val));
          }
          if (!('page' in patch) && 'page' in defaults) n.delete('page');
          return n;
        },
        { replace: true },
      ),
    [setSp, defaults],
  );
  return [values, set];
}

// ---------------------------------------------------------------- Filters
export function SearchBox({ value, onChange, placeholder = 'Search…', className }) {
  const [text, setText] = useState(value || '');
  const deb = useDebounced(text, 300);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  useEffect(() => {
    if (deb !== (value || '')) onChangeRef.current(deb.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deb]);
  useEffect(() => {
    // external change (back navigation, "clear filters")
    if ((value || '') !== deb.trim()) setText(value || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className={cx('relative min-w-0', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} className="input h-10 py-0 pl-9 pr-9 text-sm" type="search" aria-label={placeholder} />
      {text && (
        <button type="button" onClick={() => setText('')} className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted hover:bg-sand hover:text-ink" aria-label="Clear search">
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export function FilterSelect({ value, onChange, options, label, className }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className={cx(
        'input h-10 w-auto appearance-none bg-[url("data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%20viewBox%3D%270%200%2020%2020%27%3E%3Cpath%20d%3D%27M5.5%207.5l4.5%204.5%204.5-4.5%27%20stroke%3D%27%236b6178%27%20stroke-width%3D%271.6%27%20fill%3D%27none%27/%3E%3C/svg%3E")] bg-[length:16px] bg-[right_10px_center] bg-no-repeat py-0 pl-3 pr-9 text-sm font-medium',
        value ? 'border-plum-300 bg-plum-50/60 text-plum-800' : '',
        className,
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function FilterBar({ children, className }) {
  return <div className={cx('mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center', className)}>{children}</div>;
}

export function ChipToggle({ active, onClick, children, icon: Icon }) {
  return (
    <button type="button" onClick={onClick} className={cx('chip h-10 shrink-0 rounded-xl', active && 'chip-active')}>
      {Icon && <Icon className="size-3.5" />}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------- Pagination
export function Pagination({ page, limit, total, onChange, className }) {
  if (!total) return null;
  const pages = Math.max(1, Math.ceil(total / limit));
  const from = (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);
  return (
    <div className={cx('mt-4 flex items-center justify-between gap-3 text-[13px] text-muted', className)}>
      <span>
        Showing <b className="font-semibold text-ink">{from.toLocaleString('en-IN')}–{to.toLocaleString('en-IN')}</b> of <b className="font-semibold text-ink">{total.toLocaleString('en-IN')}</b>
      </span>
      {pages > 1 && (
        <div className="flex items-center gap-1.5">
          <Button size="icon-sm" variant="secondary" icon={ChevronLeft} disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page" />
          <span className="px-1.5 tabular-nums">
            {page} / {pages}
          </span>
          <Button size="icon-sm" variant="secondary" icon={ChevronRight} disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Next page" />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- People & values
export function UserCell({ user, name, sub, to, size = 32, verified }) {
  const u = user || { name };
  const inner = (
    <span className="flex min-w-0 items-center gap-2.5">
      <Avatar user={u} size={size} />
      <span className="min-w-0">
        <span className="flex items-center gap-1 truncate font-semibold text-ink">
          <span className="truncate">{u.name || 'Unnamed traveller'}</span>
          {(verified ?? u.verified) ? <VerifiedBadge className="size-3.5" /> : null}
        </span>
        {sub && <span className="block truncate text-xs text-muted">{sub}</span>}
      </span>
    </span>
  );
  if (!to) return inner;
  return (
    <Link to={to} onClick={(e) => e.stopPropagation()} className="min-w-0 rounded-lg hover:[&_span.font-semibold]:text-plum-700">
      {inner}
    </Link>
  );
}

export function CopyText({ value, className, mono = true }) {
  const [done, setDone] = useState(false);
  if (!value) return <span className="text-muted">—</span>;
  const copy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(String(value));
      setDone(true);
      setTimeout(() => setDone(false), 1200);
    } catch {
      // clipboard blocked; ignore
    }
  };
  return (
    <button type="button" onClick={copy} title="Copy" className={cx('group inline-flex max-w-full items-center gap-1 rounded-md text-left hover:text-plum-700', mono && 'font-mono text-[12px]', className)}>
      <span className="truncate">{value}</span>
      {done ? <Check className="size-3 shrink-0 text-emerald-600" /> : <Copy className="size-3 shrink-0 opacity-0 transition group-hover:opacity-60" />}
    </button>
  );
}

export function KeyValues({ items, className, cols = 2 }) {
  const list = items.filter((i) => i && i.value !== undefined && i.value !== null && i.value !== '');
  return (
    <dl className={cx('grid gap-x-6 gap-y-3', cols === 2 ? 'sm:grid-cols-2' : cols === 3 ? 'sm:grid-cols-3' : '', className)}>
      {list.map((i) => (
        <div key={i.label} className={cx('min-w-0', i.wide && 'sm:col-span-full')}>
          <dt className="text-[11.5px] font-semibold uppercase tracking-wider text-muted">{i.label}</dt>
          <dd className="mt-0.5 break-words text-[14px] font-medium text-ink">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Panel({ title, subtitle, action, children, className, bodyClassName, id }) {
  return (
    <section id={id} className={cx('card overflow-hidden', className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-line/80 px-5 py-3.5">
          <div className="min-w-0">
            <h2 className="text-[15px] font-bold text-ink">{title}</h2>
            {subtitle && <p className="text-[12.5px] text-muted">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={cx('p-5', bodyClassName)}>{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------- Drawer (right slide-over; full screen on phones)
export function Drawer({ open, onClose, title, subtitle, children, footer, headerExtra, width = 'sm:max-w-[600px]' }) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      // a modal opened on top of the drawer handles its own Escape
      if (document.querySelectorAll('[aria-modal="true"]').length > 1) return;
      onCloseRef.current?.();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[900]" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : 'Details'}>
      <div className="absolute inset-0 bg-plum-950/35 backdrop-blur-[2px] animate-[fade-up_0.2s_ease-out]" onClick={onClose} />
      <div className={cx('absolute inset-y-0 right-0 flex w-full flex-col bg-white shadow-lift animate-[tc-admin-slide_0.24s_ease-out]', width)}>
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
          <div className="min-w-0 flex-1">
            {typeof title === 'string' ? <h2 className="truncate text-lg font-bold text-ink">{title}</h2> : title}
            {subtitle && <div className="mt-0.5 text-[13px] text-muted">{subtitle}</div>}
            {headerExtra}
          </div>
          <button onClick={onClose} className="-mr-1 grid size-9 shrink-0 place-items-center rounded-xl text-muted hover:bg-sand hover:text-ink" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        <div className="scrollbar-thin flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer && <div className="border-t border-line bg-paper/70 px-5 py-3.5 sm:px-6">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------- Prompt dialog (text input → Promise<string|null>)
const PromptCtx = createContext(async () => null);

export function PromptProvider({ children }) {
  const [state, setState] = useState(null);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const prompt = useCallback(
    (opts) =>
      new Promise((resolve) => {
        setValue(opts.defaultValue ?? '');
        setError('');
        setState({ ...opts, resolve });
      }),
    [],
  );
  const close = (v) => {
    state?.resolve(v);
    setState(null);
  };
  const submit = (e) => {
    e?.preventDefault();
    const v = String(value ?? '').trim();
    if (state?.required && !v) return setError(`${state.label || 'This field'} is required`);
    close(v);
  };
  const Control = state?.multiline === false ? Input : Textarea;
  return (
    <PromptCtx.Provider value={prompt}>
      {children}
      <Modal
        open={!!state}
        onClose={() => close(null)}
        size="sm"
        title={state?.title}
        description={state?.description}
        footer={
          <>
            <Button variant="ghost" onClick={() => close(null)}>
              Cancel
            </Button>
            <Button variant={state?.tone === 'danger' ? 'danger' : state?.tone === 'success' ? 'success' : 'primary'} onClick={submit}>
              {state?.confirmLabel || 'Confirm'}
            </Button>
          </>
        }
      >
        {state && (
          <form onSubmit={submit}>
            <Field label={state.label} hint={state.hint} error={error}>
              <Control
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setError('');
                }}
                placeholder={state.placeholder}
                maxLength={state.maxLength || 300}
                type={state.type}
                rows={3}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e);
                }}
              />
            </Field>
          </form>
        )}
      </Modal>
    </PromptCtx.Provider>
  );
}

/** const prompt = usePrompt(); const note = await prompt({ title, label, required }) → string | null */
export const usePrompt = () => useContext(PromptCtx);

// ---------------------------------------------------------------- Mini stat (dense, for detail pages)
export function MiniStat({ label, value, hint, className }) {
  return (
    <div className={cx('rounded-xl border border-line bg-white px-4 py-3', className)}>
      <div className="text-[11.5px] font-semibold uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-0.5 font-display text-xl font-extrabold text-ink">{value}</div>
      {hint && <div className="text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function SkeletonRows({ rows = 5, className }) {
  return (
    <div className={cx('space-y-2', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton h-12" />
      ))}
    </div>
  );
}
