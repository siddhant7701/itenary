import { useState } from 'react';
import clsx from 'clsx';
import { toast } from 'sonner';
import { CalendarDays, MapPin, MessageCircle, Phone, Siren, UserPlus } from 'lucide-react';
import CoverArt from '../../components/CoverArt';
import { Avatar, Badge, Button, Modal, Textarea } from '../../components/ui';
import { api } from '../../lib/api';
import { fmtRange, tripCountdown, tripLength, vibeLabel } from '../../lib/format';

export function SosButton({ tripId, compact = false }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(null);

  function locate() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve({});
      navigator.geolocation.getCurrentPosition((p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }), () => resolve({}), { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 });
    });
  }

  async function send() {
    setBusy(true);
    try {
      const loc = await locate();
      const r = await api.post('/sos', { trip_id: tripId, message, ...loc });
      setSent(r);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function safe() {
    await api.post(`/sos/${sent.alert.id}/cancel`).catch(() => {});
    toast.success('Marked safe. Your group has been told.');
    setSent(null);
    setOpen(false);
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className={clsx('inline-flex items-center gap-1.5 rounded-xl bg-rose-600 font-bold text-white shadow-[0_8px_20px_-10px_rgb(225_29_72/0.9)] transition hover:bg-rose-700 active:scale-95', compact ? 'h-9 px-3 text-xs' : 'h-10 px-3.5 text-sm')}>
        <Siren className="size-4" /> SOS
      </button>
      <Modal open={open} onClose={() => !busy && setOpen(false)} title={sent ? 'Help is on the way' : 'Send an SOS alert?'} size="sm">
        {sent ? (
          <div className="space-y-4">
            <div className="rounded-2xl bg-rose-50 p-4 text-[13.5px] text-rose-900">
              Your group and the Itenary safety desk have your {sent.alert.lat != null ? 'live location' : 'alert (location unavailable)'}. Stay where you are if it’s safe.
            </div>
            <a href="tel:112" className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-rose-600 font-bold text-white hover:bg-rose-700"><Phone className="size-5" /> Call 112 (Emergency)</a>
            {sent.emergency_contact && (
              <a href={`https://wa.me/${sent.emergency_contact.phone.replace(/\D/g, '')}?text=${encodeURIComponent(sent.share_text)}`} target="_blank" rel="noreferrer" className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#1f9d55] font-bold text-white hover:bg-[#17864a]">
                <MessageCircle className="size-5" /> WhatsApp {sent.emergency_contact.name || 'emergency contact'}
              </a>
            )}
            {!sent.emergency_contact && <p className="text-[13px] text-muted">Tip: add an emergency contact in your profile so we can alert them too.</p>}
            <Button variant="secondary" className="w-full" onClick={safe}>I’m safe now — cancel alert</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted">We’ll share your live location with your trip members, your emergency contact and our 24×7 safety desk.</p>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="What’s happening? (optional)" rows={2} maxLength={300} />
            <Button variant="danger" size="lg" className="w-full" loading={busy} onClick={send} icon={Siren}>Send SOS now</Button>
            <a href="tel:112" className="block text-center text-sm font-semibold text-rose-700 hover:underline">Or call 112 directly</a>
          </div>
        )}
      </Modal>
    </>
  );
}

export default function TripHeader({ ctx, onInvite, onToggleChat, chatOpen }) {
  const { data, onlineIds, presence } = ctx;
  const { trip, members } = data;
  const editing = presence.filter((p) => p.editing && p.user_id !== ctx.user.id).map((p) => ({ ...p, member: members.find((m) => m.user_id === p.user_id) })).filter((p) => p.member);
  const onlineCount = members.filter((m) => onlineIds.has(m.user_id)).length;

  return (
    <CoverArt theme={trip.cover_theme} seed={trip.id} className="sm:mt-5 sm:rounded-3xl" rounded={false}>
      <div className="flex min-h-[210px] flex-col justify-between gap-4 bg-gradient-to-t from-plum-950/75 via-plum-950/20 to-transparent p-4 sm:min-h-[230px] sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="dark" className="bg-ink/60 backdrop-blur">{trip.status === 'ongoing' ? '● Happening now' : tripCountdown(trip.start_date, trip.end_date)}</Badge>
            <Badge tone="dark" className="bg-ink/60 backdrop-blur">Vibe {trip.vibe_score} · {vibeLabel(trip.vibe_score)}</Badge>
          </div>
          <SosButton tripId={trip.id} compact />
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-balance font-display text-3xl font-extrabold leading-tight text-white drop-shadow-[0_2px_10px_rgb(0_0_0/0.35)] sm:text-4xl">{trip.name}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13.5px] font-semibold text-white/90">
              <span className="inline-flex items-center gap-1"><MapPin className="size-4" />{trip.destination}</span>
              <span className="inline-flex items-center gap-1"><CalendarDays className="size-4" />{fmtRange(trip.start_date, trip.end_date)} · {tripLength(trip.start_date, trip.end_date)} days</span>
            </div>
            {editing.length > 0 && (
              <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-white/85 px-2.5 py-1 text-[12px] font-semibold text-ink backdrop-blur">
                <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
                {editing.map((e) => e.member.name.split(' ')[0]).join(', ')} {editing.length > 1 ? 'are' : 'is'} editing
                {editing.length === 1 && editing[0].editing?.startsWith('day:') ? ` Day ${data.days.find((d) => d.id === editing[0].editing.slice(4))?.day_number || ''}` : ''}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-2xl bg-white/90 py-1.5 pl-2 pr-3 backdrop-blur">
              <div className="flex -space-x-2">
                {members.slice(0, 5).map((m) => <Avatar key={m.user_id} user={{ ...m, id: m.user_id }} size={30} ring online={onlineIds.has(m.user_id)} />)}
              </div>
              <span className="ml-2 text-[12px] font-semibold text-ink/80">{onlineCount} online</span>
            </div>
            <Button variant="accent" size="sm" icon={UserPlus} onClick={onInvite}>Invite</Button>
            <Button variant="secondary" size="sm" icon={MessageCircle} onClick={onToggleChat} className={clsx('hidden sm:inline-flex', chatOpen && 'border-plum-400 text-plum-800')}>Chat</Button>
          </div>
        </div>
      </div>
    </CoverArt>
  );
}
