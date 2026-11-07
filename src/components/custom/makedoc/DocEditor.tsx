'use client';
// A Make with Zee document (the app's DocEditor for the web): the title, every block edited in place with its own
// toolbar (move, duplicate, Redo with AI, Add 3 more like this, delete), "+ Add" (block types or "Ask Zee to add…"),
// undo / redo, and a side panel with the summary and print settings (page and text size; for papers the answer key,
// Paper A / B, MCQ columns, answer and name lines; for expenses the currency). Preview and Save PDF print the app's
// page layout (src/makedocs/html.ts); tables can be downloaded as CSV for Excel.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDown, ArrowUp, ChevronLeft, Copy, Download, Eye, Loader2, Plus, Printer, Redo2, RefreshCw, Send, Sparkles, Trash2, Undo2,
} from 'lucide-react';
import { useT } from '@/i18n/client';
import { blocksFor, kindLabel } from '@/makedocs/kinds';
import { addFromRequest, moreLike, redoBlock } from '@/makedocs/ai';
import { blankBlock, duplicateBlock, insertBlocks, moveBlock, questionNumbers, removeBlock, updateBlock } from '@/makedocs/edit';
import { docHtml } from '@/makedocs/html';
import { useZeeDocs, zeeDocs } from '@/makedocs/store';
import type { Block, DocSettings, ZeeDoc } from '@/makedocs/types';
import { printHtml, siteFonts } from '@/textdocs/print';
import { ZeeError, zeeReady } from '@/lib/firebase';
import { Button } from '../../ui/Button';
import { Dialog } from '../text/DocList';
import { BlockEditor, blockLabel } from './blocks';
import { Choice, deletesIn, docSummary, Field, KIND_ICONS, Switch } from './parts';

const AI_REDO = new Set<Block['type']>(['question', 'flashcard', 'text', 'note', 'list', 'checklist', 'table', 'heading']);
const AI_MORE = new Set<Block['type']>(['question', 'flashcard', 'list', 'checklist']);
const HISTORY = 50;

/** Undo / redo of the blocks: typing in one block within a moment counts as one step. */
function useHistory(doc: ZeeDoc) {
  const past = useRef<Block[][]>([]);
  const future = useRef<Block[][]>([]);
  const last = useRef<{ id: string; at: number } | null>(null);
  // sizes in state, so the buttons re-render (refs aren't read while drawing)
  const [sizes, setSizes] = useState({ past: 0, future: 0 });
  const bump = () => setSizes({ past: past.current.length, future: future.current.length });
  const commit = useCallback(
    (next: Block[], typingIn?: string) => {
      const now = Date.now();
      const same = typingIn && last.current?.id === typingIn && now - last.current.at < 1200;
      if (!same) past.current = [...past.current, doc.blocks].slice(-HISTORY);
      future.current = [];
      last.current = typingIn ? { id: typingIn, at: now } : null;
      zeeDocs.update(doc.id, { blocks: next });
      bump();
    },
    [doc.id, doc.blocks],
  );
  const undo = () => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(doc.blocks);
    last.current = null;
    zeeDocs.update(doc.id, { blocks: prev });
    bump();
  };
  const redo = () => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(doc.blocks);
    last.current = null;
    zeeDocs.update(doc.id, { blocks: next });
    bump();
  };
  return { commit, undo, redo, canUndo: sizes.past > 0, canRedo: sizes.future > 0 };
}

