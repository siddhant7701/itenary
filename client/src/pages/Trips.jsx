import { useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Plus, Ticket } from 'lucide-react';
import TripCard from '../components/TripCard';
import { Button, EmptyState, Input, Modal, PageHeader, Segmented, Skeleton, ErrorState } from '../components/ui';
import CreateTripModal from './trip/CreateTripModal';
import { api } from '../lib/api';
import { useFetch } from '../lib/hooks';

export function JoinTripModal({ open, onClose }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  async function join(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.post('/trips/join', { code });
      toast.success(r.joined ? `You joined ${r.trip.name}! 🎒` : `You're already on ${r.trip.name}`);
      onClose();
      navigate(`/app/trips/${r.trip.id}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open={open} onClose={onClose} title="Join a trip" description="Enter the 6-character code from your friend’s invite link." size="sm">
      <form onSubmit={join} className="space-y-4">
        <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} maxLength={8} placeholder="e.g. K7M2QX" className="text-center font-mono text-2xl font-bold uppercase tracking-[0.4em]" />
        <Button type="submit" className="w-full" loading={busy} disabled={code.length < 6}>Join trip</Button>
      </form>
    </Modal>
  );
}

export default function Trips() {
  const { data, loading, error, reload } = useFetch('/trips');
  const [filter, setFilter] = useState('upcoming');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const navigate = useNavigate();

  const trips = data?.trips || [];
  const filtered = trips.filter((t) => (filter === 'upcoming' ? ['planning', 'booked', 'ongoing'].includes(t.status) : filter === 'past' ? ['completed', 'archived'].includes(t.status) : true));

  return (
    <div>
      <PageHeader
        title="My trips"
        subtitle="Every trip you’re planning with your people."
        actions={
          <>
            <Button variant="secondary" icon={Ticket} onClick={() => setJoining(true)}>Join with code</Button>
            <Button icon={Plus} onClick={() => setCreating(true)}>New trip</Button>
          </>
        }
      />
      <Segmented className="mb-5" value={filter} onChange={setFilter} options={[{ value: 'upcoming', label: 'Upcoming' }, { value: 'past', label: 'Past' }, { value: 'all', label: 'All' }]} />
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-64" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          emoji={filter === 'past' ? '📸' : '🧳'}
          title={filter === 'past' ? 'No past trips yet' : 'No trips planned yet'}
          description={filter === 'past' ? 'Completed trips and their digital zines will live here.' : 'Start a trip, invite your crew on WhatsApp, and plan it together in real time.'}
          action={filter !== 'past' && <div className="flex gap-2"><Button icon={Plus} onClick={() => setCreating(true)}>Plan a trip</Button><Button variant="secondary" to="/app/explore">Fork an itinerary</Button></div>}
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => <TripCard key={t.id} trip={t} />)}
        </div>
      )}
      <CreateTripModal open={creating} onClose={() => setCreating(false)} onCreated={(t) => navigate(`/app/trips/${t.id}?welcome=new`)} />
      <JoinTripModal open={joining} onClose={() => setJoining(false)} />
    </div>
  );
}
