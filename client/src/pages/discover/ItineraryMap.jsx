import { useMemo } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Polyline, Popup, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { ITEM_TYPES, fmtTime } from '../../lib/format';

/** Small read-only route map. points: [{lat, lng, title, type, day, n, start_time}] */
export default function ItineraryMap({ points, className }) {
  const bounds = useMemo(() => L.latLngBounds(points.map((p) => [p.lat, p.lng])), [points]);
  const icons = useMemo(
    () =>
      points.map((p) =>
        L.divIcon({
          className: '',
          html: `<div class="tc-marker" style="background:${ITEM_TYPES[p.type]?.color || '#7439a8'}"><span>${p.n}</span></div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 34], // .tc-marker is a pin rotated -45°: its tip sits below centre
          popupAnchor: [0, -32],
        }),
      ),
    [points],
  );
  if (!points.length) return null;
  const single = points.length === 1;

  return (
    <div className={className}>
      <MapContainer
        {...(single ? { center: [points[0].lat, points[0].lng], zoom: 12 } : { bounds, boundsOptions: { padding: [36, 36], maxZoom: 13 } })}
        scrollWheelZoom={false}
        className="size-full"
        attributionControl
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />
        {!single && <Polyline positions={points.map((p) => [p.lat, p.lng])} pathOptions={{ color: '#7439a8', weight: 2.5, opacity: 0.7, dashArray: '6 8' }} />}
        {points.map((p, i) => (
          <Marker key={`${p.day}-${p.n}`} position={[p.lat, p.lng]} icon={icons[i]}>
            <Popup>
              <div className="min-w-36">
                <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: ITEM_TYPES[p.type]?.color }}>
                  Day {p.day}
                  {p.start_time ? ` · ${fmtTime(p.start_time)}` : ''}
                </div>
                <div className="mt-0.5 text-[13.5px] font-semibold text-ink">{p.title}</div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
