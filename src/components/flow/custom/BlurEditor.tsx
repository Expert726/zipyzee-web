'use client';
// Blur faces, step 2 (the app's custom/image/BlurStep, design/FlowBlurImage.dc.html): the photo shown live with
// white boxes over what gets hidden; "Find faces automatically" (MediaPipe, src/lib/faces.ts detectAllFaces);
// Brush (paint over anything, with a ring under the pointer) or Box (drag a box, click one to remove it); Style,
// Strength, Undo / Redo. The preview is drawn by the same renderer as the saved photo (src/lib/blurImage.ts).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Redo2, Undo2 } from 'lucide-react';
import { useT } from '@/i18n/client';
import { renderHidden } from '@/lib/blurImage';
import { detectAllFaces } from '@/lib/faces';
import { decodeImage } from '@/lib/image';
import {
  boxAt, commit, dragBox, faceBox, redo, startHistory, strengthLabels, undo,
  type BlurHistory, type Box, type HideStroke, type HideStyle,
} from '@/tools/image/blur';
import { capLongest } from '@/tools/image/sizes';
import { ToolError } from '@/tools/types';
import { Button } from '../../ui/Button';
import { Choice, Switch } from '../../custom/makedoc/parts';
import type { CustomSetupProps } from './index';

const PREVIEW_SIDE = 1400;

/** A spot added by a click in Box mode: a square 18% of the photo's short side, centred on the click, inside it. */
function spotAt(p: Pt, w: number, h: number): Box {
  const side = Math.min(w, h) * 0.18;
  const bw = side / w;
  const bh = side / h;
  return { x: Math.min(1 - bw, Math.max(0, p.x - bw / 2)), y: Math.min(1 - bh, Math.max(0, p.y - bh / 2)), w: bw, h: bh };
}
type Mode = 'brush' | 'box';
type Pt = { x: number; y: number };

