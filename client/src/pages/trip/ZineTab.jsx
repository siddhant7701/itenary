import { useState } from 'react';
import clsx from 'clsx';
import { toast } from 'sonner';
import { BookOpen, Download, Pencil, RefreshCw, Share2 } from 'lucide-react';
import { Button, EmptyState, Field, Input, Modal, Skeleton, Textarea } from '../../components/ui';
import { api, assetUrl } from '../../lib/api';
import { useFetch } from '../../lib/hooks';
import { useSocketEvent } from '../../lib/socket';
import { fmtDate, fmtTime, inr, ITEM_TYPES } from '../../lib/format';

const THEMES = {
  marigold: { name: 'Marigold', bg: '#fff4dc', paper: '#fffaf0', accent: '#dd6505', ink: '#4a2308', tape: '#ffc04c' },
  monsoon: { name: 'Monsoon', bg: '#e3eff4', paper: '#f5fbfd', accent: '#0e7490', ink: '#0b3a4a', tape: '#7dd3fc' },
  chai: { name: 'Chai', bg: '#f3e7d8', paper: '#fbf5ec', accent: '#92400e', ink: '#3f2a1d', tape: '#d6b48c' },
  indigo: { name: 'Indigo', bg: '#e9e8fa', paper: '#f7f6ff', accent: '#4338ca', ink: '#1e1b4b', tape: '#a5b4fc' },
  mehendi: { name: 'Mehendi', bg: '#eaf1dc', paper: '#f7faef', accent: '#4d7c0f', ink: '#26341a', tape: '#bef264' },
};

function Tape({ color, className }) {
  return <span className={clsx('absolute h-6 w-20 opacity-80', className)} style={{ background: color, clipPath: 'polygon(4% 0, 100% 6%, 96% 100%, 0 92%)' }} />;
}

function Polaroid({ photo, rotate = 0, theme, className, large }) {
  if (!photo) return null;
  return (
    <figure className={clsx('relative bg-white p-2 pb-7 shadow-[0_12px_28px_-12px_rgb(0_0_0/0.45)]', className)} style={{ transform: `rotate(${rotate}deg)` }}>
      <Tape color={theme.tape} className="-top-3 left-1/2 -translate-x-1/2 rotate-[-4deg]" />
      <img src={assetUrl(photo.url)} alt={photo.caption} className={clsx('w-full object-cover', large ? 'aspect-[4/5]' : 'aspect-square')} loading="lazy" />
      {photo.caption && <figcaption className="absolute inset-x-2 bottom-1.5 truncate text-center font-display text-[13px] font-semibold" style={{ color: theme.ink }}>{photo.caption}</figcaption>}
    </figure>
  );
}

function ZinePage({ page, zine, media, theme, trip, onNote }) {
  const byId = (id) => media.find((m) => m.id === id);
  const rot = (i) => [-3, 2.5, -1.5, 3, -2][i % 5];
  const base = 'relative overflow-hidden rounded-[28px] p-6 sm:p-10 shadow-soft';
  const style = { background: theme.paper, color: theme.ink, backgroundImage: `radial-gradient(${theme.bg} 1.2px, transparent 1.2px)`, backgroundSize: '16px 16px' };

  if (page.type === 'cover') {
    return (
      <section className={base} style={style}>
        <div className="grid items-center gap-8 md:grid-cols-[1.1fr_1fr]">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.3em]" style={{ color: theme.accent }}>itenary.com · Digital Zine</div>
            <h2 className="mt-4 font-display text-5xl font-extrabold leading-[0.95] sm:text-6xl">{zine.title}</h2>
            <p className="mt-3 text-lg font-semibold opacity-80">{zine.subtitle}</p>
            <p className="mt-6 text-sm opacity-70">A trip by {page.members?.join(', ')}</p>
          </div>
          <Polaroid photo={byId(page.photo)} rotate={3} theme={theme} large className="mx-auto w-full max-w-xs" />
        </div>
      </section>
    );
  }
  if (page.type === 'day') {
    const photos = (page.photos || []).map(byId).filter(Boolean);
    return (
      <section className={base} style={style}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-display text-3xl font-extrabold"><span style={{ color: theme.accent }}>Day {page.day_number}.</span> {page.title}</h3>
          <span className="text-sm font-semibold opacity-60">{fmtDate(page.date, 'dddd, D MMMM')}</span>
        </div>
        <div className="mt-6 grid gap-8 md:grid-cols-[1fr_1.2fr]">
          <div>
            <ul className="space-y-2.5">
              {(page.highlights || []).map((h, i) => (
                <li key={i} className="flex items-start gap-2.5 text-[15px]">
                  <span>{ITEM_TYPES[h.type]?.emoji || '•'}</span>
                  <span><b>{h.title}</b>{h.time && <span className="opacity-60"> · {fmtTime(h.time)}</span>}</span>
                </li>
              ))}
            </ul>
            <Textarea defaultValue={page.note} onBlur={(e) => e.target.value !== page.note && onNote(e.target.value)} rows={3} placeholder="Write a memory from this day…" className="mt-5 border-dashed bg-transparent font-display text-[15px] italic" style={{ color: theme.ink, borderColor: theme.tape }} />
            {page.reactions?.length > 0 && <div className="mt-3 text-2xl tracking-widest">{page.reactions.join('')}</div>}
          </div>
          <div className={clsx('grid gap-5', photos.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}>
            {photos.length === 0 && <div className="grid aspect-video place-items-center rounded-2xl border-2 border-dashed text-sm opacity-60" style={{ borderColor: theme.tape }}>Add photos for this day in the Album</div>}
            {photos.map((p, i) => <Polaroid key={p.id} photo={p} rotate={rot(i)} theme={theme} />)}
          </div>
        </div>
      </section>
    );
  }
  if (page.type === 'collage') {
    return (
      <section className={base} style={style}>
        <h3 className="font-display text-3xl font-extrabold">{page.title}</h3>
        <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-3">
          {(page.photos || []).map(byId).filter(Boolean).map((p, i) => <Polaroid key={p.id} photo={p} rotate={rot(i + 1)} theme={theme} />)}
        </div>
      </section>
    );
  }
  if (page.type === 'stats') {
    const stats = [
      ['Days', page.days], ['Stops', page.stops], ['Photos', page.photos], ['Travellers', page.travellers], ['Reactions', page.reactions], ['Spent together', inr(page.spent, { compact: true })],
    ];
    return (
      <section className={base} style={{ ...style, background: theme.accent, color: '#fff', backgroundImage: 'none' }}>
        <h3 className="font-display text-3xl font-extrabold">{trip.destination}, by the numbers</h3>
        <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-3">
          {stats.map(([l, v]) => (
            <div key={l}>
              <div className="font-display text-5xl font-extrabold">{v}</div>
              <div className="mt-1 text-sm font-semibold opacity-80">{l}</div>
            </div>
          ))}
        </div>
      </section>
    );
  }
  return (
    <section className={clsx(base, 'text-center')} style={style}>
      <p className="font-display text-3xl font-extrabold">{page.message}</p>
      <p className="mt-3 text-sm opacity-60">Made together on Itenary</p>
    </section>
  );
}

