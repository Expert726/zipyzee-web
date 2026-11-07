// Make with Zee, the AI side (the app's src/makedocs/ai.ts): Gemini (Firebase AI Logic, src/lib/firebase.ts generateJson) writes a whole document,
// one block again ("Redo with AI"), more blocks like one ("add 3 more"), or blocks from a line ("Ask Zee to add…"),
// always as JSON in one schema that every kind shares. src/makedocs/parse.ts checks whatever comes back.
import type { ObjectSchema, Schema as SchemaClass } from 'firebase/ai';
import { generateJson, ZeeError } from '@/lib/firebase';
import type { Block, DocKind, DocLanguage, ZeeDoc } from './types';
import { parseBlocks, parseDoc, type ParsedDoc } from './parse';
import { DOC_KINDS } from './kinds';
import { t } from '@/i18n';

/** Notes / a PDF's text / a photographed page: this much is plenty for a paper or notes. */
export const MAX_SOURCE_CHARS = 30_000;

type S = typeof SchemaClass;

const blockSchema = (Sc: S) =>
  Sc.object({
    properties: {
      type: Sc.enumString({ enum: ['heading', 'text', 'list', 'checklist', 'table', 'question', 'flashcard', 'fields', 'note', 'divider'] }),
      text: Sc.string(),
      level: Sc.integer(),
      instructions: Sc.string(),
      attempt: Sc.integer(),
      ordered: Sc.boolean(),
      items: Sc.array({ items: Sc.string() }),
      checklist: Sc.array({
        items: Sc.object({ properties: { text: Sc.string(), due: Sc.string(), qty: Sc.string(), priority: Sc.enumString({ enum: ['high', 'normal'] }) }, optionalProperties: ['due', 'qty', 'priority'] }),
      }),
      columns: Sc.array({ items: Sc.object({ properties: { name: Sc.string(), type: Sc.enumString({ enum: ['text', 'number', 'money', 'date'] }) } }) }),
      rows: Sc.array({ items: Sc.array({ items: Sc.string() }) }),
      total: Sc.boolean(),
      question: Sc.object({
        properties: {
          type: Sc.enumString({ enum: ['mcq', 'truefalse', 'fill', 'match', 'oneword', 'short', 'long'] }),
          text: Sc.string(),
          options: Sc.array({ items: Sc.string() }),
          answer: Sc.integer(),
          answerText: Sc.string(),
          pairs: Sc.array({ items: Sc.object({ properties: { left: Sc.string(), right: Sc.string() } }) }),
          parts: Sc.array({ items: Sc.string() }),
          marks: Sc.integer(),
        },
        optionalProperties: ['options', 'answer', 'answerText', 'pairs', 'parts', 'marks'],
      }),
      front: Sc.string(),
      back: Sc.string(),
      fields: Sc.array({ items: Sc.object({ properties: { label: Sc.string(), value: Sc.string() } }) }),
    },
    optionalProperties: ['text', 'level', 'instructions', 'attempt', 'ordered', 'items', 'checklist', 'columns', 'rows', 'total', 'question', 'front', 'back', 'fields'],
  });

const docSchema = (Sc: S): ObjectSchema =>
  Sc.object({
    properties: {
      title: Sc.string(),
      kind: Sc.enumString({ enum: DOC_KINDS }),
      language: Sc.enumString({ enum: ['en', 'ur', 'both'] }),
      blocks: Sc.array({ items: blockSchema(Sc) }),
    },
  });

const blocksSchema = (Sc: S): ObjectSchema => Sc.object({ properties: { blocks: Sc.array({ items: blockSchema(Sc) }) } });

export const SYSTEM = `You make documents for ZipyZee, an app where people edit and print what you make. Reply with JSON only, in the schema.
A document is a kind and a list of blocks. Write exactly what was asked, nothing extra: no greetings, notes to the user or explanations outside the document.
Kinds and how to build them:
- paper (question paper, test, quiz, worksheet): first a "fields" block (School, Subject, Class, Time allowed; leave values empty unless given). Then one "heading" per section (text like "Section A: Multiple choice questions", "instructions" such as "Choose the correct answer.", "attempt" only if they may skip some), followed by its "question" blocks. Question types: mcq (exactly 4 options, "answer" = index 0-3 of the right one), truefalse ("answer" 0 = true, 1 = false), fill (put ____ where the blank is, "answerText"), match ("pairs" in the right pairing, 4-6 of them), oneword, short, long (optional "parts"). Give every question "marks" and an answer ("answer" or "answerText", a model answer for short / long) for the answer key. Match the class level. Never repeat a question. Never put the answer in the question.
- notes: headings, short "text", bullet "list"s, a "table" of key terms and meanings when useful, "note" for tips.
- todo: "checklist" items (add "due" when a time is given, "priority": "high" for urgent ones).
- expenses: a "table" with columns Date (date), Item (text), Category (text), Amount (money), "total": true; amounts as plain numbers.
- shopping: "checklist" items with "qty".
- timetable: a "table" (study plans: Day / Time / Subject / Topic).
- letter: a "fields" block (To, Date, Subject) then "text" paragraphs in the right letter format, ending with a closing and a name line.
- flashcards: "flashcard" blocks (front = question or term, back = answer).
- other: whatever blocks fit.
Language: write in the language asked for ("en" English, "ur" Urdu in Urdu script, "both" each line in English then Urdu). If not said, use the language of the request. Set "language" to match.
Title: short, 2-8 words.`;

