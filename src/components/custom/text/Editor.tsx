'use client';
// The Text editor's editing screen (the app's TextEditorStep Editor for the web): a title, a sticky toolbar and a
// rich editing area (the browser's contenteditable, so bold looks bold while typing). Saved in this browser as it's
// typed. Each paragraph finds its own direction, so Urdu and English mix. Save PDF prints exactly the page that
// Preview shows (src/textdocs/page.ts).
import { useEffect, useRef, useState } from 'react';
import {
  AlignCenter, AlignLeft, AlignRight, Bold, ChevronLeft, Eye, Heading1, Heading2, Highlighter, ImagePlus, IndentDecrease,
  IndentIncrease, Italic, Link, List, ListChecks, ListOrdered, Minus, Palette, Pilcrow, Printer, Redo2, Strikethrough, Type,
  Underline, Undo2, type LucideIcon,
} from 'lucide-react';
import { useT } from '@/i18n/client';
import { htmlToText, wordCount } from '@/textdocs/edit';
import { sanitizeHtml } from '@/textdocs/page';
import { pageWithSiteFonts, printDoc } from '@/textdocs/print';
import { docsApi, useDocs, type TextDoc } from '@/textdocs/store';
import { Button } from '../../ui/Button';
import { Dialog } from './DocList';

const TEXT_COLORS = ['#111827', '#DC2626', '#EA580C', '#16A34A', '#2563EB', '#7C3AED', '#DB2777', '#6B7280'];
const HIGHLIGHTS = ['#FEF08A', '#BBF7D0', '#BFDBFE', '#FBCFE8', '#FED7AA', 'transparent'];
/** Pictures: at most this wide or tall, so documents stay small. */
const PICTURE_MAX = 1600;
/** Editing text size (px) for the page's S / M / L. */
const EDITOR_PX = { s: 15, m: 17, l: 20 } as const;

type Action =
  | { kind: 'exec'; name: string; value?: string }
  | { kind: 'heading'; tag: 'h1' | 'h2' | 'p' }
  | { kind: 'tick' }
  | { kind: 'palette'; which: 'fore' | 'hilite' }
  | { kind: 'link' }
  | { kind: 'picture' }
  | { kind: 'style' };
type Cmd = { icon: LucideIcon; label: string; action: Action; state?: string; block?: string };
const ex = (name: string, value?: string): Action => ({ kind: 'exec', name, value });

const exec = (cmd: string, value?: string) => document.execCommand(cmd, false, value);

