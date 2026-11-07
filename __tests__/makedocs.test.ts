import { describe, expect, it } from 'vitest';
// Make with Zee, the pure parts: edits and totals, reading Gemini's JSON, Paper B, the print layout, and 24-hour
// documents in the store.
import { blankBlock, changeQuestionType, categorySummary, checklistDone, duplicateBlock, insertBlocks, moveBlock, questionNumbers, sectionMarks, sections, tableTotals, totalMarks } from '@/makedocs/edit';
import { parseBlocks, parseDoc, parseQuestion } from '@/makedocs/parse';
import { matchOrder, paperB } from '@/makedocs/shuffle';
import { docHtml } from '@/makedocs/html';
import { startBlocks, blocksFor } from '@/makedocs/kinds';
import { makePrompt } from '@/makedocs/ai';
import { zeeDocs } from '@/makedocs/store';
import { DEFAULT_SETTINGS, DOC_LIFE_MS, type Block, type ZeeDoc } from '@/makedocs/types';

const mcq = (id: string, text: string, answer = 0, marks = 1): Block => ({ id, type: 'question', q: { type: 'mcq', text, options: ['A1', 'B1', 'C1', 'D1'], answer, marks } });
const heading = (id: string, text: string, attempt?: number): Block => ({ id, type: 'heading', text, level: 2, ...(attempt ? { attempt } : {}) });
const doc = (blocks: Block[], extra: Partial<ZeeDoc> = {}): ZeeDoc => ({
  id: 'd1', kind: 'paper', title: 'Biology test', language: 'en', blocks, settings: { ...DEFAULT_SETTINGS },
  createdAt: 0, updatedAt: 0, expiresAt: DOC_LIFE_MS, ...extra,
});

describe('editing', () => {
  it('moves, inserts, duplicates and numbers questions', () => {
    const blocks = [heading('h', 'Section A'), mcq('a', 'one'), mcq('b', 'two'), mcq('c', 'three')];
    const moved = moveBlock(blocks, 3, 1);
    expect(moved.map((b) => b.id)).toEqual(['h', 'c', 'a', 'b']);
    expect(questionNumbers(moved)).toEqual({ c: 1, a: 2, b: 3 });
    const dup = duplicateBlock(blocks, 'a');
    expect(dup).toHaveLength(5);
    expect(dup[2].id).not.toBe('a');
    expect(insertBlocks(blocks, [mcq('x', 'new')], 'a').map((b) => b.id)).toEqual(['h', 'a', 'x', 'b', 'c']);
  });

  it('marks per section, with "attempt any N"', () => {
    const blocks = [mcq('a', 'q', 0, 1), heading('h1', 'B', 2), { id: 's1', type: 'question', q: { type: 'short', text: 's', marks: 2 } }, { id: 's2', type: 'question', q: { type: 'short', text: 's', marks: 3 } }, { id: 's3', type: 'question', q: { type: 'short', text: 's', marks: 2 } }] as Block[];
    const secs = sections(blocks);
    expect(secs.map(sectionMarks)).toEqual([1, 5]);
    expect(totalMarks(blocks)).toBe(6);
  });

  it('a question as another type keeps its wording', () => {
    const q = changeQuestionType({ type: 'short', text: 'Define osmosis', answerText: 'Movement of water', marks: 2 }, 'long');
    expect(q).toMatchObject({ type: 'long', text: 'Define osmosis', answerText: 'Movement of water', marks: 2 });
    expect(changeQuestionType(q, 'mcq')).toMatchObject({ type: 'mcq', text: 'Define osmosis', options: ['', '', '', ''] });
  });

  it('table totals, the expense summary and to-do progress', () => {
    const table: Block = {
      id: 't', type: 'table', total: true,
      columns: [{ name: 'Item', type: 'text' }, { name: 'Category', type: 'text' }, { name: 'Amount', type: 'money' }],
      rows: [['Petrol', 'Travel', '500'], ['Lunch', 'Food', '350'], ['Bus', 'Travel', 'Rs 1,200']],
    };
    if (table.type !== 'table') throw new Error();
    expect(tableTotals(table)).toEqual([null, null, 2050]);
    expect(categorySummary(table)).toEqual([{ name: 'Travel', amount: 1700 }, { name: 'Food', amount: 350 }]);
    expect(checklistDone([{ id: 'c', type: 'checklist', items: [{ text: 'a', done: true }, { text: 'b', done: false }, { text: '', done: true }] }])).toEqual({ done: 1, total: 2 });
  });

  it('every kind starts with something to fill and offers its own blocks first', () => {
    expect(startBlocks('paper').map((b) => b.type)).toEqual(['fields', 'heading', 'question']);
    expect(startBlocks('expenses')[0]).toMatchObject({ type: 'table', total: true });
    expect(blocksFor('todo')[0]).toBe('checklist');
    expect(blocksFor('paper')).toContain('divider');
    expect(blankBlock('checklist')).toMatchObject({ type: 'checklist', items: [{ text: '', done: false }] });
  });
});

