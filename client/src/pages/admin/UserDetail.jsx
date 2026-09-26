import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import dayjs from 'dayjs';
import { toast } from 'sonner';
import { Ban, BadgeCheck, Crown, ExternalLink, Mail, MapPin, Phone, PhoneCall, ShieldCheck, ShieldUser, ShieldX, UserCheck, Wallet } from 'lucide-react';
import { Avatar, Badge, Button, EmptyState, ErrorState, Field, Input, Modal, PageHeader, Skeleton, Tabs, VerifiedBadge, useConfirm, cx } from '../../components/ui';
import { adminApi } from '../../lib/api';
import { useFetch } from '../../lib/hooks';
import { CATEGORY, fmtDate, fmtDateTime, fmtRange, inr, timeAgo } from '../../lib/format';
import DataTable from './DataTable';
import BookingDrawer from './BookingDrawer';
import {
  BOOKING_STATUS_ADMIN,
  CopyText,
  ITINERARY_STATUS,
  PAYMENT_PURPOSE,
  PAYMENT_STATUS,
  Panel,
  SOS_STATUS,
  StatusBadge,
  TRIP_STATUS,
  USER_STATUS,
  VERIFICATION_STATUS,
  useAdmin,
  usePrompt,
} from './kit';

function PlusModal({ open, onClose, user, onSave }) {
  const [date, setDate] = useState('');
  const [busy, setBusy] = useState(false);
  const initial = user?.plan === 'plus' && user.plan_expires_at ? dayjs(user.plan_expires_at).format('YYYY-MM-DD') : dayjs().add(30, 'day').format('YYYY-MM-DD');
  const value = date || initial;
  const presets = [
    { label: '1 month', d: dayjs().add(1, 'month') },
    { label: '3 months', d: dayjs().add(3, 'month') },
    { label: '1 year', d: dayjs().add(1, 'year') },
  ];
  const save = async () => {
    if (!value || dayjs(value).isBefore(dayjs(), 'day')) return toast.error('Pick an expiry date in the future');
    setBusy(true);
    try {
      await onSave(value);
      setDate('');
      onClose();
    } catch {
      // error already surfaced as a toast
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={user?.plan === 'plus' ? 'Change Plus expiry' : 'Grant Itenary Plus'}
      description="Plus unlocks unlimited concierge requests and priority support. No payment is collected."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" icon={Crown} loading={busy} onClick={save}>
            {user?.plan === 'plus' ? 'Update expiry' : 'Grant Plus'}
          </Button>
        </>
      }
    >
      <Field label="Plus expires on">
        <Input type="date" value={value} min={dayjs().add(1, 'day').format('YYYY-MM-DD')} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <div className="mt-3 flex flex-wrap gap-2">
        {presets.map((p) => (
          <button key={p.label} type="button" onClick={() => setDate(p.d.format('YYYY-MM-DD'))} className={cx('chip', value === p.d.format('YYYY-MM-DD') && 'chip-active')}>
            {p.label}
          </button>
        ))}
      </div>
    </Modal>
  );
}

function Detail({ icon: Icon, label, children }) {
  if (!children) return null;
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-sand text-muted">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</div>
        <div className="break-words text-[13.5px] font-medium text-ink">{children}</div>
      </div>
    </div>
  );
}

