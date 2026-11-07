'use client';
// Annotate and sign / Sign PDF editor (the app's custom/annotate/AnnotateStep): every page drawn by pdf.js with a
// drawing layer on top in page points (items are measured from the top-left of the page as displayed, the app's
// model), so marks land where they show at any size. Tools: Pen, Highlight, Text, Note, Sign, Eraser; with no tool
// held, click a mark to select it and drag it to move; a signature also resizes from its corner, turns, and copies
// to every page. Undo / redo. The PDF is written by the app's flatten.ts (handlers/annotatePdf.ts).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import {
  CopyPlus, Eraser, Highlighter, Loader2, MessageSquare, MousePointer2, Pencil, PenLine, Plus, Redo2, RotateCw, Stamp, Trash2, Type, Undo2,
  type LucideIcon,
} from 'lucide-react';
import { useT } from '@/i18n/client';
import { usePdfThumbs } from '@/lib/usePdfThumbs';
import { useSignatures } from '@/lib/signatures';
import { pageFrame } from '@/tools/pdfOps';
import {
  addPoint, bubbleLeft, commit, copyToPages, emptyHistory, erase, HIGHLIGHT, itemAt, itemBox, newId, NOTE_BUBBLE, NOTE_ICON,
  noteBubbleLayout, PEN, redo, resizeFromCorner, rotateSignature, signatureImageSize, TEXT_SIZE, toSvgPath, undo, wrapLines,
  type History, type InkItem, type Item, type Pt, type SignatureItem,
} from '@/tools/annotate/model';
import { signatureInks } from '@/theme/inks';
import { Button } from '../../../ui/Button';
import { Dialog } from '../../../custom/text/DocList';
import type { CustomSetupProps } from '../index';
import { SignaturePad } from './SignaturePad';

type Tool = 'pen' | 'highlight' | 'text' | 'note' | 'sign' | 'eraser' | null;
type Size = { width: number; height: number };

const PAGE_DPI = 110;
const HIT = 8;
const SIGN_W = 160;
const TEXT_W = 220;

// text measured like the PDF's Helvetica, for the same line breaks on screen and in the file
let measureCtx: CanvasRenderingContext2D | null = null;
const measure = (size: number) => (s: string) => {
  measureCtx ??= document.createElement('canvas').getContext('2d');
  measureCtx!.font = `${size}px Helvetica, Arial, sans-serif`;
  return measureCtx!.measureText(s).width;
};

