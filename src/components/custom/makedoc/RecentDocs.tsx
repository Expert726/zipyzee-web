'use client';
// "Last 24 hours" (the app's RecentList): each document's kind, title, summary and when it deletes; a menu with
// Duplicate and Delete.
import { useEffect, useRef, useState } from 'react';
import { Clock, MoreVertical } from 'lucide-react';
import { useT } from '@/i18n/client';
import { kindLabel } from '@/makedocs/kinds';
import { zeeDocs } from '@/makedocs/store';
import type { ZeeDoc } from '@/makedocs/types';
import { Button } from '../../ui/Button';
import { Dialog } from '../text/DocList';
import { deletesIn, docSummary, KIND_ICONS } from './parts';

export function RecentDocs({ docs, onOpen }: { docs: ZeeDoc[]; onOpen: (id: string) => void }) {
  const t = useT();
  const [deleting, setDeleting] = useState<ZeeDoc | null>(null);
  return (
    <section className="flex flex-col gap-3" aria-labelledby="zee-recent">
      <div className="flex items-baseline gap-2">
        <h2 id="zee-recent" className="text-[17px] font-semibold flex-1">
          {t('Last 24 hours')}
        </h2>
        <span className="text-[12px] text-secondary flex items-center gap-1">
          <Clock size={14} aria-hidden="true" />
          {t('Kept in this browser')}
        </span>
      </div>
      {!docs.length ? (
        <div className="card p-6 text-center">
          <p className="font-semibold">{t('Nothing made yet')}</p>
          <p className="text-[13px] text-secondary mt-1">{t('Ask Zee for a paper, notes or a list, or start blank.')}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {docs.map((d) => {
            const Icon = KIND_ICONS[d.kind];
            return (
              <li key={d.id} className="card !rounded-row p-4 relative">
                <button type="button" onClick={() => onOpen(d.id)} className="w-full text-start flex items-start gap-3 pe-10 after:absolute after:inset-0 after:rounded-row focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-primary">
                  <span className="size-10 shrink-0 rounded-tile bg-category-tint text-category grid place-items-center">
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold truncate" dir="auto">{d.title || t('Untitled')}</span>
                    <span className="block text-[12px] text-secondary">{`${kindLabel(d.kind)} · ${docSummary(d, t)}`}</span>
                    <span className="block text-[12px] text-warning mt-0.5">{deletesIn(d.expiresAt, t)}</span>
                  </span>
                </button>
                <Menu onDuplicate={() => zeeDocs.duplicate(d.id, t('{title} copy', { title: d.title || t('Untitled') }))} onDelete={() => setDeleting(d)} />
              </li>
            );
          })}
        </ul>
      )}
      {deleting && (
        <Dialog title={t('Delete this document?')} onClose={() => setDeleting(null)}>
          <p className="text-[15px] text-muted">{t('"{title}" is deleted from this browser. This can\'t be undone.', { title: deleting.title || t('Untitled') })}</p>
          <div className="flex gap-2 justify-end mt-5">
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              {t('Cancel')}
            </Button>
            <button
              type="button"
              autoFocus
              onClick={() => {
                zeeDocs.remove(deleting.id);
                setDeleting(null);
              }}
              className="min-h-12 px-5 rounded-full bg-error text-white font-semibold"
            >
              {t('Delete')}
            </button>
          </div>
        </Dialog>
      )}
    </section>
  );
}

function Menu({ onDuplicate, onDelete }: { onDuplicate: () => void; onDelete: () => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const off = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', off);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', off);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  return (
    <div ref={box} className="absolute top-3 end-3 z-10">
      <button type="button" aria-label={t('More options')} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="size-9 rounded-full grid place-items-center hover:bg-fill">
        <MoreVertical size={18} aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" className="absolute end-0 mt-1 w-40 card !rounded-tile py-1 shadow-raised">
          {[
            [t('Duplicate'), onDuplicate, false],
            [t('Delete'), onDelete, true],
          ].map(([label, run, danger]) => (
            <button
              key={label as string}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                (run as () => void)();
              }}
              className={`w-full text-start px-4 py-2.5 text-[14px] hover:bg-fill ${danger ? 'text-error' : ''}`}
            >
              {label as string}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
