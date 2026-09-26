import { createContext, forwardRef, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router';
import clsx from 'clsx';
import { BadgeCheck, Loader2, X, ChevronLeft, Star, MoreHorizontal } from 'lucide-react';
import { colorFor, initials } from '../lib/format';
import { assetUrl } from '../lib/api';

export { clsx as cx };

// ---------------------------------------------------------------- Button
const VARIANTS = {
  primary: 'bg-plum-700 text-white hover:bg-plum-800 shadow-[0_8px_20px_-10px_rgb(95_45_139/0.8)] disabled:bg-plum-300',
  accent: 'bg-marigold-400 text-plum-950 hover:bg-marigold-300 shadow-[0_8px_20px_-10px_rgb(249_138_10/0.8)]',
  secondary: 'bg-white text-ink border border-line hover:border-plum-300 hover:text-plum-800',
  soft: 'bg-plum-50 text-plum-800 hover:bg-plum-100',
  ghost: 'text-ink/80 hover:bg-sand hover:text-ink',
  danger: 'bg-rose-600 text-white hover:bg-rose-700',
  'danger-soft': 'bg-rose-50 text-rose-700 hover:bg-rose-100',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700',
  dark: 'bg-ink text-white hover:bg-plum-950',
};
const SIZES = {
  xs: 'h-7 px-2.5 text-xs gap-1 rounded-lg',
  sm: 'h-9 px-3 text-[13px] gap-1.5 rounded-xl',
  md: 'h-11 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-[15px] gap-2 rounded-2xl',
  icon: 'h-10 w-10 rounded-xl justify-center',
  'icon-sm': 'h-8 w-8 rounded-lg justify-center',
};

export const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', loading = false, icon: Icon, iconRight: IconRight, to, href, className, children, disabled, type = 'button', ...props },
  ref,
) {
  const cls = clsx(
    'inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60 select-none',
    VARIANTS[variant],
    SIZES[size],
    className,
  );
  const content = (
    <>
      {loading ? <Loader2 className="size-4 animate-spin" /> : Icon ? <Icon className={size.startsWith('icon') ? 'size-[18px]' : 'size-4'} /> : null}
      {children}
      {IconRight && !loading ? <IconRight className="size-4" /> : null}
    </>
  );
  if (to) return <Link ref={ref} to={to} className={cls} {...props}>{content}</Link>;
  if (href) return <a ref={ref} href={href} className={cls} {...props}>{content}</a>;
  return (
    <button ref={ref} type={type} className={cls} disabled={disabled || loading} {...props}>
      {content}
    </button>
  );
});

// ---------------------------------------------------------------- Form fields
export function Field({ label, hint, error, children, className, htmlFor }) {
  return (
    <div className={className}>
      {label && <label className="label" htmlFor={htmlFor}>{label}</label>}
      {children}
      {error ? <p className="mt-1.5 text-xs font-medium text-rose-600">{error}</p> : hint ? <p className="mt-1.5 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export const Input = forwardRef(function Input({ className, icon: Icon, ...props }, ref) {
  if (!Icon) return <input ref={ref} className={clsx('input', className)} {...props} />;
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
      <input ref={ref} className={clsx('input pl-10', className)} {...props} />
    </div>
  );
});

export const Textarea = forwardRef(function Textarea({ className, rows = 3, ...props }, ref) {
  return <textarea ref={ref} rows={rows} className={clsx('input resize-none leading-relaxed', className)} {...props} />;
});

export const Select = forwardRef(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={clsx('input appearance-none bg-[url("data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%20viewBox%3D%270%200%2020%2020%27%20fill%3D%27%236b6178%27%3E%3Cpath%20d%3D%27M5.5%207.5l4.5%204.5%204.5-4.5%27%20stroke%3D%27%236b6178%27%20stroke-width%3D%271.6%27%20fill%3D%27none%27/%3E%3C/svg%3E")] bg-[length:18px] bg-[right_12px_center] bg-no-repeat pr-10', className)} {...props}>
      {children}
    </select>
  );
});

