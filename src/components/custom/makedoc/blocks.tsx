'use client';
// Each block edited in place (the app's BlockView + BlockSheet in one): headings and sections, text, lists, checklists,
// tables, questions of every type, flashcards, detail fields, pictures, tips and lines.
import { useRef } from 'react';
import { ImagePlus, Plus, Trash2, X } from 'lucide-react';
import { useT } from '@/i18n/client';
import type { Translate } from '@/i18n';
import { changeQuestionType, formatAmount, tableTotals } from '@/makedocs/edit';
import type { Block, ColumnType, DocKind, Question, QuestionType } from '@/makedocs/types';
import { AutoText, Field, pictureDataUrl } from './parts';

const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

export const blockLabel = (type: Block['type'], t: Translate): string =>
  ({
    heading: t('Heading / section'),
    text: t('Paragraph'),
    list: t('List'),
    checklist: t('Checklist'),
    table: t('Table'),
    question: t('Question'),
    flashcard: t('Flashcard'),
    fields: t('Details'),
    image: t('Picture'),
    note: t('Tip box'),
    divider: t('Line'),
  })[type];

export const questionLabel = (type: QuestionType, t: Translate): string =>
  ({
    mcq: t('Multiple choice'),
    truefalse: t('True / False'),
    fill: t('Fill in the blank'),
    match: t('Match the columns'),
    oneword: t('One-word answer'),
    short: t('Short question'),
    long: t('Long question'),
  })[type];

const QTYPES: QuestionType[] = ['mcq', 'truefalse', 'fill', 'match', 'oneword', 'short', 'long'];

/** Small square button inside blocks. */
function Mini({ label, onClick, children, danger }: { label: string; onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className={`size-8 shrink-0 rounded-lg grid place-items-center hover:bg-fill-strong ${danger ? 'text-error' : 'text-secondary'}`}>
      {children}
    </button>
  );
}

function AddLine({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary hover:underline self-start mt-1">
      <Plus size={16} aria-hidden="true" />
      {label}
    </button>
  );
}