export default function UserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useFetch(`/admin/users/${id}`, { scope: 'admin' });
  const { refresh } = useAdmin();
  const confirm = useConfirm();
  const prompt = usePrompt();
  const [tab, setTab] = useState('trips');
  const [plusOpen, setPlusOpen] = useState(false);
  const [busy, setBusy] = useState(null);
  const [openBooking, setOpenBooking] = useState(null);

  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (loading && !data)
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    );
  if (!data) return null;

  const { user: u, trips, bookings, payments, itineraries, sos } = data;

  const patch = async (body, success, key) => {
    setBusy(key);
    try {
      await adminApi.patch(`/admin/users/${u.id}`, body);
      toast.success(success);
      await reload();
      refresh();
    } catch (err) {
      toast.error(err.message);
      throw err;
    } finally {
      setBusy(null);
    }
  };

  const approve = () => patch({ verified: true }, `${u.name} is now a Verified Traveller`, 'verify').catch(() => {});
  const reject = async () => {
    const note = await prompt({
      title: 'Reject verification',
      description: `${u.name} will be asked to fix their profile and request again.`,
      label: 'What should they fix?',
      placeholder: 'e.g. Add an emergency contact and a clear profile photo',
      confirmLabel: 'Reject request',
      tone: 'danger',
      maxLength: 200,
    });
    if (note === null) return;
    patch({ verified: false, note: note || undefined }, 'Verification request rejected', 'reject').catch(() => {});
  };
  const revokeVerification = async () => {
    if (!(await confirm({ title: 'Remove verified badge?', description: `${u.name}'s verified badge will disappear from their profile, trips and itineraries.`, confirmLabel: 'Remove badge', tone: 'danger' }))) return;
    patch({ verified: false, verification_status: 'none' }, 'Verified badge removed', 'revoke').catch(() => {});
  };
  const toggleSuspend = async () => {
    if (u.status === 'suspended') return patch({ status: 'active' }, `${u.name} has been reactivated`, 'status').catch(() => {});
    if (!(await confirm({ title: `Suspend ${u.name}?`, description: 'They will be signed out and blocked from signing in until reactivated. Their trips stay intact.', confirmLabel: 'Suspend account', tone: 'danger' }))) return;
    patch({ status: 'suspended' }, `${u.name} has been suspended`, 'status').catch(() => {});
  };
  const revokePlus = async () => {
    if (!(await confirm({ title: 'Revoke Plus?', description: `${u.name} will move to the free plan immediately.`, confirmLabel: 'Revoke Plus', tone: 'danger' }))) return;
    patch({ plan: 'free', plan_expires_at: null }, 'Plus revoked', 'plus').catch(() => {});
  };
  const toggleAdmin = async () => {
    if (u.role === 'admin') {
      if (!(await confirm({ title: `Remove admin access for ${u.name}?`, description: 'They will lose access to this console immediately.', confirmLabel: 'Remove admin', tone: 'danger' }))) return;
      return patch({ role: 'user' }, 'Admin access removed', 'role').catch(() => {});
    }
    if (!(await confirm({ title: `Make ${u.name} an admin?`, description: `They will be able to sign in to this console with ${u.email} and act on every trip, booking and payment.`, confirmLabel: 'Grant admin access' }))) return;
    patch({ role: 'admin' }, `${u.name} is now an admin`, 'role').catch(() => {});
  };

  const tabs = [
    { id: 'trips', label: 'Trips', count: trips.length },
    { id: 'bookings', label: 'Bookings', count: bookings.length },
    { id: 'payments', label: 'Payments', count: payments.length },
    { id: 'itineraries', label: 'Itineraries', count: itineraries.length },
    { id: 'sos', label: 'SOS history', count: sos.length },
  ];

  return (
    <div>
      <PageHeader back="/admin/users" title={u.name || 'Unnamed traveller'} subtitle={`Joined ${fmtDate(u.created_at)} · last seen ${u.last_seen_at ? timeAgo(u.last_seen_at) : 'never'}`} />

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {/* Profile */}
          <div className="card p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <Avatar user={u} size={72} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold text-ink">{u.name || 'Unnamed traveller'}</h2>
                  {u.verified && <VerifiedBadge className="size-5" />}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <StatusBadge map={USER_STATUS} value={u.status} />
                  {u.role === 'admin' && (
                    <Badge tone="dark" icon={ShieldUser}>
                      Admin
                    </Badge>
                  )}
                  {u.plan === 'plus' ? (
                    <Badge tone="marigold" icon={Crown}>
                      Plus{u.plan_expires_at ? ` · until ${fmtDate(u.plan_expires_at)}` : ''}
                    </Badge>
                  ) : (
                    <Badge>Free plan</Badge>
                  )}
                  <StatusBadge map={VERIFICATION_STATUS} value={u.verification_status} />
                  {!u.onboarded && <Badge tone="blue">Onboarding incomplete</Badge>}
                </div>
                {u.bio && <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-ink/80">{u.bio}</p>}
                {u.travel_style?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {u.travel_style.map((s) => (
                      <span key={s} className="rounded-full bg-plum-50 px-2.5 py-0.5 text-[12px] font-semibold text-plum-700">
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-5 grid gap-4 border-t border-line/80 pt-5 sm:grid-cols-2 lg:grid-cols-3">
              <Detail icon={Phone} label="Phone">
                {u.phone && (
                  <a href={`tel:${u.phone}`} className="hover:text-plum-700">
                    {u.phone}
                  </a>
                )}
              </Detail>
              <Detail icon={Mail} label="Email">
                {u.email}
              </Detail>
              <Detail icon={MapPin} label="Home city">
                {u.home_city}
              </Detail>
              <Detail icon={PhoneCall} label="Emergency contact">
                {u.emergency_phone && (
                  <>
                    {u.emergency_name} ·{' '}
                    <a href={`tel:${u.emergency_phone}`} className="hover:text-plum-700">
                      {u.emergency_phone}
                    </a>
                  </>
                )}
              </Detail>
              <Detail icon={Wallet} label="UPI ID">
                {u.upi_id && <CopyText value={u.upi_id} mono={false} />}
              </Detail>
              <Detail icon={BadgeCheck} label="User ID">
                <CopyText value={u.id} />
              </Detail>
            </div>
            {u.verification_status === 'pending' && u.verification_note && (
              <div className="mt-4 rounded-xl bg-marigold-50 px-4 py-3 text-[13px] text-marigold-900 ring-1 ring-marigold-100">
                <b>Verification request note:</b> {u.verification_note}
              </div>
            )}
          </div>

          {/* Activity tabs */}
          <div>
            <Tabs tabs={tabs} value={tab} onChange={setTab} className="mb-3" size="sm" />
            {tab === 'trips' && (
              <DataTable
                sticky={false}
                rows={trips}
                rowKey="id"
                onRowClick={(t) => navigate(`/admin/trips/${t.id}`)}
                empty={<EmptyState emoji="🧳" title="No trips yet" />}
                columns={[
                  { key: 'name', header: 'Trip', mobile: 'title', render: (t) => <Link to={`/admin/trips/${t.id}`} onClick={(e) => e.stopPropagation()} className="font-semibold text-ink hover:text-plum-700">{t.name}</Link> },
                  { key: 'destination', header: 'Destination' },
                  { key: 'dates', header: 'Dates', render: (t) => <span className="whitespace-nowrap text-muted">{fmtRange(t.start_date, t.end_date)}</span> },
                  { key: 'role', header: 'Role', render: (t) => <Badge tone={t.role === 'owner' ? 'plum' : 'neutral'}>{t.role}</Badge> },
                  { key: 'status', header: 'Status', render: (t) => <StatusBadge map={TRIP_STATUS} value={t.status} /> },
                ]}
              />
            )}
            {tab === 'bookings' && (
              <DataTable
                sticky={false}
                rows={bookings}
                onRowClick={(b) => setOpenBooking(b.id)}
                empty={<EmptyState emoji="🎫" title="No bookings yet" />}
                columns={[
                  {
                    key: 'title',
                    header: 'Booking',
                    mobile: 'title',
                    render: (b) => (
                      <span className="flex items-center gap-2 font-semibold text-ink">
                        <span>{CATEGORY[b.category]?.emoji}</span>
                        <span className="truncate">{b.title}</span>
                      </span>
                    ),
                  },
                  { key: 'total', header: 'Total', align: 'right', render: (b) => <span className="tabular-nums">{inr(b.total)}</span> },
                  { key: 'status', header: 'Status', render: (b) => <StatusBadge map={BOOKING_STATUS_ADMIN} value={b.status} /> },
                  { key: 'created_at', header: 'Created', render: (b) => <span className="whitespace-nowrap text-muted">{fmtDateTime(b.created_at)}</span> },
                ]}
              />
            )}
            {tab === 'payments' && (
              <DataTable
                sticky={false}
                rows={payments}
                empty={<EmptyState emoji="💸" title="No payments yet" />}
                columns={[
                  { key: 'purpose', header: 'Purpose', mobile: 'title', render: (p) => <StatusBadge map={PAYMENT_PURPOSE} value={p.purpose} /> },
                  { key: 'amount', header: 'Amount', align: 'right', render: (p) => <span className={cx('font-semibold tabular-nums', p.purpose === 'refund' && 'text-rose-600')}>{inr(p.amount)}</span> },
                  { key: 'upi_ref', header: 'UPI ref', stop: true, render: (p) => <CopyText value={p.upi_ref} /> },
                  { key: 'status', header: 'Status', render: (p) => <StatusBadge map={PAYMENT_STATUS} value={p.status} /> },
                  { key: 'created_at', header: 'Date', render: (p) => <span className="whitespace-nowrap text-muted">{fmtDateTime(p.created_at)}</span> },
                ]}
              />
            )}
            {tab === 'itineraries' && (
              <DataTable
                sticky={false}
                rows={itineraries}
                empty={<EmptyState emoji="🗺️" title="No published itineraries" />}
                columns={[
                  {
                    key: 'title',
                    header: 'Itinerary',
                    mobile: 'title',
                    render: (i) => (
                      <a href={`/app/itineraries/${i.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-ink hover:text-plum-700">
                        {i.title} <ExternalLink className="size-3 text-muted" />
                      </a>
                    ),
                  },
                  { key: 'price', header: 'Price', align: 'right', render: (i) => (i.price ? inr(i.price) : <span className="text-muted">Free</span>) },
                  { key: 'fork_count', header: 'Forks', align: 'right' },
                  { key: 'sales_count', header: 'Sales', align: 'right' },
                  { key: 'status', header: 'Status', render: (i) => <StatusBadge map={ITINERARY_STATUS} value={i.status} /> },
                ]}
              />
            )}
            {tab === 'sos' && (
              <DataTable
                sticky={false}
                rows={sos}
                empty={<EmptyState emoji="🛟" title="No SOS alerts" description="This traveller has never triggered an SOS." />}
                columns={[
                  { key: 'message', header: 'Message', mobile: 'title', render: (s) => <span className="text-ink">{s.message || <span className="text-muted">No message</span>}</span> },
                  { key: 'status', header: 'Status', render: (s) => <StatusBadge map={SOS_STATUS} value={s.status} /> },
                  {
                    key: 'loc',
                    header: 'Location',
                    stop: true,
                    render: (s) =>
                      s.lat != null ? (
                        <a href={`https://maps.google.com/?q=${s.lat},${s.lng}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-plum-700 hover:underline">
                          Map <ExternalLink className="size-3" />
                        </a>
                      ) : (
                        '—'
                      ),
                  },
                  { key: 'resolution_note', header: 'Resolution', render: (s) => <span className="text-muted">{s.resolution_note || '—'}</span> },
                  { key: 'created_at', header: 'Raised', render: (s) => <span className="whitespace-nowrap text-muted">{fmtDateTime(s.created_at)}</span> },
                ]}
              />
            )}
          </div>
        </div>

        {/* Actions */}
        <aside className="space-y-4">
          <Panel title="Verification" subtitle={VERIFICATION_STATUS[u.verification_status]?.label}>
            {u.verification_status === 'pending' ? (
              <div className="space-y-2">
                <p className="text-[13px] text-muted">{u.name} asked for a verified badge. Check their profile, phone and emergency contact before approving.</p>
                <div className="flex gap-2">
                  <Button variant="success" size="sm" icon={ShieldCheck} loading={busy === 'verify'} onClick={approve} className="flex-1">
                    Approve
                  </Button>
                  <Button variant="danger-soft" size="sm" icon={ShieldX} loading={busy === 'reject'} onClick={reject} className="flex-1">
                    Reject
                  </Button>
                </div>
              </div>
            ) : u.verified ? (
              <div className="space-y-3">
                <p className="text-[13px] text-muted">The verified badge shows on this traveller’s profile, trips and itineraries.</p>
                <Button variant="danger-soft" size="sm" icon={ShieldX} loading={busy === 'revoke'} onClick={revokeVerification} className="w-full">
                  Remove verified badge
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-[13px] text-muted">{u.verification_status === 'rejected' ? 'Their last request was rejected.' : 'No verification request yet.'} You can still verify them directly.</p>
                <Button variant="soft" size="sm" icon={ShieldCheck} loading={busy === 'verify'} onClick={approve} className="w-full">
                  Mark as verified
                </Button>
              </div>
            )}
          </Panel>

          <Panel title="Itenary Plus" subtitle={u.plan === 'plus' ? (u.plan_expires_at ? `Active until ${fmtDate(u.plan_expires_at)}` : 'Active, no expiry') : 'Free plan'}>
            <div className="flex flex-col gap-2">
              <Button variant={u.plan === 'plus' ? 'secondary' : 'accent'} size="sm" icon={Crown} onClick={() => setPlusOpen(true)}>
                {u.plan === 'plus' ? 'Change expiry' : 'Grant Plus'}
              </Button>
              {u.plan === 'plus' && (
                <Button variant="ghost" size="sm" loading={busy === 'plus'} onClick={revokePlus} className="text-rose-600 hover:bg-rose-50 hover:text-rose-700">
                  Revoke Plus
                </Button>
              )}
            </div>
          </Panel>

          <Panel title="Account">
            <div className="flex flex-col gap-2">
              <Button variant={u.status === 'suspended' ? 'success' : 'danger-soft'} size="sm" icon={u.status === 'suspended' ? UserCheck : Ban} loading={busy === 'status'} onClick={toggleSuspend}>
                {u.status === 'suspended' ? 'Reactivate account' : 'Suspend account'}
              </Button>
              <Button variant="secondary" size="sm" icon={ShieldUser} loading={busy === 'role'} disabled={u.role !== 'admin' && !u.email} onClick={toggleAdmin}>
                {u.role === 'admin' ? 'Remove admin access' : 'Make admin'}
              </Button>
              {u.role !== 'admin' && !u.email && <p className="text-[12px] text-muted">Admin access needs an email and password. Use “Create admin” on the Users page for staff accounts.</p>}
            </div>
          </Panel>
        </aside>
      </div>

      <PlusModal open={plusOpen} onClose={() => setPlusOpen(false)} user={u} onSave={(date) => patch({ plan: 'plus', plan_expires_at: date }, `Plus active until ${fmtDate(date)}`, 'plus')} />
      <BookingDrawer id={openBooking} onClose={() => setOpenBooking(null)} onChanged={() => reload()} />
    </div>
  );
}
