'use client';
// Background remover and Change background (the app's custom/image/BgEditor): the subject is found by ormbg in the
// browser (src/lib/segment.ts), then shown on the chosen background: Transparent, White, Light blue, Sand, Blur
// original, a custom colour or your own photo (the app's swatches, src/tools/image/background.ts). "Fix edges" paints
// the mask: Erase takes more away, Restore brings the photo back; undo / redo / reset. Save makes the final image here
// (PNG when transparent, else JPG) and the handler just returns it.
// Under the photo, a strip like remove.bg's: "+" adds photos, click one to work on it, × removes it; the last 5 stay
// in this browser for an hour (src/lib/recentPhotos.ts). Each photo's cut-out and edge fixes are kept while here.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Brush, Eraser, ImagePlus, Loader2, Palette, Redo2, RotateCcw, Undo2 } from 'lucide-react';
import { useT } from '@/i18n/client';
import { decodeImage } from '@/lib/image';
import { addRecent, photoKey, removeRecent, type RecentPhoto } from '@/lib/recentPhotos';
import { subjectMask } from '@/lib/segment';
import { capLongest } from '@/tools/image/sizes';
import { BG_SWATCHES, bgBlurSigma, bgFileName, type BgKind, type BrushMode } from '@/tools/image/background';
import { ToolError } from '@/tools/types';
import { Button } from '../../ui/Button';
import { Choice } from '../../custom/makedoc/parts';
import { PhotoStrip } from '../PhotoStrip';
import { FindingSparkles } from './FindingSparkles';
import type { CustomSetupProps } from './index';

/** Photos are worked on at most this big (memory; plenty for sharing and print). */
const WORK_SIDE = 2048;

type Stroke = { mode: BrushMode; width: number; points: { x: number; y: number }[] };

/** The model's mask with the brush strokes painted in, as a canvas whose alpha is the subject. */
function maskCanvas(alpha: Uint8ClampedArray, w: number, h: number, strokes: Stroke[]): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const img = g.createImageData(w, h);
  for (let i = 0; i < alpha.length; i++) {
    img.data[i * 4 + 3] = alpha[i];
  }
  g.putImageData(img, 0, 0);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const s of strokes) {
    g.globalCompositeOperation = s.mode === 'erase' ? 'destination-out' : 'source-over';
    g.strokeStyle = '#000';
    g.lineWidth = s.width * w;
    g.beginPath();
    s.points.forEach((p, i) => (i ? g.lineTo(p.x * w, p.y * h) : g.moveTo(p.x * w, p.y * h)));
    if (s.points.length === 1) g.lineTo(s.points[0].x * w + 0.1, s.points[0].y * h);
    g.stroke();
  }
  return c;
}

/** The subject on the chosen background. */
function compose(photo: HTMLCanvasElement, mask: HTMLCanvasElement, kind: BgKind, color: string, bgPhoto: ImageBitmap | null): HTMLCanvasElement {
  const { width: w, height: h } = photo;
  const cut = document.createElement('canvas');
  cut.width = w;
  cut.height = h;
  const cg = cut.getContext('2d')!;
  cg.drawImage(photo, 0, 0);
  cg.globalCompositeOperation = 'destination-in';
  cg.drawImage(mask, 0, 0);

  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const g = out.getContext('2d')!;
  if (kind === 'blur') {
    g.filter = `blur(${bgBlurSigma(w, h)}px)`;
    g.drawImage(photo, 0, 0);
    g.filter = 'none';
  } else if (kind === 'photo' && bgPhoto) {
    const k = Math.max(w / bgPhoto.width, h / bgPhoto.height);
    g.drawImage(bgPhoto, (w - bgPhoto.width * k) / 2, (h - bgPhoto.height * k) / 2, bgPhoto.width * k, bgPhoto.height * k);
  } else if (kind !== 'transparent') {
    g.fillStyle = kind === 'custom' ? color : BG_SWATCHES.find((s) => s.value === kind)?.color ?? '#FFFFFF';
    g.fillRect(0, 0, w, h);
  }
  g.drawImage(cut, 0, 0);
  return out;
}

