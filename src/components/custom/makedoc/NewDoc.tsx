'use client';
// "Make something new" (the app's NewDocSheet, on the page): what to make, what you need, what to make it from (just
// the request or your notes), the language, and for papers the class, difficulty and a quick layout. "Make it" asks
// Zee; "Start blank" opens an empty document of that kind.
import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useT } from '@/i18n/client';
import { DOC_KINDS, kindHint, kindLabel, startBlocks } from '@/makedocs/kinds';
import type { DocKind, DocLanguage } from '@/makedocs/types';
import { MAX_SOURCE_CHARS, type MakeRequest } from '@/makedocs/ai';
import { zeeDocs } from '@/makedocs/store';
import { Button } from '../../ui/Button';
import { AutoText, Choice, Field, KIND_ICONS } from './parts';

type Preset = 'quiz' | 'test' | 'full';
const PRESETS: Record<Preset, MakeRequest['sections']> = {
  quiz: [{ type: 'mcq', count: 10, marks: 1 }],
  test: [{ type: 'mcq', count: 10, marks: 1 }, { type: 'short', count: 5, marks: 2 }],
  full: [{ type: 'mcq', count: 12, marks: 1 }, { type: 'truefalse', count: 5, marks: 1 }, { type: 'fill', count: 5, marks: 1 }, { type: 'short', count: 8, marks: 2 }, { type: 'long', count: 3, marks: 5 }],
};

export function NewDoc({ canMake, onMake, onBlank }: { canMake: boolean; onMake: (r: MakeRequest) => void; onBlank: (docId: string) => void }) {
  const t = useT();
  const [kind, setKind] = useState<DocKind>('paper');
  const [request, setRequest] = useState('');
  const [source, setSource] = useState<'request' | 'notes'>('request');
  const [notes, setNotes] = useState('');
  const [language, setLanguage] = useState<DocLanguage>('en');
  const [level, setLevel] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'mixed' | 'hard'>('mixed');
  const [preset, setPreset] = useState<Preset | null>('quiz');

  const sourceText = source === 'notes' ? notes : '';
  const ready = !!request.trim() || !!sourceText.trim();
  const placeholder = kind === 'paper' ? t('e.g. 10 MCQs on photosynthesis for class 9') : kind === 'expenses' ? t('e.g. petrol 500, lunch 350, books 1200') : t('Describe it in your own words');

  return (
    <form
      className="card p-5 sm:p-7 flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready || !canMake) return;
        onMake({
          request: request.trim(),
          kind: kind === 'other' ? undefined : kind,
          language,
          source: sourceText || undefined,
          ...(kind === 'paper' ? { level: level.trim() || undefined, difficulty, sections: preset ? PRESETS[preset] : undefined } : {}),
        });
      }}
    >
      <h2 className="text-[19px] font-semibold">{t('Make something new')}</h2>

      <fieldset>
        <legend className="text-[13px] font-semibold mb-3">{t('What to make')}</legend>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" role="radiogroup">
          {DOC_KINDS.map((k) => {
            const Icon = KIND_ICONS[k];
            const on = k === kind;
            return (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setKind(k)}
                className={`flex items-center gap-2.5 text-start rounded-tile p-3 border transition-colors ${on ? 'border-primary bg-primary-soft' : 'border-line hover:bg-fill'}`}
              >
                <span className={`size-9 shrink-0 rounded-lg grid place-items-center ${on ? 'bg-category text-white' : 'bg-category-tint text-category'}`}>
                  <Icon size={18} aria-hidden="true" />
                </span>
                <span className="text-[13px] font-semibold leading-tight">{kindLabel(k)}</span>
              </button>
            );
          })}
        </div>
        <p className="text-[13px] text-secondary mt-2">{kindHint(kind)}</p>
      </fieldset>

      <div>
        <label htmlFor="zee-request" className="block text-[13px] font-semibold mb-2">
          {t('What do you need?')}
        </label>
        <div className="rounded-tile border border-line-strong bg-surface px-4 py-3 focus-within:outline-2 focus-within:outline-primary">
          <AutoText id="zee-request" value={request} onChange={setRequest} maxLength={1000} placeholder={placeholder} className="text-[16px] min-h-12" />
        </div>
      </div>

      <Choice label={t('Make it from')} value={source} options={[['request', t('Just this')], ['notes', t('My notes')]]} onChange={setSource} />
      {source === 'notes' && (
        <div>
          <label htmlFor="zee-notes" className="block text-[13px] font-semibold mb-2">
            {t('Your notes')}
          </label>
          <textarea
            id="zee-notes"
            dir="auto"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={MAX_SOURCE_CHARS}
            rows={8}
            placeholder={t('Paste or type the material')}
            className="w-full rounded-tile border border-line-strong bg-surface p-4 text-[15px] focus:outline-2 focus:outline-primary"
          />
        </div>
      )}

      <Choice label={t('Language')} value={language} options={[['en', t('English')], ['ur', t('Urdu')], ['both', t('Both')]]} onChange={setLanguage} />

      {kind === 'paper' && (
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="zee-level" className="block text-[13px] font-semibold mb-2">
              {t('Class or level (optional)')}
            </label>
            <Field id="zee-level" value={level} onChange={setLevel} maxLength={60} placeholder={t('e.g. Class 9, O level, university')} className="w-full" />
          </div>
          <Choice label={t('Difficulty')} value={difficulty} options={[['easy', t('Easy')], ['mixed', t('Mixed')], ['hard', t('Hard')]]} onChange={setDifficulty} />
          <fieldset className="sm:col-span-2">
            <legend className="text-[13px] font-semibold mb-2">{t('Layout (or say it in your request)')}</legend>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['quiz', t('Quiz: 10 MCQs')],
                  ['test', t('Class test: MCQs + short')],
                  ['full', t('Full paper: all types')],
                ] as [Preset, string][]
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={preset === v}
                  onClick={() => setPreset(preset === v ? null : v)}
                  className={`px-4 min-h-10 rounded-full text-sm font-medium border ${preset === v ? 'bg-ink text-on-ink border-transparent' : 'bg-surface border-line-strong hover:bg-fill'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      )}

      <div className="flex flex-wrap gap-2 justify-end pt-2 border-t border-line">
        <Button variant="secondary" onClick={() => onBlank(zeeDocs.create({ kind, title: request.trim().slice(0, 80), language, blocks: startBlocks(kind) }))}>
          {t('Start blank')}
        </Button>
        <button type="submit" disabled={!ready || !canMake} className="lime-fill rounded-full min-h-12 px-6 inline-flex items-center gap-2 font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
          <Sparkles size={18} aria-hidden="true" />
          {t('Make it')}
        </button>
      </div>
    </form>
  );
}