// ---- Story export (1080×1920 PNG) ----
function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function wrap(ctx, text, maxWidth) {
  const words = String(text).split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

async function renderStory(zine, media, theme, trip, withPhotos = true) {
  const c = document.createElement('canvas');
  c.width = 1080;
  c.height = 1920;
  const g = c.getContext('2d');
  g.fillStyle = theme.bg;
  g.fillRect(0, 0, 1080, 1920);
  g.fillStyle = theme.tape;
  for (let x = 30; x < 1080; x += 48) for (let y = 30; y < 1920; y += 48) g.fillRect(x, y, 3, 3);
  g.fillStyle = theme.accent;
  g.font = '700 30px "Plus Jakarta Sans Variable", sans-serif';
  g.fillText('ITENARY.COM · DIGITAL ZINE', 90, 150);
  g.fillStyle = theme.ink;
  g.font = '800 110px "Bricolage Grotesque Variable", sans-serif';
  const lines = wrap(g, zine.title, 900).slice(0, 3);
  lines.forEach((l, i) => g.fillText(l, 90, 290 + i * 115));
  g.font = '600 42px "Plus Jakarta Sans Variable", sans-serif';
  g.globalAlpha = 0.8;
  g.fillText(zine.subtitle, 90, 290 + lines.length * 115 + 10);
  g.globalAlpha = 1;

  const top = 290 + lines.length * 115 + 90;
  const ranked = [...media].sort((a, b) => b.reactions.length - a.reactions.length).slice(0, 3);
  const slots = [
    { x: 110, y: top, w: 520, r: -4 },
    { x: 480, y: top + 260, w: 480, r: 5 },
    { x: 150, y: top + 640, w: 440, r: -2 },
  ];
  if (withPhotos) {
    const imgs = await Promise.all(ranked.map((m) => loadImage(assetUrl(m.url))));
    imgs.forEach((img, i) => {
      if (!img) return;
      const s = slots[i];
      g.save();
      g.translate(s.x + s.w / 2, s.y + s.w / 2);
      g.rotate((s.r * Math.PI) / 180);
      g.shadowColor = 'rgba(0,0,0,0.3)';
      g.shadowBlur = 40;
      g.fillStyle = '#fff';
      g.fillRect(-s.w / 2 - 18, -s.w / 2 - 18, s.w + 36, s.w + 90);
      g.shadowBlur = 0;
      const scale = Math.max(s.w / img.width, s.w / img.height);
      const sw = s.w / scale;
      const sh = s.w / scale;
      g.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, -s.w / 2, -s.w / 2, s.w, s.w);
      g.fillStyle = theme.tape;
      g.globalAlpha = 0.85;
      g.fillRect(-70, -s.w / 2 - 40, 140, 44);
      g.restore();
    });
  }
  const stats = zine.layout.find((p) => p.type === 'stats');
  if (stats) {
    g.fillStyle = theme.accent;
    g.fillRect(0, 1640, 1080, 280);
    g.fillStyle = '#fff';
    g.font = '800 64px "Bricolage Grotesque Variable", sans-serif';
    const cols = [[stats.days, 'days'], [stats.stops, 'stops'], [stats.photos, 'photos'], [stats.travellers, 'friends']];
    cols.forEach(([v, l], i) => {
      g.fillText(String(v), 90 + i * 245, 1760);
      g.font = '600 30px "Plus Jakarta Sans Variable", sans-serif';
      g.fillText(l, 90 + i * 245, 1805);
      g.font = '800 64px "Bricolage Grotesque Variable", sans-serif';
    });
  }
  return new Promise((resolve, reject) => {
    try {
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('export failed'))), 'image/png');
    } catch (err) {
      reject(err);
    }
  });
}

