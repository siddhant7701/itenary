import { useRef, useState } from 'react';
import clsx from 'clsx';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Download, ImagePlus, Trash2, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Avatar, Button, EmptyState, Input, Select, Skeleton, useConfirm } from '../../components/ui';
import { api, assetUrl } from '../../lib/api';
import { useFetch } from '../../lib/hooks';
import { useConfig } from '../../lib/config';
import { useSocketEvent } from '../../lib/socket';
import { fmtDay, timeAgo } from '../../lib/format';

function Reactions({ photo, ctx, onReact, dark }) {
  const { reactions } = useConfig();
  const counts = {};
  for (const r of photo.reactions) counts[r.emoji] = (counts[r.emoji] || 0) + 1;
  return (
    <div className="flex flex-wrap gap-1">
      {reactions.map((e) => {
        const mine = photo.reactions.some((r) => r.emoji === e && r.user_id === ctx.user.id);
        return (
          <button key={e} onClick={() => onReact(e)} className={clsx('rounded-full px-2 py-0.5 text-[13px] transition', mine ? 'bg-plum-600 text-white' : dark ? 'bg-white/15 text-white hover:bg-white/25' : 'bg-sand hover:bg-plum-100')}>
            {e}{counts[e] ? <span className="ml-0.5 text-[11px] font-bold">{counts[e]}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export default function AlbumTab({ ctx }) {
  const { data, tripId, user, isOwner } = ctx;
  const { data: res, loading, reload } = useFetch(`/trips/${tripId}/media`);
  const [uploading, setUploading] = useState(false);
  const [uploadDay, setUploadDay] = useState('');
  const [view, setView] = useState(null);
  const [caption, setCaption] = useState('');
  const fileRef = useRef(null);
  const confirm = useConfirm();
  useSocketEvent('trip:event', (ev) => ev.tripId === tripId && ev.type === 'media' && reload());

  const media = res?.media || [];
  const current = view != null ? media[view] : null;

  async function upload(files) {
    if (!files?.length) return;
    const fd = new FormData();
    [...files].slice(0, 20).forEach((f) => fd.append('files', f));
    if (uploadDay) fd.append('day_number', uploadDay);
    setUploading(true);
    try {
      const r = await api(`/trips/${tripId}/media`, { method: 'POST', form: fd });
      toast.success(`${r.media.length} photo${r.media.length > 1 ? 's' : ''} added to the album`);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const react = (photo, emoji) => api.post(`/trips/${tripId}/media/${photo.id}/react`, { emoji }).then(reload).catch((e) => toast.error(e.message));

  async function remove(photo) {
    if (!(await confirm({ title: 'Delete this photo?', tone: 'danger', confirmLabel: 'Delete' }))) return;
    await api.del(`/trips/${tripId}/media/${photo.id}`).catch((e) => toast.error(e.message));
    setView(null);
    reload();
  }

  async function saveCaption() {
    await api.patch(`/trips/${tripId}/media/${current.id}`, { caption }).catch((e) => toast.error(e.message));
    reload();
  }

  const groups = [...data.days.map((d) => ({ key: d.day_number, label: `Day ${d.day_number} · ${d.title || fmtDay(d.date)}` })), { key: null, label: 'Before & after the trip' }]
    .map((g) => ({ ...g, photos: media.map((m, i) => ({ ...m, index: i })).filter((m) => (g.key == null ? m.day_number == null : m.day_number === g.key)) }))
    .filter((g) => g.photos.length);

  return (
    <div className="space-y-6">
      <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="flex-1">
          <div className="font-bold">Shared album</div>
          <div className="text-[13px] text-muted">{media.length} photos from {new Set(media.map((m) => m.uploaded_by)).size} travellers · they become your Digital Zine</div>
        </div>
        <div className="flex gap-2">
          <Select value={uploadDay} onChange={(e) => setUploadDay(e.target.value)} className="w-36">
            <option value="">Auto day</option>
            {data.days.map((d) => <option key={d.id} value={d.day_number}>Day {d.day_number}</option>)}
          </Select>
          <Button icon={ImagePlus} loading={uploading} onClick={() => fileRef.current?.click()}>Add photos</Button>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="aspect-square" />)}</div>
      ) : media.length === 0 ? (
        <EmptyState emoji="📸" title="No photos yet" description="Everyone can drop photos here during and after the trip. We’ll turn the best ones into a scrapbook." action={<Button icon={ImagePlus} onClick={() => fileRef.current?.click()}>Upload the first one</Button>} />
      ) : (
        groups.map((g) => (
          <section key={g.label}>
            <h3 className="mb-2.5 text-sm font-bold text-ink/80">{g.label}</h3>
            <div className="columns-2 gap-3 sm:columns-3 lg:columns-4">
              {g.photos.map((m) => (
                <button key={m.id} onClick={() => { setView(m.index); setCaption(m.caption); }} className="group relative mb-3 block w-full overflow-hidden rounded-2xl bg-sand break-inside-avoid">
                  <img src={assetUrl(m.url)} alt={m.caption} loading="lazy" className="w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/60 to-transparent p-2.5 pt-8 opacity-0 transition group-hover:opacity-100">
                    <span className="truncate text-left text-[12px] font-semibold text-white">{m.caption}</span>
                    {m.reactions.length > 0 && <span className="shrink-0 rounded-full bg-white/90 px-1.5 text-[11px] font-bold">{m.reactions[0].emoji} {m.reactions.length}</span>}
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))
      )}

      {current &&
        createPortal(
          <div className="fixed inset-0 z-[1000] flex flex-col bg-black/95 text-white" role="dialog">
            <div className="flex items-center justify-between p-3">
              <div className="flex items-center gap-2 text-sm">
                <Avatar user={{ id: current.uploaded_by, name: current.uploader_name }} size={30} />
                <div>
                  <div className="font-semibold">{current.uploader_name}</div>
                  <div className="text-xs text-white/60">{current.day_number ? `Day ${current.day_number} · ` : ''}{timeAgo(current.created_at)}</div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <a href={assetUrl(current.url)} download target="_blank" rel="noreferrer" className="grid size-10 place-items-center rounded-xl hover:bg-white/10" aria-label="Download"><Download className="size-5" /></a>
                {(current.uploaded_by === user.id || isOwner) && <button onClick={() => remove(current)} className="grid size-10 place-items-center rounded-xl hover:bg-white/10" aria-label="Delete"><Trash2 className="size-5" /></button>}
                <button onClick={() => setView(null)} className="grid size-10 place-items-center rounded-xl hover:bg-white/10" aria-label="Close"><X className="size-6" /></button>
              </div>
            </div>
            <div className="relative flex min-h-0 flex-1 items-center justify-center px-2">
              {view > 0 && <button onClick={() => { setView(view - 1); setCaption(media[view - 1].caption); }} className="absolute left-2 grid size-11 place-items-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Previous"><ChevronLeft /></button>}
              <img src={assetUrl(current.url)} alt={current.caption} className="max-h-full max-w-full rounded-lg object-contain" />
              {view < media.length - 1 && <button onClick={() => { setView(view + 1); setCaption(media[view + 1].caption); }} className="absolute right-2 grid size-11 place-items-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Next"><ChevronRight /></button>}
            </div>
            <div className="mx-auto w-full max-w-xl space-y-3 p-4">
              <Reactions photo={current} ctx={ctx} onReact={(e) => react(current, e)} dark />
              <div className="flex gap-2">
                <Input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Add a caption…" className="border-white/20 bg-white/10 text-white placeholder:text-white/50" maxLength={300} />
                <Button variant="secondary" onClick={saveCaption} disabled={caption === current.caption}>Save</Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
