'use client';
// A row of photo thumbnails with "+" first (like remove.bg): click one to work on it, × removes it. Used by Background
// remover / Change background (src/lib/recentPhotos.ts keeps them for an hour) and by the Choose screen's
// "Recent photos".
import { useMemo } from 'react';
import { Plus, X } from 'lucide-react';
import { useT } from '@/i18n/client';
import type { RecentPhoto } from '@/lib/recentPhotos';
import { useObjectUrls } from '@/lib/objectUrls';

export function PhotoStrip({ photos, active, onPick, onRemove, onAdd }: { photos: RecentPhoto[]; active?: string; onPick: (id: string) => void; onRemove: (id: string) => void; onAdd?: () => void }) {
  const t = useT();
  const blobs = useMemo(() => photos.map((p) => p.file), [photos]);
  const list = useObjectUrls(blobs);
  const urls = new Map(photos.map((p, i) => [p.id, list[i]]));
  return (
    <ul className="flex flex-wrap justify-center gap-2.5" aria-label={t('Your photos')}>
      {onAdd && (
        <li>
          <button type="button" onClick={onAdd} aria-label={t('Add photos')} title={t('Add photos')} className="size-16 sm:size-[72px] rounded-tile bg-fill hover:bg-fill-strong grid place-items-center text-secondary focus-visible:outline-2 focus-visible:outline-primary">
            <Plus size={26} aria-hidden="true" />
          </button>
        </li>
      )}
      {photos.map((p) => (
        <li key={p.id} className="relative group">
          <button
            type="button"
            onClick={() => onPick(p.id)}
            aria-current={active === p.id ? 'true' : undefined}
            aria-label={p.file.name}
            title={p.file.name}
            className={`block size-16 sm:size-[72px] rounded-tile overflow-hidden bg-fill focus-visible:outline-2 focus-visible:outline-primary ${active === p.id ? 'ring-3 ring-primary ring-offset-2 ring-offset-surface' : 'hover:opacity-90'}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- a photo picked in this browser */}
            <img src={urls.get(p.id)} alt="" className="size-full object-cover" />
          </button>
          <button
            type="button"
            onClick={() => onRemove(p.id)}
            aria-label={t('Remove {name}', { name: p.file.name })}
            title={t('Remove')}
            className="absolute -top-2 -end-2 size-6 rounded-full bg-ink text-on-ink shadow grid place-items-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
          >
            <X size={13} aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}
