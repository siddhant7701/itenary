import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import clsx from 'clsx';
import { ArrowLeft, ArrowRight, Heart, ShieldCheck, Users, User, Baby } from 'lucide-react';
import Logo from '../components/Logo';
import { Button, Field, Input, Progress } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useConfig } from '../lib/config';
import CreateTripModal from './trip/CreateTripModal';

const COMPANIONS = [
  { id: 'partner', label: 'My partner', icon: Heart, hint: 'Couple trips, anniversaries, honeymoons' },
  { id: 'friends', label: 'My friends', icon: Users, hint: 'Group trips, reunions, bachelor/ette' },
  { id: 'family', label: 'My family', icon: Baby, hint: 'Parents, kids, the whole khandaan' },
  { id: 'solo', label: 'Mostly solo', icon: User, hint: 'I’ll invite people as I go' },
];

export default function Onboarding() {
  const { user, setUser } = useAuth();
  const { travel_styles } = useConfig();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/app';
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: user?.name || '',
    home_city: user?.home_city || '',
    travel_style: user?.travel_style || [],
    emergency_name: user?.emergency_name || '',
    emergency_phone: user?.emergency_phone || '',
  });
  const [companion, setCompanion] = useState('friends');
  const [showCreate, setShowCreate] = useState(false);
  const [code, setCode] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save(extra = {}) {
    setBusy(true);
    try {
      const body = { ...form, ...extra };
      if (!body.emergency_phone) delete body.emergency_phone;
      if (!body.emergency_name) delete body.emergency_name;
      const { user: u } = await api.patch('/me', body);
      setUser(u);
      return u;
    } catch (err) {
      toast.error(err.message);
      throw err;
    } finally {
      setBusy(false);
    }
  }

  const steps = ['About you', 'Travel style', 'Safety', 'Your crew'];
  const canNext = step === 0 ? form.name.trim().length >= 2 : true;

  async function goNext() {
    if (step < 3) {
      if (step === 2) await save();
      setStep(step + 1);
    }
  }

  async function finish(to) {
    await save({ onboarded: true });
    navigate(to, { replace: true });
  }

  async function join() {
    try {
      await save({ onboarded: true });
      const r = await api.post('/trips/join', { code });
      toast.success(`You joined ${r.trip.name}!`);
      navigate(`/app/trips/${r.trip.id}`, { replace: true });
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="min-h-dvh bg-paper">
      <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-5 py-6">
        <div className="flex items-center justify-between">
          <Logo />
          <span className="text-xs font-semibold text-muted">Step {step + 1} of 4</span>
        </div>
        <Progress value={step + 1} max={4} className="mt-5" tone="marigold" />
        <div className="flex-1 py-10">
          <div key={step} className="animate-fade-up">
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-marigold-600">{steps[step]}</div>
            {step === 0 && (
              <>
                <h1 className="mt-2 text-3xl font-extrabold">Let’s set up your traveller profile</h1>
                <p className="mt-2 text-muted">Your crew will see this when you plan together.</p>
                <div className="mt-8 space-y-4">
                  <Field label="Your name"><Input autoFocus value={form.name} onChange={set('name')} placeholder="e.g. Priya Iyer" maxLength={60} /></Field>
                  <Field label="Home city" hint="Helps Yatri suggest departures and nearby weekend trips"><Input value={form.home_city} onChange={set('home_city')} placeholder="e.g. Bengaluru" maxLength={60} /></Field>
                </div>
              </>
            )}
            {step === 1 && (
              <>
                <h1 className="mt-2 text-3xl font-extrabold">What’s your travel vibe?</h1>
                <p className="mt-2 text-muted">Pick up to 6. We use these to personalise your feed.</p>
                <div className="mt-8 flex flex-wrap gap-2">
                  {travel_styles.map((s) => {
                    const on = form.travel_style.includes(s);
                    return (
                      <button key={s} type="button" onClick={() => setForm((f) => ({ ...f, travel_style: on ? f.travel_style.filter((x) => x !== s) : [...f.travel_style, s].slice(0, 6) }))} className={clsx('chip px-4 py-2 text-sm', on && 'chip-active')}>
                        {s}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            {step === 2 && (
              <>
                <h1 className="mt-2 text-3xl font-extrabold">Who should we alert in an emergency?</h1>
                <p className="mt-2 text-muted">If you ever press SOS, we’ll share your live location with this person and our safety desk. You can skip this for now.</p>
                <div className="mt-8 space-y-4">
                  <Field label="Contact name"><Input value={form.emergency_name} onChange={set('emergency_name')} placeholder="e.g. Amma" /></Field>
                  <Field label="Contact mobile"><Input inputMode="tel" value={form.emergency_phone} onChange={set('emergency_phone')} placeholder="98450 00000" /></Field>
                </div>
                <div className="mt-6 flex items-start gap-3 rounded-2xl bg-plum-50 p-4 text-[13px] text-plum-900">
                  <ShieldCheck className="mt-0.5 size-5 shrink-0" />
                  Adding an emergency contact is required for the Verified Traveller badge — especially recommended for solo female travellers.
                </div>
              </>
            )}
            {step === 3 && (
              <>
                <h1 className="mt-2 text-3xl font-extrabold">Who do you usually travel with?</h1>
                <p className="mt-2 text-muted">Itenary is built for planning together. Start a trip and invite them — or join one you were sent.</p>
                <div className="mt-6 grid grid-cols-2 gap-3">
                  {COMPANIONS.map(({ id, label, icon: Icon, hint }) => (
                    <button key={id} type="button" onClick={() => setCompanion(id)} className={clsx('rounded-2xl border p-4 text-left transition', companion === id ? 'border-plum-600 bg-plum-50 ring-4 ring-plum-100' : 'border-line bg-white hover:border-plum-300')}>
                      <Icon className={clsx('size-6', companion === id ? 'text-plum-700' : 'text-muted')} />
                      <div className="mt-3 font-bold">{label}</div>
                      <div className="mt-0.5 text-xs text-muted">{hint}</div>
                    </button>
                  ))}
                </div>
                <div className="mt-8 space-y-3">
                  <Button size="lg" className="w-full" onClick={() => setShowCreate(true)} loading={busy}>Plan a new trip with {companion === 'solo' ? 'friends later' : COMPANIONS.find((c) => c.id === companion).label.toLowerCase()}</Button>
                  <div className="flex gap-2">
                    <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Have an invite code?" maxLength={8} className="font-mono uppercase tracking-widest" />
                    <Button variant="secondary" onClick={join} disabled={code.length < 6}>Join</Button>
                  </div>
                  <button onClick={() => finish(next === '/app' ? '/app/explore' : next)} className="w-full py-2 text-sm font-semibold text-muted hover:text-plum-700">Skip — just let me explore itineraries</button>
                </div>
              </>
            )}
          </div>
        </div>
        {step < 3 && (
          <div className="flex items-center justify-between gap-3 pb-4">
            <Button variant="ghost" icon={ArrowLeft} onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>Back</Button>
            <div className="flex gap-2">
              {step === 2 && <Button variant="ghost" onClick={() => { setForm((f) => ({ ...f, emergency_name: '', emergency_phone: '' })); setStep(3); }}>Skip</Button>}
              <Button iconRight={ArrowRight} onClick={goNext} disabled={!canNext} loading={busy}>Continue</Button>
            </div>
          </div>
        )}
      </div>
      <CreateTripModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={async (trip) => {
          await save({ onboarded: true }).catch(() => {});
          navigate(`/app/trips/${trip.id}?welcome=new`, { replace: true });
        }}
      />
    </div>
  );
}
