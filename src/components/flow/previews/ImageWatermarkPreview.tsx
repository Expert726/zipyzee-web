'use client';
// Image watermark's live preview: the whole photo with the watermark as it will be saved (src/lib/watermarkImage.ts,
// the handler's own drawing), redrawn on every change. Several photos: pick which one to look at.
import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useT } from '@/i18n/client';
import { decodeImage } from '@/lib/image';
import { drawImageWatermark, readImageWm } from '@/lib/watermarkImage';
import { capLongest } from '@/tools/image/sizes';
import type { LivePreviewProps } from './index';

const SIDE = 1400;

export function ImageWatermarkPreview({ files, values }: LivePreviewProps) {
  const t = useT();
  const [at, setAt] = useState(0);
  const file = files[Math.min(at, files.length - 1)];
  const [photo, setPhoto] = useState<HTMLCanvasElement | null>(null);
  const [logo, setLogo] = useState<ImageBitmap | null>(null);
  const view = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let alive = true;
    void decodeImage(file)
      .then((bmp) => {
        const s = capLongest({ w: bmp.width, h: bmp.height }, SIDE);
        const c = document.createElement('canvas');
        c.width = s.w;
        c.height = s.h;
        c.getContext('2d')!.drawImage(bmp, 0, 0, s.w, s.h);
        bmp.close();
        if (alive) setPhoto(c);
      })
      .catch(() => alive && setPhoto(null));
    return () => {
      alive = false;
    };
  }, [file]);

  const logoFile = values.logo instanceof File ? values.logo : null;
  useEffect(() => {
    let alive = true;
    let made: ImageBitmap | null = null;
    if (logoFile)
      void createImageBitmap(logoFile)
        .then((b) => {
          made = b;
          if (alive) setLogo(b);
        })
        .catch(() => alive && setLogo(null));
    else void Promise.resolve().then(() => alive && setLogo(null));
    return () => {
      alive = false;
      made?.close();
    };
  }, [logoFile]);

  useEffect(() => {
    const c = view.current;
    if (!c || !photo) return;
    const id = requestAnimationFrame(() => {
      c.width = photo.width;
      c.height = photo.height;
      const g = c.getContext('2d')!;
      g.drawImage(photo, 0, 0);
      drawImageWatermark(g, c.width, c.height, readImageWm(values, logo));
    });
    return () => cancelAnimationFrame(id);
  }, [photo, logo, values]);

  return (
    <div className="flex flex-col items-center gap-3 pt-2">
      <p className="self-start text-[13px] font-semibold">{t('Preview')}</p>
      <div className="w-full grid place-items-center rounded-lg bg-[repeating-conic-gradient(#e5e7eb_0_25%,#fff_0_50%)] bg-[length:20px_20px] min-h-48">
        {photo ? (
          <canvas ref={view} className="block max-w-full max-h-[65vh] w-auto h-auto" aria-label={t('Preview')} />
        ) : (
          <Loader2 size={24} className="animate-spin text-primary" aria-hidden="true" />
        )}
      </div>
      {files.length > 1 && (
        <div className="flex flex-wrap justify-center gap-1.5" role="radiogroup" aria-label={t('Preview')}>
          {files.map((f, i) => (
            <button key={`${f.name}-${i}`} type="button" role="radio" aria-checked={i === at} onClick={() => setAt(i)} className={`min-w-9 min-h-9 px-2 rounded-full text-[13px] font-medium border ${i === at ? 'bg-ink text-on-ink border-transparent' : 'border-line-strong hover:bg-fill'}`}>
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
