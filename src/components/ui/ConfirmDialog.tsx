'use client';
// The site's own confirm dialog (the app's ui/AlertDialog): a title, what will happen, Cancel and the action (red when
// it removes something). Over the page with a dimmed backdrop; Esc or the backdrop cancels; focus starts on Cancel
// (the safe choice) and Tab stays inside. Use it instead of window.confirm.
import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '@/i18n/client';

type Props = {
  open: boolean;
  title: string;
  body?: string;
  confirm: string;
  /** red action button (delete, sign out of everything...) */
  danger?: boolean;
  busy?: boolean;
  icon?: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({ open, title, body, confirm, danger, busy, icon, onConfirm, onCancel }: Props) {
  const t = useT();
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key !== 'Tab' || !box.current) return;
      // keep Tab inside the dialog
      const items = [...box.current.querySelectorAll<HTMLElement>('button:not([disabled])')];
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, onCancel]);

  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] grid place-items-center p-4" role="alertdialog" aria-modal="true" aria-labelledby={`${id}-t`} aria-describedby={body ? `${id}-b` : undefined}>
      <button type="button" className="absolute inset-0 bg-overlay animate-[fade_150ms_ease-out]" aria-hidden="true" tabIndex={-1} onClick={onCancel} />
      <div ref={box} className="relative card w-full max-w-sm p-6 flex flex-col gap-3 shadow-raised animate-[fade_180ms_ease-out]">
        {icon && <span className={`size-12 rounded-full grid place-items-center ${danger ? 'bg-error/10 text-error' : 'bg-category-tint text-category'}`}>{icon}</span>}
        <h2 id={`${id}-t`} className="text-[18px] font-semibold">
          {title}
        </h2>
        {body && (
          <p id={`${id}-b`} className="text-[14px] text-secondary">
            {body}
          </p>
        )}
        <div className="flex justify-end gap-2 mt-2">
          <button ref={cancel} type="button" onClick={onCancel} className="px-5 min-h-11 rounded-full text-[14px] font-semibold border border-line-strong hover:bg-fill">
            {t('Cancel')}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`px-5 min-h-11 rounded-full text-[14px] font-semibold disabled:opacity-60 ${danger ? 'bg-error text-white hover:brightness-95' : 'lime-fill hover:brightness-95'}`}
          >
            {confirm}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
