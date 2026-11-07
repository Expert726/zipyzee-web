'use client';
// Draw on photo, step 2 (the app's custom/image/DrawStep; no board): the photo to draw on, Pen / Highlighter /
// Eraser / Text, 8 colours + any colour, size, Undo / Redo (also Ctrl+Z / Ctrl+Shift+Z). The drawing is its own
// layer, so the eraser removes ink, not the photo. Text: click where it goes and type (Enter places it, Esc cancels).
// Saved by handlers/drawImage.ts with the same renderer (src/lib/drawImage.ts) at the photo's full size.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Eraser, Highlighter, Loader2, PenLine, Redo2, Type, Undo2 } from 'lucide-react';
import { useT } from '@/i18n/client';
import { drawFont, drawItems } from '@/lib/drawImage';
import { decodeImage } from '@/lib/image';
import { addItem, emptyDrawing, hasDrawing, PEN_COLORS, redoDraw, undoDraw, type DrawStroke, type DrawTool } from '@/tools/image/draw';
import { capLongest } from '@/tools/image/sizes';
import { ToolError } from '@/tools/types';
import { Button } from '../../ui/Button';
import type { CustomSetupProps } from './index';

const PREVIEW_SIDE = 1600;
const TOOLS = [
  { id: 'pen', icon: PenLine },
  { id: 'highlighter', icon: Highlighter },
  { id: 'eraser', icon: Eraser },
  { id: 'text', icon: Type },
] as const;

