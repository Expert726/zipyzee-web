// A document as a printable page (pure, unit-tested; the app's src/makedocs/html.ts): one printer per block, and a
// layout per kind. Printed with the browser's print dialog like the Text editor (src/textdocs/print.ts), with the
// site's fonts passed in: real text, Urdu in Noto Naskh right to left. Papers print like an exam (header, name / roll no lines, numbered questions with marks on
// the right, MCQs in 1 or 2 columns, answer lines) with an optional answer key page and a shuffled Paper B.
import { esc } from '@/textdocs/page';
import type { Block, DocSettings, Question, ZeeDoc } from './types';
import { categorySummary, formatAmount, questionNumbers, sections, sectionMarks, tableTotals, totalMarks } from './edit';
import { matchOrder, paperB } from './shuffle';
import { t } from '@/i18n';

export type PrintOptions = {
  version?: 'A' | 'B';
  answerKey?: boolean;
  /** the site's @font-face rules and families (src/textdocs/print.ts siteFonts) */
  fonts?: { faces: string; sans: string; urdu: string };
};

const TEXT_PT: Record<DocSettings['textSize'], number> = { s: 10.5, m: 12, l: 13.5 };
const PAGE: Record<DocSettings['pageSize'], string> = { a4: 'A4', letter: 'letter', legal: 'legal' };
const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

/** Text with line breaks and **bold** kept. */
const rich = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
/** A stable number from an id (Match the columns order). */
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 4294967296, 7);
const lines = (n: number) => (n ? `<div class="lines">${'<div class="line"></div>'.repeat(n)}</div>` : '');

function questionHtml(id: string, q: Question, n: number, s: DocSettings): string {
  const marks = q.marks ? `<span class="marks">[${q.marks}]</span>` : '';
  const img = q.image ? `<img class="qimg" src="${esc(q.image)}">` : '';
  const head = (text: string) => `<div class="qhead"><span class="qn">${n}.</span><div class="qt" dir="auto">${text}</div>${marks}</div>`;
  switch (q.type) {
    case 'mcq': {
      const opts = (q.options ?? []).map((o, i) => `<div class="opt" dir="auto">(${LETTERS[i]}) ${esc(o)}</div>`).join('');
      return `<div class="q">${head(rich(q.text))}${img}<div class="opts c${s.mcqColumns}">${opts}</div></div>`;
    }
    case 'truefalse':
      return `<div class="q">${head(`${rich(q.text)} <span class="tf">( ${esc(t('True'))} / ${esc(t('False'))} )</span>`)}${img}</div>`;
    case 'fill': {
      const text = /_{3,}/.test(q.text) ? rich(q.text).replace(/_{3,}/g, '<span class="blank"></span>') : `${rich(q.text)} <span class="blank"></span>`;
      return `<div class="q">${head(text)}${img}</div>`;
    }
    case 'oneword':
      return `<div class="q">${head(`${rich(q.text)} <span class="blank short"></span>`)}${img}</div>`;
    case 'match': {
      const pairs = q.pairs ?? [];
      const order = matchOrder(pairs.length, hash(id));
      const rows = pairs
        .map((p, i) => `<tr><td dir="auto">${i + 1}. ${esc(p.left)}</td><td class="gap"></td><td dir="auto">(${LETTERS[i]}) ${esc(pairs[order[i]].right)}</td></tr>`)
        .join('');
      return `<div class="q">${head(rich(q.text || t('Match column A with column B.')))}${img}<table class="match"><tr><th>${esc(t('Column A'))}</th><th></th><th>${esc(t('Column B'))}</th></tr>${rows}</table></div>`;
    }
    case 'long': {
      const parts = (q.parts ?? []).map((p, i) => `<div class="part" dir="auto">(${LETTERS[i]}) ${rich(p)}</div>`).join('');
      return `<div class="q">${head(rich(q.text))}${img}${parts}${s.answerLines ? lines(6) : ''}</div>`;
    }
    default:
      return `<div class="q">${head(rich(q.text))}${img}${s.answerLines ? lines(2) : ''}</div>`;
  }
}

