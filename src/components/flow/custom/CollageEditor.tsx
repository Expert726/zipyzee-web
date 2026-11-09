'use client';
// Collage maker, step 2 (the app's custom/image/CollageStep, design/FlowCollage.dc.html): the collage in a white card,
// 5 layout tiles, Spacing (px on the board's 350 px preview) and Shape (Square / Story 9:16 / 4:5). Same rects as the
// saved image (src/tools/image/collage.ts). Web extras: each photo framed by hand (drag it to move it in its cell,
// mouse wheel or the Zoom slider to zoom, src/tools/image/collageFit.ts), swap two photos by dragging one's handle onto
// another, remove one with ×.
import { useRef, useState } from 'react';
import { Move, Plus, RotateCcw, X } from 'lucide-react';
import { useT } from '@/i18n/client';
import { COLLAGE_CELL_RADIUS, COLLAGE_PREVIEW, COLLAGE_SHAPES, COLLAGE_SIZE, type CollageShape } from '@/tools/image/collage';
import { Button } from '../../ui/Button';
import { Choice } from '../../custom/makedoc/parts';
import type { CustomSetupProps } from './index';
import { useObjectUrls } from '@/lib/objectUrls';
import { CENTERED, distinctLayouts, fitSource, layoutRects, MAX_ZOOM, panned, type CellFit, type WebLayout } from '@/tools/image/collageFit';

const keyOf = (f: File) => `${f.name}|${f.size}|${f.lastModified}`;

const BOX = { w: 520, h: 560 };
const TILE = 56;

