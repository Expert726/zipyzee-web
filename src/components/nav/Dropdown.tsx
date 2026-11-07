'use client';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * A header menu: opens on hover (mouse) or click / Enter, closes on Escape, a click outside, a link inside, or when
 * the page is hidden by navigation (Activity keeps state, so it's reset in a layout-effect cleanup).
 * `mega`: the panel spans the header (its nearest positioned parent) instead of sitting under the button.
 */
export function Dropdown({ label, active, mega, children }: { label: string; active?: boolean; mega?: boolean; children: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();
  // a mouse already opened it on hover, so its click must not close it again; keyboard and touch toggle
  const pointer = useRef<string>('');
  const close = () => setOpen(false);

  useLayoutEffect(() => () => setOpen(false), []);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div
      ref={box}
      className={mega ? 'static' : 'relative'}
      onPointerEnter={(e) => e.pointerType === 'mouse' && setOpen(true)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setOpen(false)}
    >
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onPointerDown={(e) => {
          pointer.current = e.pointerType;
        }}
        onClick={(e) => {
          const mouse = e.detail > 0 && pointer.current === 'mouse';
          setOpen((v) => (mouse ? true : !v));
        }}
        className={`flex items-center gap-1 px-3 h-16 text-[14px] font-semibold hover:text-primary ${open || active ? 'text-primary' : ''}`}
      >
        {label}
        <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <div id={id} className={`absolute top-full z-40 ${mega ? 'inset-x-4 sm:inset-x-6' : 'start-0 min-w-[520px]'}`}>
          <div className="card !rounded-[20px] p-5 shadow-raised max-h-[calc(100dvh-90px)] overflow-y-auto">{children(close)}</div>
        </div>
      )}
    </div>
  );
}
