'use client';
// "Recent photos" on the Choose screen of tools that keep them (src/lib/recentPhotos.ts): the photos from the last
// hour, one click to carry on with one of them. Nothing shows when there are none.
import { useEffect, useState } from 'react';
import { useT } from '@/i18n/client';
import { listRecent, removeRecent, RECENT_HOURS, type RecentPhoto } from '@/lib/recentPhotos';
import { PhotoStrip } from './PhotoStrip';

/** Tools that keep recent photos, and the group they share. */
export const RECENT_GROUPS: Record<string, string> = { 'remove-bg': 'bg', 'change-bg': 'bg' };

export function RecentPick({ group, onPick }: { group: string; onPick: (file: File) => void }) {
  const t = useT();
  const [photos, setPhotos] = useState<RecentPhoto[]>([]);
  useEffect(() => {
    let alive = true;
    void listRecent(group).then((list) => alive && setPhotos(list));
    return () => {
      alive = false;
    };
  }, [group]);
  if (!photos.length) return null;
  return (
    <div className="mt-6 flex flex-col items-center gap-3">
      <p className="text-[13px] font-semibold">
        {t('Recent photos')} <span className="font-normal text-secondary">· {t('Kept for {count} hour', { count: RECENT_HOURS })}</span>
      </p>
      <PhotoStrip
        photos={photos}
        onPick={(id) => {
          const p = photos.find((x) => x.id === id);
          if (p) onPick(p.file);
        }}
        onRemove={(id) => {
          setPhotos((list) => list.filter((p) => p.id !== id));
          void removeRecent(id);
        }}
      />
    </div>
  );
}
