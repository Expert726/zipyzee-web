// What each kind of document starts with, which blocks it offers in "+ Add", and its name. New kinds are a template
// here (and a line in the AI prompt), not new screens.
import type { Block, BlockType, DocKind } from './types';
import { blankBlock } from './edit';
import { t } from '@/i18n';

export const DOC_KINDS: DocKind[] = ['paper', 'notes', 'todo', 'expenses', 'shopping', 'timetable', 'letter', 'flashcards', 'other'];

export const kindLabel = (k: DocKind): string =>
  ({
    paper: t('Question paper / quiz'),
    notes: t('Notes'),
    todo: t('To-do list'),
    expenses: t('Expenses'),
    shopping: t('Shopping list'),
    timetable: t('Timetable / plan'),
    letter: t('Letter / application'),
    flashcards: t('Flashcards'),
    other: t('Something else'),
  })[k];

export const kindHint = (k: DocKind): string =>
  ({
    paper: t('MCQs, short and long questions, with marks and an answer key'),
    notes: t('Headings, points and key terms to study from'),
    todo: t('Tasks you tick off, with due dates'),
    expenses: t('Items and amounts, with the total'),
    shopping: t('Things to buy, with quantities'),
    timetable: t('A study plan or weekly timetable'),
    letter: t('An application or letter in the right format'),
    flashcards: t('Question on the front, answer on the back'),
    other: t('Tell Zee what you need'),
  })[k];

const ALL: BlockType[] = ['heading', 'text', 'list', 'checklist', 'table', 'question', 'flashcard', 'fields', 'image', 'note', 'divider'];

/** "+ Add" offers these first for the kind (then everything else). */
export function blocksFor(kind: DocKind): BlockType[] {
  const first: Partial<Record<DocKind, BlockType[]>> = {
    paper: ['question', 'heading', 'fields', 'image', 'note'],
    notes: ['heading', 'text', 'list', 'table', 'note', 'image'],
    todo: ['checklist', 'heading', 'note'],
    expenses: ['table', 'heading', 'note'],
    shopping: ['checklist', 'heading'],
    timetable: ['table', 'heading', 'note'],
    letter: ['fields', 'text', 'heading'],
    flashcards: ['flashcard', 'heading'],
  };
  const top = first[kind] ?? [];
  return [...top, ...ALL.filter((b) => !top.includes(b))];
}

/** A blank document of this kind ("Start blank"). */
export function startBlocks(kind: DocKind): Block[] {
  const b = (type: BlockType) => blankBlock(type);
  switch (kind) {
    case 'paper': {
      const fields = b('fields');
      if (fields.type === 'fields') {
        fields.fields = [
          { label: t('School'), value: '' },
          { label: t('Subject'), value: '' },
          { label: t('Class'), value: '' },
          { label: t('Time allowed'), value: '' },
        ];
      }
      const section = b('heading');
      if (section.type === 'heading') section.text = t('Section A: Multiple choice');
      return [fields, section, b('question')];
    }
    case 'expenses': {
      const table = b('table');
      if (table.type === 'table') {
        table.columns = [
          { name: t('Date'), type: 'date' },
          { name: t('Item'), type: 'text' },
          { name: t('Category'), type: 'text' },
          { name: t('Amount'), type: 'money' },
        ];
        table.rows = [['', '', '', '']];
        table.total = true;
      }
      return [table];
    }
    case 'timetable': {
      const table = b('table');
      if (table.type === 'table') {
        table.columns = [{ name: t('Time'), type: 'text' }, { name: t('Monday'), type: 'text' }, { name: t('Tuesday'), type: 'text' }];
        table.rows = [['', '', '']];
      }
      return [table];
    }
    case 'todo':
    case 'shopping':
      return [b('checklist')];
    case 'letter': {
      const fields = b('fields');
      if (fields.type === 'fields') {
        fields.fields = [
          { label: t('To'), value: '' },
          { label: t('Date'), value: '' },
          { label: t('Subject'), value: '' },
        ];
      }
      return [fields, b('text')];
    }
    case 'flashcards':
      return [b('flashcard')];
    default:
      return [b('heading'), b('text')];
  }
}
