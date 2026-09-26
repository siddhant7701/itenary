import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Lock, ShieldCheck } from 'lucide-react';
import clsx from 'clsx';
import { Button, Modal } from './ui';
import { UPI_APPS, inr } from '../lib/format';

/**
 * Confirm-before-pay sheet (sandbox UPI). Every money-moving action in the app goes through this.
 * Props: open, onClose, amount, title, lines [{label, value}], note, onPay({upi_app, pin}) → Promise, onDone(result)
 */
export default function UpiPaySheet({ open, onClose, amount, title = 'Review & pay', lines = [], note, onPay, onDone, payLabel }) {
  const [app, setApp] = useState('gpay');
  const [pin, setPin] = useState('');
  const [step, setStep] = useState('review'); // review → pin → processing → done
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const pinRef = useRef(null);

  useEffect(() => {
    if (open) {
      setStep('review');
      setPin('');
      setError('');
      setResult(null);
    }
  }, [open]);

  useEffect(() => {
    if (step === 'pin') setTimeout(() => pinRef.current?.focus(), 50);
  }, [step]);

  async function pay() {
    if (!/^\d{4}(\d{2})?$/.test(pin)) {
      setError('Enter your 4 or 6 digit UPI PIN');
      return;
    }
    setError('');
    setStep('processing');
    try {
      const [res] = await Promise.all([onPay({ upi_app: app, pin }), new Promise((r) => setTimeout(r, 1100))]);
      setResult(res);
      setStep('done');
    } catch (err) {
      setError(err.message || 'Payment failed');
      setStep('review');
    }
  }

  const close = () => {
    if (step === 'processing') return;
    if (step === 'done') onDone?.(result);
    onClose();
  };

  return (
    <Modal open={open} onClose={close} title={step === 'done' ? null : title} size="sm" hideClose={step === 'processing'}>
      {step === 'done' ? (
        <div className="flex flex-col items-center py-6 text-center">
          <div className="mb-4 grid size-16 place-items-center rounded-full bg-emerald-50 animate-pop">
            <CheckCircle2 className="size-9 text-emerald-600" />
          </div>
          <div className="font-display text-3xl font-extrabold">{inr(amount)}</div>
          <p className="mt-1 text-sm font-semibold text-emerald-700">Payment successful</p>
          {result?.payment?.upi_ref && <p className="mt-2 text-xs text-muted">UPI ref {result.payment.upi_ref}</p>}
          <Button className="mt-6 w-full" onClick={close}>Done</Button>
        </div>
      ) : step === 'processing' ? (
        <div className="flex flex-col items-center py-10 text-center">
          <div className="relative mb-5 size-16">
            <span className="absolute inset-0 animate-ping rounded-full bg-plum-200" />
            <span className="relative grid size-16 place-items-center rounded-full bg-plum-700 text-white">
              <Lock className="size-7" />
            </span>
          </div>
          <p className="font-semibold">Authorising with {UPI_APPS[app].label}…</p>
          <p className="mt-1 text-sm text-muted">Please don’t close this window</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl bg-gradient-to-br from-plum-800 to-plum-950 p-5 text-white">
            <div className="text-xs font-semibold uppercase tracking-wider text-white/60">You pay</div>
            <div className="mt-1 font-display text-4xl font-extrabold">{inr(amount)}</div>
            {lines.length > 0 && (
              <div className="mt-4 space-y-1.5 border-t border-white/15 pt-3 text-[13px]">
                {lines.map((l) => (
                  <div key={l.label} className="flex justify-between gap-3">
                    <span className="text-white/70">{l.label}</span>
                    <span className="text-right font-semibold">{l.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {note && <p className="rounded-xl bg-marigold-50 px-3.5 py-2.5 text-[13px] text-marigold-900">{note}</p>}

          {step === 'review' ? (
            <>
              <div>
                <div className="label">Pay with UPI</div>
                <div className="grid grid-cols-2 gap-2">
                  {['gpay', 'phonepe', 'paytm', 'bhim'].map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setApp(k)}
                      className={clsx('flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition', app === k ? 'border-plum-600 bg-plum-50 text-plum-800 ring-2 ring-plum-100' : 'border-line hover:border-plum-300')}
                    >
                      <span className="size-2.5 rounded-full" style={{ background: UPI_APPS[k].color }} />
                      {UPI_APPS[k].label}
                    </button>
                  ))}
                </div>
              </div>
              {error && <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-[13px] font-medium text-rose-700">{error}</p>}
              <Button className="w-full" size="lg" onClick={() => setStep('pin')}>
                {payLabel || `Proceed to pay ${inr(amount)}`}
              </Button>
            </>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                pay();
              }}
              className="space-y-3"
            >
              <label className="label" htmlFor="upi-pin">Enter UPI PIN for {UPI_APPS[app].label}</label>
              <input
                id="upi-pin"
                ref={pinRef}
                inputMode="numeric"
                autoComplete="off"
                type="password"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                className="input text-center font-mono text-2xl tracking-[0.6em]"
                placeholder="••••"
              />
              {error && <p className="text-[13px] font-medium text-rose-600">{error}</p>}
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setStep('review')} className="flex-1">Back</Button>
                <Button type="submit" className="flex-[2]">Pay {inr(amount)}</Button>
              </div>
            </form>
          )}
          <p className="flex items-center justify-center gap-1.5 text-center text-[11.5px] text-muted">
            <ShieldCheck className="size-3.5" /> Sandbox UPI — no real money moves. Any 4 or 6 digit PIN works.
          </p>
        </div>
      )}
    </Modal>
  );
}