export function DocEditor({ doc, onBack }: { doc: ZeeDoc; onBack: () => void }) {
  const t = useT();
  const { savedAt, error } = useZeeDocs();
  const { commit, undo, redo, canUndo, canRedo } = useHistory(doc);
  const [busy, setBusy] = useState<string | null>(null); // block id (or 'add') Zee is working on
  const [problem, setProblem] = useState<string | null>(null);
  const [version, setVersion] = useState<'A' | 'B'>('A');
  const [previewing, setPreviewing] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const numbers = questionNumbers(doc.blocks);
  const paper = doc.kind === 'paper';
  const Icon = KIND_ICONS[doc.kind];

  useEffect(() => {
    if (!savedAt) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- shows "Saved" for a moment after each save
    setShowSaved(true);
    const timer = setTimeout(() => setShowSaved(false), 1500);
    return () => clearTimeout(timer);
  }, [savedAt]);

  // Ctrl / ⌘ Z and Shift+Z outside text fields
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z' || el.matches('input, textarea, select, [contenteditable]')) return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const ai = async (key: string, run: () => Promise<void>) => {
    if (!zeeReady()) return setProblem(t('Zee isn\'t set up on this website yet. Try the ZipyZee Android app.'));
    if (!navigator.onLine) return setProblem(t('Zee needs the internet for this.'));
    setBusy(key);
    try {
      await run();
    } catch (e) {
      setProblem(e instanceof ZeeError ? e.message : t('Zee couldn\'t make it this time. Try again.'));
    } finally {
      setBusy(null);
    }
  };

  const setSettings = (patch: Partial<DocSettings>) => zeeDocs.update(doc.id, { settings: { ...doc.settings, ...patch } });
  const page = () => docHtml(doc, { version: paper ? version : 'A', answerKey: paper && doc.settings.answerKey, fonts: siteFonts() });
  const tables = doc.blocks.filter((b): b is Extract<Block, { type: 'table' }> => b.type === 'table' && b.rows.some((r) => r.some((c) => c.trim())));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1 min-h-10 px-2 rounded-full text-sm font-medium text-secondary hover:text-text">
          <ChevronLeft size={18} className="flip-rtl" aria-hidden="true" />
          {t('Make with Zee')}
        </button>
        <span className={`text-[13px] ms-1 ${error ? 'text-error' : showSaved ? 'text-success' : 'text-secondary'}`} aria-live="polite">
          {error ? t('Couldn\'t save in this browser. Remove a big picture or free some space.') : showSaved ? t('Saved') : deletesIn(doc.expiresAt, t)}
        </span>
        <div className="ms-auto flex gap-1">
          <button type="button" onClick={undo} disabled={!canUndo} aria-label={t('Undo')} title={t('Undo')} className="size-10 rounded-full grid place-items-center hover:bg-fill disabled:opacity-30">
            <Undo2 size={20} aria-hidden="true" />
          </button>
          <button type="button" onClick={redo} disabled={!canRedo} aria-label={t('Redo')} title={t('Redo')} className="size-10 rounded-full grid place-items-center hover:bg-fill disabled:opacity-30">
            <Redo2 size={20} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] items-start">
        <div className="flex flex-col gap-3 min-w-0">
          <div className="card p-5 sm:p-6 flex items-center gap-4">
            <span className="size-12 shrink-0 rounded-tile bg-category-tint text-category grid place-items-center">
              <Icon size={24} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <input
                value={doc.title}
                onChange={(e) => zeeDocs.update(doc.id, { title: e.target.value })}
                placeholder={t('Title')}
                aria-label={t('Title')}
                maxLength={120}
                dir="auto"
                className="w-full bg-transparent text-[24px] sm:text-[28px] font-semibold tracking-tight focus:outline-none placeholder:text-secondary"
              />
              <p className="text-[13px] text-secondary">{`${kindLabel(doc.kind)} · ${docSummary(doc, t)}`}</p>
            </div>
          </div>

          {doc.blocks.map((b, i) => (
            <article key={b.id} className={`card !rounded-row p-4 sm:p-5 group relative ${busy === b.id ? 'opacity-60' : ''}`} aria-label={blockLabel(b.type, t)} aria-busy={busy === b.id}>
              <div className="flex items-center gap-1 mb-2 -mt-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-secondary flex-1">{blockLabel(b.type, t)}</span>
                {busy === b.id && <Loader2 size={16} className="animate-spin text-primary" aria-hidden="true" />}
                {AI_REDO.has(b.type) && (
                  <Tool label={t('Redo with AI')} onClick={() => ai(b.id, async () => commit(updateBlock(doc.blocks, b.id, { ...(await redoBlock(doc, b)), id: b.id })))} disabled={!!busy}>
                    <RefreshCw size={16} />
                  </Tool>
                )}
                {AI_MORE.has(b.type) && (
                  <Tool label={t('Add 3 more like this')} onClick={() => ai(b.id, async () => commit(insertBlocks(doc.blocks, await moreLike(doc, b, 3), b.id)))} disabled={!!busy}>
                    <Sparkles size={16} />
                  </Tool>
                )}
                <Tool label={t('Move up')} onClick={() => commit(moveBlock(doc.blocks, i, i - 1))} disabled={i === 0}>
                  <ArrowUp size={16} />
                </Tool>
                <Tool label={t('Move down')} onClick={() => commit(moveBlock(doc.blocks, i, i + 1))} disabled={i === doc.blocks.length - 1}>
                  <ArrowDown size={16} />
                </Tool>
                <Tool label={t('Duplicate')} onClick={() => commit(duplicateBlock(doc.blocks, b.id))}>
                  <Copy size={16} />
                </Tool>
                <Tool label={t('Delete')} onClick={() => commit(removeBlock(doc.blocks, b.id))} danger>
                  <Trash2 size={16} />
                </Tool>
              </div>
              <BlockEditor block={b} kind={doc.kind} number={numbers[b.id]} onChange={(next) => commit(updateBlock(doc.blocks, b.id, next), b.id)} />
            </article>
          ))}

          <AddPanel
            doc={doc}
            busy={busy === 'add'}
            onAdd={(type) => commit([...doc.blocks, blankBlock(type)])}
            onAsk={(request) => ai('add', async () => commit([...doc.blocks, ...(await addFromRequest(doc, request))]))}
          />
        </div>

        <aside className="card p-5 flex flex-col gap-5 lg:sticky lg:top-20" aria-label={t('Save PDF')}>
          <div className="grid grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-2 [&_button]:whitespace-nowrap">
            <Button variant="secondary" onClick={() => setPreviewing(true)} disabled={!doc.blocks.length}>
              <Eye size={18} aria-hidden="true" className="inline me-2" />
              {t('Preview')}
            </Button>
            <Button onClick={() => void printHtml(page())} disabled={!doc.blocks.length} className="!min-h-12">
              <Printer size={18} aria-hidden="true" className="inline me-2" />
              {t('Save PDF')}
            </Button>
          </div>
          {tables.length > 0 && (
            <Button variant="secondary" onClick={() => downloadCsv(doc.title || t('Untitled'), tables)}>
              <Download size={18} aria-hidden="true" className="inline me-2" />
              {t('Download CSV for Excel')}
            </Button>
          )}
          {paper && (
            <>
              <Choice label={t('Version')} value={version} options={[['A', t('Paper A')], ['B', t('Paper B (shuffled)')]]} onChange={setVersion} />
              <Switch label={t('Answer key page')} sub={t('A last page with the answers. Turn off for students.')} value={doc.settings.answerKey} onChange={(answerKey) => setSettings({ answerKey })} />
              <Choice label={t('Multiple choice')} value={String(doc.settings.mcqColumns) as '1' | '2'} options={[['1', t('1 column')], ['2', t('2 columns')]]} onChange={(v) => setSettings({ mcqColumns: v === '1' ? 1 : 2 })} />
              <Switch label={t('Lines to write answers')} value={doc.settings.answerLines} onChange={(answerLines) => setSettings({ answerLines })} />
              <Switch label={t('Name and roll no lines')} value={doc.settings.nameLines} onChange={(nameLines) => setSettings({ nameLines })} />
            </>
          )}
          {doc.kind === 'expenses' && (
            <label className="flex flex-col gap-2 text-[13px] font-semibold">
              {t('Currency')}
              <Field value={doc.settings.currency} onChange={(currency) => setSettings({ currency })} maxLength={6} className="w-32 font-normal" />
            </label>
          )}
          <Choice label={t('Page size')} value={doc.settings.pageSize} options={[['a4', 'A4'], ['letter', t('Letter')], ['legal', t('Legal')]]} onChange={(pageSize) => setSettings({ pageSize })} />
          <Choice label={t('Text size')} value={doc.settings.textSize} options={[['s', t('Small')], ['m', t('Medium')], ['l', t('Large')]]} onChange={(textSize) => setSettings({ textSize })} />
        </aside>
      </div>

      {previewing && <Preview html={page()} onClose={() => setPreviewing(false)} onPrint={() => void printHtml(page())} />}
      {problem && (
        <Dialog title={t('Not made')} onClose={() => setProblem(null)}>
          <p className="text-[15px] text-muted">{problem}</p>
          <div className="flex justify-end mt-5">
            <Button onClick={() => setProblem(null)}>{t('OK')}</Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function Tool({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className={`size-8 rounded-lg grid place-items-center hover:bg-fill disabled:opacity-30 ${danger ? 'text-error' : 'text-secondary hover:text-text'}`}>
      {children}
    </button>
  );
}

/** "+ Add": the kind's blocks first, and a line for Zee. */
function AddPanel({ doc, busy, onAdd, onAsk }: { doc: ZeeDoc; busy: boolean; onAdd: (type: Block['type']) => void; onAsk: (request: string) => void }) {
  const t = useT();
  const [ask, setAsk] = useState('');
  const types = blocksFor(doc.kind);
  return (
    <section className="rounded-row border-2 border-dashed border-line-strong p-4 flex flex-col gap-3" aria-label={t('Add')}>
      <div className="flex flex-wrap gap-2">
        {types.map((type) => (
          <button key={type} type="button" onClick={() => onAdd(type)} className="inline-flex items-center gap-1.5 min-h-9 px-3 rounded-full bg-surface border border-line text-[13px] font-medium hover:bg-fill">
            <Plus size={14} aria-hidden="true" />
            {blockLabel(type, t)}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!ask.trim() || busy) return;
          onAsk(ask);
          setAsk('');
        }}
        className="flex gap-2 items-center"
      >
        <Sparkles size={18} className="text-primary shrink-0" aria-hidden="true" />
        <Field value={ask} onChange={setAsk} placeholder={doc.kind === 'paper' ? t('e.g. 5 true/false questions') : t('e.g. 5 more points about…')} aria-label={t('Ask Zee to add…')} className="flex-1" maxLength={500} />
        <button type="submit" disabled={!ask.trim() || busy} aria-label={t('Add with Zee')} className="lime-fill size-10 rounded-full grid place-items-center disabled:opacity-40 shrink-0">
          {busy ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Send size={18} className="flip-rtl" aria-hidden="true" />}
        </button>
      </form>
    </section>
  );
}

function Preview({ html, onClose, onPrint }: { html: string; onClose: () => void; onPrint: () => void }) {
  const t = useT();
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-overlay" role="dialog" aria-modal="true" aria-label={t('Preview')}>
      <div className="h-16 px-4 flex items-center gap-2 bg-surface border-b border-line">
        <p className="font-semibold flex-1">{t('Preview')}</p>
        <Button variant="secondary" onClick={onClose}>
          {t('Close')}
        </Button>
        <Button onClick={onPrint} className="!min-h-12">
          <Printer size={18} aria-hidden="true" className="inline me-2" />
          {t('Save PDF')}
        </Button>
      </div>
      <div className="flex-1 overflow-auto p-4 sm:p-8">
        {/* the page with its own margins; no scripts run in it */}
        <iframe title={t('Preview')} sandbox="allow-same-origin" srcDoc={html.replace('<body>', '<body style="padding:14mm">')} className="mx-auto block bg-paper shadow-raised w-full max-w-[794px] h-[1123px]" />
      </div>
    </div>
  );
}

/** Every table as CSV (UTF-8 with a BOM so Excel reads Urdu), one after another. */
function downloadCsv(title: string, tables: Extract<Block, { type: 'table' }>[]) {
  const cell = (s: string) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const csv = tables.map((tb) => [tb.columns.map((c) => cell(c.name)).join(','), ...tb.rows.filter((r) => r.some((c) => c.trim())).map((r) => tb.columns.map((_, i) => cell(r[i] ?? '')).join(','))].join('\r\n')).join('\r\n\r\n');
  const url = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'table'}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