/** Quick picks under "Custom color" (the board's swatches cover white, light blue and sand). */
const QUICK_COLORS = ['#FDE68A', '#FCA5A5', '#F9A8D4', '#C4B5FD', '#93C5FD', '#86EFAC', '#111827', '#6B7280'];

/** Background remover and Change background share their recent photos. */
const GROUP = 'bg';
type Done = { photo: HTMLCanvasElement; alpha: Uint8ClampedArray | null; strokes: Stroke[] };

export function BgEditor({ tool, files, onStart, onFiles }: CustomSetupProps) {
  const t = useT();
  const change = tool.id === 'change-bg';
  // the strip: this visit's photos plus the ones kept from the last hour
  const [photos, setPhotos] = useState<RecentPhoto[]>(() => files.map((file, i) => ({ id: `new-${i}`, file })));
  const [activeId, setActiveId] = useState('new-0');
  const file = (photos.find((p) => p.id === activeId) ?? photos[0])?.file ?? files[0];
  const done = useRef(new Map<string, Done>());
  const addInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let alive = true;
    void addRecent(GROUP, files).then((list) => {
      if (!alive || !list.length) return;
      setPhotos(list);
      setActiveId(list.find((p) => photoKey(p.file) === photoKey(files[0]))?.id ?? list[0].id);
    });
    return () => {
      alive = false;
    };
  }, [files]);
  const [photo, setPhoto] = useState<HTMLCanvasElement | null>(null);
  const [alpha, setAlpha] = useState<Uint8ClampedArray | null>(null);
  const [status, setStatus] = useState<string | null>(t('Finding the subject…'));
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<BgKind>(change ? 'white' : 'transparent');
  const [color, setColor] = useState('#FDE68A');
  const [bgPhoto, setBgPhoto] = useState<ImageBitmap | null>(null);
  const [mode, setMode] = useState<BrushMode | null>(null);
  const [brush, setBrush] = useState(4); // % of the photo's width
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [undone, setUndone] = useState<Stroke[]>([]);
  const [showBefore, setShowBefore] = useState(false);
  const [saving, setSaving] = useState(false);
  const view = useRef<HTMLCanvasElement>(null);
  const drawing = useRef<Stroke | null>(null);
  const bgInput = useRef<HTMLInputElement>(null);
  const colorInput = useRef<HTMLInputElement>(null);
  // what's typed in the hex box (kept apart from the colour until it's a whole #RRGGBB)
  const [hex, setHex] = useState('#FDE68A');
  const [lastColor, setLastColor] = useState(color);
  if (lastColor !== color) {
    setLastColor(color);
    setHex(color.toUpperCase());
  }

  // the photo, then its subject (or what this visit already found for it)
  const key = photoKey(file);
  useEffect(() => {
    let alive = true;
    (async () => {
      const have = done.current.get(key);
      setError(null);
      setUndone([]);
      setMode(null);
      if (have) {
        setPhoto(have.photo);
        setAlpha(have.alpha);
        setStrokes(have.strokes);
        setStatus(have.alpha ? null : t('Finding the subject…'));
        if (have.alpha) return;
      } else {
        setPhoto(null);
        setAlpha(null);
        setStrokes([]);
        setStatus(t('Finding the subject…'));
      }
      try {
        const bmp = await decodeImage(file);
        const size = capLongest({ w: bmp.width, h: bmp.height }, WORK_SIDE);
        const c = document.createElement('canvas');
        c.width = size.w;
        c.height = size.h;
        c.getContext('2d')!.drawImage(bmp, 0, 0, size.w, size.h);
        bmp.close();
        if (!alive) return;
        setPhoto(c);
        done.current.set(key, { photo: c, alpha: null, strokes: [] });
        const mask = await subjectMask(c, (pct) => alive && setStatus(`${t('Getting the background tool ready (one time only)…')} ${pct}%`));
        done.current.set(key, { photo: c, alpha: mask, strokes: [] });
        if (!alive) return;
        setStatus(null);
        setAlpha(mask);
      } catch (e) {
        if (alive) setError(e instanceof ToolError ? e.message : t('This photo could not be read. Try another one.'));
      }
    })();
    return () => {
      alive = false;
    };
  }, [file, key, t]);
  // edge fixes stay with their photo
  useEffect(() => {
    const have = done.current.get(key);
    if (have && have.alpha) have.strokes = strokes;
  }, [key, strokes]);

  const addPhotos = async (list: FileList | null) => {
    const picked = [...(list ?? [])].filter((f) => /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name));
    if (!picked.length) return;
    const next = await addRecent(GROUP, picked);
    setPhotos(next);
    setActiveId(next.find((p) => photoKey(p.file) === photoKey(picked[0]))?.id ?? next[0]?.id);
  };
  const removePhoto = async (id: string) => {
    const gone = photos.find((p) => p.id === id);
    if (gone) done.current.delete(photoKey(gone.file));
    await removeRecent(id);
    const next = photos.filter((p) => p.id !== id);
    setPhotos(next);
    if (!next.length) return onFiles?.([]);
    if (id === activeId) setActiveId(next[0].id);
  };
  const strip = (
    <>
      <PhotoStrip photos={photos} active={photos.find((p) => p.file === file)?.id} onPick={setActiveId} onRemove={(id) => void removePhoto(id)} onAdd={() => addInput.current?.click()} />
      <input
        ref={addInput}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        multiple
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          void addPhotos(e.target.files);
          e.target.value = '';
        }}
      />
    </>
  );

  const mask = useMemo(() => (photo && alpha ? maskCanvas(alpha, photo.width, photo.height, strokes) : null), [photo, alpha, strokes]);

  // the preview
  useEffect(() => {
    const c = view.current;
    if (!c || !photo) return;
    c.width = photo.width;
    c.height = photo.height;
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, c.width, c.height);
    if (showBefore || !mask) g.drawImage(photo, 0, 0);
    else g.drawImage(compose(photo, mask, kind, color, bgPhoto), 0, 0);
  }, [photo, mask, kind, color, bgPhoto, showBefore]);

  const pt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };
  // a stroke in progress is drawn straight onto the preview; it joins the mask when the pointer lifts
  const paintLive = (s: Stroke) => {
    const c = view.current;
    if (!c) return;
    const g = c.getContext('2d')!;
    g.save();
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.lineWidth = s.width * c.width;
    g.strokeStyle = s.mode === 'erase' ? 'rgba(239,68,68,0.45)' : 'rgba(34,197,94,0.45)';
    const [a, b] = s.points.slice(-2);
    g.beginPath();
    g.moveTo(a.x * c.width, a.y * c.height);
    g.lineTo((b ?? a).x * c.width, (b ?? a).y * c.height);
    g.stroke();
    g.restore();
  };

  const save = async () => {
    if (!photo || !mask) return;
    setSaving(true);
    const out = compose(photo, mask, kind, color, bgPhoto);
    const png = kind === 'transparent';
    const blob = await new Promise<Blob | null>((r) => out.toBlob(r, png ? 'image/png' : 'image/jpeg', 0.92));
    setSaving(false);
    if (blob) onStart({ blob, name: bgFileName(file.name, kind), remove: !change });
  };

  if (error) {
    return (
      <div className="card p-8 text-center flex flex-col items-center gap-5">
        <p className="text-[17px] font-semibold" role="alert">
          {error}
        </p>
        {strip}
      </div>
    );
  }

  const ready = !!mask;
  const swatches = BG_SWATCHES;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
      <section className="card p-3 sm:p-4 flex flex-col items-center gap-3">
        <div className="relative w-full flex justify-center rounded-lg bg-[repeating-conic-gradient(#e5e7eb_0_25%,#fff_0_50%)] bg-[length:22px_22px]">
          <canvas
            ref={view}
            aria-label={showBefore ? t('Before') : t('After')}
            className={`block max-w-full max-h-[70vh] w-auto h-auto ${mode && ready ? 'cursor-crosshair touch-none' : ''}`}
            onPointerDown={(e) => {
              if (!mode || !ready || showBefore) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              drawing.current = { mode, width: brush / 100, points: [pt(e)] };
              paintLive(drawing.current);
            }}
            onPointerMove={(e) => {
              if (!drawing.current || !e.buttons) return;
              drawing.current.points.push(pt(e));
              paintLive(drawing.current);
            }}
            onPointerUp={() => {
              // taken now: the state update runs later, after drawing.current is cleared
              const stroke = drawing.current;
              drawing.current = null;
              if (!stroke) return;
              setStrokes((s) => [...s, stroke]);
              setUndone([]);
            }}
            onPointerCancel={() => (drawing.current = null)}
          />
          {status && photo && <FindingSparkles label={status} />}
          {status && !photo && (
            <div className="min-h-64 w-full grid place-items-center" role="status">
              <Loader2 size={28} className="animate-spin text-primary" aria-hidden="true" />
              <span className="sr-only">{status}</span>
            </div>
          )}
        </div>
        <Choice value={showBefore ? 'before' : 'after'} options={[['after', t('After')], ['before', t('Before')]]} onChange={(v) => setShowBefore(v === 'before')} />
        <div className="w-full border-t border-line pt-4 mt-1 flex flex-col items-center gap-2">
          {strip}
          <p className="text-[12px] text-secondary">{t('Your last {count} photos stay in this browser for an hour.', { count: 5 })}</p>
        </div>
      </section>

      <aside className="card p-5 flex flex-col gap-5 lg:sticky lg:top-20">
        <fieldset>
          <legend className="text-[13px] font-semibold mb-2">{t('Background')}</legend>
          <div className="grid grid-cols-4 gap-2" role="radiogroup">
            {swatches.map((s) => {
              const on = kind === s.value;
              const look =
                s.value === 'transparent'
                  ? 'bg-[repeating-conic-gradient(#e5e7eb_0_25%,#fff_0_50%)] bg-[length:10px_10px]'
                  : s.value === 'blur'
                    ? 'bg-gradient-to-br from-[#C9BFB0] to-[#E8E2D8]'
                    : '';
              const custom = s.value === 'custom';
              return (
                <button
                  key={s.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={s.label}
                  title={s.label}
                  disabled={!ready}
                  onClick={() => {
                    if (s.value === 'photo') return bgInput.current?.click();
                    setKind(s.value);
                    // the custom tile opens the colour picker straight away
                    if (custom) colorInput.current?.click();
                  }}
                  className={`aspect-square rounded-tile border-2 grid place-items-center disabled:opacity-40 ${on ? 'border-primary' : 'border-line'} ${look}`}
                  style={
                    s.color
                      ? { background: s.color }
                      : custom
                        ? { background: on ? color : 'conic-gradient(from 90deg, #F87171, #FBBF24, #A3E635, #34D399, #38BDF8, #818CF8, #E879F9, #F87171)' }
                        : undefined
                  }
                >
                  {custom && (
                    <span className="size-7 rounded-full bg-white/85 grid place-items-center shadow-sm">
                      <Palette size={16} className="text-[#3F3A33]" aria-hidden="true" />
                    </span>
                  )}
                  {s.value === 'photo' && <ImagePlus size={20} className="text-secondary" aria-hidden="true" />}
                  {s.value === 'blur' && <span className="text-[10px] font-semibold text-[#3F3A33]">{t('Blur')}</span>}
                </button>
              );
            })}
          </div>
          {/* the system colour picker, opened by the custom tile */}
          <input
            ref={colorInput}
            type="color"
            value={color}
            onChange={(e) => {
              setColor(e.target.value);
              setKind('custom');
            }}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
          />
          {kind === 'custom' && (
            <div className="mt-3 flex flex-col gap-2.5">
              <p className="text-[13px] font-semibold">{t('Custom color')}</p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('Custom color')}>
                {QUICK_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={color.toLowerCase() === c.toLowerCase()}
                    aria-label={c}
                    onClick={() => setColor(c)}
                    className={`size-8 rounded-full border ${color.toLowerCase() === c.toLowerCase() ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface border-transparent' : 'border-line-strong'}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => colorInput.current?.click()} aria-label={t('More colors')} title={t('More colors')} className="size-10 shrink-0 rounded-tile border border-line-strong" style={{ background: color }} />
                <input
                  value={hex}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    setHex(v);
                    const full = v.startsWith('#') ? v : `#${v}`;
                    if (/^#[0-9a-f]{6}$/i.test(full)) setColor(full);
                  }}
                  onBlur={() => setHex(color.toUpperCase())}
                  maxLength={7}
                  spellCheck={false}
                  dir="ltr"
                  aria-label={t('Hex code')}
                  className="flex-1 min-w-0 min-h-10 rounded-tile bg-surface border border-line-strong px-3 text-[14px] font-mono uppercase"
                />
              </div>
            </div>
          )}
          <input
            ref={bgInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            tabIndex={-1}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              try {
                setBgPhoto(await createImageBitmap(f));
                setKind('photo');
              } catch {
                setError(t('This photo could not be read. Try another one.'));
              }
            }}
          />
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="text-[13px] font-semibold mb-2">{t('Fix edges')}</legend>
          <div className="flex gap-2">
            {(
              [
                ['erase', t('Erase'), Eraser],
                ['restore', t('Restore'), Brush],
              ] as const
            ).map(([m, label, Icon]) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                disabled={!ready}
                onClick={() => setMode(mode === m ? null : m)}
                className={`flex-1 min-h-10 rounded-full inline-flex items-center justify-center gap-1.5 text-sm font-medium border disabled:opacity-40 ${mode === m ? 'bg-ink text-on-ink border-transparent' : 'border-line-strong hover:bg-fill'}`}
              >
                <Icon size={16} aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
          {mode && (
            <label className="flex flex-col gap-1 text-[13px] font-semibold">
              <span className="flex">
                <span className="flex-1">{t('Brush size')}</span>
                <span className="text-primary">{brush}%</span>
              </span>
              <input type="range" min={1} max={15} value={brush} onChange={(e) => setBrush(Number(e.target.value))} className="accent-[var(--primary)]" />
            </label>
          )}
          <div className="flex gap-1">
            <button type="button" disabled={!strokes.length} onClick={() => { setUndone((u) => [strokes[strokes.length - 1], ...u]); setStrokes((s) => s.slice(0, -1)); }} aria-label={t('Undo')} title={t('Undo')} className="size-10 rounded-full grid place-items-center hover:bg-fill disabled:opacity-30">
              <Undo2 size={18} aria-hidden="true" />
            </button>
            <button type="button" disabled={!undone.length} onClick={() => { setStrokes((s) => [...s, undone[0]]); setUndone((u) => u.slice(1)); }} aria-label={t('Redo')} title={t('Redo')} className="size-10 rounded-full grid place-items-center hover:bg-fill disabled:opacity-30">
              <Redo2 size={18} aria-hidden="true" />
            </button>
            <button type="button" disabled={!strokes.length} onClick={() => { setStrokes([]); setUndone([]); }} className="ms-auto min-h-10 px-3 rounded-full inline-flex items-center gap-1.5 text-[13px] font-medium hover:bg-fill disabled:opacity-30">
              <RotateCcw size={16} aria-hidden="true" />
              {t('Reset edges')}
            </button>
          </div>
        </fieldset>

        <p className="text-[12px] text-secondary">{t('Removed in your browser. Saves as {value}.', { value: kind === 'transparent' ? 'PNG' : 'JPG' })}</p>
        <Button arrow disabled={!ready || saving} onClick={() => void save()} className="w-full">
          {t(tool.verb)}
        </Button>
      </aside>
    </div>
  );
}