export type MakeRequest = {
  request: string;
  kind?: DocKind;
  language?: DocLanguage;
  /** notes, a PDF's text or a photographed page to make it from */
  source?: string;
  /** a paper's level, difficulty and sections */
  level?: string;
  difficulty?: 'easy' | 'mixed' | 'hard';
  sections?: { type: string; count: number; marks: number }[];
};

export function makePrompt(r: MakeRequest): string {
  const lines = [`Request: ${r.request.trim() || '(none: use the source)'}`];
  if (r.kind && r.kind !== 'other') lines.push(`Kind: ${r.kind}`);
  if (r.language) lines.push(`Language: ${r.language}`);
  if (r.level) lines.push(`Class / level: ${r.level}`);
  if (r.difficulty) lines.push(`Difficulty: ${r.difficulty}`);
  if (r.sections?.length) lines.push(`Sections: ${r.sections.map((s) => `${s.count} × ${s.type} (${s.marks} mark${s.marks === 1 ? '' : 's'} each)`).join('; ')}`);
  if (r.source?.trim()) lines.push(`Make it from this material only:\n"""\n${r.source.trim().slice(0, MAX_SOURCE_CHARS)}\n"""`);
  return lines.join('\n');
}

/** A whole document from a request (and optional source). */
export async function makeDoc(r: MakeRequest, signal?: AbortSignal): Promise<ParsedDoc> {
  const raw = await generateJson(makePrompt(r), SYSTEM, docSchema, signal);
  const doc = parseDoc(raw, r.kind ?? 'other');
  if (!doc) throw new ZeeError(t('Zee couldn\'t make it this time. Try again.'));
  return doc;
}

const context = (doc: ZeeDoc) => `Document: "${doc.title}" (kind: ${doc.kind}, language: ${doc.language}).`;
/** A block as JSON for the prompt, without the app's id. */
const plain = (b: Block) => JSON.stringify(b, (k, v) => (k === 'id' ? undefined : v));

/** "Redo with AI": one new block of the same type and topic, different content. */
export async function redoBlock(doc: ZeeDoc, b: Block): Promise<Block> {
  const others = doc.blocks.filter((x) => x.type === b.type && x.id !== b.id).slice(0, 30).map(plain).join('\n');
  const prompt = `${context(doc)}\nWrite ONE new block of type "${b.type}" to replace this one, on the same topic and level, with different content:\n${plain(b)}\nDon't repeat any of these:\n${others}`;
  const [next] = parseBlocks(await generateJson(prompt, SYSTEM, blocksSchema));
  if (!next) throw new ZeeError(t('Zee couldn\'t make it this time. Try again.'));
  return next;
}

/** "AI: add more like this": `count` new blocks like `b` (new questions, new items...). */
export async function moreLike(doc: ZeeDoc, b: Block, count: number): Promise<Block[]> {
  const others = doc.blocks.filter((x) => x.type === b.type).slice(0, 40).map(plain).join('\n');
  const prompt = `${context(doc)}\nWrite ${count} NEW blocks of type "${b.type}" like this one (same topic, level and format):\n${plain(b)}\nThey must all be different from these:\n${others}`;
  const blocks = parseBlocks(await generateJson(prompt, SYSTEM, blocksSchema));
  if (!blocks.length) throw new ZeeError(t('Zee couldn\'t make it this time. Try again.'));
  return blocks.slice(0, count);
}

/** "Ask Zee to add…": blocks for a free line, fitting the document. */
export async function addFromRequest(doc: ZeeDoc, request: string): Promise<Block[]> {
  const prompt = `${context(doc)}\nIt already has ${doc.blocks.length} blocks. Add what this asks for, as new blocks that fit the document: ${request.trim()}`;
  const blocks = parseBlocks(await generateJson(prompt, SYSTEM, blocksSchema));
  if (!blocks.length) throw new ZeeError(t('Zee couldn\'t make it this time. Try again.'));
  return blocks;
}
