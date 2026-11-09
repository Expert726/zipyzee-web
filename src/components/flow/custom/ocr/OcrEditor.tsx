'use client';
// Image to text and Urdu OCR (the app: custom/ocr/OcrAreaStep + OcrResultStep / UrduResultStep): the photo, Languages
// (English / Urdu / Arabic; Urdu OCR starts on Urdu), an optional area (drag a box to read only that part), Read text,
// then the text to fix, Copy, or save as .txt (handlers/ocrTools.ts). Read in the browser (src/lib/ocr.ts).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Loader2, ScanText, X } from 'lucide-react';
import { useT } from '@/i18n/client';
import { decodeImage } from '@/lib/image';
import { readText, RTL_LANGS, type OcrLang } from '@/lib/ocr';
import { capLongest } from '@/tools/image/sizes';
import { ToolError } from '@/tools/types';
import { Button } from '../../../ui/Button';
import type { CustomSetupProps } from '../index';

type Box = { x: number; y: number; w: number; h: number };
const LANGS: [OcrLang, string][] = [['eng', 'English'], ['urd', 'Urdu'], ['ara', 'Arabic']];

export function OcrEditor({ tool, files, onStart, onReplace }: CustomSetupProps) {
  const t = useT();
  const file = files[0];
  const [photo, setPhoto] = useState<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [langs, setLangs] = useState<OcrLang[]>(tool.id === 'urdu-ocr' ? ['urd'] : ['eng']);
  const [area, setArea] = useState<Box | null>(null);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    void decodeImage(file)
      .then((bmp) => {
        const s = capLongest({ w: bmp.width, h: bmp.height }, 3000);
        const c = document.createElement('canvas');
        c.width = s.w;
        c.height = s.h;
        c.getContext('2d')!.drawImage(bmp, 0, 0, s.w, s.h);
        bmp.close();
        if (alive) setPhoto(c);
      })
      .catch((e) => alive && setError(e instanceof ToolError ? e.message : t('This photo could not be read. Try another one.')));
    return () => {
      alive = false;
    };
  }, [file, t]);
  const url = useMemo(() => photo?.toDataURL('image/jpeg', 0.85), [photo]);

  const at = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };

  const read = async () => {
    if (!photo) return;
    setText(null);
    setError(null);
    setStatus(t('Reading text'));
    try {
      let src = photo;
      if (area) {
        src = document.createElement('canvas');
        src.width = Math.max(1, Math.round(area.w * photo.width));
        src.height = Math.max(1, Math.round(area.h * photo.height));
        src.getContext('2d')!.drawImage(photo, area.x * photo.width, area.y * photo.height, src.width, src.height, 0, 0, src.width, src.height);
      }
      const r = await readText(src, langs, (pct, what) => setStatus(what === 'download' ? `${t('Getting the text reader ready (one time only)…')} ${pct}%` : `${t('Reading text')} ${pct}%`));
      setText(r.text);
      if (!r.text) setError(t('No text found in the photo. Take it straight on, in good light.'));
    } catch {
      setError(t('The text reader couldn\'t start. Check your internet the first time, then try again.'));
    }
    setStatus(null);
  };

  if (error && !photo) {
    return (
      <div className="card p-8 text-center flex flex-col items-center gap-3" role="alert">
        <p className="text-[17px] font-semibold">{error}</p>
        <Button variant="secondary" onClick={onReplace}>
          {t('Choose a photo')}
        </Button>
      </div>
    );
  }

  const rtl = langs.every((l) => RTL_LANGS.includes(l));

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px] items-start">
      <section className="card p-3 sm:p-5 flex flex-col items-center gap-3">
        {!url ? (
          <Loader2 size={26} className="animate-spin text-primary my-20" aria-hidden="true" />
        ) : (
          <div
            ref={box}
            className="relative select-none touch-none cursor-crosshair max-w-full"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              const p = at(e);
              setDrag(p);
              setArea(null);
            }}
            onPointerMove={(e) => {
              if (!drag) return;
              const p = at(e);
              const b = { x: Math.min(drag.x, p.x), y: Math.min(drag.y, p.y), w: Math.abs(p.x - drag.x), h: Math.abs(p.y - drag.y) };
              setArea(b.w > 0.02 && b.h > 0.02 ? b : null);
            }}
            onPointerUp={() => setDrag(null)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- the photo being read */}
            <img src={url} alt="" draggable={false} className="block max-w-full max-h-[62vh] rounded-md" />
            {area && <span aria-hidden="true" className="absolute border-2 border-[#CFF26B] bg-[#CFF26B]/15 pointer-events-none" style={{ left: `${area.x * 100}%`, top: `${area.y * 100}%`, width: `${area.w * 100}%`, height: `${area.h * 100}%`, boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)', clipPath: 'none' }} />}
          </div>
        )}
        <p className="text-[12px] text-secondary text-center">
          {area ? (
            <button type="button" onClick={() => setArea(null)} className="inline-flex items-center gap-1 text-primary font-medium hover:underline">
              <X size={13} aria-hidden="true" />
              {t('Read the whole photo')}
            </button>
          ) : (
            t('Drag over a part of the photo to read only that part.')
          )}
        </p>
      </section>

      <aside className="card p-5 flex flex-col gap-4 lg:sticky lg:top-20">
        <fieldset>
          <legend className="text-[13px] font-semibold mb-2">{t('Languages in the photo')}</legend>
          <div className="flex flex-wrap gap-2">
            {LANGS.map(([l, label]) => {
              const on = langs.includes(l);
              return (
                <button key={l} type="button" role="checkbox" aria-checked={on} onClick={() => setLangs((x) => (on ? (x.length > 1 ? x.filter((y) => y !== l) : x) : [...x, l]))} className={`px-3.5 min-h-9 rounded-full text-sm font-medium border inline-flex items-center gap-1 ${on ? 'bg-ink text-on-ink border-transparent' : 'bg-surface border-line-strong hover:bg-fill'}`}>
                  {on && <Check size={14} aria-hidden="true" />}
                  {t(label)}
                </button>
              );
            })}
          </div>
        </fieldset>
        <Button arrow={!text} variant={text ? 'secondary' : 'primary'} disabled={!photo || !!status} onClick={() => void read()}>
          {status ? <Loader2 size={17} className="inline me-2 animate-spin" aria-hidden="true" /> : <ScanText size={17} className="inline me-2" aria-hidden="true" />}
          {status ?? (text != null ? t('Read again') : t(tool.verb))}
        </Button>
        {error && photo && <p className="text-[13px] text-warning" role="status">{error}</p>}
        {text != null && text !== '' && (
          <>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={12} dir={rtl ? 'rtl' : 'auto'} aria-label={t('Text')} className={`rounded-tile bg-surface border border-line-strong p-3 text-[15px] leading-relaxed ${rtl ? 'font-[var(--font-naskh)] text-[17px] leading-loose' : ''}`} />
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                onClick={async () => {
                  await navigator.clipboard.writeText(text).catch(() => {});
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1600);
                }}
              >
                {copied ? <Check size={17} className="inline me-2" aria-hidden="true" /> : <Copy size={17} className="inline me-2" aria-hidden="true" />}
                {copied ? t('Copied') : t('Copy text')}
              </Button>
              <Button onClick={() => onStart({ text })}>{t('Save as .txt')}</Button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