export function BlurEditor({ tool, files, onStart, onReplace }: CustomSetupProps) {
  const t = useT();
  const file = files[0];
  const [photo, setPhoto] = useState<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [faces, setFaces] = useState<Box[] | null>(null);
  const [auto, setAuto] = useState(true);
  const [history, setHistory] = useState<BlurHistory>(() => startHistory({ removed: [], manual: [], strokes: [] }));
  const { removed, manual, strokes } = history.now;
  const [mode, setMode] = useState<Mode>('brush');
  const [brush, setBrush] = useState(34);
  const [style, setStyle] = useState<HideStyle>('blur');
  const [strength, setStrength] = useState(3);
  const [drawing, setDrawing] = useState<{ a: Pt; b: Pt } | null>(null);
  const [live, setLive] = useState<HideStroke | null>(null);
  const [cursor, setCursor] = useState<Pt | null>(null);
  const view = useRef<HTMLCanvasElement>(null);
  const moved = useRef(false);
  // the stroke being painted, always current (state can lag a quick click by a render)
  const liveRef = useRef<HideStroke | null>(null);
  const marks = useRef<HTMLCanvasElement>(null);

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
        if (!alive) return;
        setPhoto(c);
        try {
          const found = await detectAllFaces(c);
          if (alive) setFaces(found.map((f) => faceBox({ left: f.x, top: f.y, width: f.w, height: f.h }, { w: c.width, h: c.height })));
        } catch {
          if (alive) setFaces([]);
        }
      } catch (e) {
        if (alive) setError(e instanceof ToolError ? e.message : t('This photo could not be read. Try another one.'));
      }
    })();
    return () => {
      alive = false;
    };
  }, [file, t]);

  const autoBoxes = useMemo(() => (auto && faces ? faces.filter((_, i) => !removed.includes(i)) : []), [auto, faces, removed]);
  const boxes = useMemo(() => [...autoBoxes, ...manual], [autoBoxes, manual]);

  // the live preview, redrawn on every change (including the stroke being painted)
  useEffect(() => {
    if (!photo || !view.current) return;
    const id = requestAnimationFrame(() => {
      const c = view.current;
      if (!c) return;
      const out = renderHidden(photo, photo.width, photo.height, boxes, style, strength, live ? [...strokes, live] : strokes);
      c.width = out.width;
      c.height = out.height;
      c.getContext('2d')!.drawImage(out, 0, 0);
      out.width = out.height = 0;
    });
    return () => cancelAnimationFrame(id);
  }, [photo, boxes, style, strength, strokes, live]);

  useEffect(() => {
    const c = marks.current;
    if (!c || !photo) return;
    c.width = photo.width;
    c.height = photo.height;
    const g = c.getContext('2d')!;
    const short = Math.min(c.width, c.height);
    g.strokeStyle = '#A3E635';
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const st of live ? [live] : []) {
      g.lineWidth = st.s * short;
      g.beginPath();
      g.moveTo(st.p[0][0] * c.width, st.p[0][1] * c.height);
      if (st.p.length === 1) g.lineTo(st.p[0][0] * c.width + 0.1, st.p[0][1] * c.height);
      for (const [x, y] of st.p.slice(1)) g.lineTo(x * c.width, y * c.height);
      g.stroke();
    }
  }, [photo, live, mode]);

  const edit = (next: Partial<BlurHistory['now']>) => setHistory((h) => commit(h, { ...h.now, ...next }));
  const rect = () => view.current!.getBoundingClientRect();
  const frac = (e: React.PointerEvent): Pt => {
    const r = rect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };
  const local = (e: React.PointerEvent): Pt => {
    const r = rect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = frac(e);
    moved.current = false;
    if (mode === 'brush') {
      const r = rect();
      liveRef.current = { s: brush / Math.min(r.width, r.height), p: [[p.x, p.y]] };
      setLive(liveRef.current);
      setCursor(local(e));
    } else setDrawing({ a: p, b: p });
  };
  const onMove = (e: React.PointerEvent) => {
    if (mode === 'brush') {
      setCursor(local(e));
      const st = liveRef.current;
      if (st) {
        const p = frac(e);
        liveRef.current = { ...st, p: [...st.p, [p.x, p.y]] };
        setLive(liveRef.current);
      }
    } else if (drawing) {
      const p = frac(e);
      if (Math.abs(p.x - drawing.a.x) + Math.abs(p.y - drawing.a.y) > 0.01) moved.current = true;
      setDrawing({ ...drawing, b: p });
    }
  };
  const onUp = (e: React.PointerEvent) => {
    if (mode === 'brush') {
      const st = liveRef.current;
      liveRef.current = null;
      setLive(null);
      if (st) setHistory((h) => commit(h, { ...h.now, strokes: [...h.now.strokes, st] }));
      if (e.pointerType !== 'mouse') setCursor(null);
      return;
    }
    const d = drawing;
    setDrawing(null);
    if (!d) return;
    const p = frac(e);
    if (moved.current) {
      const b = dragBox(d.a.x, d.a.y, p.x, p.y);
      if (b) edit({ manual: [...manual, b] });
      return;
    }
    // a click on a box removes it; anywhere else adds a spot there (click as many places as you like)
    const i = boxAt(boxes, p.x, p.y);
    if (i >= 0) {
      if (i < autoBoxes.length) edit({ removed: [...removed, faces!.indexOf(autoBoxes[i])] });
      else edit({ manual: manual.filter((_, j) => j !== i - autoBoxes.length) });
      return;
    }
    edit({ manual: [...manual, spotAt(p, photo!.width, photo!.height)] });
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

  const found = faces?.length ?? 0;
  const sub = !faces ? t('Looking for faces…') : found ? t('{count} {faces} found', { count: found, faces: found === 1 ? t('face') : t('faces') }) : t('No faces found');
  const blocked = !photo ? t('Opening the photo…') : boxes.length || strokes.length ? null : t('Paint or drag on the photo to choose what to hide');
  const shown = drawing ? dragBox(drawing.a.x, drawing.a.y, drawing.b.x, drawing.b.y, 0) : null;
  const strengths = strengthLabels();

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
            className={`relative select-none touch-none max-w-full ${mode === 'brush' ? 'cursor-none' : 'cursor-crosshair'}`}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={() => {
              liveRef.current = null;
              setLive(null);
              setDrawing(null);
            }}
            onPointerLeave={() => !liveRef.current && setCursor(null)}
            role="img"
            aria-label={t('Photo. Paint or drag over what to hide.')}
          >
            <canvas ref={view} className="block max-w-full max-h-[70vh] w-auto h-auto rounded-md" style={{ aspectRatio: `${photo.width} / ${photo.height}` }} />
            {/* Brush: the stroke being painted, lightly tinted while the pointer is down; once lifted it looks exactly like
                the faces' blur (no colour over the result) */}
            {mode === 'brush' && live && <canvas ref={marks} aria-hidden="true" className="absolute inset-0 size-full pointer-events-none opacity-30 rounded-md" />}
            {/* no borders over the result; in Box mode a faint dashed outline shows what a click removes */}
            {mode === 'box' &&
              [...boxes, ...(shown ? [shown] : [])].map((b, i) => (
                <span key={i} aria-hidden="true" className="absolute border border-dashed border-white/60 rounded-[10px] pointer-events-none" style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` }} />
              ))}
            {mode === 'brush' && cursor && (
              <span aria-hidden="true" className="absolute rounded-full border-2 border-white pointer-events-none shadow-[0_0_0_1px_rgba(0,0,0,0.35)]" style={{ left: cursor.x - brush / 2, top: cursor.y - brush / 2, width: brush, height: brush }} />
            )}
          </div>
        )}
      </section>

      <aside className="card p-5 flex flex-col gap-5">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <Choice value={mode} options={[['brush', t('Brush')], ['box', t('Box')]]} onChange={setMode} />
          </div>
          <button type="button" disabled={!history.past.length} onClick={() => setHistory(undo)} aria-label={t('Undo')} title={t('Undo')} className="size-10 rounded-full grid place-items-center hover:bg-fill disabled:opacity-30">
            <Undo2 size={18} aria-hidden="true" />
          </button>
          <button type="button" disabled={!history.future.length} onClick={() => setHistory(redo)} aria-label={t('Redo')} title={t('Redo')} className="size-10 rounded-full grid place-items-center hover:bg-fill disabled:opacity-30">
            <Redo2 size={18} aria-hidden="true" />
          </button>
        </div>
        <p className="text-[13px] text-secondary -mt-2">{mode === 'brush' ? t('Paint over anything you want hidden.') : t('Click to hide a spot, or drag a box. Click a box to remove it.')}</p>
        {mode === 'brush' && (
          <label className="flex flex-col gap-2 text-[13px] font-semibold">
            <span className="flex justify-between">
              {t('Brush size')}
              <span className="font-normal text-secondary">{brush}</span>
            </span>
            <input type="range" min={10} max={80} step={1} value={brush} onChange={(e) => setBrush(Number(e.target.value))} className="accent-[var(--primary)]" />
          </label>
        )}
        <Switch label={t('Find faces automatically')} sub={sub} value={auto} onChange={setAuto} />
        <Choice label={t('Style')} value={style} options={[['blur', t('Blur')], ['pixelate', t('Pixelate')], ['black', t('Black box')]]} onChange={setStyle} />
        <label className="flex flex-col gap-2 text-[13px] font-semibold">
          <span className="flex justify-between">
            {t('Strength')}
            <span className="font-normal text-secondary">{strengths[strength - 1]}</span>
          </span>
          <input type="range" min={1} max={3} step={1} value={strength} onChange={(e) => setStrength(Number(e.target.value))} className="accent-[var(--primary)]" />
        </label>
        {blocked && photo && <p className="text-[13px] text-secondary">{blocked}</p>}
        <Button arrow disabled={!!blocked} onClick={() => onStart({ boxes, strokes, style, strength })} className="w-full">
          {t(tool.verb)}
        </Button>
      </aside>
    </div>
  );
}