function answerFor(id: string, q: Question): string {
  switch (q.type) {
    case 'mcq': {
      const i = q.answer ?? 0;
      return `(${LETTERS[i]}) ${esc(q.options?.[i] ?? '')}`;
    }
    case 'truefalse':
      return esc(q.answer === 1 ? t('False') : t('True'));
    case 'match': {
      const pairs = q.pairs ?? [];
      const order = matchOrder(pairs.length, hash(id));
      // left i goes with the right item printed at position order.indexOf(i)
      return pairs.map((_, i) => `${i + 1} → ${LETTERS[order.indexOf(i)]}`).join(', ');
    }
    default:
      return q.answerText ? rich(q.answerText) : '—';
  }
}

function blockHtml(b: Block, doc: ZeeDoc, numbers: Record<string, number>, blocks: Block[]): string {
  const s = doc.settings;
  switch (b.type) {
    case 'heading': {
      if (doc.kind === 'paper') {
        const sec = sections(blocks).find((x) => x.heading?.id === b.id);
        const marks = sec ? sectionMarks(sec) : 0;
        const attempt = b.attempt ? ` <span class="attempt">(${esc(t('Attempt any {n}', { n: b.attempt }))})</span>` : '';
        return `<div class="section"><div class="sectionbar"><span dir="auto">${esc(b.text)}${attempt}</span>${marks ? `<span>${esc(t('{n} marks', { n: marks }))}</span>` : ''}</div>${b.instructions ? `<div class="instr" dir="auto">${rich(b.instructions)}</div>` : ''}</div>`;
      }
      return b.level === 1 ? `<h2 dir="auto">${esc(b.text)}</h2>` : `<h3 dir="auto">${esc(b.text)}</h3>`;
    }
    case 'text':
      return `<p dir="auto">${rich(b.text)}</p>`;
    case 'note':
      return `<div class="note" dir="auto">${rich(b.text)}</div>`;
    case 'list': {
      const tag = b.ordered ? 'ol' : 'ul';
      return `<${tag} dir="auto">${b.items.filter(Boolean).map((i) => `<li>${rich(i)}</li>`).join('')}</${tag}>`;
    }
    case 'checklist': {
      const items = b.items
        .filter((i) => i.text.trim())
        .map((i) => {
          const meta = [i.qty, i.due].filter(Boolean).map((m) => esc(m!)).join(' · ');
          return `<div class="check${i.done ? ' done' : ''}" dir="auto"><span class="box">${i.done ? '✓' : ''}</span><span class="ct">${esc(i.text)}${i.priority === 'high' ? ' <b>!</b>' : ''}</span>${meta ? `<span class="cm">${meta}</span>` : ''}</div>`;
        })
        .join('');
      return `<div class="checks${doc.kind === 'shopping' ? ' two' : ''}">${items}</div>`;
    }
    case 'table': {
      const right = (i: number) => (b.columns[i].type === 'money' || b.columns[i].type === 'number' ? ' class="num"' : '');
      const head = `<tr>${b.columns.map((c, i) => `<th${right(i)} dir="auto">${esc(c.name)}</th>`).join('')}</tr>`;
      const body = b.rows
        .filter((r) => r.some((c) => c.trim()))
        .map((r) => `<tr>${b.columns.map((c, i) => `<td${right(i)} dir="auto">${esc(c.type === 'money' && r[i] ? formatAmount(Number(r[i].replace(/[^\d.-]/g, '')) || 0) : r[i] ?? '')}</td>`).join('')}</tr>`)
        .join('');
      let foot = '';
      if (b.total) {
        const totals = tableTotals(b);
        const label = totals.findIndex((v) => v == null);
        foot = `<tr class="total">${b.columns
          .map((c, i) => (i === label ? `<td>${esc(t('Total'))}</td>` : totals[i] != null ? `<td class="num">${c.type === 'money' ? `${esc(s.currency)} ` : ''}${formatAmount(totals[i]!)}</td>` : '<td></td>'))
          .join('')}</tr>`;
      }
      let summary = '';
      if (doc.kind === 'expenses') {
        const cats = categorySummary(b);
        if (cats.length > 1) {
          summary = `<h3>${esc(t('By category'))}</h3><table class="grid small">${cats.map((c) => `<tr><td dir="auto">${esc(c.name)}</td><td class="num">${esc(s.currency)} ${formatAmount(c.amount)}</td></tr>`).join('')}</table>`;
        }
      }
      return `<table class="grid">${head}${body}${foot}</table>${summary}`;
    }
    case 'question':
      return questionHtml(b.id, b.q, numbers[b.id], s);
    case 'flashcard':
      return `<div class="card"><div class="front" dir="auto">${rich(b.front)}</div><div class="back" dir="auto">${rich(b.back)}</div></div>`;
    case 'fields': {
      if (doc.kind === 'paper') {
        return `<div class="pfields">${b.fields.map((f) => `<div dir="auto"><b>${esc(f.label)}:</b> ${esc(f.value) || '<span class="blank short"></span>'}</div>`).join('')}</div>`;
      }
      return `<table class="fields">${b.fields.map((f) => `<tr><td class="fl" dir="auto">${esc(f.label)}</td><td dir="auto">${rich(f.value)}</td></tr>`).join('')}</table>`;
    }
    case 'image':
      return b.uri ? `<figure><img src="${esc(b.uri)}">${b.caption ? `<figcaption dir="auto">${esc(b.caption)}</figcaption>` : ''}</figure>` : '';
    default:
      return '<hr>';
  }
}