export function BlockEditor({ block: b, kind, number, onChange }: { block: Block; kind: DocKind; number?: number; onChange: (b: Block) => void }) {
  const t = useT();
  switch (b.type) {
    case 'heading':
      return (
        <div className="flex flex-col gap-2">
          <AutoText value={b.text} onChange={(text) => onChange({ ...b, text })} placeholder={kind === 'paper' ? t('Section') : t('Heading')} className={`font-semibold ${b.level === 1 ? 'text-[24px]' : 'text-[19px]'}`} />
          {kind === 'paper' ? (
            <div className="grid gap-2 sm:grid-cols-[1fr_180px]">
              <Field value={b.instructions ?? ''} onChange={(instructions) => onChange({ ...b, instructions: instructions || undefined })} placeholder={t('e.g. Choose the correct answer.')} aria-label={t('Instructions (optional)')} />
              <Field
                value={b.attempt ? String(b.attempt) : ''}
                onChange={(v) => onChange({ ...b, attempt: Number(v.replace(/\D/g, '')) || undefined })}
                inputMode="numeric"
                placeholder={t('Attempt any (optional)')}
                aria-label={t('Attempt any (optional)')}
                title={t('Students answer only this many questions of the section; its marks count only those.')}
              />
            </div>
          ) : (
            <div className="flex gap-1">
              {([1, 2] as const).map((l) => (
                <button key={l} type="button" aria-pressed={b.level === l} onClick={() => onChange({ ...b, level: l })} className={`px-3 min-h-8 rounded-full text-[12px] font-semibold ${b.level === l ? 'bg-ink text-on-ink' : 'bg-fill text-muted'}`}>
                  H{l}
                </button>
              ))}
            </div>
          )}
        </div>
      );
    case 'text':
      return <AutoText value={b.text} onChange={(text) => onChange({ ...b, text })} placeholder={t('Empty paragraph')} className="text-[15px] leading-relaxed" />;
    case 'note':
      return (
        <div className="rounded-lg bg-info-soft border-s-4 border-primary px-3 py-2">
          <AutoText value={b.text} onChange={(text) => onChange({ ...b, text })} placeholder={t('Empty tip')} className="text-[15px] text-info-ink" />
        </div>
      );
    case 'list':
      return (
        <div className="flex flex-col gap-1.5">
          <div className="flex gap-1 mb-1">
            {[
              [false, t('Point')],
              [true, t('Numbered')],
            ].map(([ordered, label]) => (
              <button key={String(ordered)} type="button" aria-pressed={b.ordered === ordered} onClick={() => onChange({ ...b, ordered: ordered as boolean })} className={`px-3 min-h-8 rounded-full text-[12px] font-semibold ${b.ordered === ordered ? 'bg-ink text-on-ink' : 'bg-fill text-muted'}`}>
                {label as string}
              </button>
            ))}
          </div>
          {b.items.map((it, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="w-6 text-end text-secondary pt-2 text-[14px]" aria-hidden="true">
                {b.ordered ? `${i + 1}.` : '•'}
              </span>
              <AutoText value={it} onChange={(v) => onChange({ ...b, items: b.items.map((x, j) => (j === i ? v : x)) })} placeholder={t('Empty item')} className="text-[15px] py-1.5 flex-1" />
              <Mini label={t('Remove')} onClick={() => onChange({ ...b, items: b.items.filter((_, j) => j !== i) })}>
                <X size={16} />
              </Mini>
            </div>
          ))}
          <AddLine label={t('Add item')} onClick={() => onChange({ ...b, items: [...b.items, ''] })} />
        </div>
      );
    case 'checklist':
      return (
        <div className="flex flex-col gap-1.5">
          {b.items.map((it, i) => {
            const set = (patch: Partial<typeof it>) => onChange({ ...b, items: b.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
            return (
              <div key={i} className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                <input type="checkbox" checked={it.done} onChange={(e) => set({ done: e.target.checked })} aria-label={it.done ? t('Done') : t('Not done')} className="size-5 accent-[var(--primary)]" />
                <Field value={it.text} onChange={(text) => set({ text })} placeholder={t('Item')} className={`flex-1 min-w-40 ${it.done ? 'line-through text-secondary' : ''}`} />
                {kind === 'shopping' ? (
                  <Field value={it.qty ?? ''} onChange={(qty) => set({ qty: qty || undefined })} placeholder={t('Quantity')} className="w-28" />
                ) : (
                  <Field value={it.due ?? ''} onChange={(due) => set({ due: due || undefined })} placeholder={t('When')} className="w-32" />
                )}
                <button type="button" aria-pressed={it.priority === 'high'} title="!" onClick={() => set({ priority: it.priority === 'high' ? undefined : 'high' })} className={`size-8 rounded-lg font-bold ${it.priority === 'high' ? 'bg-danger-soft text-error' : 'bg-fill text-secondary'}`} aria-label={t('Important')}>
                  !
                </button>
                <Mini label={t('Remove')} onClick={() => onChange({ ...b, items: b.items.filter((_, j) => j !== i) })}>
                  <X size={16} />
                </Mini>
              </div>
            );
          })}
          <AddLine label={t('Add item')} onClick={() => onChange({ ...b, items: [...b.items, { text: '', done: false }] })} />
        </div>
      );
    case 'table':
      return <TableEditor block={b} onChange={onChange} />;
    case 'question':
      return <QuestionEditor q={b.q} number={number} onChange={(q) => onChange({ ...b, q })} />;
    case 'flashcard':
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-secondary">
            {t('Front')}
            <div className="rounded-lg border border-dashed border-line-strong p-3 min-h-24 text-text">
              <AutoText value={b.front} onChange={(front) => onChange({ ...b, front })} className="text-[15px] font-semibold" />
            </div>
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-secondary">
            {t('Answer')}
            <div className="rounded-lg border border-dashed border-line-strong p-3 min-h-24 text-text">
              <AutoText value={b.back} onChange={(back) => onChange({ ...b, back })} className="text-[15px] font-normal" />
            </div>
          </label>
        </div>
      );
    case 'fields':
      return (
        <div className="flex flex-col gap-1.5">
          {b.fields.map((f, i) => {
            const set = (patch: Partial<typeof f>) => onChange({ ...b, fields: b.fields.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
            return (
              <div key={i} className="grid grid-cols-[minmax(0,140px)_minmax(0,1fr)_auto] gap-2 items-center">
                <Field value={f.label} onChange={(label) => set({ label })} placeholder={t('Label')} className="font-semibold" />
                <Field value={f.value} onChange={(value) => set({ value })} placeholder={t('Value')} />
                <Mini label={t('Remove')} onClick={() => onChange({ ...b, fields: b.fields.filter((_, j) => j !== i) })}>
                  <X size={16} />
                </Mini>
              </div>
            );
          })}
          <AddLine label={t('Add detail')} onClick={() => onChange({ ...b, fields: [...b.fields, { label: '', value: '' }] })} />
        </div>
      );
    case 'image':
      return <PictureEditor uri={b.uri} caption={b.caption} onChange={(uri, caption) => onChange({ ...b, uri, caption })} />;
    default:
      return <hr className="border-line-strong my-2" />;
  }
}

function TableEditor({ block: b, onChange }: { block: Extract<Block, { type: 'table' }>; onChange: (b: Block) => void }) {
  const t = useT();
  const totals = b.total ? tableTotals(b) : null;
  const types: [ColumnType, string][] = [['text', t('Text')], ['number', t('Number')], ['money', t('Money')], ['date', t('Date')]];
  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full border-collapse text-[14px]">
          <thead>
            <tr>
              {b.columns.map((c, ci) => (
                <th key={ci} className="p-1 align-bottom min-w-32">
                  <div className="flex flex-col gap-1">
                    <div className="flex gap-1">
                      <Field value={c.name} onChange={(name) => onChange({ ...b, columns: b.columns.map((x, j) => (j === ci ? { ...x, name } : x)) })} placeholder={t('Column {n}', { n: ci + 1 })} className="font-semibold flex-1 min-w-0" />
                      {b.columns.length > 1 && (
                        <Mini label={t('Remove')} onClick={() => onChange({ ...b, columns: b.columns.filter((_, j) => j !== ci), rows: b.rows.map((r) => r.filter((_, j) => j !== ci)) })}>
                          <X size={14} />
                        </Mini>
                      )}
                    </div>
                    <select
                      value={c.type}
                      aria-label={t('Column type')}
                      onChange={(e) => onChange({ ...b, columns: b.columns.map((x, j) => (j === ci ? { ...x, type: e.target.value as ColumnType } : x)) })}
                      className="min-h-8 rounded-lg bg-fill px-2 text-[12px] font-normal text-secondary"
                    >
                      {types.map(([v, label]) => (
                        <option key={v} value={v}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                </th>
              ))}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {b.rows.map((r, ri) => (
              <tr key={ri}>
                {b.columns.map((c, ci) => (
                  <td key={ci} className="p-1">
                    <Field
                      value={r[ci] ?? ''}
                      inputMode={c.type === 'money' || c.type === 'number' ? 'decimal' : undefined}
                      onChange={(v) => onChange({ ...b, rows: b.rows.map((x, j) => (j === ri ? b.columns.map((_, k) => (k === ci ? v : x[k] ?? '')) : x)) })}
                      className={`w-full ${c.type === 'money' || c.type === 'number' ? 'text-end' : ''}`}
                      aria-label={`${c.name || t('Column {n}', { n: ci + 1 })}, ${t('Row {n}', { n: ri + 1 })}`}
                    />
                  </td>
                ))}
                <td className="p-1">
                  <Mini label={t('Remove')} onClick={() => onChange({ ...b, rows: b.rows.filter((_, j) => j !== ri) })}>
                    <X size={16} />
                  </Mini>
                </td>
              </tr>
            ))}
          </tbody>
          {totals && (
            <tfoot>
              <tr>
                {b.columns.map((c, ci) => (
                  <td key={ci} className={`p-2 font-semibold border-t border-line-strong ${totals[ci] != null ? 'text-end' : ''}`}>
                    {totals[ci] != null ? formatAmount(totals[ci]!) : ci === totals.findIndex((v) => v == null) ? t('Total') : ''}
                  </td>
                ))}
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <div className="flex flex-wrap gap-4 items-center">
        <AddLine label={t('Add row')} onClick={() => onChange({ ...b, rows: [...b.rows, b.columns.map(() => '')] })} />
        <AddLine label={t('Add column')} onClick={() => onChange({ ...b, columns: [...b.columns, { name: '', type: 'text' }], rows: b.rows.map((r) => [...r, '']) })} />
        <label className="ms-auto inline-flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={!!b.total} onChange={(e) => onChange({ ...b, total: e.target.checked || undefined })} className="size-4 accent-[var(--primary)]" />
          {t('Total row')}
        </label>
      </div>
    </div>
  );
}

function QuestionEditor({ q, number, onChange }: { q: Question; number?: number; onChange: (q: Question) => void }) {
  const t = useT();
  const set = (patch: Partial<Question>) => onChange({ ...q, ...patch });
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {number != null && <span className="font-semibold text-[15px]">{number}.</span>}
        <select value={q.type} aria-label={t('Type')} onChange={(e) => onChange(changeQuestionType(q, e.target.value as QuestionType))} className="min-h-9 rounded-lg bg-fill px-2 text-[13px] font-medium">
          {QTYPES.map((v) => (
            <option key={v} value={v}>
              {questionLabel(v, t)}
            </option>
          ))}
        </select>
        <label className="ms-auto inline-flex items-center gap-2 text-[13px] text-secondary">
          {t('Marks')}
          <input
            type="number"
            min={0}
            max={100}
            value={q.marks ?? 0}
            onChange={(e) => set({ marks: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
            className="w-16 min-h-9 rounded-lg bg-fill px-2 text-[14px] text-text text-center"
          />
        </label>
      </div>
      <div className="rounded-lg bg-fill px-3 py-2 focus-within:outline-2 focus-within:outline-primary">
        <AutoText value={q.text} onChange={(text) => set({ text })} placeholder={q.type === 'fill' ? t('Put ____ where the blank goes.') : t('Question')} className="text-[15px] font-medium" />
      </div>
      {q.image && (
        <div className="relative w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element -- a picture stored in the document */}
          <img src={q.image} alt="" className="max-h-40 rounded-lg border border-line" />
          <button type="button" aria-label={t('Remove picture')} onClick={() => set({ image: undefined })} className="absolute -top-2 -end-2 size-7 rounded-full bg-surface shadow-raised grid place-items-center">
            <X size={14} />
          </button>
        </div>
      )}

      {q.type === 'mcq' && (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-[12px] text-secondary mb-1">{t('Choices (tap the circle for the right one)')}</legend>
          {(q.options ?? []).map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="radio" name={`ans-${number}-${q.text.slice(0, 8)}`} checked={q.answer === i} onChange={() => set({ answer: i })} aria-label={t('Right answer: {letter}', { letter: LETTERS[i] })} className="size-5 accent-[var(--primary)]" />
              <span className="w-6 text-secondary text-[14px]">({LETTERS[i]})</span>
              <Field value={o} onChange={(v) => set({ options: (q.options ?? []).map((x, j) => (j === i ? v : x)) })} placeholder={t('Choice {letter}', { letter: LETTERS[i] })} className={`flex-1 ${q.answer === i ? 'border-primary' : ''}`} />
              {(q.options?.length ?? 0) > 2 && (
                <Mini label={t('Remove')} onClick={() => set({ options: q.options!.filter((_, j) => j !== i), answer: Math.min(q.answer ?? 0, q.options!.length - 2) })}>
                  <X size={16} />
                </Mini>
              )}
            </div>
          ))}
          {(q.options?.length ?? 0) < 6 && <AddLine label={t('Add choice')} onClick={() => set({ options: [...(q.options ?? []), ''] })} />}
        </fieldset>
      )}
      {q.type === 'truefalse' && (
        <div className="flex gap-2" role="radiogroup" aria-label={t('Right answer')}>
          {[
            [0, t('True')],
            [1, t('False')],
          ].map(([v, label]) => (
            <button key={v} type="button" role="radio" aria-checked={q.answer === v} onClick={() => set({ answer: v as number })} className={`px-4 min-h-9 rounded-full text-sm font-medium border ${q.answer === v ? 'bg-ink text-on-ink border-transparent' : 'border-line-strong'}`}>
              {label}
            </button>
          ))}
        </div>
      )}
      {q.type === 'match' && (
        <div className="flex flex-col gap-1.5">
          <p className="text-[12px] text-secondary">{t('Pairs (they print mixed up)')}</p>
          {(q.pairs ?? []).map((p, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2">
              <Field value={p.left} onChange={(left) => set({ pairs: q.pairs!.map((x, j) => (j === i ? { ...x, left } : x)) })} placeholder={t('Column A')} />
              <Field value={p.right} onChange={(right) => set({ pairs: q.pairs!.map((x, j) => (j === i ? { ...x, right } : x)) })} placeholder={t('Column B')} />
              <Mini label={t('Remove')} onClick={() => set({ pairs: q.pairs!.filter((_, j) => j !== i) })}>
                <X size={16} />
              </Mini>
            </div>
          ))}
          <AddLine label={t('Add pair')} onClick={() => set({ pairs: [...(q.pairs ?? []), { left: '', right: '' }] })} />
        </div>
      )}
      {q.type === 'long' && (
        <div className="flex flex-col gap-1.5">
          <p className="text-[12px] text-secondary">{t('Parts (optional)')}</p>
          {(q.parts ?? []).map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-6 text-secondary text-[14px]">({LETTERS[i]})</span>
              <Field value={p} onChange={(v) => set({ parts: q.parts!.map((x, j) => (j === i ? v : x)) })} placeholder={t('Part')} className="flex-1" />
              <Mini label={t('Remove')} onClick={() => set({ parts: q.parts!.filter((_, j) => j !== i) })}>
                <X size={16} />
              </Mini>
            </div>
          ))}
          <AddLine label={t('Part')} onClick={() => set({ parts: [...(q.parts ?? []), ''] })} />
        </div>
      )}
      {['fill', 'oneword', 'short', 'long'].includes(q.type) && (
        <label className="flex flex-col gap-1 text-[12px] text-secondary">
          {t('Answer (for the answer key)')}
          <div className="rounded-lg border border-dashed border-line-strong px-3 py-2 text-text">
            <AutoText value={q.answerText ?? ''} onChange={(answerText) => set({ answerText: answerText || undefined })} className="text-[14px]" />
          </div>
        </label>
      )}
      {!q.image && <QuestionPicture onPick={(image) => set({ image })} />}
    </div>
  );
}

function QuestionPicture({ onPick }: { onPick: (url: string) => void }) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" onClick={() => input.current?.click()} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary hover:underline self-start">
        <ImagePlus size={16} aria-hidden="true" />
        {t('Add a picture')}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) onPick(await pictureDataUrl(f, 900).catch(() => ''));
        }}
      />
    </>
  );
}

function PictureEditor({ uri, caption, onChange }: { uri: string; caption?: string; onChange: (uri: string, caption?: string) => void }) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col gap-2">
      {uri ? (
        // eslint-disable-next-line @next/next/no-img-element -- a picture stored in the document
        <img src={uri} alt={caption ?? ''} className="max-h-80 w-auto self-start rounded-lg border border-line" />
      ) : (
        <button type="button" onClick={() => input.current?.click()} className="rounded-lg border-2 border-dashed border-line-strong min-h-32 grid place-items-center text-secondary hover:bg-fill">
          <span className="flex items-center gap-2 text-[14px] font-medium">
            <ImagePlus size={20} aria-hidden="true" />
            {t('Tap to choose a picture')}
          </span>
        </button>
      )}
      <div className="flex gap-2 items-center">
        <Field value={caption ?? ''} onChange={(c) => onChange(uri, c || undefined)} placeholder={t('Caption (optional)')} className="flex-1" />
        {uri && (
          <Mini label={t('Remove picture')} onClick={() => onChange('', caption)} danger>
            <Trash2 size={16} />
          </Mini>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) onChange(await pictureDataUrl(f).catch(() => ''), caption);
        }}
      />
    </div>
  );
}
