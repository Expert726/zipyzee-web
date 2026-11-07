'use client';
// Collage maker, step 2 (the app's custom/image/CollageStep, design/FlowCollage.dc.html): the collage in a white card,
// 5 layout tiles, Spacing (px on the board's 350 px preview) and Shape (Square / Story 9:16 / 4:5). Same rects as the
// saved image (src/tools/image/collage.ts). Web extras: drag a photo onto another to swap them, remove one with ×.
import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useT } from '@/i18n/client';
import {
  COLLAGE_CELL_RADIUS, COLLAGE_LAYOUTS, COLLAGE_PREVIEW, COLLAGE_SHAPES, COLLAGE_SIZE, collageLayout,
  type CollageLayout, type CollageShape,
} from '@/tools/image/collage';
import { Button } from '../../ui/Button';
import { Choice } from '../../custom/makedoc/parts';
import type { CustomSetupProps } from './index';
import { useObjectUrls } from '@/lib/objectUrls';

const BOX = { w: 520, h: 560 };
const TILE = 56;

export function CollageEditor({ tool, files, onStart, onReplace, onFiles }: CustomSetupProps) {
  const t = useT();
  const [layout, setLayout] = useState<CollageLayout>('grid');
  const [spacing, setSpacing] = useState(6);
  const [shape, setShape] = useState<CollageShape>('square');
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  const urls = useObjectUrls(files);

  const out = COLLAGE_SIZE[shape];
  const k = Math.min(BOX.w / out.w, BOX.h / out.h);
  const w = out.w * k;
  const h = out.h * k;
  const unit = w / COLLAGE_PREVIEW;
  const shown = files.slice(0, 9);
  const cells = collageLayout(shown.length, layout, w, h, spacing * unit);
  const blocked = files.length > 9 ? t('A collage takes up to 9 photos') : files.length < 2 ? t('Add at least 2 photos') : null;

  const swap = (a: number, b: number) => {
    if (a === b || !onFiles) return;
    const next = [...files];
    [next[a], next[b]] = [next[b], next[a]];
    onFiles(next);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
      <section className="card p-4 sm:p-6 grid place-items-center overflow-hidden">
        {/* the collage itself is always on white, like the saved image */}
        <div className="relative bg-white rounded-[10px] shadow-raised max-w-full" style={{ width: w, aspectRatio: `${out.w} / ${out.h}` }}>
          {cells.map((c, i) => (
            <div
              key={`${files[i].name}-${files[i].lastModified}-${i}`}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move';
                setDragFrom(i);
              }}
              onDragOver={(e) => {
                if (dragFrom == null) return;
                e.preventDefault();
                e.stopPropagation();
                setOver(i);
              }}
              onDragLeave={() => setOver((o) => (o === i ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (dragFrom != null) swap(dragFrom, i);
                setDragFrom(null);
                setOver(null);
              }}
              onDragEnd={() => {
                setDragFrom(null);
                setOver(null);
              }}
              className={`group absolute overflow-hidden bg-fill cursor-grab active:cursor-grabbing ${over === i && dragFrom !== i ? 'outline-3 outline-primary' : ''} ${dragFrom === i ? 'opacity-60' : ''}`}
              style={{ left: `${(c.x / w) * 100}%`, top: `${(c.y / h) * 100}%`, width: `${(c.w / w) * 100}%`, height: `${(c.h / h) * 100}%`, borderRadius: COLLAGE_CELL_RADIUS * unit }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- a picked photo */}
              <img src={urls[i]} alt={files[i].name} draggable={false} className="size-full object-cover pointer-events-none" />
              {onFiles && (
                <button
                  type="button"
                  onClick={() => onFiles(files.filter((_, j) => j !== i))}
                  aria-label={`${t('Remove')} ${files[i].name}`}
                  title={t('Remove')}
                  className="absolute top-1.5 end-1.5 size-7 rounded-full bg-black/60 text-white grid place-items-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              )}
            </div>
          ))}
        </div>
        {onFiles && files.length > 2 && <p className="text-[12px] text-secondary mt-3 [@media(hover:none)]:hidden">{t('Drag a photo onto another to swap them.')}</p>}
      </section>

      <aside className="card p-5 flex flex-col gap-5">
        <fieldset>
          <legend className="text-[13px] font-semibold mb-2">{t('Layout')}</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup">
            {COLLAGE_LAYOUTS.map((l) => (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={layout === l}
                aria-label={t('Layout {l}', { l })}
                onClick={() => setLayout(l)}
                className={`relative bg-surface rounded-tile ${layout === l ? 'border-2 border-primary' : 'border border-line-strong hover:bg-fill'}`}
                style={{ width: TILE, height: TILE }}
              >
                {collageLayout(Math.min(9, Math.max(2, files.length)), l, TILE - 10, TILE - 10, 3).map((c, i) => (
                  <span key={i} aria-hidden="true" className="absolute rounded-[2px] bg-line-strong" style={{ left: c.x + 3, top: c.y + 3, width: c.w, height: c.h }} />
                ))}
              </button>
            ))}
          </div>
        </fieldset>
        {files.length < 9 && (
          <Button variant="secondary" onClick={onReplace}>
            <Plus size={18} aria-hidden="true" className="inline me-2" />
            {t('Add photos')}
          </Button>
        )}
        <label className="flex flex-col gap-2 text-[13px] font-semibold">
          <span className="flex justify-between">
            {t('Spacing')}
            <span className="font-normal text-secondary">{spacing} px</span>
          </span>
          <input type="range" min={0} max={20} step={1} value={spacing} onChange={(e) => setSpacing(Number(e.target.value))} className="accent-[var(--primary)]" />
        </label>
        <Choice label={t('Shape')} value={shape} options={COLLAGE_SHAPES.map((s) => [s.value, s.label] as [CollageShape, string])} onChange={setShape} />
        {blocked && <p className="text-[13px] text-warning">{blocked}</p>}
        <Button arrow disabled={!!blocked} onClick={() => onStart({ layout, spacing, shape })} className="w-full">
          {t(tool.verb)}
        </Button>
      </aside>
    </div>
  );
}
