// "Make with Zee" documents: one model for everything Zee can make and you can edit — question papers and quizzes,
// notes, to-dos, expenses, shopping lists, timetables, letters, flashcards. A document is a kind (src/makedocs/kinds.ts:
// header fields, the blocks it offers, how it prints) and a list of blocks. Kept on the phone for 24 hours.

export type DocKind = 'paper' | 'notes' | 'todo' | 'expenses' | 'shopping' | 'timetable' | 'letter' | 'flashcards' | 'other';
export type DocLanguage = 'en' | 'ur' | 'both';

export type QuestionType = 'mcq' | 'truefalse' | 'fill' | 'match' | 'oneword' | 'short' | 'long';

export type Question = {
  type: QuestionType;
  text: string;
  /** mcq: the choices (usually 4) */
  options?: string[];
  /** mcq: index of the right choice; truefalse: 0 = true, 1 = false */
  answer?: number;
  /** fill / oneword / short / long: the expected answer (for the answer key) */
  answerText?: string;
  /** match: left and right columns, in the right pairing */
  pairs?: { left: string; right: string }[];
  /** long: (a) (b) (c) parts */
  parts?: string[];
  marks?: number;
  /** a picture with the question (a file in Documents/zee-doc-images) */
  image?: string;
};

export type ColumnType = 'text' | 'number' | 'money' | 'date';
export type Column = { name: string; type: ColumnType };

export type ChecklistItem = { text: string; done: boolean; due?: string; qty?: string; priority?: 'high' | 'normal' };

export type Block =
  | { id: string; type: 'heading'; text: string; level: 1 | 2; marks?: number; instructions?: string; attempt?: number }
  | { id: string; type: 'text'; text: string }
  | { id: string; type: 'list'; ordered: boolean; items: string[] }
  | { id: string; type: 'checklist'; items: ChecklistItem[] }
  | { id: string; type: 'table'; columns: Column[]; rows: string[][]; total?: boolean }
  | { id: string; type: 'question'; q: Question }
  | { id: string; type: 'flashcard'; front: string; back: string }
  | { id: string; type: 'fields'; fields: { label: string; value: string }[] }
  | { id: string; type: 'image'; uri: string; caption?: string }
  | { id: string; type: 'divider' }
  | { id: string; type: 'note'; text: string };

export type BlockType = Block['type'];

/** How it prints; each kind uses the ones that apply. */
export type DocSettings = {
  pageSize: 'a4' | 'letter' | 'legal';
  textSize: 's' | 'm' | 'l';
  /** papers */
  answerKey: boolean;
  mcqColumns: 1 | 2;
  answerLines: boolean;
  nameLines: boolean;
  /** expenses */
  currency: string;
};

export type ZeeDoc = {
  id: string;
  kind: DocKind;
  title: string;
  language: DocLanguage;
  blocks: Block[];
  settings: DocSettings;
  createdAt: number;
  updatedAt: number;
  /** 24 hours after the last change; then it's removed from the phone */
  expiresAt: number;
};

export const DOC_LIFE_MS = 24 * 60 * 60 * 1000;

export const DEFAULT_SETTINGS: DocSettings = {
  pageSize: 'a4',
  textSize: 'm',
  answerKey: true,
  mcqColumns: 2,
  answerLines: true,
  nameLines: true,
  currency: 'Rs',
};