export function Editor({ doc, onBack }: { doc: TextDoc; onBack: () => void }) {
  const t = useT();
  const { savedAt, error } = useDocs();
  const area = useRef<HTMLDivElement>(null);
  const saved = useRef<Range | null>(null);
  const picture = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState<Record<string, boolean>>({});
  const [block, setBlock] = useState('');
  const [palette, setPalette] = useState<'fore' | 'hilite' | null>(null);
  const [linking, setLinking] = useState<{ text: string } | null>(null);
  const [styling, setStyling] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  // the content is set once; after that the editing area owns it
  useEffect(() => {
    if (area.current) area.current.innerHTML = sanitizeHtml(doc.html);
    exec('styleWithCSS', 'true');
    exec('defaultParagraphSeparator', 'p');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when another document opens
  }, [doc.id]);

  useEffect(() => {
    if (!savedAt) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- shows "Saved" for a moment after each save
    setShowSaved(true);
    const timer = setTimeout(() => setShowSaved(false), 1500);
    return () => clearTimeout(timer);
  }, [savedAt]);

  // which toolbar buttons are on, for the current selection
  useEffect(() => {
    const onSel = () => {
      const sel = document.getSelection();
      if (!sel?.rangeCount || !area.current?.contains(sel.anchorNode)) return;
      saved.current = sel.getRangeAt(0).cloneRange();
      setActive({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        strikeThrough: document.queryCommandState('strikeThrough'),
        insertUnorderedList: document.queryCommandState('insertUnorderedList'),
        insertOrderedList: document.queryCommandState('insertOrderedList'),
        justifyCenter: document.queryCommandState('justifyCenter'),
        justifyRight: document.queryCommandState('justifyRight'),
      });
      setBlock(String(document.queryCommandValue('formatBlock')).toLowerCase());
    };
    document.addEventListener('selectionchange', onSel);
    return () => document.removeEventListener('selectionchange', onSel);
  }, []);

  const save = () => {
    const el = area.current;
    if (!el) return;
    docsApi.update(doc.id, { html: el.innerHTML, text: htmlToText(el.innerHTML) });
  };

  /** Back into the editing area at the saved selection, then run. */
  const withSelection = (run: () => void) => {
    const el = area.current;
    if (!el) return;
    const sel = document.getSelection();
    // the cursor already in the editing area wins; the saved one is for after a dialog or palette took the focus
    const inside = !!sel?.rangeCount && el.contains(sel.anchorNode);
    el.focus();
    if (!inside && saved.current && sel) {
      sel.removeAllRanges();
      sel.addRange(saved.current);
    }
    run();
    save();
  };

  const perform = (a: Action) => {
    switch (a.kind) {
      case 'exec':
        return withSelection(() => exec(a.name, a.value));
      case 'heading':
        return withSelection(() => exec('formatBlock', `<${block === a.tag && a.tag !== 'p' ? 'p' : a.tag}>`));
      case 'tick':
        return withSelection(() => {
          const text = document.getSelection()?.toString() || '';
          // a marker shows where the cursor goes: right after the new box
          exec('insertHTML', `<ul class="x-todo"><li><input type="checkbox">&nbsp;${escapeText(text)}<span data-caret></span></li></ul>`);
          const mark = area.current?.querySelector('[data-caret]');
          if (mark) {
            const r = document.createRange();
            r.setStartBefore(mark);
            r.collapse(true);
            mark.remove();
            document.getSelection()?.removeAllRanges();
            document.getSelection()?.addRange(r);
          }
        });
      case 'palette':
        return setPalette(palette === a.which ? null : a.which);
      case 'link':
        return setLinking({ text: saved.current?.toString() ?? '' });
      case 'picture':
        return picture.current?.click();
      case 'style':
        return setStyling(true);
    }
  };

  const tools: (Cmd | 'sep')[] = [
    { icon: Undo2, label: t('Undo'), action: ex('undo') },
    { icon: Redo2, label: t('Redo'), action: ex('redo') },
    'sep',
    { icon: Bold, label: t('Bold'), action: ex('bold'), state: 'bold' },
    { icon: Italic, label: t('Italic'), action: ex('italic'), state: 'italic' },
    { icon: Underline, label: t('Underline'), action: ex('underline'), state: 'underline' },
    { icon: Strikethrough, label: t('Strikethrough'), action: ex('strikeThrough'), state: 'strikeThrough' },
    'sep',
    { icon: Heading1, label: t('Heading 1'), action: { kind: 'heading', tag: 'h1' }, block: 'h1' },
    { icon: Heading2, label: t('Heading 2'), action: { kind: 'heading', tag: 'h2' }, block: 'h2' },
    { icon: Pilcrow, label: t('Normal text'), action: { kind: 'heading', tag: 'p' }, block: 'p' },
    'sep',
    { icon: List, label: t('Bullets'), action: ex('insertUnorderedList'), state: 'insertUnorderedList' },
    { icon: ListOrdered, label: t('Numbers'), action: ex('insertOrderedList'), state: 'insertOrderedList' },
    { icon: ListChecks, label: t('Tick boxes'), action: { kind: 'tick' } },
    'sep',
    { icon: AlignLeft, label: t('Align left'), action: ex('justifyLeft') },
    { icon: AlignCenter, label: t('Align center'), action: ex('justifyCenter'), state: 'justifyCenter' },
    { icon: AlignRight, label: t('Align right'), action: ex('justifyRight'), state: 'justifyRight' },
    'sep',
    { icon: Palette, label: t('Text color'), action: { kind: 'palette', which: 'fore' } },
    { icon: Highlighter, label: t('Highlight'), action: { kind: 'palette', which: 'hilite' } },
    { icon: IndentIncrease, label: t('Indent'), action: ex('indent') },
    { icon: IndentDecrease, label: t('Outdent'), action: ex('outdent') },
    'sep',
    { icon: Link, label: t('Link'), action: { kind: 'link' } },
    { icon: ImagePlus, label: t('Picture'), action: { kind: 'picture' } },
    { icon: Minus, label: t('Line'), action: ex('insertHorizontalRule') },
    { icon: Type, label: t('Text style'), action: { kind: 'style' } },
  ];

  const addPicture = async (file: File) => {
    try {
      const url = await pictureDataUrl(file);
      withSelection(() => exec('insertImage', url));
    } catch {
      setProblem(t('This photo could not be read. Try another one.'));
    }
  };

  // tick boxes: a click must change the saved HTML too; Enter on a ticked line adds the next box, on an empty one leaves
  const onClick = (e: React.MouseEvent) => {
    const el = e.target as HTMLElement;
    if (el instanceof HTMLInputElement && el.type === 'checkbox') {
      if (el.checked) el.setAttribute('checked', '');
      else el.removeAttribute('checked');
      save();
    }
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      perform({ kind: 'link' });
      return;
    }
    if (e.key !== 'Enter' || e.shiftKey) return;
    const li = (document.getSelection()?.anchorNode as HTMLElement | null)?.parentElement?.closest('ul.x-todo > li') ?? (document.getSelection()?.anchorNode as HTMLElement | null)?.closest?.('ul.x-todo > li');
    if (!li) return;
    if (!li.textContent?.replace(/ /g, '').trim()) {
      // an empty tick line ends the list
      e.preventDefault();
      const list = li.parentElement!;
      li.remove();
      const p = document.createElement('p');
      p.innerHTML = '<br>';
      list.after(p);
      if (!list.children.length) list.remove();
      const r = document.createRange();
      r.setStart(p, 0);
      document.getSelection()?.removeAllRanges();
      document.getSelection()?.addRange(r);
      save();
      return;
    }
    requestAnimationFrame(() => {
      const next = (document.getSelection()?.anchorNode as HTMLElement | null);
      const item = (next?.nodeType === 1 ? (next as HTMLElement) : next?.parentElement)?.closest('ul.x-todo > li');
      if (item && !item.querySelector('input[type=checkbox]')) {
        const box = document.createElement('input');
        box.type = 'checkbox';
        item.prepend(box, ' ');
        item.querySelectorAll('input[checked]').forEach((x) => x !== box && x.removeAttribute('checked'));
        const r = document.createRange();
        r.setStartAfter(item.childNodes[1]);
        document.getSelection()?.removeAllRanges();
        document.getSelection()?.addRange(r);
        save();
      }
    });
  };
  const onPaste = (e: React.ClipboardEvent) => {
    const html = e.clipboardData.getData('text/html');
    if (!html) return; // plain text pastes as it is
    e.preventDefault();
    exec('insertHTML', sanitizeHtml(html.replace(/<!--[\s\S]*?-->/g, '')).replace(/\s(class|id)\s*=\s*("[^"]*"|'[^']*')/gi, ''));
    save();
  };

  const words = wordCount(doc.text);
  const empty = !doc.text.trim() && !/<img\b/i.test(doc.html);
  const page = () => ({ title: doc.title, html: doc.html, font: doc.font, size: doc.size, align: doc.align });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1 min-h-10 px-2 rounded-full text-sm font-medium text-secondary hover:text-text">
          <ChevronLeft size={18} className="flip-rtl" aria-hidden="true" />
          {t('My documents')}
        </button>
        <span className={`text-[13px] ms-2 ${error ? 'text-error' : showSaved ? 'text-success' : 'text-secondary'}`} aria-live="polite">
          {error ? t('Couldn\'t save in this browser. Remove a big picture or free some space.') : showSaved ? t('Saved') : words === 1 ? t('1 word') : t('{count} words', { count: words })}
        </span>
        <div className="ms-auto flex gap-2">
          <Button variant="secondary" disabled={empty} onClick={() => setPreviewing(true)}>
            <Eye size={18} aria-hidden="true" className="inline me-2" />
            {t('Preview')}
          </Button>
          <Button disabled={empty} onClick={() => void printDoc(page())} className="!min-h-12">
            <Printer size={18} aria-hidden="true" className="inline me-2" />
            {t('Save PDF')}
          </Button>
        </div>
      </div>

      <div className="card overflow-visible">
        <div role="toolbar" aria-label={t('Text style')} className="sticky top-16 z-20 flex flex-wrap items-center gap-0.5 p-2 border-b border-line bg-surface rounded-t-card">
          {tools.map((x, i) =>
            x === 'sep' ? (
              <span key={i} className="w-px h-6 bg-line mx-1" aria-hidden="true" />
            ) : (
              <button
                key={x.label}
                type="button"
                title={x.label}
                aria-label={x.label}
                aria-pressed={x.state ? !!active[x.state] : x.block ? block === x.block : undefined}
                // keep the selection in the editing area
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => perform(x.action)}
                className={`size-9 rounded-lg grid place-items-center hover:bg-fill ${(x.state && active[x.state]) || (x.block && block === x.block) ? 'bg-primary-soft text-primary' : ''}`}
              >
                <x.icon size={18} aria-hidden="true" />
              </button>
            ),
          )}
          {palette && (
            <div className="basis-full flex flex-wrap gap-2 pt-2" role="group" aria-label={palette === 'fore' ? t('Text color') : t('Highlight')}>
              {(palette === 'fore' ? TEXT_COLORS : HIGHLIGHTS).map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c === 'transparent' ? t('None') : c}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    withSelection(() => exec(palette === 'fore' ? 'foreColor' : 'hiliteColor', c));
                    setPalette(null);
                  }}
                  className="size-8 rounded-full border border-line-strong grid place-items-center"
                  style={{ background: c === 'transparent' ? 'var(--surface)' : c }}
                >
                  {c === 'transparent' && <span className="block w-5 h-0.5 bg-error rotate-45" aria-hidden="true" />}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="px-5 sm:px-10 pt-6 pb-10">
          <input
            value={doc.title}
            onChange={(e) => docsApi.update(doc.id, { title: e.target.value })}
            placeholder={t('Title')}
            aria-label={t('Title')}
            maxLength={120}
            dir="auto"
            className="w-full bg-transparent text-[28px] font-semibold tracking-tight placeholder:text-secondary focus:outline-none mb-4"
          />
          <div
            ref={area}
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-multiline="true"
            aria-label={t('Start writing')}
            data-placeholder={t('Start writing')}
            onInput={save}
            onClick={onClick}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            className={`rich-editor min-h-[50vh] focus:outline-none ${doc.font === 'serif' ? 'font-serif' : ''}`}
            style={{ fontSize: EDITOR_PX[doc.size], textAlign: doc.align === 'center' ? 'center' : 'start' }}
          />
        </div>
      </div>

      <input
        ref={picture}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void addPicture(f);
        }}
      />

      {linking && (
        <LinkDialog
          initialText={linking.text}
          onClose={() => setLinking(null)}
          onAdd={(text, url) => withSelection(() => (linking.text ? exec('createLink', url) : exec('insertHTML', `<a href="${escapeAttr(url)}">${escapeText(text)}</a>`)))}
        />
      )}
      {styling && (
        <Dialog title={t('Text style')} onClose={() => setStyling(false)}>
          <StyleForm doc={doc} />
          <div className="flex justify-end mt-5">
            <Button onClick={() => setStyling(false)}>{t('Done')}</Button>
          </div>
        </Dialog>
      )}
      {previewing && <Preview html={pageWithSiteFonts(page())} onClose={() => setPreviewing(false)} onPrint={() => void printDoc(page())} />}
      {problem && (
        <Dialog title={t('Picture')} onClose={() => setProblem(null)}>
          <p className="text-[15px] text-muted">{problem}</p>
          <div className="flex justify-end mt-5">
            <Button onClick={() => setProblem(null)}>{t('OK')}</Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function StyleForm({ doc }: { doc: TextDoc }) {
  const t = useT();
  const row = <K extends 'font' | 'size' | 'align'>(label: string, key: K, options: [TextDoc[K], string][]) => (
    <fieldset className="mb-4">
      <legend className="text-[13px] font-semibold mb-2">{label}</legend>
      <div className="flex gap-1 p-1 rounded-full bg-fill w-fit" role="radiogroup">
        {options.map(([value, text]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={doc[key] === value}
            onClick={() => docsApi.update(doc.id, { [key]: value })}
            className={`px-4 min-h-10 rounded-full text-sm font-medium ${doc[key] === value ? 'bg-ink text-on-ink shadow-soft' : 'text-muted hover:text-text'}`}
          >
            {text}
          </button>
        ))}
      </div>
    </fieldset>
  );
  return (
    <>
      {row(t('Font'), 'font', [['sans', t('Sans')], ['serif', t('Serif')]])}
      {row(t('Size'), 'size', [['s', t('Small')], ['m', t('Medium')], ['l', t('Large')]])}
      {row(t('Alignment'), 'align', [['start', t('Start')], ['center', t('Center')]])}
    </>
  );
}

function LinkDialog({ initialText, onClose, onAdd }: { initialText: string; onClose: () => void; onAdd: (text: string, url: string) => void }) {
  const t = useT();
  const [text, setText] = useState(initialText);
  const [url, setUrl] = useState('');
  const href = normalizeLink(url);
  return (
    <Dialog title={t('Link')} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!href) return;
          onAdd(text.trim() || url.trim(), href);
          onClose();
        }}
        className="flex flex-col gap-4"
      >
        {!initialText && (
          <label className="flex flex-col gap-2 text-[13px] font-semibold">
            {t('Text')}
            <input value={text} onChange={(e) => setText(e.target.value)} dir="auto" className="min-h-12 rounded-tile bg-surface border border-line-strong px-4 text-[15px] font-normal focus:outline-2 focus:outline-primary" />
          </label>
        )}
        <label className="flex flex-col gap-2 text-[13px] font-semibold">
          {t('Web page link')}
          <input autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" dir="ltr" inputMode="url" className="min-h-12 rounded-tile bg-surface border border-line-strong px-4 text-[15px] font-normal focus:outline-2 focus:outline-primary" />
        </label>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <button type="submit" disabled={!href} className="lime-fill min-h-12 px-6 rounded-full font-semibold disabled:opacity-50">
            {t('Add')}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function Preview({ html, onClose, onPrint }: { html: string; onClose: () => void; onPrint: () => void }) {
  const t = useT();
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
        {/* an A4-shaped sheet; no scripts run in it (same origin only so it can load the site's font files) */}
        <iframe title={t('Preview')} sandbox="allow-same-origin" srcDoc={html.replace('<body>', '<body style="padding:18mm 16mm">')} className="mx-auto block bg-paper shadow-raised w-full max-w-[794px] aspect-[210/297]" />
      </div>
    </div>
  );
}

/** A picture as a JPEG data URL, at most PICTURE_MAX on its long side (EXIF rotation applied). */
async function pictureDataUrl(file: File): Promise<string> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const k = Math.min(1, PICTURE_MAX / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  const g = c.getContext('2d')!;
  g.fillStyle = '#FFFFFF';
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return c.toDataURL('image/jpeg', 0.82);
}

/** https / mailto / tel links only; "example.com" becomes https://example.com. */
export function normalizeLink(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  if (/^(mailto:|tel:)/i.test(s)) return s;
  const withScheme = /^https?:\/\//i.test(s) ? s : /^[\w-]+(\.[\w-]+)+/.test(s) ? `https://${s}` : null;
  if (!withScheme) return null;
  try {
    return new URL(withScheme).href;
  } catch {
    return null;
  }
}

const escapeText = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = (s: string) => escapeText(s).replace(/"/g, '&quot;');
