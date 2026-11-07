'use client';
// "My documents" (the app's custom/text/DocList): newest first, a preview line, words and when it was edited, and a
// menu per document: Rename, Duplicate, Delete (asks first).
import { useEffect, useRef, useState } from 'react';
import { FileText, MoreVertical, Plus } from 'lucide-react';
import { useLanguage, useT } from '@/i18n/client';
import { plainLine, titleOf, wordCount } from '@/textdocs/edit';
import { docsApi, type TextDoc } from '@/textdocs/store';
import { Button } from '../../ui/Button';

export function DocList({ docs, onOpen, onNew }: { docs: TextDoc[]; onOpen: (id: string) => void; onNew: () => void }) {
  const t = useT();
  const lang = useLanguage();
  const [renaming, setRenaming] = useState<TextDoc | null>(null);
  const [deleting, setDeleting] = useState<TextDoc | null>(null);
  const when = (ms: number) => new Date(ms).toLocaleDateString(lang === 'ur' ? 'ur-PK' : 'en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <h2 className="text-[17px] font-semibold flex-1">{t('My documents')}</h2>
        <Button arrow onClick={onNew}>
          <Plus size={18} aria-hidden="true" className="inline me-1" />
          {t('New document')}
        </Button>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {docs.map((d) => {
          const words = wordCount(d.text);
          return (
            <li key={d.id} className="card p-5 flex flex-col gap-2 relative">
              <button type="button" onClick={() => onOpen(d.id)} className="text-start flex flex-col gap-2 after:absolute after:inset-0 after:rounded-card focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-primary">
                <span className="flex items-center gap-2 pe-10">
                  <FileText size={18} className="text-category shrink-0" aria-hidden="true" />
                  <span className="font-semibold text-[16px] truncate" dir="auto">{titleOf(d, t('Untitled'))}</span>
                </span>
                <span className="text-[13px] text-secondary line-clamp-2 min-h-9" dir="auto">{plainLine(d.text).slice(0, 160)}</span>
                <span className="text-[12px] text-secondary">
                  {words === 1 ? t('1 word') : t('{count} words', { count: words })} · {when(d.updatedAt)}
                </span>
              </button>
              <DocMenu
                onRename={() => setRenaming(d)}
                onDuplicate={() => docsApi.duplicate(d.id, t('{title} copy', { title: titleOf(d, t('Untitled')) }))}
                onDelete={() => setDeleting(d)}
              />
            </li>
          );
        })}
      </ul>

      {renaming && (
        <Dialog title={t('Rename document')} onClose={() => setRenaming(null)}>
          <RenameForm
            initial={renaming.title || titleOf(renaming, '')}
            onSave={(v) => {
              docsApi.update(renaming.id, { title: v.trim() });
              setRenaming(null);
            }}
            onCancel={() => setRenaming(null)}
          />
        </Dialog>
      )}
      {deleting && (
        <Dialog title={t('Delete this document?')} onClose={() => setDeleting(null)}>
          <p className="text-[15px] text-muted">{t('"{title}" is deleted from this browser. This can\'t be undone.', { title: titleOf(deleting, t('Untitled')) })}</p>
          <div className="flex gap-2 justify-end mt-5">
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              {t('Cancel')}
            </Button>
            <button
              type="button"
              autoFocus
              onClick={() => {
                docsApi.remove(deleting.id);
                setDeleting(null);
              }}
              className="min-h-12 px-5 rounded-full bg-error text-white font-semibold"
            >
              {t('Delete')}
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function DocMenu({ onRename, onDuplicate, onDelete }: { onRename: () => void; onDuplicate: () => void; onDelete: () => void }) {
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
  const item = (label: string, run: () => void, danger?: boolean) => (
    <button
      type="button"
      role="menuitem"
      onClick={() => {
        setOpen(false);
        run();
      }}
      className={`w-full text-start px-4 py-2.5 text-[14px] hover:bg-fill ${danger ? 'text-error' : ''}`}
    >
      {label}
    </button>
  );
  return (
    <div ref={box} className="absolute top-3 end-3 z-10">
      <button type="button" aria-label={t('More options')} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="size-9 rounded-full grid place-items-center hover:bg-fill">
        <MoreVertical size={18} aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" className="absolute end-0 mt-1 w-44 card !rounded-tile py-1 shadow-raised">
          {item(t('Rename'), onRename)}
          {item(t('Duplicate'), onDuplicate)}
          {item(t('Delete'), onDelete, true)}
        </div>
      )}
    </div>
  );
}

function RenameForm({ initial, onSave, onCancel }: { initial: string; onSave: (v: string) => void; onCancel: () => void }) {
  const t = useT();
  const [v, setV] = useState(initial);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(v);
      }}
    >
      <label className="block text-[13px] font-semibold mb-2" htmlFor="doc-name">
        {t('Name')}
      </label>
      <input id="doc-name" autoFocus value={v} maxLength={120} onChange={(e) => setV(e.target.value)} dir="auto" className="w-full min-h-12 rounded-tile bg-surface border border-line-strong px-4 focus:outline-2 focus:outline-primary" />
      <div className="flex gap-2 justify-end mt-5">
        <Button variant="secondary" onClick={onCancel}>
          {t('Cancel')}
        </Button>
        <button type="submit" className="lime-fill min-h-12 px-6 rounded-full font-semibold">
          {t('Rename')}
        </button>
      </div>
    </form>
  );
}

/** A small modal (the app's AlertDialog): Escape or the backdrop closes it. */
export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="absolute inset-0 bg-overlay" tabIndex={-1} aria-hidden="true" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md shadow-raised">
        <h2 className="text-[19px] font-semibold mb-3">{title}</h2>
        {children}
      </div>
    </div>
  );
}