export default function ZineTab({ ctx }) {
  const { data, tripId } = ctx;
  const { data: res, loading, reload, setData } = useFetch(`/trips/${tripId}/zine`);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [meta, setMeta] = useState({ title: '', subtitle: '' });
  const [exporting, setExporting] = useState(false);
  useSocketEvent('trip:event', (ev) => ev.tripId === tripId && ev.type === 'zine' && reload());

  async function generate(theme) {
    setBusy(true);
    try {
      setData(await api.post(`/trips/${tripId}/zine/generate`, theme ? { theme } : {}));
      toast.success('Zine refreshed with your latest photos ✨');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function patch(body) {
    try {
      setData(await api.patch(`/trips/${tripId}/zine`, body));
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function exportStory() {
    const zine = res.zine;
    const theme = THEMES[zine.theme] || THEMES.marigold;
    setExporting(true);
    try {
      let blob;
      try {
        blob = await renderStory(zine, res.media, theme, data.trip, true);
      } catch {
        blob = await renderStory(zine, res.media, theme, data.trip, false);
        toast('Some photos couldn’t be embedded — exported without them');
      }
      const file = new File([blob], `${zine.title.replace(/[^\w]+/g, '-')}-story.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: zine.title, text: `${zine.title} — made on Itenary` }).catch(() => {});
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        toast.success('Story image downloaded — post it to Instagram Stories!');
      }
    } catch (err) {
      toast.error('Could not export: ' + err.message);
    } finally {
      setExporting(false);
    }
  }

  if (loading) return <Skeleton className="h-96" />;
  if (!res?.zine) {
    return (
      <EmptyState
        icon={BookOpen}
        title="Turn this trip into a Digital Zine"
        description={`We’ll auto-build a scrapbook from your itinerary, ${res?.media?.length || 0} album photos and everyone’s reactions — then you can export it as an Instagram Story.`}
        action={<Button loading={busy} onClick={() => generate()}>Generate our zine</Button>}
      />
    );
  }

  const zine = res.zine;
  const theme = THEMES[zine.theme] || THEMES.marigold;

  return (
    <div className="space-y-5">
      <div className="card flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
        <div className="flex flex-wrap items-center gap-2">
          {Object.entries(THEMES).map(([k, t]) => (
            <button key={k} onClick={() => patch({ theme: k })} className={clsx('flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition', zine.theme === k ? 'border-plum-600 ring-2 ring-plum-100' : 'border-line hover:border-plum-300')}>
              <span className="size-3.5 rounded-full" style={{ background: t.accent }} /> {t.name}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 lg:ml-auto">
          <Button variant="ghost" size="sm" icon={Pencil} onClick={() => { setMeta({ title: zine.title, subtitle: zine.subtitle }); setEditing(true); }}>Edit title</Button>
          <Button variant="secondary" size="sm" icon={RefreshCw} loading={busy} onClick={() => generate()}>Refresh from album</Button>
          <Button size="sm" icon={navigator.canShare ? Share2 : Download} loading={exporting} onClick={exportStory}>Export Story</Button>
        </div>
      </div>
      <div className="rounded-[36px] p-3 sm:p-6" style={{ background: theme.bg }}>
        <div className="mx-auto max-w-4xl space-y-6">
          {zine.layout.map((page, i) => (
            <ZinePage
              key={i}
              page={page}
              zine={zine}
              media={res.media}
              theme={theme}
              trip={data.trip}
              onNote={(note) => patch({ layout: zine.layout.map((p, j) => (j === i ? { ...p, note } : p)) })}
            />
          ))}
        </div>
      </div>
      <Modal open={editing} onClose={() => setEditing(false)} title="Edit zine" size="sm">
        <div className="space-y-4">
          <Field label="Title"><Input value={meta.title} onChange={(e) => setMeta((m) => ({ ...m, title: e.target.value }))} maxLength={80} /></Field>
          <Field label="Subtitle"><Input value={meta.subtitle} onChange={(e) => setMeta((m) => ({ ...m, subtitle: e.target.value }))} maxLength={120} /></Field>
          <Button className="w-full" onClick={() => { patch(meta); setEditing(false); }}>Save</Button>
        </div>
      </Modal>
    </div>
  );
}
