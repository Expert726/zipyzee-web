'use client';
// Remove metadata, step 2 (the app's custom/image/MetadataStep, design/FlowStripMetadata.dc.html, on the web showing
// everything): each kind of detail found ("Found in 3 photos"), what it says (the selected photo's values), and
// Remove (default) or Keep per kind. Location shows the coordinates and a map link. Formats whose details can't be
// read here are still saved as clean copies. src/tools/image/metadataWeb.ts reads and removes.
import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Image as ImageIcon, Info, Loader2, MapPin, ShieldCheck, X } from 'lucide-react';
import { useT } from '@/i18n/client';
import { useObjectUrls } from '@/lib/objectUrls';
import { GROUP_LABEL, groupsFound, readMeta, type MetaGroup, type PhotoMeta } from '@/tools/image/metadataWeb';
import { Button } from '../../ui/Button';
import type { CustomSetupProps } from './index';

export function MetadataEditor({ files, onStart, onReplace, onFiles }: CustomSetupProps) {
  const t = useT();
  const [metas, setMetas] = useState<PhotoMeta[] | null>(null);
  const [at, setAt] = useState(0);
  const [keep, setKeep] = useState<MetaGroup[]>([]);
  const [open, setOpen] = useState<MetaGroup | null>('location');
  const [broken, setBroken] = useState<number[]>([]);
  const urls = useObjectUrls(files);

  useEffect(() => {
    let alive = true;
    void Promise.all(files.map(async (f) => readMeta(new Uint8Array(await f.arrayBuffer()), f.name, f.type))).then((m) => alive && setMetas(m));
    return () => {
      alive = false;
    };
  }, [files]);

  const found = useMemo(() => (metas ? groupsFound(metas) : []), [metas]);
  const photo = metas?.[Math.min(at, files.length - 1)];
  const remove = found.map((g) => g.group).filter((g) => !keep.includes(g));
  const unreadable = metas ? metas.filter((m) => m.kind === 'other').length : 0;
  const n = files.length;
  const allKept = found.length > 0 && remove.length === 0;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
      <section className="card p-4 sm:p-5 flex flex-col gap-4">
        {/* the photos; the selected one's values are shown below */}
        <div className="flex flex-wrap gap-3" role="radiogroup" aria-label={t('Your photos')}>
          {files.map((f, i) => (
            <div key={`${f.name}-${i}`} className="relative group">
              <button type="button" role="radio" aria-checked={i === at} onClick={() => setAt(i)} title={f.name} className={`size-16 rounded-tile overflow-hidden bg-fill grid place-items-center ${i === at ? 'ring-3 ring-primary ring-offset-2 ring-offset-surface' : 'hover:opacity-90'}`}>
                {broken.includes(i) ? (
                  // a photo this browser can't show (HEIC outside Safari): its kind instead
                  <span className="flex flex-col items-center gap-0.5 text-secondary">
                    <ImageIcon size={18} aria-hidden="true" />
                    <span className="text-[10px] font-semibold uppercase">{f.name.split('.').pop()}</span>
                  </span>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- a picked photo
                  <img src={urls[i]} alt={f.name} className="size-full object-cover" onError={() => setBroken((b) => (b.includes(i) ? b : [...b, i]))} />
                )}
              </button>
              {onFiles && (
                <button
                  type="button"
                  onClick={() => {
                    onFiles(files.filter((_, j) => j !== i));
                    setAt((a) => Math.max(0, a > i ? a - 1 : Math.min(a, files.length - 2)));
                    setBroken([]);
                  }}
                  aria-label={t('Remove {name}', { name: f.name })}
                  title={t('Remove')}
                  className="absolute -top-2 -end-2 size-6 rounded-full bg-ink text-on-ink shadow grid place-items-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                >
                  <X size={13} aria-hidden="true" />
                </button>
              )}
            </div>
          ))}
        </div>

        {!metas ? (
          <p className="flex items-center gap-2 text-[14px] text-secondary" role="status">
            <Loader2 size={18} className="animate-spin text-primary" aria-hidden="true" />
            {t('Reading the photos…')}
          </p>
        ) : !found.length ? (
          <p className="flex gap-2 rounded-tile bg-success-soft text-success p-3 text-[14px]">
            <ShieldCheck size={18} className="shrink-0" aria-hidden="true" />
            {t('No location or camera details found. Saving still makes clean copies.')}
          </p>
        ) : (
          <>
            <p className="text-[13px] font-semibold">{t('Details in {name}', { name: files[at]?.name ?? '' })}</p>
            <ul className="flex flex-col gap-2">
              {found.map(({ group, photos }) => {
                const items = photo?.items.filter((x) => x.group === group) ?? [];
                const kept = keep.includes(group);
                const expanded = open === group;
                return (
                  <li key={group} className="rounded-row bg-fill">
                    <div className="flex items-center gap-3 p-3">
                      <button type="button" onClick={() => setOpen(expanded ? null : group)} aria-expanded={expanded} className="flex-1 min-w-0 flex items-center gap-2 text-start">
                        <ChevronDown size={18} className={`shrink-0 transition-transform ${expanded ? '' : '-rotate-90 rtl:rotate-90'}`} aria-hidden="true" />
                        <span className="min-w-0">
                          <span className="block font-semibold text-[14px]">{t(GROUP_LABEL[group])}</span>
                          <span className="block text-[12px] text-secondary">
                            {n > 1 ? t('Found in {found} {value}', { found: photos, value: photos === 1 ? t('photo') : t('photos') }) : items.length ? t('{count} details', { count: items.length }) : t('Not in this photo')}
                          </span>
                        </span>
                      </button>
                      <div className="flex rounded-full bg-surface p-0.5 shrink-0" role="radiogroup" aria-label={t(GROUP_LABEL[group])}>
                        {(
                          [
                            [false, t('Remove')],
                            [true, t('Keep')],
                          ] as const
                        ).map(([k, label]) => (
                          <button
                            key={label}
                            type="button"
                            role="radio"
                            aria-checked={kept === k}
                            onClick={() => setKeep((list) => (k ? [...list.filter((x) => x !== group), group] : list.filter((x) => x !== group)))}
                            className={`px-3 min-h-8 rounded-full text-[13px] font-semibold ${kept === k ? (k ? 'bg-ink text-on-ink' : 'bg-error text-white') : 'text-secondary'}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {expanded && (
                      <div className="px-3 pb-3 flex flex-col gap-1.5">
                        {group === 'location' && photo?.lat != null && photo?.lng != null && (
                          <a href={`https://www.openstreetmap.org/?mlat=${photo.lat}&mlon=${photo.lng}#map=15/${photo.lat}/${photo.lng}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline self-start" dir="ltr">
                            <MapPin size={15} aria-hidden="true" />
                            {photo.lat.toFixed(5)}, {photo.lng.toFixed(5)} · {t('View on map')}
                          </a>
                        )}
                        {items.length ? (
                          <dl className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] gap-x-3 gap-y-1 text-[13px]">
                            {items.map((x, i) => (
                              <div key={i} className="contents">
                                <dt className="text-secondary truncate" title={x.name}>
                                  {x.name}
                                </dt>
                                <dd className="break-words" dir="auto">
                                  {x.value || '—'}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        ) : (
                          <p className="text-[13px] text-secondary">{t('Not in this photo')}</p>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
        {unreadable > 0 && (
          <p className="flex gap-2 text-[13px] text-secondary">
            <Info size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
            {t('Details in WEBP, HEIC and other formats can\'t be shown here; those photos are saved as clean copies with nothing kept.')}
          </p>
        )}
      </section>

      <aside className="card p-5 flex flex-col gap-4 lg:sticky lg:top-20">
        <p className="text-[13px] text-secondary">{t('Pick Remove or Keep for each kind of detail. JPG and PNG keep their full quality.')}</p>
        <Button variant="secondary" onClick={onReplace}>
          {t('Add photos')}
        </Button>
        {allKept && <p className="text-[13px] text-warning">{t('Everything is set to Keep')}</p>}
        <Button arrow disabled={!metas || allKept} onClick={() => onStart({ remove: found.length ? remove : ['location', 'camera', 'date', 'owner', 'software', 'text', 'preview', 'extra'] })} className="w-full">
          {t('Remove from {n} {value}', { n, value: n === 1 ? t('photo') : t('photos') })}
        </Button>
      </aside>
    </div>
  );
}
