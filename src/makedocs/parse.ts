// Gemini's JSON (the schema in src/makedocs/ai.ts) to a valid document: never trusted. Missing fields are filled,
// sizes are capped, MCQs get 2-6 options and a right answer that exists, empty blocks are dropped, unknown ones skipped.
import type { Block, ChecklistItem, Column, ColumnType, DocKind, DocLanguage, Question, QuestionType } from './types';
import { DOC_KINDS } from './kinds';
import { newId } from './edit';

const MAX_BLOCKS = 200;
const MAX_ITEMS = 100;
const MAX_TEXT = 4000;

const str = (v: unknown, max = MAX_TEXT) => (typeof v === 'string' ? v.trim().slice(0, max) : typeof v === 'number' ? String(v) : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() && Number.isFinite(Number(v)) ? Number(v) : undefined);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

const QUESTION_TYPES: QuestionType[] = ['mcq', 'truefalse', 'fill', 'match', 'oneword', 'short', 'long'];
const COLUMN_TYPES: ColumnType[] = ['text', 'number', 'money', 'date'];

export function parseQuestion(raw: unknown): Question | null {
  const r = obj(raw);
  const type = (QUESTION_TYPES as string[]).includes(String(r.type)) ? (r.type as QuestionType) : 'short';
  const text = str(r.text);
  const marks = Math.max(0, Math.min(100, num(r.marks) ?? (type === 'long' ? 5 : type === 'short' ? 2 : 1)));
  const answerText = str(r.answerText, 2000) || undefined;
  if (type === 'mcq') {
    const options = arr(r.options).map((o) => str(o, 500)).filter(Boolean).slice(0, 6);
    if (!text || options.length < 2) return null;
    const a = num(r.answer);
    // the answer as an index, or as the option's text
    const byText = options.findIndex((o) => o.toLowerCase() === str(r.answer).toLowerCase());
    const answer = a != null && a >= 0 && a < options.length ? Math.floor(a) : byText >= 0 ? byText : 0;
    return { type, text, options, answer, marks };
  }
  if (type === 'truefalse') {
    if (!text) return null;
    const a = r.answer;
    const isFalse = a === 1 || a === false || /^f(alse)?$|^غلط$/i.test(str(a));
    return { type, text, answer: isFalse ? 1 : 0, marks };
  }
  if (type === 'match') {
    const pairs = arr(r.pairs)
      .map((p) => ({ left: str(obj(p).left, 300), right: str(obj(p).right, 300) }))
      .filter((p) => p.left && p.right)
      .slice(0, 12);
    if (pairs.length < 2) return null;
    return { type, text: text || '', pairs, marks: Math.max(marks, pairs.length > 3 ? pairs.length : marks) };
  }
  if (!text) return null;
  if (type === 'long') {
    const parts = arr(r.parts).map((p) => str(p, 1000)).filter(Boolean).slice(0, 8);
    return { type, text, parts, answerText, marks };
  }
  return { type, text, answerText, marks };
}

function parseBlock(raw: unknown): Block | null {
  const r = obj(raw);
  const id = newId();
  switch (r.type) {
    case 'heading': {
      const text = str(r.text, 300);
      if (!text) return null;
      const attempt = num(r.attempt);
      return {
        id, type: 'heading', text, level: num(r.level) === 1 ? 1 : 2,
        ...(str(r.instructions, 500) ? { instructions: str(r.instructions, 500) } : {}),
        ...(attempt && attempt > 0 ? { attempt: Math.floor(attempt) } : {}),
      };
    }
    case 'text':
    case 'note': {
      const text = str(r.text);
      return text ? { id, type: r.type, text } : null;
    }
    case 'list': {
      const items = arr(r.items).map((i) => str(i, 1000)).filter(Boolean).slice(0, MAX_ITEMS);
      return items.length ? { id, type: 'list', ordered: !!r.ordered, items } : null;
    }
    case 'checklist': {
      const items: ChecklistItem[] = arr(r.checklist ?? r.items)
        .map((i) => (typeof i === 'string' ? { text: str(i, 500) } : obj(i)))
        .map((i) => ({
          text: str(i.text, 500),
          done: i.done === true,
          ...(str(i.due, 40) ? { due: str(i.due, 40) } : {}),
          ...(str(i.qty, 40) ? { qty: str(i.qty, 40) } : {}),
          ...(i.priority === 'high' ? { priority: 'high' as const } : {}),
        }))
        .filter((i) => i.text)
        .slice(0, MAX_ITEMS);
      return items.length ? { id, type: 'checklist', items } : null;
    }
    case 'table': {
      const columns: Column[] = arr(r.columns)
        .map((c) => (typeof c === 'string' ? { name: str(c, 60) } : obj(c)))
        .map((c) => ({ name: str(c.name, 60), type: (COLUMN_TYPES as string[]).includes(String(c.type)) ? (c.type as ColumnType) : 'text' }))
        .slice(0, 8);
      if (!columns.length) return null;
      const rows = arr(r.rows)
        .map((row) => columns.map((_, i) => str(arr(row)[i], 300)))
        .filter((row) => row.some(Boolean))
        .slice(0, 200);
      const total = r.total === true || columns.some((c) => c.type === 'money');
      return { id, type: 'table', columns, rows: rows.length ? rows : [columns.map(() => '')], ...(total ? { total: true } : {}) };
    }
    case 'question': {
      const q = parseQuestion(r.question ?? r);
      return q ? { id, type: 'question', q } : null;
    }
    case 'flashcard': {
      const front = str(r.front, 1000);
      const back = str(r.back, 2000);
      return front && back ? { id, type: 'flashcard', front, back } : null;
    }
    case 'fields': {
      const fields = arr(r.fields)
        .map((f) => ({ label: str(obj(f).label, 60), value: str(obj(f).value, 300) }))
        .filter((f) => f.label)
        .slice(0, 12);
      return fields.length ? { id, type: 'fields', fields } : null;
    }
    case 'divider':
      return { id, type: 'divider' };
    default:
      return null;
  }
}

export type ParsedDoc = { title: string; kind: DocKind; language: DocLanguage; blocks: Block[] };

/** The whole answer from Gemini; null when nothing usable came back. */
export function parseDoc(raw: unknown, fallbackKind: DocKind = 'other'): ParsedDoc | null {
  const r = obj(typeof raw === 'string' ? safeJson(raw) : raw);
  const blocks = arr(r.blocks).slice(0, MAX_BLOCKS * 2).map(parseBlock).filter((b): b is Block => !!b).slice(0, MAX_BLOCKS);
  if (!blocks.length) return null;
  const kind = (DOC_KINDS as string[]).includes(String(r.kind)) ? (r.kind as DocKind) : fallbackKind;
  const language: DocLanguage = r.language === 'ur' || r.language === 'both' ? r.language : 'en';
  return { title: str(r.title, 120) || '', kind, language, blocks };
}

/** Blocks only (Redo with AI, add more like this). */
export function parseBlocks(raw: unknown): Block[] {
  const r = typeof raw === 'string' ? safeJson(raw) : raw;
  const list = Array.isArray(r) ? r : arr(obj(r).blocks);
  return list.slice(0, 50).map(parseBlock).filter((b): b is Block => !!b);
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    // a fenced or chatty answer: the first {...} in it
    const m = /\{[\s\S]*\}/.exec(s);
    try {
      return m ? JSON.parse(m[0]) : null;
    } catch {
      return null;
    }
  }
}
