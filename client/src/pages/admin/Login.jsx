import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { ArrowRight, Eye, EyeOff, KeyRound, Lock, Mail, ShieldCheck, Siren, Ticket } from 'lucide-react';
import Logo from '../../components/Logo';
import { Button, Field, Input, PageLoader } from '../../components/ui';
import { adminApi } from '../../lib/api';
import { useAdminAuth } from '../../lib/auth';

const DEMO = { email: 'admin@itenary.com', password: 'Admin@12345' };

export default function AdminLogin() {
  const { user, loading, login } = useAdminAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const next = params.get('next');
  const dest = next && next.startsWith('/admin') && !next.startsWith('/admin/login') ? next : '/admin';

  if (loading) return <PageLoader />;
  if (user) return <Navigate to={dest} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) return setError('Enter your admin email and password.');
    setBusy(true);
    try {
      const { token, user: u } = await adminApi.post('/auth/admin/login', { email: email.trim(), password });
      login(token, u);
      toast.success(`Welcome back, ${u.name?.split(' ')[0] || 'admin'}`);
      navigate(dest, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-dvh bg-paper lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-plum-900 via-plum-950 to-[#140820] p-12 text-white lg:flex lg:flex-col">
        <div className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-marigold-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 size-[28rem] rounded-full bg-plum-500/20 blur-3xl" />
        <div className="relative flex items-center gap-2.5">
          <Logo to="/" light />
          <span className="rounded-md bg-marigold-400 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-plum-950">Admin</span>
        </div>
        <div className="relative mt-auto max-w-md">
          <h1 className="text-[40px] font-extrabold leading-[1.05]">Mission control for every trip on Itenary.</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-white/70">Resolve bookings the AI concierge couldn’t finish, respond to SOS alerts in real time, and keep the creator marketplace healthy.</p>
          <ul className="mt-8 space-y-3 text-[14px] text-white/85">
            {[
              [Siren, 'Live SOS alerts with location and emergency contacts'],
              [Ticket, 'Human-in-the-loop queue for failed provider bookings'],
              [ShieldCheck, 'Full audit trail of every AI and admin action'],
            ].map(([Icon, text]) => (
              <li key={text} className="flex items-center gap-3">
                <span className="grid size-8 place-items-center rounded-lg bg-white/10 text-marigold-300">
                  <Icon className="size-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative mt-12 text-xs text-white/40">Authorised Itenary staff only. All actions are logged.</p>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <Logo to="/" />
            <span className="rounded-md bg-plum-700 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-white">Admin</span>
          </div>
          <div className="mb-1 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.14em] text-marigold-600">
            <Lock className="size-3.5" /> Admin console
          </div>
          <h2 className="text-[30px] font-extrabold leading-tight text-ink">Sign in</h2>
          <p className="mt-1 text-[15px] text-muted">Use your staff email and password.</p>

          <form onSubmit={submit} className="mt-7 space-y-4" noValidate>
            <Field label="Email" htmlFor="admin-email">
              <Input id="admin-email" type="email" icon={Mail} autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@itenary.com" autoFocus />
            </Field>
            <Field label="Password" htmlFor="admin-password">
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
                <input
                  id="admin-password"
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="input pl-10 pr-11"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted hover:bg-sand hover:text-ink" aria-label={show ? 'Hide password' : 'Show password'}>
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </Field>
            {error && <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-[13px] font-medium text-rose-700 ring-1 ring-rose-100">{error}</p>}
            <Button type="submit" size="lg" className="w-full" loading={busy} iconRight={ArrowRight}>
              Sign in to admin
            </Button>
          </form>

          <div className="mt-6 rounded-2xl border border-dashed border-marigold-300 bg-marigold-50/70 p-4">
            <div className="flex items-center gap-2 text-[13px] font-bold text-marigold-900">
              <KeyRound className="size-4" /> Demo credentials
            </div>
            <div className="mt-2 space-y-0.5 font-mono text-[12.5px] text-ink/80">
              <div>{DEMO.email}</div>
              <div>{DEMO.password}</div>
            </div>
            <p className="mt-2 text-[12px] text-marigold-900/80">Change this password in Settings → Account right after your first sign-in.</p>
            <Button
              size="xs"
              variant="secondary"
              className="mt-3"
              onClick={() => {
                setEmail(DEMO.email);
                setPassword(DEMO.password);
                setError('');
              }}
            >
              Fill demo credentials
            </Button>
          </div>

          <p className="mt-8 text-center text-[13px] text-muted">
            Looking for the traveller app?{' '}
            <a href="/app" className="font-semibold text-plum-700 hover:underline">
              Open Itenary
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
