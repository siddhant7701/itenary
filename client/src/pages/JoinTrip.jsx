import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import Logo from '../components/Logo';
import CoverArt from '../components/CoverArt';
import { Avatar, Button, ErrorState, PageLoader } from '../components/ui';
import { api } from '../lib/api';
import { useFetch } from '../lib/hooks';
import { fmtRange } from '../lib/format';

export default function JoinTrip() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { data, loading, error } = useFetch(`/trips/invite/${code}`);
  const [busy, setBusy] = useState(false);

  if (loading) return <PageLoader label="Opening invite…" />;
  if (error) return <div className="mx-auto max-w-md p-6"><ErrorState error={error} /></div>;
  if (data.is_member) return <Navigate to={`/app/trips/${data.trip.id}`} replace />;

  async function join() {
    setBusy(true);
    try {
      const r = await api.post('/trips/join', { code });
      toast.success(`Welcome aboard ${r.trip.name}! 🎒`);
      navigate(`/app/trips/${r.trip.id}`, { replace: true });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-paper px-4 py-10">
      <div className="w-full max-w-md">
        <Logo className="mb-6" />
        <div className="card overflow-hidden p-0">
          <CoverArt theme={data.trip.cover_theme} seed={data.trip.id} className="h-44" rounded={false} />
          <div className="p-6 text-center">
            <Avatar user={data.owner} size={52} className="-mt-14 ring-4 ring-white" />
            <p className="mt-3 text-sm text-muted"><span className="font-semibold text-ink">{data.owner?.name}</span> invited you to plan</p>
            <h1 className="mt-1 text-2xl font-extrabold">{data.trip.name}</h1>
            <p className="mt-1 text-sm text-muted">{data.trip.destination} · {fmtRange(data.trip.start_date, data.trip.end_date)} · {data.members} going</p>
            <Button size="lg" className="mt-6 w-full" loading={busy} onClick={join}>Join the trip</Button>
            <Button variant="ghost" className="mt-2 w-full" to="/app">Not now</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
