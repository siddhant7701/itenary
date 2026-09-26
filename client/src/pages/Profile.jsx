import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import clsx from 'clsx';
import { toast } from 'sonner';
import { BadgeCheck, Camera, ExternalLink, LogOut, ShieldCheck, Sparkles, Wallet } from 'lucide-react';
import { Avatar, Badge, Button, Card, Field, Input, PageHeader, Progress, SectionTitle, Textarea, VerifiedBadge } from '../components/ui';
import UpiPaySheet from '../components/UpiPaySheet';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useConfig } from '../lib/config';
import { useFetch } from '../lib/hooks';
import { fmtDate, fmtDateTime, inr } from '../lib/format';

const PURPOSE = { booking: 'Booking', refund: 'Refund', settlement: 'Settle-up', purchase: 'Itinerary unlock', tip: 'Tip', subscription: 'Plus subscription', payout: 'Creator payout' };

export default function Profile() {
  const { user, setUser, logout } = useAuth();
  const { travel_styles, plus_price_monthly } = useConfig();
  const navigate = useNavigate();
  const location = useLocation();
  const usage = useFetch('/me/usage');
  const payments = useFetch('/me/payments');
  const fileRef = useRef(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [verifyNote, setVerifyNote] = useState('');

  useEffect(() => {
    if (user && !form) setForm({ name: user.name || '', bio: user.bio || '', home_city: user.home_city || '', email: user.email || '', upi_id: user.upi_id || '', travel_style: user.travel_style || [], emergency_name: user.emergency_name || '', emergency_phone: user.emergency_phone || '' });
  }, [user, form]);

  useEffect(() => {
    if (location.hash) setTimeout(() => document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
  }, [location.hash]);

  if (!form) return null;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save(e) {
    e?.preventDefault();
    setSaving(true);
    try {
      const body = { ...form };
      for (const k of ['email', 'upi_id', 'emergency_phone', 'emergency_name']) if (!body[k]) delete body[k];
      const { user: u } = await api.patch('/me', body);
      setUser(u);
      toast.success('Profile saved');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar(file) {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const { user: u } = await api('/me/avatar', { method: 'POST', form: fd });
      setUser(u);
      toast.success('Looking good! 📸');
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function requestVerification() {
    try {
      const { user: u } = await api.post('/me/verification', { note: verifyNote });
      setUser(u);
      toast.success('Verification requested — our team usually reviews within 24 hours.');
    } catch (err) {
      toast.error(err.message);
    }
  }

  const u = usage.data;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Profile & settings" />

      <Card className="flex flex-col items-center gap-5 sm:flex-row">
        <div className="relative">
          <Avatar user={user} size={88} />
          <button onClick={() => fileRef.current?.click()} className="absolute -bottom-1 -right-1 grid size-8 place-items-center rounded-full bg-plum-700 text-white ring-4 ring-white hover:bg-plum-800" aria-label="Change photo">
            <Camera className="size-4" />
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => uploadAvatar(e.target.files?.[0])} />
        </div>
        <div className="flex-1 text-center sm:text-left">
          <div className="flex items-center justify-center gap-1.5 text-2xl font-extrabold sm:justify-start">{user.name} {user.verified && <VerifiedBadge className="size-5" />}</div>
          <div className="mt-0.5 text-sm text-muted">{user.phone} · Joined {fmtDate(user.created_at, 'MMM YYYY')}</div>
          <div className="mt-2 flex flex-wrap justify-center gap-1.5 sm:justify-start">
            {user.plan === 'plus' ? <Badge tone="marigold" icon={Sparkles}>Plus member</Badge> : <Badge>Free plan</Badge>}
            {user.verified ? <Badge tone="blue" icon={BadgeCheck}>Verified traveller</Badge> : user.verification_status === 'pending' ? <Badge tone="marigold">Verification pending</Badge> : null}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Button variant="secondary" size="sm" icon={ExternalLink} to={`/app/u/${user.id}`}>Public profile</Button>
          <Button variant="ghost" size="sm" icon={LogOut} onClick={() => { logout(); navigate('/'); }}>Sign out</Button>
        </div>
      </Card>

      <Card>
        <SectionTitle title="About you" />
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <Field label="Name"><Input value={form.name} onChange={set('name')} maxLength={60} required /></Field>
          <Field label="Home city"><Input value={form.home_city} onChange={set('home_city')} maxLength={60} /></Field>
          <Field label="Bio" className="sm:col-span-2"><Textarea value={form.bio} onChange={set('bio')} maxLength={300} placeholder="Weekend trekker, full-time foodie…" /></Field>
          <Field label="Email" hint="Optional — for receipts"><Input type="email" value={form.email} onChange={set('email')} /></Field>
          <Field label="UPI ID" hint="Where creator payouts and settle-ups are sent"><Input value={form.upi_id} onChange={set('upi_id')} placeholder="name@okhdfcbank" /></Field>
          <div className="sm:col-span-2">
            <div className="label">Travel style</div>
            <div className="flex flex-wrap gap-1.5">
              {travel_styles.map((s) => {
                const on = form.travel_style.includes(s);
                return <button key={s} type="button" onClick={() => setForm((f) => ({ ...f, travel_style: on ? f.travel_style.filter((x) => x !== s) : [...f.travel_style, s].slice(0, 6) }))} className={clsx('chip', on && 'chip-active')}>{s}</button>;
              })}
            </div>
          </div>
          <div className="sm:col-span-2 flex justify-end"><Button type="submit" loading={saving}>Save changes</Button></div>
        </form>
      </Card>

      <Card id="safety">
        <SectionTitle title="Safety" subtitle="Used by the SOS button in every trip." />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Emergency contact name"><Input value={form.emergency_name} onChange={set('emergency_name')} /></Field>
          <Field label="Emergency contact mobile"><Input inputMode="tel" value={form.emergency_phone} onChange={set('emergency_phone')} placeholder="98450 00000" /></Field>
        </div>
        <div className="mt-3 flex justify-end"><Button variant="secondary" loading={saving} onClick={save}>Save contact</Button></div>
        <div className="mt-5 rounded-2xl bg-paper p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-sky-600" />
            <div className="flex-1">
              <div className="font-bold">Verified Traveller badge</div>
              <p className="mt-0.5 text-[13px] text-muted">Verified badges build trust in group trips and on the itineraries you publish. Requires an emergency contact.</p>
              {user.verified ? (
                <Badge tone="blue" className="mt-3" icon={BadgeCheck}>You’re verified</Badge>
              ) : user.verification_status === 'pending' ? (
                <Badge tone="marigold" className="mt-3">Under review</Badge>
              ) : (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <Input value={verifyNote} onChange={(e) => setVerifyNote(e.target.value)} placeholder="Anything we should know? (optional)" />
                  <Button variant="soft" onClick={requestVerification} disabled={!user.emergency_phone}>Request verification</Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Card id="plus" className={clsx(user.plan === 'plus' ? '' : 'bg-gradient-to-br from-plum-800 to-plum-950 text-white')}>
        {user.plan === 'plus' ? (
          <div className="flex items-center gap-4">
            <div className="grid size-12 place-items-center rounded-2xl bg-marigold-50 text-marigold-600"><Sparkles className="size-6" /></div>
            <div className="flex-1">
              <div className="text-lg font-bold">You’re on Itenary Plus</div>
              <div className="text-sm text-muted">Unlimited Yatri concierge · renews {user.plan_expires_at ? fmtDate(user.plan_expires_at) : 'monthly'}</div>
            </div>
            <Button variant="secondary" onClick={() => setUpgrading(true)}>Extend</Button>
          </div>
        ) : (
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm font-bold text-marigold-300"><Sparkles className="size-4" /> Itenary Plus</div>
              <div className="mt-1 font-display text-2xl font-extrabold">Unlimited concierge for {inr(plus_price_monthly)}/month</div>
              {u && u.concierge_limit != null && (
                <div className="mt-3 max-w-sm">
                  <div className="mb-1 flex justify-between text-xs text-white/70"><span>Today’s free Yatri requests</span><span>{u.concierge_used}/{u.concierge_limit}</span></div>
                  <Progress value={u.concierge_used} max={u.concierge_limit} tone="marigold" className="bg-white/15" />
                </div>
              )}
            </div>
            <Button variant="accent" size="lg" onClick={() => setUpgrading(true)}>Upgrade</Button>
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle title="Payment history" subtitle="All UPI transactions on your account" />
        {!payments.data?.payments?.length ? (
          <p className="py-6 text-center text-sm text-muted">No payments yet.</p>
        ) : (
          <div className="divide-y divide-line">
            {payments.data.payments.slice(0, 25).map((p) => {
              const incoming = p.payee_user_id === user.id || p.purpose === 'refund';
              return (
                <div key={p.id} className="flex items-center gap-3 py-3">
                  <span className={clsx('grid size-9 place-items-center rounded-xl', incoming ? 'bg-emerald-50 text-emerald-700' : 'bg-sand text-ink/70')}><Wallet className="size-4" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-semibold">{PURPOSE[p.purpose] || p.purpose}</div>
                    <div className="text-xs text-muted">{fmtDateTime(p.created_at)} · UPI {p.upi_ref}</div>
                  </div>
                  <div className={clsx('text-sm font-bold', incoming && 'text-emerald-700')}>{incoming ? '+' : '−'}{inr(p.amount)}</div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <UpiPaySheet
        open={upgrading}
        onClose={() => setUpgrading(false)}
        amount={plus_price_monthly}
        title="Itenary Plus"
        lines={[{ label: 'Plan', value: 'Plus · 1 month' }, { label: 'Includes', value: 'Unlimited Yatri' }]}
        onPay={(auth) => api.post('/me/upgrade', { ...auth, months: 1 })}
        onDone={(r) => {
          if (r?.user) setUser(r.user);
          usage.reload();
          payments.reload();
          toast.success('Welcome to Plus ✨');
        }}
      />
    </div>
  );
}
