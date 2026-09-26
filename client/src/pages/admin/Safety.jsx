import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { toast } from 'sonner';
import { CircleCheck, ExternalLink, Hand, LifeBuoy, MapPin, Phone, PhoneCall, ShieldCheck, ShieldX, Siren } from 'lucide-react';
import { Avatar, Badge, Button, EmptyState, ErrorState, PageHeader, Tabs, cx } from '../../components/ui';
import { adminApi } from '../../lib/api';
import { useFetch } from '../../lib/hooks';
import { useSocketEvent } from '../../lib/socket';
import { fmtDate, fmtDateTime, timeAgo } from '../../lib/format';
import { SOS_STATUS, StatusBadge, useAdmin, usePrompt } from './kit';

function useTick(ms = 30_000) {
  const [, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT((t) => t + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

function SosCard({ a, onAction, busy }) {
  const active = a.status === 'active';
  const open = a.status !== 'resolved';
  const maps = a.lat != null && a.lng != null ? `https://maps.google.com/?q=${a.lat},${a.lng}` : null;
  return (
    <article className={cx('card overflow-hidden', active ? 'border-rose-300 shadow-[0_0_0_3px_rgb(244_63_94/0.12)]' : a.status === 'acknowledged' ? 'border-marigold-200' : '')}>
      {active && (
        <div className="flex items-center gap-2 bg-rose-600 px-4 py-1.5 text-[12px] font-bold uppercase tracking-wider text-white">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-white" />
          </span>
          Active SOS · {timeAgo(a.created_at)}
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <Link to={`/admin/users/${a.user_id}`} className="flex min-w-0 items-center gap-3 hover:text-plum-700">
            <Avatar user={{ id: a.user_id, name: a.user_name }} size={42} />
            <div className="min-w-0">
              <div className="truncate text-[15px] font-bold text-ink">{a.user_name}</div>
              <div className="text-[12px] text-muted" title={fmtDateTime(a.created_at)}>
                Raised {fmtDateTime(a.created_at)}
              </div>
            </div>
          </Link>
          <StatusBadge map={SOS_STATUS} value={a.status} />
        </div>

        <blockquote className={cx('mt-3 rounded-xl px-3.5 py-2.5 text-[14px] leading-relaxed', active ? 'bg-rose-50 text-rose-950' : 'bg-paper text-ink/85')}>
          {a.message ? `“${a.message}”` : <span className="italic text-muted">No message — SOS button pressed.</span>}
        </blockquote>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {a.phone && (
            <a href={`tel:${a.phone}`} className="flex items-center gap-2.5 rounded-xl border border-line px-3 py-2 transition hover:border-plum-300">
              <Phone className="size-4 text-plum-600" />
              <span className="min-w-0">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted">Call traveller</span>
                <span className="block truncate text-[13.5px] font-semibold text-ink">{a.phone}</span>
              </span>
            </a>
          )}
          {a.emergency_phone ? (
            <a href={`tel:${a.emergency_phone}`} className="flex items-center gap-2.5 rounded-xl border border-line px-3 py-2 transition hover:border-plum-300">
              <PhoneCall className="size-4 text-plum-600" />
              <span className="min-w-0">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted">Emergency · {a.emergency_name || 'contact'}</span>
                <span className="block truncate text-[13.5px] font-semibold text-ink">{a.emergency_phone}</span>
              </span>
            </a>
          ) : (
            <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-line px-3 py-2 text-[12.5px] text-muted">
              <PhoneCall className="size-4" /> No emergency contact on file
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px]">
          {maps ? (
            <a href={maps} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-plum-700 hover:underline">
              <MapPin className="size-4" /> Open location in Google Maps <ExternalLink className="size-3" />
            </a>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-muted">
              <MapPin className="size-4" /> Location not shared
            </span>
          )}
          {a.trip_id && (
            <Link to={`/admin/trips/${a.trip_id}`} className="text-ink/80 hover:text-plum-700">
              🧳 {a.trip_name}
              {a.destination ? ` · ${a.destination}` : ''}
            </Link>
          )}
        </div>

        {a.resolution_note && (
          <p className="mt-3 rounded-xl bg-plum-50 px-3.5 py-2 text-[12.5px] text-plum-900 ring-1 ring-plum-100">
            <b>Note:</b> {a.resolution_note}
            {a.resolved_at && <span className="text-plum-900/60"> · resolved {timeAgo(a.resolved_at)}</span>}
          </p>
        )}
      </div>
      {open && (
        <div className="flex flex-wrap gap-2 border-t border-line/80 bg-paper/60 px-4 py-3">
          {active && (
            <Button size="sm" variant="accent" icon={Hand} loading={busy === 'acknowledged'} disabled={!!busy} onClick={() => onAction(a, 'acknowledged')}>
              Acknowledge
            </Button>
          )}
          <Button size="sm" variant="success" icon={CircleCheck} loading={busy === 'resolved'} disabled={!!busy} onClick={() => onAction(a, 'resolved')}>
            Resolve
          </Button>
        </div>
      )}
    </article>
  );
}

export default function Safety() {
  useTick();
  const location = useLocation();
  const sos = useFetch('/admin/sos', { scope: 'admin' });
  const ver = useFetch('/admin/users?verification=pending&limit=100', { scope: 'admin' });
  const { refresh } = useAdmin();
  const prompt = usePrompt();
  const [tab, setTab] = useState('open');
  const [busy, setBusy] = useState({});

  useSocketEvent('sos', () => sos.reload(), { admin: true });
  useSocketEvent('verification', () => ver.reload(), { admin: true });

  const scrolledFor = useRef(null);
  const verLoaded = !!ver.data && !!sos.data;
  useEffect(() => {
    if (location.hash !== '#verifications' || !verLoaded || scrolledFor.current === location.key) return;
    scrolledFor.current = location.key;
    document.getElementById('verifications')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [location.hash, location.key, verLoaded]);

  const alerts = sos.data?.alerts || [];
  const openAlerts = alerts.filter((a) => a.status !== 'resolved');
  const shown = tab === 'open' ? openAlerts : tab === 'resolved' ? alerts.filter((a) => a.status === 'resolved') : alerts;
  const pending = ver.data?.users || [];

  const actSos = async (a, status) => {
    const note = await prompt({
      title: status === 'acknowledged' ? `Acknowledge ${a.user_name}’s SOS` : `Resolve ${a.user_name}’s SOS`,
      description: status === 'acknowledged' ? 'The traveller is told a safety specialist is reaching out. Add what you’re doing.' : 'The traveller is notified that the alert is closed. Record what happened.',
      label: status === 'acknowledged' ? 'Note to traveller (optional)' : 'Resolution note',
      placeholder: status === 'acknowledged' ? 'e.g. Calling you now from +91 80 4000 0000' : 'e.g. Spoke to traveller — safe at hotel, local police informed',
      confirmLabel: status === 'acknowledged' ? 'Acknowledge' : 'Mark resolved',
      tone: status === 'resolved' ? 'success' : undefined,
      required: status === 'resolved',
      maxLength: 300,
    });
    if (note === null) return;
    setBusy((b) => ({ ...b, [a.id]: status }));
    try {
      await adminApi.patch(`/admin/sos/${a.id}`, { status, note: note || undefined });
      toast.success(status === 'acknowledged' ? `${a.user_name} has been told help is on the way` : 'SOS resolved');
      sos.reload();
      refresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy((b) => ({ ...b, [a.id]: null }));
    }
  };

  const verify = async (u, approve) => {
    let note;
    if (!approve) {
      note = await prompt({
        title: `Reject ${u.name}’s request`,
        description: 'They’ll be asked to fix their profile and request again.',
        label: 'What should they fix?',
        placeholder: 'e.g. Add an emergency contact and a clear profile photo',
        confirmLabel: 'Reject request',
        tone: 'danger',
        maxLength: 200,
      });
      if (note === null) return;
    }
    setBusy((b) => ({ ...b, [u.id]: approve ? 'approve' : 'reject' }));
    try {
      await adminApi.patch(`/admin/users/${u.id}`, approve ? { verified: true } : { verified: false, note: note || undefined });
      toast.success(approve ? `${u.name} is now a Verified Traveller` : 'Request rejected — traveller notified');
      ver.setData((d) => ({ ...d, users: d.users.filter((x) => x.id !== u.id), total: Math.max(0, (d.total || 1) - 1) }));
      refresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy((b) => ({ ...b, [u.id]: null }));
    }
  };

  return (
    <div className="space-y-10">
      <section>
        <PageHeader
          title="Safety"
          subtitle="Live SOS alerts from travellers. Acknowledge fast, call them, and resolve with a note."
          actions={
            openAlerts.length > 0 ? (
              <Badge tone="red" dot className="px-3 py-1 text-[13px]">
                {openAlerts.length} open alert{openAlerts.length === 1 ? '' : 's'}
              </Badge>
            ) : sos.data ? (
              <Badge tone="green" icon={CircleCheck} className="px-3 py-1 text-[13px]">
                No open alerts
              </Badge>
            ) : null
          }
        />
        <Tabs
          className="mb-4"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'open', label: 'Open', icon: Siren, count: openAlerts.length },
            { id: 'resolved', label: 'Resolved' },
            { id: 'all', label: 'All alerts' },
          ]}
        />
        {sos.error && !sos.data ? (
          <ErrorState error={sos.error} onRetry={sos.reload} />
        ) : sos.loading && !sos.data ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="skeleton h-72 rounded-2xl" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <EmptyState icon={LifeBuoy} title={tab === 'open' ? 'All travellers are safe' : 'No alerts here'} description={tab === 'open' ? 'When a traveller presses SOS you’ll get a live alert with their location and emergency contact.' : undefined} />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {shown.map((a) => (
              <SosCard key={a.id} a={a} busy={busy[a.id]} onAction={actSos} />
            ))}
          </div>
        )}
      </section>

      <section id="verifications" className="scroll-mt-24">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-[22px] font-extrabold text-ink">Verification requests</h2>
            <p className="text-[14px] text-muted">Travellers asking for the Verified Traveller badge. Check they have a real name, phone and emergency contact.</p>
          </div>
          {pending.length > 0 && <Badge tone="marigold">{pending.length} pending</Badge>}
        </div>
        {ver.error && !ver.data ? (
          <ErrorState error={ver.error} onRetry={ver.reload} />
        ) : ver.loading && !ver.data ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="skeleton h-44 rounded-2xl" />
            ))}
          </div>
        ) : pending.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="No pending requests" description="Verification requests from travellers will appear here." />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {pending.map((u) => (
              <article key={u.id} className="card flex flex-col p-4">
                <div className="flex items-start gap-3">
                  <Avatar user={u} size={46} />
                  <div className="min-w-0 flex-1">
                    <Link to={`/admin/users/${u.id}`} className="block truncate text-[15px] font-bold text-ink hover:text-plum-700">
                      {u.name || 'Unnamed traveller'}
                    </Link>
                    <div className="text-[12.5px] text-muted">
                      {u.phone}
                      {u.home_city ? ` · ${u.home_city}` : ''} · joined {fmtDate(u.created_at)}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11.5px]">
                      <Badge>{u.trip_count} trips</Badge>
                      <Badge>{u.booking_count} bookings</Badge>
                      {u.avatar_url ? <Badge tone="green">Has photo</Badge> : <Badge tone="marigold">No photo</Badge>}
                      {u.emergency_phone ? <Badge tone="green">Emergency contact</Badge> : <Badge tone="red">No emergency contact</Badge>}
                    </div>
                  </div>
                </div>
                {u.bio && <p className="mt-3 line-clamp-2 text-[13px] text-ink/80">{u.bio}</p>}
                {u.verification_note && (
                  <p className="mt-3 rounded-xl bg-marigold-50 px-3 py-2 text-[12.5px] text-marigold-900 ring-1 ring-marigold-100">
                    <b>Their note:</b> {u.verification_note}
                  </p>
                )}
                {u.emergency_phone && (
                  <p className="mt-2 text-[12.5px] text-muted">
                    Emergency: {u.emergency_name} · {u.emergency_phone}
                  </p>
                )}
                <div className="mt-auto flex flex-wrap gap-2 pt-4">
                  <Button size="sm" variant="success" icon={ShieldCheck} loading={busy[u.id] === 'approve'} disabled={!!busy[u.id]} onClick={() => verify(u, true)}>
                    Approve
                  </Button>
                  <Button size="sm" variant="danger-soft" icon={ShieldX} loading={busy[u.id] === 'reject'} disabled={!!busy[u.id]} onClick={() => verify(u, false)}>
                    Reject
                  </Button>
                  <Button size="sm" variant="ghost" to={`/admin/users/${u.id}`} className="ml-auto">
                    Full profile
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