describe("reading Gemini's JSON", () => {
  it('a paper: sections, every question type, answers checked', () => {
    const parsed = parseDoc({
      title: 'Photosynthesis quiz', kind: 'paper', language: 'en',
      blocks: [
        { type: 'fields', fields: [{ label: 'Class', value: '9' }] },
        { type: 'heading', text: 'Section A: MCQs', instructions: 'Choose the correct answer.' },
        { type: 'question', question: { type: 'mcq', text: 'Plants make food by?', options: ['Respiration', 'Photosynthesis', 'Digestion', 'Osmosis'], answer: 1, marks: 1 } },
        { type: 'question', question: { type: 'mcq', text: 'Answer out of range', options: ['a', 'b'], answer: 9 } },
        { type: 'question', question: { type: 'mcq', text: 'Only one option', options: ['a'] } },
        { type: 'question', question: { type: 'truefalse', text: 'Roots make food.', answer: 1 } },
        { type: 'question', question: { type: 'match', pairs: [{ left: 'Leaf', right: 'Food' }, { left: 'Root', right: 'Water' }] } },
        { type: 'question', question: { type: 'long', text: 'Explain it.', parts: ['Light', 'Dark'], marks: 5 } },
        { type: 'mystery', text: 'dropped' },
        { type: 'text', text: '' },
      ],
    });
    expect(parsed?.title).toBe('Photosynthesis quiz');
    const qs = parsed!.blocks.filter((b) => b.type === 'question');
    expect(qs).toHaveLength(5);
    expect(qs[0]).toMatchObject({ q: { answer: 1 } });
    expect(qs[1]).toMatchObject({ q: { answer: 0 } }); // out of range: the first
    expect(qs[2]).toMatchObject({ q: { type: 'truefalse', answer: 1 } });
    expect(qs[4]).toMatchObject({ q: { parts: ['Light', 'Dark'], marks: 5 } });
    expect(parsed!.blocks.some((b) => (b as { text?: string }).text === 'dropped')).toBe(false);
  });

  it('an MCQ answer given as the option text, chatty JSON, and nothing usable', () => {
    expect(parseQuestion({ type: 'mcq', text: 'x', options: ['Red', 'Blue'], answer: 'blue' })).toMatchObject({ answer: 1 });
    expect(parseDoc('Sure! ```json {"kind":"todo","blocks":[{"type":"checklist","checklist":[{"text":"Revise"}]}]} ```')?.blocks[0]).toMatchObject({ type: 'checklist', items: [{ text: 'Revise', done: false }] });
    expect(parseDoc({ blocks: [] })).toBeNull();
    expect(parseDoc('not json')).toBeNull();
    expect(parseDoc({ kind: 'nonsense', blocks: [{ type: 'text', text: 'hi' }] }, 'notes')?.kind).toBe('notes');
    expect(parseBlocks({ blocks: [{ type: 'list', items: ['a', '', 'b'] }] })[0]).toMatchObject({ items: ['a', 'b'] });
  });

  it('sizes are capped', () => {
    const many = Array.from({ length: 500 }, (_, i) => ({ type: 'text', text: `p${i}` }));
    expect(parseDoc({ blocks: many })!.blocks).toHaveLength(200);
    const table = parseBlocks({ blocks: [{ type: 'table', columns: Array.from({ length: 20 }, (_, i) => `c${i}`), rows: [['1', '2']] }] })[0];
    expect(table.type === 'table' && table.columns.length).toBe(8);
  });

  it('the prompt carries the request, level, sections and the source (capped)', () => {
    const p = makePrompt({ request: '10 MCQs on cells', kind: 'paper', level: 'Class 9', sections: [{ type: 'mcq', count: 10, marks: 1 }], source: 'x'.repeat(40_000) });
    expect(p).toContain('Kind: paper');
    expect(p).toContain('10 × mcq (1 mark each)');
    expect(p.length).toBeLessThan(31_000);
  });
});

