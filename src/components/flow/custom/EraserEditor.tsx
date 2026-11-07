'use client';
// Object eraser, step 2 (the app's custom/image/EraserStep, design/FlowObjectEraser.dc.html): the photo to paint over
// in see-through red, the brush ring under the pointer, "Brush size" (34), Undo (also Ctrl+Z), the note, and Erase.
// The strokes are in 0-1 of the photo ({ s: share of the short side, p: points }); handlers/objectEraser.ts fills
// them with LaMa in the browser (src/lib/inpaint.ts).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Info, Loader2, Undo2 } from 'lucide-react';
import { useT } from '@/i18n/client';
import { decodeImage } from '@/lib/image';
import type { EraseStroke } from '@/lib/inpaint';
import { capLongest } from '@/tools/image/sizes';
import { ToolError } from '@/tools/types';
import { Button } from '../../ui/Button';
import type { CustomSetupProps } from './index';

const PREVIEW_SIDE = 1400;
const MARK = 'rgba(229, 83, 61, 0.55)';

export function EraserEditor({ tool, files, onStart, onReplace }: CustomSetupProps) {
  const t = useT();
  const file = files[0];
  const [photo, setPhoto] = useState<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [brush, setBrush] = useState(34);
  const [strokes, setStrokes] = useState<EraseStroke[]>([]);
  const [live, setLive] = useState<EraseStroke | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const ink = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const bmp = await decodeImage(file);
        const s = capLongest({ w: bmp.width, h: bmp.height }, PREVIEW_SIDE);
        const c = document.createElement('canvas');
        c.width = s.w;
        c.height = s.h;
        c.getContext('2d')!.drawImage(bmp, 0, 0, s.w, s.h);
        bmp.close();
        if (alive) setPhoto(c);
      } catch (e) {
        if (alive) setError(e instanceof ToolError ? e.message : t('This photo could not be read. Try another one.'));
      }
    })();
    return () => {
      alive = false;
    };
  }, [file, t]);
  const url = useMemo(() => photo?.toDataURL('image/jpeg', 0.9), [photo]);

  // the red marks, one layer so overlaps don't get darker
  useEffect(() => {
    const c = ink.current;
    if (!c || !photo) return;
    const id = requestAnimationFrame(() => {
      c.width = photo.width;
      c.height = photo.height;
      const g = c.getContext('2d')!;
      const short = Math.min(c.width, c.height);
      g.strokeStyle = '#E5533D';
      g.lineCap = 'round';
      g.lineJoin = 'round';
      for (const st of live ? [...strokes, live] : strokes) {
        g.lineWidth = st.s * short;
        g.beginPath();
        g.moveTo(st.p[0][0] * c.width, st.p[0][1] * c.height);
        if (st.p.length === 1) g.lineTo(st.p[0][0] * c.width + 0.1, st.p[0][1] * c.height);
        for (const [x, y] of st.p.slice(1)) g.lineTo(x * c.width, y * c.height);
        g.stroke();
      }
    });
    return () => cancelAnimationFrame(id);
  }, [photo, strokes, live]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        setStrokes((s) => s.slice(0, -1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const rect = () => ink.current!.getBoundingClientRect();
  const frac = (e: React.PointerEvent): [number, number] => {
    const r = rect();
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
  };
  const local = (e: React.PointerEvent) => {
    const r = rect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  if (error) {
    return (
      <div className="card p-8 text-center flex flex-col items-center gap-3" role="alert">
        <p className="text-[17px] font-semibold">{error}</p>
        <Button variant="secondary" onClick={onReplace}>
          {t('Choose a photo')}
        </Button>
      </div>
    );
  }

  const painted = strokes.length > 0;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
      <section className="card p-3 sm:p-5 grid place-items-center">
        {!photo ? (
          <div className="min-h-64 grid place-items-center" aria-busy="true">
            <Loader2 size={28} className="animate-spin text-primary" aria-hidden="true" />
            <span className="sr-only">{t('Opening the photo…')}</span>
          </div>
        ) : (
          <div
            className="relative select-none touch-none max-w-full cursor-none"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              const r = rect();
              setLive({ s: brush / Math.min(r.width, r.height), p: [frac(e)] });
              setCursor(local(e));
            }}
            onPointerMove={(e) => {
              setCursor(local(e));
              if (live) setLive({ ...live, p: [...live.p, frac(e)] });
            }}
            onPointerUp={(e) => {
              if (live) setStrokes((s) => [...s, live]);
              setLive(null);
              if (e.pointerType !== 'mouse') setCursor(null);
            }}
            onPointerCancel={() => setLive(null)}
            onPointerLeave={() => !live && setCursor(null)}
            role="img"
            aria-label={t('Photo. Paint over the object to erase.')}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- the photo being painted on */}
            <img src={url} alt="" draggable={false} className="block max-w-full max-h-[70vh] rounded-md" />
            <canvas ref={ink} className="absolute inset-0 size-full pointer-events-none" style={{ opacity: 0.55 }} />
            {cursor && (
              <span aria-hidden="true" className="absolute rounded-full border-2 border-white pointer-events-none shadow-[0_0_0_1px_rgba(0,0,0,0.35)]" style={{ left: cursor.x - brush / 2, top: cursor.y - brush / 2, width: brush, height: brush, background: MARK }} />
            )}
          </div>
        )}
      </section>

      <aside className="card p-5 flex flex-col gap-5">
        <div className="flex items-center gap-2">
          <label className="flex-1 flex flex-col gap-2 text-[13px] font-semibold">
            <span className="flex justify-between">
              {t('Brush size')}
              <span className="font-normal text-secondary">{brush}</span>
            </span>
            <input type="range" min={10} max={80} step={1} value={brush} onChange={(e) => setBrush(Number(e.target.value))} className="accent-[var(--primary)]" />
          </label>
          <button type="button" disabled={!painted} onClick={() => setStrokes((s) => s.slice(0, -1))} aria-label={t('Undo')} title={t('Undo')} className="size-10 rounded-full grid place-items-center hover:bg-fill disabled:opacity-30">
            <Undo2 size={18} aria-hidden="true" />
          </button>
        </div>
        <p className="flex gap-2 text-[13px] text-secondary rounded-tile bg-fill p-3">
          <Info size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
          {t('Paint over the object you want gone. You can undo before you erase.')}
        </p>
        <p className="text-[12px] text-secondary">{t('Done in your browser. The first time, the eraser downloads once (about 208 MB).')}</p>
        {photo && !painted && <p className="text-[13px] text-secondary">{t('Paint over the object you want gone first.')}</p>}
        <Button arrow disabled={!painted} onClick={() => onStart({ strokes })} className="w-full">
          {t(tool.verb)}
        </Button>
      </aside>
    </div>
  );
}