/** The full page, ready for printHtmlToPdf. */
export function docHtml(doc: ZeeDoc, opts: PrintOptions = {}): string {
  const s = doc.settings;
  const paper = doc.kind === 'paper';
  const blocks = paper && opts.version === 'B' ? paperB(doc.blocks) : doc.blocks;
  const numbers = questionNumbers(blocks);
  const pt = TEXT_PT[s.textSize];
  const serif = paper || doc.kind === 'letter';
  const f = opts.fonts ?? { faces: '', sans: 'sans-serif', urdu: "'Noto Naskh Arabic'" };
  const family = `${serif ? 'Georgia, "Times New Roman"' : f.sans}, ${f.urdu}, ${serif ? 'serif' : 'sans-serif'}`;
  const title = `${esc(doc.title || t('Untitled'))}${paper && opts.version === 'B' ? ` <span class="ver">(${esc(t('Paper B'))})</span>` : ''}`;

  let header = `<h1 dir="auto"${paper ? ' class="center"' : ''}>${title}</h1>`;
  if (paper) {
    const total = totalMarks(blocks);
    const id = s.nameLines ? `<div class="idrow"><span>${esc(t('Name'))}: <span class="blank"></span></span><span>${esc(t('Roll no'))}: <span class="blank short"></span></span></div>` : '';
    header += `${total ? `<div class="totalm">${esc(t('Total marks: {n}', { n: total }))}</div>` : ''}${id}`;
  }

  // flashcards: a cut-out grid
  const body =
    doc.kind === 'flashcards'
      ? `<div class="cards">${blocks.map((b) => (b.type === 'flashcard' ? blockHtml(b, doc, numbers, blocks) : '')).join('')}</div>${blocks.filter((b) => b.type !== 'flashcard').map((b) => blockHtml(b, doc, numbers, blocks)).join('\n')}`
      : blocks.map((b) => blockHtml(b, doc, numbers, blocks)).join('\n');

  const questions = blocks.filter((b): b is Extract<Block, { type: 'question' }> => b.type === 'question');
  const key =
    opts.answerKey && questions.length
      ? `<div class="keypage"><h1 dir="auto">${esc(t('Answer key'))}${paper && opts.version === 'B' ? ` (${esc(t('Paper B'))})` : ''}</h1><ol class="key">${questions
        .map((b) => `<li value="${numbers[b.id]}" dir="auto">${answerFor(b.id, b.q)}</li>`)
        .join('')}</ol></div>`
      : '';

  return `<!doctype html><html${doc.language === 'ur' ? ' dir="rtl" lang="ur"' : ''}><head><meta charset="utf-8"><title>${esc(doc.title || t('Untitled'))}${paper && opts.version === 'B' ? ' (B)' : ''}</title><style>
${f.faces}
@page{size:${PAGE[s.pageSize]};margin:14mm 14mm}
*{font-variant-ligatures:none;box-sizing:border-box}
body{margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact;font-family:${family};font-size:${pt}pt;line-height:1.5;color:#111827}
h1{font-size:${(pt * 1.55).toFixed(1)}pt;line-height:1.25;margin:0 0 6pt}
h1.center{text-align:center}
.ver{font-size:${(pt * 0.9).toFixed(1)}pt;color:#4B5563}
h2{font-size:${(pt * 1.3).toFixed(1)}pt;margin:12pt 0 4pt}
h3{font-size:${(pt * 1.1).toFixed(1)}pt;margin:10pt 0 3pt}
p{margin:0 0 7pt}
ul,ol{margin:0 0 7pt;padding-inline-start:18pt}
li{margin:0 0 2pt}
hr{border:0;border-top:1px solid #9CA3AF;margin:10pt 0}
.note{border-inline-start:3pt solid #0284C7;background:#E0F2FE;padding:6pt 9pt;margin:0 0 8pt;border-radius:3pt}
.totalm{text-align:center;font-weight:700;margin:0 0 6pt}
.idrow{display:flex;justify-content:space-between;gap:16pt;margin:4pt 0 8pt}
.pfields{display:grid;grid-template-columns:1fr 1fr;gap:3pt 16pt;border-top:1.5pt solid #111827;border-bottom:1.5pt solid #111827;padding:5pt 0;margin:0 0 8pt}
.blank{display:inline-block;min-width:90pt;border-bottom:1px solid #111827;height:1em;vertical-align:bottom}
.blank.short{min-width:55pt}
.section{margin:12pt 0 4pt;break-inside:avoid}
.sectionbar{display:flex;justify-content:space-between;font-weight:700;background:#F3F4F6;padding:3pt 6pt;border-radius:3pt}
.attempt{font-weight:400}
.instr{font-style:italic;margin:3pt 0 0}
.q{margin:0 0 8pt;break-inside:avoid}
.qhead{display:flex;gap:5pt;align-items:flex-start}
.qn{font-weight:700;min-width:16pt}
.qt{flex:1}
.marks{white-space:nowrap;font-weight:600}
.tf{white-space:nowrap}
.opts{display:grid;gap:2pt 14pt;padding-inline-start:21pt;margin-top:2pt}
.opts.c1{grid-template-columns:1fr}
.opts.c2{grid-template-columns:1fr 1fr}
.part{padding-inline-start:21pt;margin-top:2pt}
.lines{padding-inline-start:21pt}
.line{border-bottom:1px solid #9CA3AF;height:${(pt * 1.9).toFixed(1)}pt}
.qimg{display:block;max-width:60%;max-height:160pt;margin:4pt 0 4pt 21pt}
table.match{margin:4pt 0 0 21pt;border-collapse:collapse}
table.match th{text-align:start;padding:1pt 10pt 1pt 0}
table.match td{padding:1pt 10pt 1pt 0}
table.match .gap{width:24pt}
table.grid{width:100%;border-collapse:collapse;margin:0 0 9pt}
table.grid th,table.grid td{border:1px solid #9CA3AF;padding:4pt 6pt;text-align:start;vertical-align:top}
table.grid th{background:#F3F4F6}
table.grid.small{width:auto;min-width:50%}
.num{text-align:end !important;white-space:nowrap}
tr.total td{font-weight:700;background:#F9FAFB}
table.fields{border-collapse:collapse;margin:0 0 9pt}
table.fields td{padding:2pt 12pt 2pt 0;vertical-align:top}
.fl{font-weight:700;white-space:nowrap}
.checks .check{display:flex;gap:7pt;align-items:baseline;padding:3pt 0;border-bottom:1px dashed #E5E7EB;break-inside:avoid}
.checks.two{column-count:2;column-gap:18pt}
.box{display:inline-flex;width:11pt;height:11pt;border:1.2pt solid #111827;border-radius:2pt;align-items:center;justify-content:center;font-size:9pt;flex:none}
.check.done .ct{text-decoration:line-through;color:#6B7280}
.ct{flex:1}
.cm{color:#6B7280;font-size:${(pt * 0.85).toFixed(1)}pt;white-space:nowrap}
.cards{display:grid;grid-template-columns:1fr 1fr;gap:8pt}
.card{border:1.2pt dashed #6B7280;border-radius:6pt;padding:9pt;min-height:120pt;display:flex;flex-direction:column;justify-content:space-between;break-inside:avoid}
.card .front{font-weight:700}
.card .back{color:#374151;border-top:1px solid #E5E7EB;padding-top:5pt;margin-top:6pt}
figure{margin:0 0 9pt}
figure img{max-width:100%;max-height:300pt}
figcaption{color:#6B7280;font-size:${(pt * 0.85).toFixed(1)}pt}
.keypage{break-before:page}
ol.key li{margin:0 0 4pt}
</style></head><body>
${header}
${body}
${key}
</body></html>`;
}
