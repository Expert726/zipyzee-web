'use client';
// Organize PDF's editor (the app's custom/OrganizeStep): every page as a thumbnail. Drag a page to move it; click to
// select (several at once); Rotate, Duplicate, Delete and Move earlier / later act on the selection; Blank page and
// Add photo add pages at the end. The pure edits are the app's src/tools/organize.ts; applyOrganize builds the PDF.
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Copy, FilePlus2, ImagePlus, Loader2, RotateCw, Trash2, X } from 'lucide-react';
import { useT } from '@/i18n/client';
import { usePdfThumbs } from '@/lib/usePdfThumbs';
import { addBlank, addPhotos, deleteSelected, duplicateSelected, initialPages, rotateSelected, selectionLabel, type OrganizePage } from '@/tools/organize';
import { Button } from '../../ui/Button';
import type { CustomSetupProps } from './index';

export function OrganizeEditor({ tool, files, onStart, onReplace }: CustomSetupProps) {
  const t = useT();
  const file = files[0];
  const thumbs = usePdfThumbs(file);
  const [edited, setEdited] = useState<OrganizePage[] | null>(null);
  const pages = useMemo(() => edited ?? (thumbs.count ? initialPages(thumbs.count) : []), [edited, thumbs.count]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [photos, setPhotos] = useState<Record<string, { file: File; url: string }>>({});
  const [drag, setDrag] = useState<{ id: string; over: number | null } | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  // added photos' previews are freed when the editor goes
  const photoUrls = useRef<string[]>([]);
  useEffect(() => () => photoUrls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const set = (next: OrganizePage[]) => setEdited(next);
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  /** Moves the selected pages one place earlier (-1) or later (+1), keeping their order. */
  const nudge = (d: -1 | 1) => {
    const next = [...pages];
    const idx = next.map((p, i) => (selected.has(p.id) ? i : -1)).filter((i) => i >= 0);
    if (d === 1) idx.reverse();
    for (const i of idx) {
      const j = i + d;
      if (j < 0 || j >= next.length || selected.has(next[j].id)) continue;
      [next[i], next[j]] = [next[j], next[i]];
    }
    set(next);
  };

  /** Drop: the dragged page goes before position `to` (0..length). */
  const dropAt = (to: number) => {
    if (!drag) return;
    const from = pages.findIndex((p) => p.id === drag.id);
    if (from < 0) return;
    const next = [...pages];
    const [p] = next.splice(from, 1);
    next.splice(to > from ? to - 1 : to, 0, p);
    set(next);
    setDrag(null);
  };

  const addPhotoFiles = (list: FileList) => {
    const items = [...list].filter((f) => f.type.startsWith('image/'));
    if (!items.length) return;
    const keys = items.map((f, i) => `photo-${Date.now()}-${i}`);
    const made = items.map((f) => URL.createObjectURL(f));
    photoUrls.current.push(...made);
    setPhotos((cur) => ({ ...cur, ...Object.fromEntries(items.map((f, i) => [keys[i], { file: f, url: made[i] }])) }));
    set(addPhotos(pages, keys));
  };

  if (thumbs.error) {
    return (
      <div className="card p-8 text-center flex flex-col items-center gap-3" role="alert">
        <p className="text-[17px] font-semibold">{thumbs.error}</p>
        <Button variant="secondary" onClick={onReplace}>
          {t('Choose a PDF')}
        </Button>
      </div>
    );
  }

  const busy = thumbs.count == null;
  const sel = selected.size > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="card !rounded-row p-4 sm:px-5 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold truncate" dir="auto">
            {file?.name}
          </p>
          <p className="text-[13px] text-secondary">{busy ? t('Reading the PDF') : t('Drag a page to move it. Click to select it.')}</p>
        </div>
        <Button arrow disabled={busy || !pages.length} onClick={() => onStart({ pages, photos: Object.fromEntries(Object.entries(photos).map(([k, v]) => [k, v.file])) })}>
          {t(tool.verb)}
        </Button>
      </div>

      {/* actions: the selection's, then adding pages */}
      <div role="toolbar" aria-label={t('Selected page actions')} className="sticky top-16 z-20 card !rounded-row p-2 flex flex-wrap items-center gap-1">
        {sel ? (
          <>
            <span className="px-2 text-[14px] font-semibold" aria-live="polite">
              {selectionLabel(pages, selected)}
            </span>
            <Act label={t('Rotate')} onClick={() => set(rotateSelected(pages, selected))}>
              <RotateCw size={18} />
            </Act>
            <Act label={t('Move up')} onClick={() => nudge(-1)}>
              <ArrowLeft size={18} className="flip-rtl" />
            </Act>
            <Act label={t('Move down')} onClick={() => nudge(1)}>
              <ArrowRight size={18} className="flip-rtl" />
            </Act>
            <Act label={t('Duplicate')} onClick={() => set(duplicateSelected(pages, selected))}>
              <Copy size={18} />
            </Act>
            <Act
              label={t('Delete')}
              danger
              disabled={selected.size >= pages.length}
              onClick={() => {
                set(deleteSelected(pages, selected));
                setSelected(new Set());
              }}
            >
              <Trash2 size={18} />
            </Act>
            <Act label={t('Deselect all')} onClick={() => setSelected(new Set())}>
              <X size={18} />
            </Act>
          </>
        ) : (
          <span className="px-2 text-[14px] text-secondary">{busy ? '' : t('{count} pages', { count: pages.length })}</span>
        )}
        <span className="ms-auto flex gap-1">
          <Act label={t('Blank page')} text onClick={() => set(addBlank(pages))} disabled={busy}>
            <FilePlus2 size={18} />
          </Act>
          <Act label={t('Add photo')} text onClick={() => photoInput.current?.click()} disabled={busy}>
            <ImagePlus size={18} />
          </Act>
        </span>
      </div>
      <input
        ref={photoInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          if (e.target.files) addPhotoFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {busy ? (
        <div className="card min-h-64 grid place-items-center" aria-busy="true">
          <Loader2 size={28} className="animate-spin text-primary" aria-hidden="true" />
        </div>
      ) : (
        <ol className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4" onDragOver={(e) => drag && e.preventDefault()}>
          {pages.map((p, i) => {
            const on = selected.has(p.id);
            const src = p.image ? photos[p.image]?.url : p.src != null ? thumbs.urls[p.src] : undefined;
            const label = p.image ? t('Add photo') : p.src == null ? t('Blank page') : t('Page {value}', { value: p.src + 1 });
            return (
              <li
                key={p.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', p.id);
                  setDrag({ id: p.id, over: null });
                }}
                onDragEnd={() => setDrag(null)}
                onDragOver={(e) => {
                  if (!drag) return;
                  e.preventDefault();
                  const r = e.currentTarget.getBoundingClientRect();
                  const after = (e.clientX - r.left) / r.width > 0.5 !== (document.documentElement.dir === 'rtl');
                  const over = i + (after ? 1 : 0);
                  if (drag.over !== over) setDrag({ ...drag, over });
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (drag?.over != null) dropAt(drag.over);
                }}
                className={`relative ${drag?.id === p.id ? 'opacity-40' : ''}`}
              >
                {drag && drag.over === i && <span className="absolute -start-2 sm:-start-2.5 top-0 bottom-8 w-1 rounded-full bg-primary" aria-hidden="true" />}
                {drag && drag.over === i + 1 && i === pages.length - 1 && <span className="absolute -end-2 sm:-end-2.5 top-0 bottom-8 w-1 rounded-full bg-primary" aria-hidden="true" />}
                <button
                  type="button"
                  aria-pressed={on}
                  aria-label={`${i + 1}. ${label}`}
                  onClick={() => toggle(p.id)}
                  className={`group w-full aspect-[3/4] rounded-tile bg-fill grid place-items-center p-2 cursor-grab active:cursor-grabbing outline-offset-2 ${on ? 'outline-3 outline-primary' : 'hover:outline-2 hover:outline-line-strong'}`}
                >
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element -- a page drawn in the browser
                    <img src={src} alt="" draggable={false} className="max-w-full max-h-full object-contain shadow-[0_1px_4px_rgba(0,0,0,0.18)] bg-paper transition-transform" style={{ transform: turn(p.rotation) }} />
                  ) : p.src == null && !p.image ? (
                    <span className="w-[70%] aspect-[1/1.414] bg-paper shadow-[0_1px_4px_rgba(0,0,0,0.18)] grid place-items-center text-[12px] text-secondary transition-transform" style={{ transform: turn(p.rotation) }}>
                      {t('Blank page')}
                    </span>
                  ) : (
                    <Loader2 size={20} className="animate-spin text-secondary" aria-hidden="true" />
                  )}
                  {on && (
                    <span className="absolute top-2 end-2 size-7 rounded-full bg-primary text-white grid place-items-center shadow" aria-hidden="true">
                      <Check size={16} />
                    </span>
                  )}
                </button>
                <p className="mt-1.5 text-center text-[13px]">
                  <span className="font-semibold">{i + 1}</span>
                  {(p.src == null || p.src !== i || p.rotation !== 0) && <span className="text-secondary">{` · ${label}${p.rotation ? ` · ${p.rotation}°` : ''}`}</span>}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/** A page turned on its side is shrunk so it still fits its upright tile. */
const turn = (deg: number) => `rotate(${deg}deg)${deg % 180 ? ' scale(0.72)' : ''}`;

function Act({ label, onClick, disabled, danger, text, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; text?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={text ? undefined : label}
      title={label}
      className={`min-h-10 rounded-full inline-flex items-center gap-1.5 hover:bg-fill disabled:opacity-30 ${text ? 'px-3 text-[14px] font-medium' : 'size-10 justify-center'} ${danger ? 'text-error' : ''}`}
    >
      {children}
      {text && <span>{label}</span>}
    </button>
  );
}