export function DrawEditor({ tool, files, onStart, onReplace }: CustomSetupProps) {
  const t = useT();
  const file = files[0];
  const [photo, setPhoto] = useState<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState(() => emptyDrawing());
  const [mode, setMode] = useState<DrawTool>('pen');
  const [color, setColor] = useState(PEN_COLORS[2]);
  const [brush, setBrush] = useState(8);
  const [live, setLive] = useState<DrawStroke | null>(null);
  const [textAt, setTextAt] = useState<{ x: number; y: number; short: number } | null>(null);
  const [draft, setDraft] = useState('');
  const ink = useRef<HTMLCanvasElement>(null);
  const items = history.present;
  const url = useMemo(() => photo?.toDataURL('image/jpeg', 0.9), [photo]);

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

  // the ink layer over the photo, redrawn on every change
  useEffect(() => {
    const c = ink.current;
    if (!c || !photo) return;
    const id = requestAnimationFrame(() => {
      c.width = photo.width;
      c.height = photo.height;
      drawItems(c.getContext('2d')!, c.width, c.height, live ? [...items, live] : items);
    });
    return () => cancelAnimationFrame(id);
  }, [photo, items, live]);

  // Ctrl / Cmd + Z, Shift for redo (not while typing)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z' || (e.target as HTMLElement)?.closest('input, textarea')) return;
      e.preventDefault();
      setHistory(e.shiftKey ? redoDraw : undoDraw);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const box = () => ink.current!.getBoundingClientRect();
  const frac = (e: React.PointerEvent): [number, number] => {
    const r = box();
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
  };

  const placeText = () => {
    const text = draft.trim();
    if (text && textAt) setHistory((h) => addItem(h, { kind: 'text', text, color, s: (brush * 2.5) / textAt.short, x: textAt.x, y: textAt.y }));
    setTextAt(null);
    setDraft('');
  };

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (textAt) return placeText();
    const r = box();
    const short = Math.min(r.width, r.height);
    const [x, y] = frac(e);
    if (mode === 'text') {
      setDraft('');
      setTextAt({ x, y, short });
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    setLive({ kind: 'stroke', tool: mode, color, s: brush / short, p: [[x, y]] });
  };
  const onMove = (e: React.PointerEvent) => {
    if (live) setLive({ ...live, p: [...live.p, frac(e)] });
  };
  const onUp = () => {
    if (live) setHistory((h) => addItem(h, live));
    setLive(null);
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

  const label = { pen: t('Pen'), highlighter: t('Highlighter'), eraser: t('Eraser'), text: t('Text') };
  const shownSize = textAt ? brush * 2.5 : 0;

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
            className={`relative select-none touch-none max-w-full ${mode === 'text' ? 'cursor-text' : 'cursor-crosshair'}`}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={() => setLive(null)}
            role="img"
            aria-label={t('Photo. Draw on it with your finger.')}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- the photo being drawn on */}
            <img src={url} alt="" draggable={false} className="block max-w-full max-h-[70vh] rounded-md" />
            <canvas ref={ink} className="absolute inset-0 size-full pointer-events-none" />
            {textAt && (
              <input
                autoFocus
                value={draft}
                maxLength={80}
                onChange={(e) => setDraft(e.target.value)}
                onPointerDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') placeText();
                  if (e.key === 'Escape') setTextAt(null);
                }}
                onBlur={placeText}
                dir="auto"
                aria-label={t('Add text')}
                placeholder={t('Text')}
                className="absolute bg-transparent outline-2 outline-dashed outline-white/80 rounded px-0.5 min-w-24 font-semibold"
                style={{ left: `${textAt.x * 100}%`, top: `calc(${textAt.y * 100}% - ${shownSize}px)`, fontSize: shownSize, lineHeight: 1.2, color, fontFamily: drawFont(), width: `${Math.max(6, draft.length + 2)}ch` }}
              />
            )}
          </div>
        )}
      </section>

      <aside className="card p-5 flex flex-col gap-5">
        <div className="flex items-center justify-end gap-1 -mb-2">
          <button type="button" disabled={!history.past.length} onClick={() => setHistory(undoDraw)} aria-label={t('Undo')} title={t('Undo')} className="size-10 rounded-full grid place-items-center hover:bg-fill disabled:opacity-30">
            <Undo2 size={18} aria-hidden="true" />
          </button>
          <button type="button" disabled={!history.future.length} onClick={() => setHistory(redoDraw)} aria-label={t('Redo')} title={t('Redo')} className="size-10 rounded-full grid place-items-center hover:bg-fill disabled:opacity-30">
            <Redo2 size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2" role="radiogroup">
          {TOOLS.map(({ id, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={mode === id}
              onClick={() => setMode(id)}
              className={`min-h-16 rounded-tile flex flex-col items-center justify-center gap-1 text-[12px] font-semibold border ${mode === id ? 'border-2 border-primary text-primary bg-primary/10' : 'border-line-strong text-secondary hover:bg-fill'}`}
            >
              <Icon size={20} aria-hidden="true" />
              {label[id]}
            </button>
          ))}
        </div>
        {mode === 'text' && <p className="text-[13px] text-secondary -mt-2">{t('Tap the photo where the text should go.')}</p>}

        {mode !== 'eraser' && (
          <fieldset>
            <legend className="text-[13px] font-semibold mb-2">{t('Color')}</legend>
            <div className="flex flex-wrap gap-2.5" role="radiogroup">
              {PEN_COLORS.map((c) => (
                <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={c} onClick={() => setColor(c)} className={`size-9 rounded-full border ${color === c ? 'ring-3 ring-primary ring-offset-2 ring-offset-surface border-transparent' : 'border-line-strong'}`} style={{ background: c }} />
              ))}
              <label className="size-9 rounded-full border border-line-strong cursor-pointer overflow-hidden relative" title={t('More colors')} style={{ background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' }}>
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label={t('More colors')} className="absolute inset-0 opacity-0 cursor-pointer" />
              </label>
            </div>
          </fieldset>
        )}

        <label className="flex flex-col gap-2 text-[13px] font-semibold">
          <span className="flex justify-between">
            {mode === 'text' ? t('Text size') : t('Brush size')}
            <span className="font-normal text-secondary">{brush}</span>
          </span>
          <input type="range" min={2} max={40} step={1} value={brush} onChange={(e) => setBrush(Number(e.target.value))} className="accent-[var(--primary)]" />
        </label>

        {photo && !hasDrawing(items) && <p className="text-[13px] text-secondary">{t('Draw something first.')}</p>}
        <Button arrow disabled={!photo || !hasDrawing(items)} onClick={() => onStart({ items })} className="w-full">
          {t(tool.verb)}
        </Button>
      </aside>
    </div>
  );
}