export function CollageEditor({ tool, files, onStart, onReplace, onFiles }: CustomSetupProps) {
  const t = useT();
  const [chosen, setLayout] = useState<WebLayout>('grid');
  const [spacing, setSpacing] = useState(6);
  const [shape, setShape] = useState<CollageShape>('square');
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  // each photo's framing and natural size, by file (they follow the photo when photos are swapped)
  const [fits, setFits] = useState<Record<string, CellFit>>({});
  const [dims, setDims] = useState<Record<string, { w: number; h: number }>>({});
  const [selected, setSelected] = useState(0);
  const pan = useRef<{ i: number; x: number; y: number; f: CellFit; moved: boolean } | null>(null);

  const urls = useObjectUrls(files);

  const out = COLLAGE_SIZE[shape];
  const k = Math.min(BOX.w / out.w, BOX.h / out.h);
  const w = out.w * k;
  const h = out.h * k;
  const unit = w / COLLAGE_PREVIEW;
  const shown = files.slice(0, 9);
  // only layouts that look different for this many photos; a hidden one falls back to the first
  const layouts = distinctLayouts(shown.length);
  const layout = layouts.includes(chosen) ? chosen : layouts[0];
  const cells = layoutRects(shown.length, layout, w, h, spacing * unit);
  const blocked = files.length > 9 ? t('A collage takes up to 9 photos') : files.length < 2 ? t('Add at least 2 photos') : null;

  const fitOf = (f: File) => fits[keyOf(f)] ?? CENTERED;
  const setFit = (f: File, next: CellFit) => setFits((m) => ({ ...m, [keyOf(f)]: next }));
  const zoomCell = (i: number, z: number) => {
    const f = files[i];
    if (f) setFit(f, { ...fitOf(f), zoom: Math.min(MAX_ZOOM, Math.max(1, z)) });
  };
  const sel = Math.min(selected, shown.length - 1);

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
              onPointerDown={(e) => {
                if ((e.target as HTMLElement).closest('button')) return;
                e.currentTarget.setPointerCapture(e.pointerId);
                setSelected(i);
                pan.current = { i, x: e.clientX, y: e.clientY, f: fitOf(files[i]), moved: false };
              }}
              onPointerMove={(e) => {
                const p = pan.current;
                const d = dims[keyOf(files[i])];
                if (!p || p.i !== i || !d) return;
                const cellW = e.currentTarget.getBoundingClientRect().width;
                setFit(files[i], panned(d.w, d.h, c.w, c.h, p.f, e.clientX - p.x, e.clientY - p.y, cellW));
              }}
              onPointerUp={() => (pan.current = null)}
              onPointerCancel={() => (pan.current = null)}
              onWheel={(e) => {
                setSelected(i);
                zoomCell(i, fitOf(files[i]).zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08));
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
              className={`group absolute overflow-hidden bg-fill cursor-move touch-none ${over === i && dragFrom !== i ? 'outline-3 outline-primary' : i === sel && shown.length > 1 ? 'outline-2 outline-primary/70' : ''} ${dragFrom === i ? 'opacity-60' : ''}`}
              style={{ left: `${(c.x / w) * 100}%`, top: `${(c.y / h) * 100}%`, width: `${(c.w / w) * 100}%`, height: `${(c.h / h) * 100}%`, borderRadius: COLLAGE_CELL_RADIUS * unit }}
            >
              {(() => {
                const d = dims[keyOf(files[i])];
                // framed like the saved collage: the part fitSource picks, scaled to the cell
                const s = d ? fitSource(d.w, d.h, c.w, c.h, fitOf(files[i])) : null;
                return (
                  // eslint-disable-next-line @next/next/no-img-element -- a picked photo
                  <img
                    src={urls[i]}
                    alt={files[i].name}
                    draggable={false}
                    onLoad={(e) => {
                      const { naturalWidth: nw, naturalHeight: nh } = e.currentTarget;
                      setDims((m) => (m[keyOf(files[i])] ? m : { ...m, [keyOf(files[i])]: { w: nw, h: nh } }));
                    }}
                    className={`pointer-events-none select-none ${s ? 'absolute max-w-none' : 'size-full object-cover'}`}
                    style={s ? { width: `${(d!.w / s.w) * 100}%`, height: `${(d!.h / s.h) * 100}%`, left: `${(-s.x / s.w) * 100}%`, top: `${(-s.y / s.h) * 100}%` } : undefined}
                  />
                );
              })()}
              {onFiles && shown.length > 1 && (
                <span
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'move';
                    setDragFrom(i);
                  }}
                  onDragEnd={() => {
                    setDragFrom(null);
                    setOver(null);
                  }}
                  title={t('Drag onto another photo to swap')}
                  aria-label={t('Drag onto another photo to swap')}
                  className="absolute top-1.5 start-1.5 size-7 rounded-full bg-black/60 text-white grid place-items-center cursor-grab opacity-0 group-hover:opacity-100 [@media(hover:none)]:hidden"
                >
                  <Move size={14} aria-hidden="true" />
                </span>
              )}
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
        <p className="text-[12px] text-secondary mt-3 text-center">{t('Drag a photo to move it in its frame; zoom with the mouse wheel or the slider.')}</p>
      </section>

      <aside className="card p-5 flex flex-col gap-5">
        <fieldset>
          <legend className="text-[13px] font-semibold mb-2">{t('Layout')}</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup">
            {layouts.map((l) => (
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
                {layoutRects(Math.min(9, Math.max(2, files.length)), l, TILE - 10, TILE - 10, 3).map((c, i) => (
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
        {shown[sel] && (
          <div className="flex flex-col gap-2 text-[13px] font-semibold">
            <span className="flex justify-between items-center">
              {t('Zoom photo {n}', { n: sel + 1 })}
              <button type="button" onClick={() => setFit(shown[sel], CENTERED)} className="inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline">
                <RotateCcw size={13} aria-hidden="true" />
                {t('Reset')}
              </button>
            </span>
            <input type="range" min={1} max={MAX_ZOOM} step={0.01} value={fitOf(shown[sel]).zoom} onChange={(e) => zoomCell(sel, Number(e.target.value))} aria-label={t('Zoom photo {n}', { n: sel + 1 })} className="accent-[var(--primary)]" />
          </div>
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
        <Button arrow disabled={!!blocked} onClick={() => onStart({ layout, spacing, shape, fits: shown.map(fitOf) })} className="w-full">
          {t(tool.verb)}
        </Button>
      </aside>
    </div>
  );
}