describe('Paper B', () => {
  it('shuffles each section and MCQ choices; the answer follows its choice; same every time', () => {
    const blocks = [heading('h', 'A'), ...Array.from({ length: 6 }, (_, i) => mcq(`q${i}`, `Q${i}`, i % 4))];
    const b1 = paperB(blocks);
    const b2 = paperB(blocks);
    expect(b1).toEqual(b2);
    expect(b1[0].id).toBe('h');
    expect(b1.map((b) => b.id)).not.toEqual(blocks.map((b) => b.id));
    for (const b of b1) {
      if (b.type !== 'question') continue;
      const orig = blocks.find((x) => x.id === b.id)!;
      if (orig.type !== 'question') continue;
      expect(b.q.options![b.q.answer!]).toBe(orig.q.options![orig.q.answer!]);
    }
    expect(matchOrder(4, 3)).not.toEqual([0, 1, 2, 3]);
  });
});

describe('the printed page', () => {
  const paper = doc([
    { id: 'f', type: 'fields', fields: [{ label: 'Class', value: '9' }] },
    heading('h', 'Section A: MCQs'),
    mcq('a', 'Plants make food by <photosynthesis>?', 1),
    { id: 't', type: 'question', q: { type: 'truefalse', text: 'Roots make food.', answer: 1, marks: 1 } },
    { id: 'm', type: 'question', q: { type: 'match', text: '', pairs: [{ left: 'Leaf', right: 'Food' }, { left: 'Root', right: 'Water' }], marks: 2 } },
    { id: 's', type: 'question', q: { type: 'short', text: 'Define osmosis.', answerText: 'Water moving', marks: 2 } },
  ]);

  it('an exam paper: total marks, name lines, numbered questions, escaped text, MCQ columns', () => {
    const html = docHtml(paper);
    expect(html).toContain('Total marks: 6');
    expect(html).toContain('Roll no');
    expect(html).toContain('<span class="qn">1.</span>');
    expect(html).toContain('&lt;photosynthesis&gt;');
    expect(html).toContain('opts c2');
    expect(html).toContain('Section A: MCQs');
    expect(html).not.toContain('Answer key');
    expect(docHtml({ ...paper, settings: { ...paper.settings, mcqColumns: 1, nameLines: false } })).not.toContain('Roll no');
  });

  it('the answer key page and Paper B', () => {
    const html = docHtml(paper, { answerKey: true });
    expect(html).toContain('class="keypage"');
    expect(html).toContain('(b) B1');
    expect(html).toContain('False');
    expect(html).toContain('Water moving');
    expect(docHtml(paper, { version: 'B', answerKey: true })).toContain('Paper B');
  });

  it('expenses with the total and categories, a checklist, flashcards, Urdu, page sizes', () => {
    const expenses = doc([{ id: 't', type: 'table', total: true, columns: [{ name: 'Item', type: 'text' }, { name: 'Category', type: 'text' }, { name: 'Amount', type: 'money' }], rows: [['Petrol', 'Travel', '500'], ['Lunch', 'Food', '1350']] }], { kind: 'expenses', title: 'October' });
    const e = docHtml(expenses);
    expect(e).toContain('Rs 1,850');
    expect(e).toContain('By category');
    const todo = docHtml(doc([{ id: 'c', type: 'checklist', items: [{ text: 'Revise', done: true }, { text: 'Sleep', done: false, due: '10pm' }] }], { kind: 'todo' }));
    expect(todo).toContain('check done');
    expect(todo).toContain('10pm');
    expect(docHtml(doc([{ id: 'f', type: 'flashcard', front: 'Cell', back: 'Unit of life' }], { kind: 'flashcards' }))).toContain('class="cards"');
    expect(docHtml(doc([], { language: 'ur' }))).toContain('dir="rtl"');
    expect(docHtml(doc([], { settings: { ...DEFAULT_SETTINGS, pageSize: 'legal' } }))).toContain('size:legal');
  });
});

describe('the store', () => {
  it('documents live 24 hours after their last change', () => {
    const id = zeeDocs.create({ kind: 'notes', title: 'Cells', blocks: [] });
    const created = zeeDocs.get(id)!;
    expect(created.expiresAt - created.updatedAt).toBe(DOC_LIFE_MS);
    zeeDocs.update(id, { title: 'Plant cells' });
    expect(zeeDocs.get(id)!.expiresAt).toBeGreaterThanOrEqual(created.expiresAt);
    const copy = zeeDocs.duplicate(zeeDocs.create({ kind: 'todo', blocks: [] }), 'copy');
    expect(zeeDocs.get(copy!)!.title).toBe('copy');
    zeeDocs.remove(id);
    expect(zeeDocs.get(id)).toBeUndefined();
  });
});