export function AnnotateEditor({ tool: toolDef, files, onStart, onReplace }: CustomSetupProps) {
  const t = useT();
  const sign = toolDef.id === 'sign-pdf';
  const file = files[0];
  const pagesImg = usePdfThumbs(file, PAGE_DPI);
  const [sizes, setSizes] = useState<Size[] | null>(null);
  const [hist, setHist] = useState<History>(emptyHistory);
  const [live, setLive] = useState<Item[] | null>(null); // a drag or a stroke in progress
  const [tool, setTool] = useState<Tool>(sign ? 'sign' : null);
  const [color, setColor] = useState<string>(PEN.color);
  const [selected, setSelected] = useState<string | null>(null);
  const [writing, setWriting] = useState<{ kind: 'text' | 'note'; page: number; at: Pt; edit?: string; text: string } | null>(null);
  const { signatures, add: saveSignature } = useSignatures();
  const [chosenSig, setChosenSig] = useState<{ png: string; w: number; h: number } | null>(null);
  const [padOpen, setPadOpen] = useState(false);
  const drag = useRef<{ id: string; from: Pt; orig: Item; corner?: boolean } | null>(null);

  const items = live ?? hist.present;
  const set = useCallback((next: Item[]) => {
    setHist((h) => commit(h, next));
    setLive(null);
  }, []);

  // page sizes as displayed (pdf-lib), for page points
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const doc = await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false });
        if (alive) setSizes(doc.getPages().map((p) => ({ width: pageFrame(p).vw, height: pageFrame(p).vh })));
      } catch {
        // the thumbnails hook says what went wrong
      }
    })();
    return () => {
      alive = false;
    };
  }, [file]);

  // Sign PDF starts on the signature pad when nothing is saved yet (the app's step 2)
  const askedPad = useRef(false);
  useEffect(() => {
    if (!sign || askedPad.current) return;
    askedPad.current = true;
    const timer = setTimeout(() => {
      if (!signatures.length) setPadOpen(true);
      else setChosenSig(signatures[0]);
    }, 200);
    return () => clearTimeout(timer);
  }, [sign, signatures]);

  // Ctrl / ⌘ Z, Shift for redo; Delete removes the selected mark
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).matches('input, textarea')) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        setHist((h) => (e.shiftKey ? redo(h) : undo(h)));
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
        set(hist.present.filter((i) => i.id !== selected));
        setSelected(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, hist.present, set]);

  const toPt = (e: React.PointerEvent, page: number): Pt => {
    const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const s = sizes![page];
    return { x: ((e.clientX - r.left) / r.width) * s.width, y: ((e.clientY - r.top) / r.height) * s.height };
  };

  const onDown = (e: React.PointerEvent<SVGSVGElement>, page: number) => {
    if (!sizes) return;
    const p = toPt(e, page);
    if (tool === 'pen' || tool === 'highlight') {
      e.currentTarget.setPointerCapture(e.pointerId);
      const hl = tool === 'highlight';
      const ink: InkItem = { id: newId(), type: 'ink', page, kind: hl ? 'highlight' : 'pen', points: [p], color: hl ? HIGHLIGHT.color : color, width: hl ? HIGHLIGHT.width : PEN.width };
      setLive([...hist.present, ink]);
      drag.current = { id: ink.id, from: p, orig: ink };
      return;
    }
    if (tool === 'eraser') {
      e.currentTarget.setPointerCapture(e.pointerId);
      setLive(erase(hist.present, page, p, HIT * 1.5));
      drag.current = { id: '', from: p, orig: hist.present[0] };
      return;
    }
    if (tool === 'text' || tool === 'note') {
      setWriting({ kind: tool, page, at: p, text: '' });
      return;
    }
    if (tool === 'sign') {
      if (!chosenSig) return setPadOpen(true);
      const w = Math.min(SIGN_W, sizes[page].width * 0.6);
      const h = (w * chosenSig.h) / chosenSig.w;
      const s: SignatureItem = {
        id: newId(), type: 'signature', page, w, h, png: chosenSig.png,
        x: Math.max(0, Math.min(sizes[page].width - w, p.x - w / 2)),
        y: Math.max(0, Math.min(sizes[page].height - h, p.y - h / 2)),
      };
      set([...hist.present, s]);
      setSelected(s.id);
      setTool(null);
      return;
    }
    // no tool: select and drag
    const hit = itemAt(hist.present, page, p, HIT);
    setSelected(hit?.id ?? null);
    if (hit) {
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { id: hit.id, from: p, orig: hit };
    }
  };

  const onMove = (e: React.PointerEvent<SVGSVGElement>, page: number) => {
    const d = drag.current;
    if (!d || !e.buttons || !sizes) return;
    const p = toPt(e, page);
    if (tool === 'pen' || tool === 'highlight') {
      setLive((cur) => (cur ?? hist.present).map((i) => (i.id === d.id && i.type === 'ink' ? { ...i, points: addPoint(i.points, p) } : i)));
      return;
    }
    if (tool === 'eraser') {
      setLive((cur) => erase(cur ?? hist.present, page, p, HIT * 1.5));
      return;
    }
    const dx = p.x - d.from.x;
    const dy = p.y - d.from.y;
    const o = d.orig;
    const moved: Item =
      o.type === 'ink'
        ? { ...o, points: o.points.map((q) => ({ x: q.x + dx, y: q.y + dy })) }
        : o.type === 'signature' && d.corner
          ? { ...o, ...resizeFromCorner(o, 'br', dx) }
          : { ...o, x: o.x + dx, y: o.y + dy };
    setLive(hist.present.map((i) => (i.id === d.id ? moved : i)));
  };

  const onUp = () => {
    if (drag.current && live) set(live);
    drag.current = null;
  };

  const selItem = items.find((i) => i.id === selected);
  const pageCount = pagesImg.count ?? 0;

  const tools: { id: Exclude<Tool, null>; label: string; icon: LucideIcon }[] = useMemo(() => {
    const all: { id: Exclude<Tool, null>; label: string; icon: LucideIcon }[] = [
      { id: 'pen', label: t('Pen'), icon: Pencil },
      { id: 'highlight', label: t('Highlight'), icon: Highlighter },
      { id: 'text', label: t('Text'), icon: Type },
      { id: 'note', label: t('Note'), icon: MessageSquare },
      { id: 'sign', label: t('Sign'), icon: Stamp },
      { id: 'eraser', label: t('Eraser'), icon: Eraser },
    ];
    return sign ? [all[4], all[2], all[0], all[5]] : all;
  }, [sign, t]);

  if (pagesImg.error) {
    return (
      <div className="card p-8 text-center flex flex-col items-center gap-3" role="alert">
        <p className="text-[17px] font-semibold">{pagesImg.error}</p>
        <Button variant="secondary" onClick={onReplace}>
          {t('Choose a PDF')}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div role="toolbar" aria-label={t('Tools')} className="sticky top-16 z-20 card !rounded-row p-2 flex flex-wrap items-center gap-1">
        <ToolBtn label={t('Select')} on={tool === null} onClick={() => setTool(null)} icon={MousePointer2} />
        {tools.map((x) => (
          <ToolBtn
            key={x.id}
            label={x.label}
            on={tool === x.id}
            icon={x.icon}
            onClick={() => {
              setTool(x.id);
              setSelected(null);
              if (x.id === 'sign' && !chosenSig) {
                if (signatures.length) setChosenSig(signatures[0]);
                else setPadOpen(true);
              }
            }}
          />
        ))}
        <span className="w-px h-6 bg-line mx-1" aria-hidden="true" />
        <ToolBtn label={t('Undo')} disabled={!hist.past.length} onClick={() => setHist(undo)} icon={Undo2} />
        <ToolBtn label={t('Redo')} disabled={!hist.future.length} onClick={() => setHist(redo)} icon={Redo2} />
        <span className="ms-auto">
          <Button arrow disabled={!hist.present.length} onClick={() => onStart({ items: hist.present })}>
            {t(toolDef.verb)}
          </Button>
        </span>

        {tool === 'pen' && (
          <div className="basis-full flex items-center gap-2 pt-2 px-1" role="radiogroup" aria-label={t('Ink')}>
            {signatureInks.map((c) => (
              <button key={c.value} type="button" role="radio" aria-checked={color === c.value} aria-label={t(c.label)} onClick={() => setColor(c.value)} className={`size-8 rounded-full border-2 ${color === c.value ? 'border-primary' : 'border-transparent'}`}>
                <span className="block size-full rounded-full border-2 border-surface" style={{ background: c.value }} />
              </button>
            ))}
          </div>
        )}
        {tool === 'sign' && (
          <div className="basis-full flex items-center gap-2 pt-2 px-1 overflow-x-auto">
            {signatures.map((s) => (
              <button key={s.id} type="button" aria-pressed={chosenSig?.png === s.png} onClick={() => setChosenSig(s)} className={`h-12 px-2 rounded-lg border bg-paper shrink-0 ${chosenSig?.png === s.png ? 'border-primary outline-2 outline-primary' : 'border-line'}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- a saved signature */}
                <img src={s.png} alt={t('Signature')} className="h-full w-auto" />
              </button>
            ))}
            {chosenSig && !signatures.some((s) => s.png === chosenSig.png) && (
              <span className="h-12 px-2 rounded-lg border border-primary outline-2 outline-primary bg-paper shrink-0 grid place-items-center">
                {/* eslint-disable-next-line @next/next/no-img-element -- this signature */}
                <img src={chosenSig.png} alt={t('Signature')} className="h-full w-auto" />
              </span>
            )}
            <button type="button" onClick={() => setPadOpen(true)} className="h-12 px-3 rounded-lg border border-dashed border-line-strong shrink-0 inline-flex items-center gap-1.5 text-[13px] font-medium hover:bg-fill">
              <Plus size={16} aria-hidden="true" />
              {t('New signature')}
            </button>
            <span className="text-[13px] text-secondary ms-2 shrink-0">{chosenSig ? t('Click the page to place it') : ''}</span>
          </div>
        )}
      </div>

      {!sizes || !pageCount ? (
        <div className="card min-h-64 grid place-items-center" aria-busy="true">
          <Loader2 size={28} className="animate-spin text-primary" aria-hidden="true" />
        </div>
      ) : (
        <div className="flex flex-col items-center gap-6">
          {sizes.map((s, page) => (
            <div key={page} className="relative w-full max-w-3xl">
              <p className="text-[12px] text-secondary mb-1">{t('Page {value}', { value: page + 1 })}</p>
              <div className="relative bg-paper shadow-raised" style={{ aspectRatio: `${s.width} / ${s.height}` }}>
                {pagesImg.urls[page] ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a page drawn in the browser
                  <img src={pagesImg.urls[page]} alt="" draggable={false} className="absolute inset-0 size-full select-none" />
                ) : (
                  <Loader2 size={24} className="absolute inset-0 m-auto animate-spin text-secondary" aria-hidden="true" />
                )}
                <svg
                  viewBox={`0 0 ${s.width} ${s.height}`}
                  className="absolute inset-0 size-full"
                  style={{ touchAction: tool ? 'none' : 'pan-y pinch-zoom', cursor: tool === 'pen' || tool === 'highlight' || tool === 'eraser' ? 'crosshair' : tool ? 'copy' : 'default' }}
                  onPointerDown={(e) => onDown(e, page)}
                  onPointerMove={(e) => onMove(e, page)}
                  onPointerUp={onUp}
                  onPointerCancel={onUp}
                  role="img"
                  aria-label={t('Page {value}', { value: page + 1 })}
                >
                  {items.filter((i) => i.page === page).map((i) => (
                    <ItemShape key={i.id} item={i} pageWidth={s.width} />
                  ))}
                  {selItem && selItem.page === page && selItem.type !== 'ink' && <Selection item={selItem} onCorner={(e) => {
                    e.stopPropagation();
                    (e.currentTarget.ownerSVGElement as SVGSVGElement).setPointerCapture(e.pointerId);
                    const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                    drag.current = { id: selItem.id, from: { x: ((e.clientX - r.left) / r.width) * s.width, y: ((e.clientY - r.top) / r.height) * s.height }, orig: selItem, corner: true };
                  }} />}
                </svg>
                {selItem && selItem.page === page && (
                  <ItemActions
                    item={selItem}
                    size={s}
                    onDelete={() => {
                      set(hist.present.filter((i) => i.id !== selItem.id));
                      setSelected(null);
                    }}
                    onEdit={() => (selItem.type === 'text' || selItem.type === 'note') && setWriting({ kind: selItem.type, page, at: { x: selItem.x, y: selItem.y }, edit: selItem.id, text: selItem.text })}
                    onRotate={() => selItem.type === 'signature' && set(hist.present.map((i) => (i.id === selItem.id ? rotateSignature(selItem) : i)))}
                    onCopyAll={() => {
                      if (selItem.type !== 'signature') return;
                      const others = sizes.map((_, j) => j).filter((j) => j !== page);
                      set([...hist.present, ...copyToPages(selItem, others, sizes)]);
                    }}
                    many={sizes.length > 1}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {writing && (
        <Dialog title={writing.kind === 'note' ? t('Note') : t('Text')} onClose={() => setWriting(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const text = writing.text.trim();
              if (writing.edit) {
                set(text ? hist.present.map((i) => (i.id === writing.edit && (i.type === 'text' || i.type === 'note') ? { ...i, text } : i)) : hist.present.filter((i) => i.id !== writing.edit));
              } else if (text) {
                const id = newId();
                const p = writing.at;
                set([...hist.present, writing.kind === 'note' ? { id, type: 'note', page: writing.page, x: p.x - NOTE_ICON / 2, y: p.y - NOTE_ICON / 2, text } : { id, type: 'text', page: writing.page, x: p.x, y: p.y - TEXT_SIZE / 2, w: TEXT_W, text, size: TEXT_SIZE }]);
                setSelected(id);
                setTool(null);
              }
              setWriting(null);
            }}
            className="flex flex-col gap-4"
          >
            <textarea
              autoFocus
              rows={4}
              value={writing.text}
              onChange={(e) => setWriting({ ...writing, text: e.target.value })}
              maxLength={1000}
              className="w-full rounded-tile border border-line-strong bg-surface p-3 text-[15px] focus:outline-2 focus:outline-primary"
            />
            <p className="text-[12px] text-secondary -mt-2">{t('Use Latin letters for notes and text.')}</p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setWriting(null)}>
                {t('Cancel')}
              </Button>
              <button type="submit" className="lime-fill min-h-12 px-6 rounded-full font-semibold">
                {writing.edit ? t('Save') : t('Add')}
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {padOpen && (
        <SignaturePad
          onClose={() => setPadOpen(false)}
          onDone={(s) => {
            const made = { id: newId(), png: s.png, w: s.w, h: s.h };
            if (s.save) saveSignature(made);
            setChosenSig(made);
            setTool('sign');
            setPadOpen(false);
          }}
        />
      )}
    </div>
  );
}

function ToolBtn({ label, on, disabled, onClick, icon: Icon }: { label: string; on?: boolean; disabled?: boolean; onClick: () => void; icon: LucideIcon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      title={label}
      className={`min-h-10 px-3 rounded-full inline-flex items-center gap-1.5 text-[13px] font-medium disabled:opacity-30 ${on ? 'bg-ink text-on-ink' : 'hover:bg-fill'}`}
    >
      <Icon size={18} aria-hidden="true" />
      <span className="hidden sm:inline">{label}</span>
      <span className="sr-only sm:hidden">{label}</span>
    </button>
  );
}

/** One mark, drawn like the PDF will have it. */
function ItemShape({ item: i, pageWidth }: { item: Item; pageWidth: number }) {
  if (i.type === 'ink') {
    const hl = i.kind === 'highlight';
    return (
      <path
        d={toSvgPath(i.points)}
        fill="none"
        stroke={i.color}
        strokeWidth={i.width}
        strokeLinecap={hl ? 'square' : 'round'}
        strokeLinejoin="round"
        opacity={hl ? HIGHLIGHT.opacity : 1}
        style={hl ? { mixBlendMode: 'multiply' } : undefined}
      />
    );
  }
  if (i.type === 'text') {
    const lines = wrapLines(i.text, measure(i.size), i.w);
    return (
      <text fontFamily="Helvetica, Arial, sans-serif" fontSize={i.size} fill="#111827">
        {lines.map((l, k) => (
          <tspan key={k} x={i.x} y={i.y + i.size * 0.8 + k * i.size * 1.4}>
            {l}
          </tspan>
        ))}
      </text>
    );
  }
  if (i.type === 'note') {
    const s = NOTE_ICON / 24;
    const b = i.text.trim() ? noteBubbleLayout(i.text, measure(NOTE_BUBBLE.size)) : null;
    const top = i.y + NOTE_ICON + NOTE_BUBBLE.gap;
    const left = b ? bubbleLeft(i.x, b.w, pageWidth) : 0;
    return (
      <g>
        <rect x={i.x} y={i.y} width={NOTE_ICON} height={NOTE_ICON} rx={6} fill="#FDE047" />
        <path d={`M${i.x + 4 * s + 2} ${i.y + 6 * s + 2}h${16 * s - 4} M${i.x + 4 * s + 2} ${i.y + 12 * s + 2}h${10 * s - 4} M${i.x + 4 * s + 2} ${i.y + 18 * s + 2}h${7 * s - 4}`} stroke="#713F12" strokeWidth={1.6} strokeLinecap="round" />
        {b && (
          <g>
            <rect x={left} y={top} width={b.w} height={b.h} rx={10} fill="#FEF9C3" stroke="#FDE047" />
            <text fontFamily="Helvetica, Arial, sans-serif" fontSize={NOTE_BUBBLE.size} fill="#713F12">
              {b.lines.map((l, k) => (
                <tspan key={k} x={left + NOTE_BUBBLE.padX} y={top + NOTE_BUBBLE.padY + NOTE_BUBBLE.size * 0.85 + k * NOTE_BUBBLE.lineHeight}>
                  {l}
                </tspan>
              ))}
            </text>
          </g>
        )}
      </g>
    );
  }
  const { w: iw, h: ih } = signatureImageSize(i);
  const cx = i.x + i.w / 2;
  const cy = i.y + i.h / 2;
  return (
    <g transform={`rotate(${i.rotation ?? 0} ${cx} ${cy})`}>
      <image href={i.png} x={cx - iw / 2} y={cy - ih / 2} width={iw} height={ih} preserveAspectRatio="none" />
    </g>
  );
}

function Selection({ item, onCorner }: { item: Exclude<Item, InkItem>; onCorner: (e: React.PointerEvent<SVGCircleElement>) => void }) {
  const b = itemBox(item);
  return (
    <g pointerEvents="none">
      <rect x={b.x - 3} y={b.y - 3} width={b.w + 6} height={b.h + 6} fill="none" stroke="var(--primary)" strokeWidth={1.2} strokeDasharray="4 3" rx={3} />
      {item.type === 'signature' && <circle cx={b.x + b.w + 3} cy={b.y + b.h + 3} r={7} fill="var(--primary)" stroke="#fff" strokeWidth={2} pointerEvents="all" style={{ cursor: 'nwse-resize' }} onPointerDown={onCorner} />}
    </g>
  );
}

/** The selected mark's buttons, just above it. */
function ItemActions({ item, size, onDelete, onEdit, onRotate, onCopyAll, many }: { item: Item; size: Size; onDelete: () => void; onEdit: () => void; onRotate: () => void; onCopyAll: () => void; many: boolean }) {
  const t = useT();
  const b = item.type === 'ink' ? { x: Math.min(...item.points.map((p) => p.x)), y: Math.min(...item.points.map((p) => p.y)) } : itemBox(item);
  const left = `${Math.min(80, (b.x / size.width) * 100)}%`;
  const top = `max(0px, calc(${(b.y / size.height) * 100}% - 48px))`;
  const btn = 'size-9 rounded-full grid place-items-center hover:bg-fill';
  return (
    <div className="absolute z-10 flex gap-1 rounded-full bg-surface shadow-raised p-1" style={{ left, top }}>
      {(item.type === 'text' || item.type === 'note') && (
        <button type="button" onClick={onEdit} aria-label={t('Edit')} title={t('Edit')} className={btn}>
          <PenLine size={16} aria-hidden="true" />
        </button>
      )}
      {item.type === 'signature' && (
        <>
          <button type="button" onClick={onRotate} aria-label={t('Rotate')} title={t('Rotate')} className={btn}>
            <RotateCw size={16} aria-hidden="true" />
          </button>
          {many && (
            <button type="button" onClick={onCopyAll} aria-label={t('Add to every page')} title={t('Add to every page')} className={btn}>
              <CopyPlus size={16} aria-hidden="true" />
            </button>
          )}
        </>
      )}
      <button type="button" onClick={onDelete} aria-label={t('Delete')} title={t('Delete')} className={`${btn} text-error`}>
        <Trash2 size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
