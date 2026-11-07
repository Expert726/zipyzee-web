// Pure edits on a document's blocks (unit-tested): new blocks, move / duplicate / remove, changing a question's type
// (the text stays), numbering, a paper's marks (with "attempt any N"), and table totals.
import type { Block, BlockType, Question, QuestionType } from './types';

let seq = 0;
export const newId = () => `${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const blankQuestion = (type: QuestionType = 'mcq'): Question => {
  switch (type) {
    case 'mcq':
      return { type, text: '', options: ['', '', '', ''], answer: 0, marks: 1 };
    case 'truefalse':
      return { type, text: '', answer: 0, marks: 1 };
    case 'match':
      return { type, text: '', pairs: [{ left: '', right: '' }, { left: '', right: '' }, { left: '', right: '' }], marks: 3 };
    case 'long':
      return { type, text: '', parts: [], answerText: '', marks: 5 };
    case 'short':
      return { type, text: '', answerText: '', marks: 2 };
    default:
      return { type, text: '', answerText: '', marks: 1 };
  }
};

export function blankBlock(type: BlockType): Block {
  const id = newId();
  switch (type) {
    case 'heading':
      return { id, type, text: '', level: 2 };
    case 'text':
      return { id, type, text: '' };
    case 'list':
      return { id, type, ordered: false, items: [''] };
    case 'checklist':
      return { id, type, items: [{ text: '', done: false }] };
    case 'table':
      return { id, type, columns: [{ name: '', type: 'text' }, { name: '', type: 'text' }], rows: [['', '']] };
    case 'question':
      return { id, type, q: blankQuestion() };
    case 'flashcard':
      return { id, type, front: '', back: '' };
    case 'fields':
      return { id, type, fields: [{ label: '', value: '' }] };
    case 'image':
      return { id, type, uri: '' };
    case 'note':
      return { id, type, text: '' };
    default:
      return { id, type: 'divider' };
  }
}

/** Moves the block at `from` to `to` (both indexes in the list before the move). */
export function moveBlock(blocks: Block[], from: number, to: number): Block[] {
  if (from === to || from < 0 || from >= blocks.length) return blocks;
  const next = [...blocks];
  const [b] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(next.length, to)), 0, b);
  return next;
}

export const updateBlock = (blocks: Block[], id: string, next: Block): Block[] => blocks.map((b) => (b.id === id ? next : b));
export const removeBlock = (blocks: Block[], id: string): Block[] => blocks.filter((b) => b.id !== id);

export function duplicateBlock(blocks: Block[], id: string): Block[] {
  const i = blocks.findIndex((b) => b.id === id);
  if (i < 0) return blocks;
  const copy = { ...JSON.parse(JSON.stringify(blocks[i])), id: newId() } as Block;
  return [...blocks.slice(0, i + 1), copy, ...blocks.slice(i + 1)];
}

/** Inserts after the block with `afterId` (or at the end). */
export function insertBlocks(blocks: Block[], add: Block[], afterId?: string): Block[] {
  const i = afterId ? blocks.findIndex((b) => b.id === afterId) : -1;
  if (i < 0) return [...blocks, ...add];
  return [...blocks.slice(0, i + 1), ...add, ...blocks.slice(i + 1)];
}

/** A question as another type: the wording stays, options / answers that fit the new type are kept. */
export function changeQuestionType(q: Question, type: QuestionType): Question {
  if (q.type === type) return q;
  const base = blankQuestion(type);
  return {
    ...base,
    text: q.text,
    image: q.image,
    marks: q.marks ?? base.marks,
    ...(type === 'mcq' && q.options?.length ? { options: q.options, answer: q.answer ?? 0 } : {}),
    ...(['fill', 'oneword', 'short', 'long'].includes(type) && q.answerText ? { answerText: q.answerText } : {}),
  };
}

/** Each question's number (1, 2, 3… through the whole document). */
export function questionNumbers(blocks: Block[]): Record<string, number> {
  const out: Record<string, number> = {};
  let n = 0;
  for (const b of blocks) if (b.type === 'question') out[b.id] = ++n;
  return out;
}

/** The questions under each heading (a paper's sections), by the heading's id; '' = before the first heading. */
export function sections(blocks: Block[]): { heading: Extract<Block, { type: 'heading' }> | null; questions: Question[] }[] {
  const out: { heading: Extract<Block, { type: 'heading' }> | null; questions: Question[] }[] = [{ heading: null, questions: [] }];
  for (const b of blocks) {
    if (b.type === 'heading') out.push({ heading: b, questions: [] });
    else if (b.type === 'question') out[out.length - 1].questions.push(b.q);
  }
  return out.filter((s) => s.heading || s.questions.length);
}

/** A section's marks: all its questions, or with "attempt any N", the N highest-marked. */
export function sectionMarks(s: { heading: { attempt?: number } | null; questions: Question[] }): number {
  const marks = s.questions.map((q) => Math.max(0, Number(q.marks) || 0)).sort((a, b) => b - a);
  const n = s.heading?.attempt && s.heading.attempt > 0 ? Math.min(s.heading.attempt, marks.length) : marks.length;
  return marks.slice(0, n).reduce((a, b) => a + b, 0);
}

export const totalMarks = (blocks: Block[]) => sections(blocks).reduce((sum, s) => sum + sectionMarks(s), 0);
export const questionCount = (blocks: Block[]) => blocks.filter((b) => b.type === 'question').length;

/** "1,250" / "Rs 1,250": a number with thousands separators; NaN-safe. */
export function parseAmount(s: string): number {
  const n = Number(String(s).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}
export const formatAmount = (n: number) => {
  const [int, dec] = (Math.round(n * 100) / 100).toString().split('.');
  return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${dec ? `.${dec}` : ''}`;
};

/** Totals of a table's number / money columns (null for the others). */
export function tableTotals(b: Extract<Block, { type: 'table' }>): (number | null)[] {
  return b.columns.map((c, i) => (c.type === 'number' || c.type === 'money' ? b.rows.reduce((sum, r) => sum + parseAmount(r[i] ?? ''), 0) : null));
}

/** Expenses: total per category (the column named like "Category"), biggest first. */
export function categorySummary(b: Extract<Block, { type: 'table' }>): { name: string; amount: number }[] {
  const cat = b.columns.findIndex((c) => /categor|قسم/i.test(c.name));
  const money = b.columns.findIndex((c) => c.type === 'money' || c.type === 'number');
  if (cat < 0 || money < 0) return [];
  const sums = new Map<string, number>();
  for (const r of b.rows) {
    const name = (r[cat] ?? '').trim();
    if (!name) continue;
    sums.set(name, (sums.get(name) ?? 0) + parseAmount(r[money] ?? ''));
  }
  return [...sums].map(([name, amount]) => ({ name, amount })).sort((a, z) => z.amount - a.amount);
}

/** Checklist progress, e.g. 3 of 7 done. */
export function checklistDone(blocks: Block[]): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const b of blocks) {
    if (b.type !== 'checklist') continue;
    for (const it of b.items) {
      if (!it.text.trim()) continue;
      total++;
      if (it.done) done++;
    }
  }
  return { done, total };
}
