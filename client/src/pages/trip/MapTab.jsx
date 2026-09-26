import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { toast } from 'sonner';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import { LocateFixed, Navigation } from 'lucide-react';
import { Card, Toggle } from '../../components/ui';
import { api } from '../../lib/api';
import { getSocket, useSocketEvent } from '../../lib/socket';
import { ITEM_TYPES, colorFor, fmtDay, fmtTime, initials, timeAgo } from '../../lib/format';

const DAY_COLORS = ['#7439a8', '#dd6505', '#0f766e', '#be185d', '#1d4ed8', '#4d7c0f', '#9333ea', '#b45309'];

const pin = (color, label) => L.divIcon({ className: '', html: `<div class="tc-marker" style="background:${color}"><span>${label}</span></div>`, iconSize: [30, 30], iconAnchor: [6, 28], popupAnchor: [9, -26] });
const person = (id, name) => L.divIcon({ className: '', html: `<div class="tc-person" style="background:${colorFor(id)}">${initials(name)}</div>`, iconSize: [34, 34], iconAnchor: [17, 17] });

function FitBounds({ points, fallback }) {
  const map = useMap();
  const key = points.map((p) => p.join(',')).join('|');
  useEffect(() => {
    if (points.length > 1) map.fitBounds(points, { padding: [40, 40], maxZoom: 14 });
    else if (points.length === 1) map.setView(points[0], 13);
    else if (fallback) map.setView(fallback, 11);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}

export default function MapTab({ ctx }) {
  const { data, tripId, user } = ctx;
  const [day, setDay] = useState('all');
  const [locations, setLocations] = useState({});
  const sharing = !!data.me?.share_location;
  const watchId = useRef(null);
  const lastSent = useRef(0);

  useEffect(() => {
    api.get(`/trips/${tripId}/locations`).then((r) => setLocations(Object.fromEntries(r.locations.map((l) => [l.user_id, l])))).catch(() => {});
  }, [tripId]);

  useSocketEvent('trip:event', (ev) => {
    if (ev.tripId !== tripId) return;
    if (ev.type === 'location') setLocations((l) => ({ ...l, [ev.data.user_id]: { ...l[ev.data.user_id], ...ev.data } }));
    if (ev.type === 'location:stop') setLocations((l) => {
      const n = { ...l };
      delete n[ev.data.user_id];
      return n;
    });
  });

  // Broadcast my position while sharing is on
  useEffect(() => {
    if (!sharing || !navigator.geolocation) return;
    watchId.current = navigator.geolocation.watchPosition(
      (p) => {
        if (Date.now() - lastSent.current < 15000) return;
        lastSent.current = Date.now();
        getSocket()?.emit('location:update', { tripId, lat: p.coords.latitude, lng: p.coords.longitude });
      },
      () => toast.error('Could not read your location — check browser permissions'),
      { enableHighAccuracy: true, maximumAge: 30000 },
    );
    return () => navigator.geolocation.clearWatch(watchId.current);
  }, [sharing, tripId]);

  async function toggleShare(on) {
    try {
      await api.patch(`/trips/${tripId}/me`, { share_location: on });
      ctx.setData((d) => ({ ...d, me: { ...d.me, share_location: on } }));
      toast.success(on ? 'Sharing your live location with this trip' : 'Stopped sharing your location');
    } catch (err) {
      toast.error(err.message);
    }
  }

  const days = data.days.filter((d) => day === 'all' || d.id === day);
  const stops = useMemo(() => days.flatMap((d) => d.items.filter((i) => i.lat != null && i.lng != null).map((i, idx) => ({ ...i, dayNumber: d.day_number, idx: idx + 1, color: DAY_COLORS[(d.day_number - 1) % DAY_COLORS.length] }))), [days]);
  const unpinned = days.flatMap((d) => d.items.filter((i) => i.lat == null)).length;
  const people = Object.values(locations).filter((l) => l.lat != null);
  const points = [...stops.map((s) => [s.lat, s.lng]), ...people.map((p) => [p.lat, p.lng])];
  const fallback = data.trip.dest_lat ? [data.trip.dest_lat, data.trip.dest_lng] : [22.5, 79];

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-3">
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          <button onClick={() => setDay('all')} className={clsx('chip shrink-0', day === 'all' && 'chip-active')}>All days</button>
          {data.days.map((d) => (
            <button key={d.id} onClick={() => setDay(d.id)} className={clsx('chip shrink-0', day === d.id && 'chip-active')}>
              <span className="size-2 rounded-full" style={{ background: DAY_COLORS[(d.day_number - 1) % DAY_COLORS.length] }} /> Day {d.day_number}
            </button>
          ))}
        </div>
        <div className="card relative isolate h-[62vh] min-h-[420px] overflow-hidden p-0">
          <MapContainer center={fallback} zoom={11} scrollWheelZoom className="h-full w-full">
            <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <FitBounds points={points} fallback={fallback} />
            {days.map((d) => {
              const line = d.items.filter((i) => i.lat != null).map((i) => [i.lat, i.lng]);
              return line.length > 1 ? <Polyline key={d.id} positions={line} pathOptions={{ color: DAY_COLORS[(d.day_number - 1) % DAY_COLORS.length], weight: 4, opacity: 0.75, dashArray: '8 8' }} /> : null;
            })}
            {stops.map((s) => (
              <Marker key={s.id} position={[s.lat, s.lng]} icon={pin(s.color, day === 'all' ? s.dayNumber : s.idx)}>
                <Popup>
                  <div className="text-[13px]">
                    <div className="font-bold">{ITEM_TYPES[s.type]?.emoji} {s.title}</div>
                    <div className="text-muted">Day {s.dayNumber}{s.start_time ? ` · ${fmtTime(s.start_time)}` : ''}</div>
                    <a className="mt-1 inline-block font-semibold text-plum-700" href={`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`} target="_blank" rel="noreferrer">Directions →</a>
                  </div>
                </Popup>
              </Marker>
            ))}
            {people.map((p) => {
              const m = data.members.find((x) => x.user_id === p.user_id);
              return (
                <Marker key={p.user_id} position={[p.lat, p.lng]} icon={person(p.user_id, m?.name || p.name || '?')} zIndexOffset={1000}>
                  <Popup><b>{p.user_id === user.id ? 'You' : m?.name}</b><br />Live · {timeAgo(p.updated_at)}</Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
        {unpinned > 0 && <p className="text-xs text-muted">{unpinned} stop{unpinned > 1 ? 's have' : ' has'} no location yet — edit them and pick a place suggestion to pin them.</p>}
      </div>
      <div className="space-y-4">
        <Card>
          <div className="flex items-center gap-2 font-bold"><LocateFixed className="size-4 text-marigold-600" /> Live location</div>
          <p className="mt-1 text-[13px] text-muted">Share your location with this trip while you travel. Only trip members can see it; it’s used by SOS too.</p>
          <div className="mt-4"><Toggle checked={sharing} onChange={toggleShare} label="Share my live location" /></div>
          <div className="mt-4 space-y-2">
            {data.members.filter((m) => m.share_location).map((m) => {
              const l = locations[m.user_id];
              return (
                <div key={m.user_id} className="flex items-center justify-between text-[13px]">
                  <span className="font-semibold">{m.user_id === user.id ? 'You' : m.name}</span>
                  <span className="text-muted">{l ? `updated ${timeAgo(l.updated_at)}` : 'waiting for GPS…'}</span>
                </div>
              );
            })}
            {!data.members.some((m) => m.share_location) && <p className="text-[12.5px] text-muted">Nobody is sharing right now.</p>}
          </div>
        </Card>
        <Card padded={false}>
          <div className="px-4 pb-2 pt-4 font-bold">Route</div>
          <div className="scrollbar-thin max-h-[42vh] divide-y divide-line overflow-y-auto">
            {days.map((d) => (
              <div key={d.id} className="px-4 py-3">
                <div className="mb-1.5 flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide" style={{ color: DAY_COLORS[(d.day_number - 1) % DAY_COLORS.length] }}>Day {d.day_number} · {fmtDay(d.date)}</div>
                {d.items.length === 0 ? <p className="text-[12.5px] text-muted">Nothing planned</p> : d.items.map((i) => (
                  <div key={i.id} className="flex items-center gap-2 py-0.5 text-[13px]">
                    <span className="w-14 shrink-0 text-muted">{i.start_time ? fmtTime(i.start_time) : ''}</span>
                    <span className="truncate">{i.title}</span>
                    {i.lat != null && <a href={`https://www.google.com/maps/dir/?api=1&destination=${i.lat},${i.lng}`} target="_blank" rel="noreferrer" className="ml-auto text-plum-600" aria-label="Directions"><Navigation className="size-3.5" /></a>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
