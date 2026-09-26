import { useState } from 'react';
import { toast } from 'sonner';
import { Copy, MessageCircle, RefreshCw } from 'lucide-react';
import { Avatar, Button, Divider, Input, Modal } from '../../components/ui';
import { api } from '../../lib/api';
import { fmtRange } from '../../lib/format';

export default function InviteModal({ open, onClose, ctx }) {
  const { data, setData, isOwner } = ctx;
  const { trip } = data;
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const link = trip.invite_code ? `${window.location.origin}/join/${trip.invite_code}` : null;
  const text = `Join me on Itenary to plan “${trip.name}” (${trip.destination}, ${fmtRange(trip.start_date, trip.end_date)}) ✈️ ${link}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Invite link copied');
    } catch {
      toast(link);
    }
  };

  async function addByPhone(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.post(`/trips/${trip.id}/members`, { phone });
      if (r.invited) {
        toast.success('Added to the trip! They’ve been notified.');
        setData((d) => ({ ...d, members: r.members }));
        setPhone('');
      } else {
        toast(r.message, { action: { label: 'Share on WhatsApp', onClick: () => window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank') } });
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function regenerate() {
    const r = await api.post(`/trips/${trip.id}/invite-code`);
    setData((d) => ({ ...d, trip: { ...d.trip, invite_code: r.invite_code } }));
    toast.success('New invite link created — the old one no longer works');
  }

  return (
    <Modal open={open} onClose={onClose} title="Invite your crew" description="Itenary is better together. Everyone you invite can edit the plan, vote and chat." size="md">
      {!isOwner ? (
        <p className="rounded-2xl bg-paper p-4 text-sm text-muted">Only the trip owner can invite people. Ask {data.members.find((m) => m.role === 'owner')?.name || 'the owner'} to share the invite link.</p>
      ) : (
        <div className="space-y-5">
          <div className="rounded-2xl bg-paper p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted">Invite code</div>
            <div className="mt-1 flex items-center justify-between gap-3">
              <span className="font-mono text-3xl font-extrabold tracking-[0.3em] text-plum-800">{trip.invite_code}</span>
              <Button variant="ghost" size="sm" icon={RefreshCw} onClick={regenerate}>New</Button>
            </div>
            <div className="mt-3 truncate rounded-xl bg-white px-3 py-2 font-mono text-xs text-muted">{link}</div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button className="bg-[#1f9d55] hover:bg-[#17864a]" icon={MessageCircle} href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">Share on WhatsApp</Button>
            <Button variant="secondary" icon={Copy} onClick={copy}>Copy link</Button>
          </div>
          <Divider label="or add by mobile number" />
          <form onSubmit={addByPhone} className="flex gap-2">
            <Input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Friend’s WhatsApp number" />
            <Button type="submit" loading={busy} disabled={phone.replace(/\D/g, '').length < 10}>Add</Button>
          </form>
          <div>
            <div className="label">On this trip ({data.members.length})</div>
            <div className="flex flex-wrap gap-2">
              {data.members.map((m) => (
                <span key={m.user_id} className="inline-flex items-center gap-2 rounded-full bg-sand py-1 pl-1 pr-3 text-[13px] font-semibold">
                  <Avatar user={{ ...m, id: m.user_id }} size={24} /> {m.name.split(' ')[0]}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
