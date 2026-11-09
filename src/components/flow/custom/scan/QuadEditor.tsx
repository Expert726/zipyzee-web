'use client';
// The photo with the paper's four corners on it (Smart scan, ID card scan): drag a corner to move it; outside the
// page is dimmed. Corners are in 0-1 of the photo (src/tools/scanQuad.ts); a move that would twist the shape is
// ignored. A magnified view of the corner being dragged helps place it exactly.
import { useMemo, useRef, useState } from 'react';
import { useT } from '@/i18n/client';
import { isConvex, type Pt, type Quad } from '@/tools/scanQuad';

export function QuadEditor({ photo, quad, onChange, className = '' }: { photo: HTMLCanvasElement; quad: Quad; onChange: (q: Quad) => void; className?: string }) {
  const t = useT();
  const url = useMemo(() => photo.toDataURL('image/jpeg', 0.85), [photo]);
  const box = useRef<HTMLDivElement>(null);
  // the corner being dragged and the view's size then (for the magnifier)
  const [drag, setDrag] = useState<{ i: number; w: number; h: number } | null>(null);

  const at = (e: React.PointerEvent): Pt => {
    const r = box.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };
  const pts = quad.map((p) => `${p.x * 100},${p.y * 100}`).join(' ');
  const labels = [t('Top left'), t('Top right'), t('Bottom right'), t('Bottom left')];

  return (
    <div
      ref={box}
      className={`relative select-none touch-none max-w-full ${className}`}
      onPointerMove={(e) => {
        if (drag == null) return;
        const next = quad.map((p, i) => (i === drag.i ? at(e) : p)) as Quad;
        if (isConvex(next)) onChange(next);
      }}
      onPointerUp={() => setDrag(null)}
      onPointerCancel={() => setDrag(null)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- the photo being scanned */}
      <img src={url} alt="" draggable={false} className="block max-w-full max-h-[64vh] rounded-md" />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full pointer-events-none" aria-hidden="true">
        <path d={`M0 0H100V100H0Z M${pts.replace(/ /g, ' L')}Z`} fill="rgba(0,0,0,0.45)" fillRule="evenodd" />
        <polygon points={pts} fill="none" stroke="#CFF26B" strokeWidth="0.6" vectorEffect="non-scaling-stroke" style={{ strokeWidth: 2 }} />
      </svg>
      {quad.map((p, i) => (
        <button
          key={i}
          type="button"
          aria-label={labels[i]}
          title={labels[i]}
          onPointerDown={(e) => {
            e.preventDefault();
            box.current!.setPointerCapture(e.pointerId);
            setDrag({ i, w: box.current!.clientWidth, h: box.current!.clientHeight });
          }}
          onKeyDown={(e) => {
            // arrow keys nudge the corner (1% of the photo)
            const d = { ArrowLeft: [-0.01, 0], ArrowRight: [0.01, 0], ArrowUp: [0, -0.01], ArrowDown: [0, 0.01] }[e.key];
            if (!d) return;
            e.preventDefault();
            const next = quad.map((c, j) => (j === i ? { x: Math.min(1, Math.max(0, c.x + d[0])), y: Math.min(1, Math.max(0, c.y + d[1])) } : c)) as Quad;
            if (isConvex(next)) onChange(next);
          }}
          className={`absolute size-7 -ms-3.5 -mt-3.5 rounded-full border-[3px] border-[#CFF26B] bg-black/30 shadow-[0_0_0_1px_rgba(0,0,0,0.4)] cursor-grab focus-visible:outline-2 focus-visible:outline-white ${drag?.i === i ? 'scale-125' : ''}`}
          style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
        />
      ))}
      {drag != null && (
        // magnifier: the photo around the corner, 3x, in the corner of the view away from the finger
        <div
          aria-hidden="true"
          className={`absolute top-2 size-28 rounded-full border-2 border-white shadow-raised overflow-hidden pointer-events-none ${quad[drag.i].x < 0.5 ? 'right-2' : 'left-2'}`}
          style={{
            backgroundImage: `url(${url})`,
            backgroundSize: `${drag.w * 3}px auto`,
            backgroundPosition: `${-quad[drag.i].x * drag.w * 3 + 56}px ${-quad[drag.i].y * drag.h * 3 + 56}px`,
          }}
        >
          <span className="absolute left-1/2 top-1/2 size-3 -ms-1.5 -mt-1.5 rounded-full border-2 border-[#CFF26B]" />
        </div>
      )}
    </div>
  );
}