export function Toggle({ checked, onChange, label, description, disabled }) {
  const id = useId();
  return (
    <label htmlFor={id} className={clsx('flex cursor-pointer items-start justify-between gap-4', disabled && 'opacity-60')}>
      {(label || description) && (
        <span>
          {label && <span className="block text-sm font-semibold text-ink">{label}</span>}
          {description && <span className="mt-0.5 block text-[13px] text-muted">{description}</span>}
        </span>
      )}
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input id={id} type="checkbox" className="peer sr-only" checked={!!checked} disabled={disabled} onChange={(e) => onChange?.(e.target.checked)} />
        <span className="h-6 w-11 rounded-full bg-line transition peer-checked:bg-plum-600 peer-focus-visible:ring-4 peer-focus-visible:ring-plum-100" />
        <span className="absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

export function Segmented({ options, value, onChange, className, size = 'md' }) {
  return (
    <div className={clsx('inline-flex rounded-xl bg-sand p-1', className)}>
      {options.map((o) => {
        const v = typeof o === 'string' ? o : o.value;
        const label = typeof o === 'string' ? o : o.label;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={clsx('rounded-lg font-semibold transition', size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-[13px]', value === v ? 'bg-white text-plum-800 shadow-sm' : 'text-muted hover:text-ink')}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- Surfaces
export function Card({ as: Tag = 'div', className, children, padded = true, ...props }) {
  return (
    <Tag className={clsx('card', padded && 'p-5', className)} {...props}>
      {children}
    </Tag>
  );
}

const TONES = {
  neutral: 'bg-sand text-ink/75',
  plum: 'bg-plum-50 text-plum-700 ring-1 ring-inset ring-plum-100',
  marigold: 'bg-marigold-50 text-marigold-800 ring-1 ring-inset ring-marigold-100',
  green: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100',
  red: 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-100',
  blue: 'bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-100',
  dark: 'bg-ink text-white',
};

export function Badge({ tone = 'neutral', icon: Icon, className, children, dot }) {
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold whitespace-nowrap', TONES[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {Icon && <Icon className="size-3" />}
      {children}
    </span>
  );
}

export function VerifiedBadge({ className }) {
  return <BadgeCheck className={clsx('inline size-4 shrink-0 fill-sky-500 text-white', className)} aria-label="Verified traveller" />;
}

export function Avatar({ user, size = 36, className, ring = false, online }) {
  const name = user?.name || '?';
  const style = { width: size, height: size, fontSize: Math.max(10, size * 0.38) };
  return (
    <span className={clsx('relative inline-flex shrink-0', className)} title={name}>
      {user?.avatar_url ? (
        <img src={assetUrl(user.avatar_url)} alt={name} className={clsx('rounded-full object-cover', ring && 'ring-2 ring-white')} style={style} />
      ) : (
        <span className={clsx('grid place-items-center rounded-full font-bold text-white', ring && 'ring-2 ring-white')} style={{ ...style, background: colorFor(user?.id || user?.user_id || name) }}>
          {initials(name)}
        </span>
      )}
      {online !== undefined && (
        <span className={clsx('absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-white', online ? 'bg-emerald-500' : 'bg-line')} style={{ width: Math.max(10, size * 0.32), height: Math.max(10, size * 0.32) }} />
      )}
    </span>
  );
}

export function AvatarStack({ users = [], max = 4, size = 28, className }) {
  const shown = users.slice(0, max);
  const rest = users.length - shown.length;
  return (
    <div className={clsx('flex items-center', className)}>
      {shown.map((u, i) => (
        <Avatar key={u.id || u.user_id || i} user={u} size={size} ring className={i ? '-ml-2' : ''} />
      ))}
      {rest > 0 && (
        <span className="-ml-2 grid place-items-center rounded-full bg-sand text-[11px] font-bold text-ink/70 ring-2 ring-white" style={{ width: size, height: size }}>
          +{rest}
        </span>
      )}
    </div>
  );
}

export function Stars({ value = 0, size = 14, className }) {
  return (
    <span className={clsx('inline-flex items-center gap-0.5', className)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} style={{ width: size, height: size }} className={i <= Math.round(value) ? 'fill-marigold-400 text-marigold-400' : 'fill-line text-line'} />
      ))}
    </span>
  );
}

// ---------------------------------------------------------------- Loading & empty
export const Spinner = ({ className }) => <Loader2 className={clsx('size-5 animate-spin text-plum-600', className)} />;

export function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="grid min-h-[40vh] place-items-center">
      <div className="flex flex-col items-center gap-3 text-sm text-muted">
        <Spinner className="size-7" />
        {label}
      </div>
    </div>
  );
}

export const Skeleton = ({ className }) => <div className={clsx('skeleton', className)} />;

export function EmptyState({ icon: Icon, emoji, title, description, action, className }) {
  return (
    <div className={clsx('flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-white/60 px-6 py-12 text-center', className)}>
      {emoji ? <div className="mb-3 text-4xl">{emoji}</div> : Icon ? <div className="mb-3 grid size-12 place-items-center rounded-2xl bg-plum-50 text-plum-600"><Icon className="size-6" /></div> : null}
      <h3 className="text-lg font-bold text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <EmptyState
      emoji="🧭"
      title={error?.status === 404 ? 'Not found' : error?.status === 403 ? 'No access' : 'Something went off-route'}
      description={error?.message || 'Please try again.'}
      action={onRetry && <Button variant="secondary" onClick={onRetry}>Try again</Button>}
    />
  );
}

// ---------------------------------------------------------------- Headers & stats
export function PageHeader({ title, subtitle, actions, back, eyebrow, className }) {
  return (
    <div className={clsx('mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {back && (
          <Link to={back} className="mb-2 inline-flex items-center gap-1 text-[13px] font-semibold text-muted hover:text-plum-700">
            <ChevronLeft className="size-4" /> Back
          </Link>
        )}
        {eyebrow && <div className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-marigold-600">{eyebrow}</div>}
        <h1 className="text-balance text-[28px] font-extrabold leading-tight text-ink sm:text-[32px]">{title}</h1>
        {subtitle && <p className="mt-1 text-[15px] text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionTitle({ title, subtitle, action, className }) {
  return (
    <div className={clsx('mb-3 flex items-end justify-between gap-3', className)}>
      <div>
        <h2 className="text-lg font-bold text-ink">{title}</h2>
        {subtitle && <p className="text-[13px] text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({ label, value, hint, icon: Icon, tone = 'plum', className }) {
  const toneCls = { plum: 'bg-plum-50 text-plum-700', marigold: 'bg-marigold-50 text-marigold-700', green: 'bg-emerald-50 text-emerald-700', red: 'bg-rose-50 text-rose-700', blue: 'bg-sky-50 text-sky-700' }[tone];
  return (
    <Card className={clsx('flex items-start gap-3.5', className)}>
      {Icon && (
        <div className={clsx('grid size-10 shrink-0 place-items-center rounded-xl', toneCls)}>
          <Icon className="size-5" />
        </div>
      )}
      <div className="min-w-0">
        <div className="text-[12.5px] font-semibold text-muted">{label}</div>
        <div className="mt-0.5 truncate font-display text-[22px] font-extrabold leading-tight text-ink">{value}</div>
        {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- Tabs
export function Tabs({ tabs, value, onChange, className, size = 'md' }) {
  return (
    <div className={clsx('no-scrollbar flex gap-1 overflow-x-auto', className)} role="tablist">
      {tabs.map((t) => {
        const active = t.id === value;
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={clsx(
              'relative inline-flex shrink-0 items-center gap-1.5 rounded-xl font-semibold transition',
              size === 'sm' ? 'px-3 py-1.5 text-[13px]' : 'px-3.5 py-2 text-sm',
              active ? 'bg-plum-700 text-white shadow-sm' : 'text-ink/70 hover:bg-white hover:text-ink',
            )}
          >
            {Icon && <Icon className="size-4" />}
            {t.label}
            {t.count ? <span className={clsx('rounded-full px-1.5 text-[11px] font-bold', active ? 'bg-white/20' : 'bg-marigold-100 text-marigold-800')}>{t.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- Modal / sheet
export function Modal({ open, onClose, title, description, children, footer, size = 'md', className, hideClose = false }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  // Depends on `open` only: re-running on every new onClose identity would steal focus mid-typing.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && closeRef.current?.();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => ref.current?.querySelector('input, textarea, select, button[data-autofocus]')?.focus(), 30);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);
  if (!open) return null;
  const width = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' }[size];
  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-plum-950/40 backdrop-blur-[2px] animate-[fade-up_0.2s_ease-out]" onClick={onClose} />
      <div ref={ref} className={clsx('relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-lift animate-pop sm:rounded-3xl', width, className)}>
        {(title || !hideClose) && (
          <div className="flex items-start justify-between gap-4 px-5 pb-2 pt-5 sm:px-6">
            <div className="min-w-0">
              {title && <h2 className="text-xl font-bold text-ink">{title}</h2>}
              {description && <p className="mt-1 text-sm text-muted">{description}</p>}
            </div>
            {!hideClose && (
              <button onClick={onClose} className="-mr-1 grid size-9 shrink-0 place-items-center rounded-xl text-muted hover:bg-sand hover:text-ink" aria-label="Close">
                <X className="size-5" />
              </button>
            )}
          </div>
        )}
        <div className="scrollbar-thin flex-1 overflow-y-auto px-5 pb-5 pt-2 sm:px-6">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-paper/60 px-5 py-3.5 sm:px-6">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------- Confirm dialog
const ConfirmCtx = createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const confirm = useCallback((opts) => new Promise((resolve) => setState({ ...opts, resolve })), []);
  const close = (v) => {
    state?.resolve(v);
    setState(null);
  };
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Modal
        open={!!state}
        onClose={() => close(false)}
        size="sm"
        title={state?.title}
        description={state?.description}
        footer={
          <>
            <Button variant="ghost" onClick={() => close(false)}>{state?.cancelLabel || 'Cancel'}</Button>
            <Button data-autofocus variant={state?.tone === 'danger' ? 'danger' : 'primary'} onClick={() => close(true)}>{state?.confirmLabel || 'Confirm'}</Button>
          </>
        }
      >
        {state?.body || null}
      </Modal>
    </ConfirmCtx.Provider>
  );
}

/** const confirm = useConfirm(); if (await confirm({ title, description, tone: 'danger' })) … */
export const useConfirm = () => useContext(ConfirmCtx);

// ---------------------------------------------------------------- Menu
export function Menu({ items, trigger, align = 'right', className }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  return (
    <div ref={ref} className={clsx('relative', className)}>
      <span onClick={() => setOpen((o) => !o)}>
        {trigger || (
          <button className="grid size-8 place-items-center rounded-lg text-muted hover:bg-sand hover:text-ink" aria-label="More">
            <MoreHorizontal className="size-4" />
          </button>
        )}
      </span>
      {open && (
        <div className={clsx('absolute z-50 mt-1 min-w-44 overflow-hidden rounded-xl border border-line bg-white py-1 shadow-lift animate-pop', align === 'right' ? 'right-0' : 'left-0')}>
          {items.filter(Boolean).map((it) => {
            const Icon = it.icon;
            return (
              <button
                key={it.label}
                disabled={it.disabled}
                onClick={() => {
                  setOpen(false);
                  it.onClick?.();
                }}
                className={clsx('flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm font-medium transition disabled:opacity-50', it.danger ? 'text-rose-600 hover:bg-rose-50' : 'text-ink/85 hover:bg-sand')}
              >
                {Icon && <Icon className="size-4" />}
                {it.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Misc
export function Progress({ value, max = 100, className, tone = 'plum' }) {
  const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  return (
    <div className={clsx('h-2 overflow-hidden rounded-full bg-sand', className)}>
      <div className={clsx('h-full rounded-full transition-all', tone === 'plum' ? 'bg-plum-600' : tone === 'marigold' ? 'bg-marigold-400' : tone === 'red' ? 'bg-rose-500' : 'bg-emerald-500')} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Kbd({ children }) {
  return <kbd className="rounded-md border border-line bg-white px-1.5 py-0.5 font-mono text-[11px] text-muted">{children}</kbd>;
}

export function Divider({ label, className }) {
  if (!label) return <hr className={clsx('border-line', className)} />;
  return (
    <div className={clsx('flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-muted', className)}>
      <span className="h-px flex-1 bg-line" />
      {label}
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
