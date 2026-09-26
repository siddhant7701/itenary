import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { ArrowLeft, MessageCircle, ShieldCheck, Sparkles } from 'lucide-react';
import Logo from '../components/Logo';
import CoverArt from '../components/CoverArt';
import { Avatar, Button, VerifiedBadge } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useConfig } from '../lib/config';

function OtpInput({ value, onChange, onComplete }) {
  const refs = useRef([]);
  const digits = value.padEnd(6, ' ').slice(0, 6).split('');
  const set = (i, ch) => {
    const arr = value.padEnd(6, ' ').slice(0, 6).split('');
    arr[i] = ch;
    const next = arr.join('').replace(/\s+$/, '');
    onChange(next.replace(/\s/g, ''));
    if (next.replace(/\s/g, '').length === 6) onComplete?.(next.replace(/\s/g, ''));
  };
  return (
    <div className="flex justify-between gap-2" onPaste={(e) => {
      const txt = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
      if (txt) {
        e.preventDefault();
        onChange(txt);
        if (txt.length === 6) onComplete?.(txt);
      }
    }}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={d.trim()}
          onChange={(e) => {
            const ch = e.target.value.replace(/\D/g, '').slice(-1);
            if (!ch) return;
            set(i, ch);
            refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace') {
              e.preventDefault();
              set(i, ' ');
              if (!d.trim()) refs.current[i - 1]?.focus();
            }
          }}
          className="input h-14 w-12 p-0 text-center font-display text-2xl font-bold sm:w-14"
          aria-label={`Digit ${i + 1}`}
        />
      ))}
    </div>
  );
}

export default function Login() {
  const { user, login } = useAuth();
  const config = useConfig();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = params.get('next') || '/app';
  const [step, setStep] = useState('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [demoCode, setDemoCode] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [demo, setDemo] = useState([]);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    api.get('/auth/demo-accounts').then((d) => setDemo(d.accounts || [])).catch(() => {});
  }, []);
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  if (user) return <Navigate to={user.onboarded ? next : `/onboarding?next=${encodeURIComponent(next)}`} replace />;

  const done = (res) => {
    login(res.token, res.user);
    toast.success(res.is_new ? 'Welcome to Itenary! 🎉' : `Welcome back, ${res.user.name?.split(' ')[0] || 'traveller'}!`);
    navigate(res.user.onboarded ? next : `/onboarding?next=${encodeURIComponent(next)}`, { replace: true });
  };

  async function sendCode(e) {
    e?.preventDefault();
    setError('');
    setBusy(true);
    try {
      const r = await api.post('/auth/whatsapp/otp', { phone });
      setPhone(r.phone);
      setDemoCode(r.demo_code || null);
      setCode('');
      setStep('code');
      setResendIn(30);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function verify(c = code) {
    if (c.length !== 6) return;
    setError('');
    setBusy(true);
    try {
      done(await api.post('/auth/whatsapp/verify', { phone, code: c }));
    } catch (err) {
      setError(err.message);
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  async function demoLogin(id) {
    setBusy(true);
    try {
      done(await api.post('/auth/demo-login', { user_id: id }));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <Logo />
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          {step === 'phone' ? (
            <form onSubmit={sendCode} className="animate-fade-up">
              <h1 className="text-4xl font-extrabold leading-tight">Namaste! 👋</h1>
              <p className="mt-2 text-[15px] text-muted">Sign in or create your account with your WhatsApp number. We’ll send you a 6-digit code.</p>
              <label className="label mt-8" htmlFor="phone">WhatsApp number</label>
              <div className="flex gap-2">
                <div className="input flex w-20 items-center justify-center font-semibold text-ink/70">🇮🇳 +91</div>
                <input id="phone" autoFocus inputMode="tel" autoComplete="tel-national" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98765 43210" className="input text-lg font-semibold tracking-wide" />
              </div>
              {error && <p className="mt-3 text-sm font-medium text-rose-600">{error}</p>}
              <Button type="submit" size="lg" className="mt-5 w-full bg-[#1f9d55] hover:bg-[#17864a]" loading={busy} icon={MessageCircle} disabled={phone.replace(/\D/g, '').length < 10}>
                Continue with WhatsApp
              </Button>
              <p className="mt-4 flex items-center gap-1.5 text-xs text-muted"><ShieldCheck className="size-3.5" /> We never share your number. By continuing you agree to our terms & DPDP-compliant privacy policy.</p>

              {config.demo_mode && demo.length > 0 && (
                <div className="mt-10">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted"><Sparkles className="size-3.5 text-marigold-500" /> Or try a demo traveller</div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {demo.map((a) => (
                      <button key={a.id} type="button" disabled={busy} onClick={() => demoLogin(a.id)} className="flex items-center gap-2.5 rounded-xl border border-line bg-white p-2.5 text-left transition hover:border-plum-300 hover:shadow-soft">
                        <Avatar user={a} size={32} />
                        <span className="min-w-0">
                          <span className="flex items-center gap-1 truncate text-[13px] font-semibold">{a.name.split(' ')[0]} {a.verified && <VerifiedBadge className="size-3.5" />}</span>
                          <span className="block truncate text-[11px] text-muted">{a.home_city}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-[11.5px] text-muted">Tip: sign in as Aarav in one browser and Priya in another to see real-time collaboration.</p>
                </div>
              )}
            </form>
          ) : (
            <div className="animate-fade-up">
              <button onClick={() => setStep('phone')} className="mb-6 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-plum-700"><ArrowLeft className="size-4" /> Change number</button>
              <h1 className="text-3xl font-extrabold">Enter the code</h1>
              <p className="mt-2 text-[15px] text-muted">Sent on WhatsApp to <span className="font-semibold text-ink">{phone}</span></p>
              {demoCode && (
                <button type="button" onClick={() => { setCode(demoCode); verify(demoCode); }} className="mt-5 w-full rounded-2xl border border-dashed border-marigold-300 bg-marigold-50 px-4 py-3 text-left text-[13px] text-marigold-900">
                  <span className="font-bold">Demo mode:</span> WhatsApp isn’t connected yet, so your code is <span className="font-mono text-base font-bold tracking-widest">{demoCode}</span> — tap to fill.
                </button>
              )}
              <div className="mt-6">
                <OtpInput value={code} onChange={setCode} onComplete={verify} />
              </div>
              {error && <p className="mt-3 text-sm font-medium text-rose-600">{error}</p>}
              <Button size="lg" className="mt-6 w-full" loading={busy} disabled={code.length !== 6} onClick={() => verify()}>Verify & continue</Button>
              <div className="mt-4 text-center text-sm text-muted">
                {resendIn > 0 ? `Resend code in ${resendIn}s` : <button onClick={sendCode} className="font-semibold text-plum-700 hover:underline">Resend code</button>}
              </div>
            </div>
          )}
        </div>
      </div>
      <CoverArt theme="mountains" seed="login-hills" rounded={false} className="hidden lg:block">
        <div className="flex h-full flex-col justify-end p-12">
          <div className="max-w-md rounded-3xl bg-white/85 p-6 shadow-lift backdrop-blur">
            <p className="font-display text-2xl font-bold leading-snug">“We planned Goa for four people in one evening. Yatri booked the cabs while we argued about beaches.”</p>
            <p className="mt-3 text-sm font-semibold text-muted">— Kabir, Chandigarh · Goa with the Gang</p>
          </div>
        </div>
      </CoverArt>
    </div>
  );
}
