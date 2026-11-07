'use client';
// Calculator (the app's custom/calc/CalculatorStep for the web): Basic | Scientific, the display (expression, live
// answer, the answer large after =), history beside the keypad on wide screens. The maths and keypad rules are the
// app's src/tools/calc.ts. Typing works too: digits, + - * / ^ ( ) % . , Enter or =, Backspace, Escape.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Copy, Delete, History } from 'lucide-react';
import { useT } from '@/i18n/client';
import type { Translate } from '@/i18n';
import { useStored } from '@/lib/useStored';
import { calcErrorText, EMPTY, exprText, groupDigits, preview, pressKey, type Angle, type CalcState, type Key } from '@/tools/calc';

type Pad = { label: string; a11y: (t: Translate) => string; key: Key; look?: 'op' | 'fn' | 'equals' | 'clear' };
type Entry = { expr: string; result: string; value: number; at: number };

const d = (v: string): Pad => ({ label: v, a11y: (t) => (v === '.' ? t('Point') : v), key: { kind: 'digit', v } });
const op = (label: string, v: '+' | '−' | '×' | '÷', a11y: (t: Translate) => string): Pad => ({ label, a11y, key: { kind: 'op', v }, look: 'op' });
const fn = (label: string, v: string, a11y: (t: Translate) => string): Pad => ({ label, a11y, key: { kind: 'fn', v }, look: 'fn' });

const BASIC: Pad[] = [
  { label: 'AC', a11y: (t) => t('Clear all'), key: { kind: 'clear' }, look: 'clear' },
  { label: '( )', a11y: (t) => t('Brackets'), key: { kind: 'paren' }, look: 'fn' },
  { label: '%', a11y: (t) => t('Percent'), key: { kind: 'post', v: '%' }, look: 'fn' },
  op('÷', '÷', (t) => t('Divide')),
  d('7'), d('8'), d('9'), op('×', '×', (t) => t('Times')),
  d('4'), d('5'), d('6'), op('−', '−', (t) => t('Minus')),
  d('1'), d('2'), d('3'), op('+', '+', (t) => t('Plus')),
  { label: '±', a11y: (t) => t('Change sign'), key: { kind: 'sign' } }, d('0'), d('.'), { label: '=', a11y: (t) => t('Equals'), key: { kind: 'equals' }, look: 'equals' },
];

const scientific = (second: boolean): Pad[] => [
  second ? fn('sin⁻¹', 'sin⁻¹(', (t) => t('Inverse sine')) : fn('sin', 'sin(', (t) => t('Sine')),
  second ? fn('cos⁻¹', 'cos⁻¹(', (t) => t('Inverse cosine')) : fn('cos', 'cos(', (t) => t('Cosine')),
  second ? fn('tan⁻¹', 'tan⁻¹(', (t) => t('Inverse tangent')) : fn('tan', 'tan(', (t) => t('Tangent')),
  { label: 'xʸ', a11y: (t) => t('Power'), key: { kind: 'op', v: '^' }, look: 'fn' },
  { label: 'x²', a11y: (t) => t('Square'), key: { kind: 'post', v: '²' }, look: 'fn' },
  fn('√', '√(', (t) => t('Square root')),
  fn('∛', '∛(', (t) => t('Cube root')),
  { label: '1/x', a11y: (t) => t('Reciprocal'), key: { kind: 'post', v: '⁻¹' }, look: 'fn' },
  { label: 'x!', a11y: (t) => t('Factorial'), key: { kind: 'post', v: '!' }, look: 'fn' },
  fn('|x|', 'abs(', (t) => t('Absolute value')),
  fn('ln', 'ln(', (t) => t('Natural log')),
  fn('log', 'log(', (t) => t('Log base 10')),
  fn('eˣ', 'e^(', (t) => t('e to the power')),
  fn('10ˣ', '10^(', (t) => t('10 to the power')),
  { label: 'EE', a11y: (t) => t('Times ten to the power'), key: { kind: 'exp' }, look: 'fn' },
  { label: 'π', a11y: (t) => t('Pi'), key: { kind: 'const', v: 'π' }, look: 'fn' },
  { label: 'e', a11y: (t) => t('Euler\'s number'), key: { kind: 'const', v: 'e' }, look: 'fn' },
  { label: 'Ans', a11y: (t) => t('Previous answer'), key: { kind: 'const', v: 'Ans' }, look: 'fn' },
];

/** A typed key -> a calculator key. */
function keyOf(e: KeyboardEvent): Key | null {
  const k = e.key;
  if (/^[0-9.]$/.test(k)) return { kind: 'digit', v: k };
  if (k === ',') return { kind: 'digit', v: '.' };
  const ops: Record<string, '+' | '−' | '×' | '÷' | '^'> = { '+': '+', '-': '−', '*': '×', x: '×', '/': '÷', '^': '^' };
  if (ops[k]) return { kind: 'op', v: ops[k] };
  if (k === '(' || k === ')') return { kind: 'paren' };
  if (k === '%') return { kind: 'post', v: '%' };
  if (k === '!') return { kind: 'post', v: '!' };
  if (k === 'Enter' || k === '=') return { kind: 'equals' };
  if (k === 'Backspace') return { kind: 'back' };
  if (k === 'Escape' || k === 'Delete') return { kind: 'clear' };
  return null;
}

const KEEP = 30;

export function Calculator() {
  const t = useT();
  const [mode, setMode] = useStored<'basic' | 'scientific'>('calc.mode', 'basic');
  const [angle, setAngle] = useStored<Angle>('calc.angle', 'deg');
  const [history, setHistory] = useStored<Entry[]>('calc.history', []);
  const [calc, setCalc] = useState<CalcState>(EMPTY);
  const [second, setSecond] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const current = useRef(calc);
  const exprBox = useRef<HTMLDivElement>(null);
  const sci = mode === 'scientific';

  const press = useCallback(
    (key: Key) => {
      const s = current.current;
      const next = pressKey(s, key, { angle });
      if (key.kind === 'equals' && next.done && next.ans != null && !s.done) {
        setHistory((h) => [{ expr: exprText(s.tokens), result: exprText(next.tokens), value: next.ans!, at: Date.now() }, ...h].slice(0, KEEP));
      }
      current.current = next;
      setCalc(next);
    },
    [angle, setHistory],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
      // Enter on a focused button already clicks it
      if (e.key === 'Enter' && el?.tagName === 'BUTTON') return;
      const key = keyOf(e);
      if (!key) return;
      e.preventDefault();
      press(key);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press]);

  useEffect(() => {
    exprBox.current?.scrollTo({ left: exprBox.current.scrollWidth });
  }, [calc.tokens]);

  const expr = exprText(calc.tokens);
  const live = preview(calc, angle);
  const answer = calc.done ? expr : null;

  const historyPanel = (
    <aside className="card p-5 flex flex-col gap-3 min-h-0" aria-label={t('History')}>
      <div className="flex items-center gap-2">
        <History size={18} aria-hidden="true" />
        <h2 className="font-semibold flex-1">{t('History')}</h2>
        {history.length > 0 && (
          <button type="button" onClick={() => setHistory([])} className="text-sm font-medium text-primary hover:underline">
            {t('Clear history')}
          </button>
        )}
      </div>
      {history.length ? (
        <ul className="flex flex-col gap-1 overflow-y-auto max-h-[420px]">
          {history.map((e) => (
            <li key={e.at}>
              <button
                type="button"
                className="w-full text-end rounded-tile px-3 py-2 hover:bg-fill"
                dir="ltr"
                onClick={() => {
                  const next = { ...EMPTY, ans: e.value, tokens: e.expr.match(/sin⁻¹\(|cos⁻¹\(|tan⁻¹\(|[a-z√∛]+\(|Ans|⁻¹|./gu) ?? [] };
                  current.current = next;
                  setCalc(next);
                  setShowHistory(false);
                }}
              >
                <span className="block text-[13px] text-secondary truncate">{e.expr} =</span>
                <span className="block text-[17px] font-semibold">{groupDigits(e.result)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-secondary">{t('No calculations yet')}</p>
      )}
    </aside>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,460px)_1fr] items-start">
      <section className="card p-4 sm:p-5 flex flex-col gap-4" aria-label={t('Calculator')}>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 p-1 rounded-full bg-fill w-fit" role="radiogroup" aria-label={t('Calculator type')}>
            {(['basic', 'scientific'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => setMode(m)}
                className={`px-4 min-h-10 rounded-full text-sm font-medium ${mode === m ? 'bg-ink text-on-ink shadow-soft' : 'text-muted hover:text-text'}`}
              >
                {m === 'basic' ? t('Basic') : t('Scientific')}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setShowHistory((v) => !v)} aria-label={t('History')} aria-expanded={showHistory} className="lg:hidden ms-auto size-10 rounded-full grid place-items-center hover:bg-fill">
            <History size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="rounded-row bg-fill p-4 min-h-36 flex flex-col justify-end gap-1" dir="ltr">
          {sci && <span className="self-start text-[12px] font-semibold text-category rounded-full bg-category-tint px-2 py-0.5">{angle === 'deg' ? 'DEG' : 'RAD'}</span>}
          {calc.prev && <p className="text-end text-[15px] text-secondary truncate">{calc.prev} =</p>}
          <div ref={exprBox} className="overflow-x-auto whitespace-nowrap text-end [scrollbar-width:none]">
            {answer ? (
              <span className="text-[40px] leading-tight font-semibold tracking-tight" aria-live="polite">
                {groupDigits(answer)}
              </span>
            ) : (
              <span className={`text-[32px] leading-tight ${expr ? '' : 'text-secondary'}`}>{expr || '0'}</span>
            )}
          </div>
          <div className="flex items-center gap-2 min-h-8">
            <p className={`flex-1 text-end text-[15px] truncate ${calc.error ? 'text-error' : 'text-secondary'}`} aria-live={calc.error ? 'assertive' : 'off'}>
              {calc.error ? calcErrorText(calc.error) : live ? `= ${groupDigits(live)}` : ' '}
            </p>
            {answer && (
              <button type="button" onClick={() => navigator.clipboard?.writeText(answer.replace(/,/g, ''))} aria-label={t('Copy')} className="size-9 rounded-full grid place-items-center hover:bg-fill-strong">
                <Copy size={18} aria-hidden="true" />
              </button>
            )}
            <button type="button" onClick={() => press({ kind: 'back' })} disabled={!calc.tokens.length} aria-label={t('Delete')} className="size-9 rounded-full grid place-items-center hover:bg-fill-strong disabled:opacity-30">
              <Delete size={20} aria-hidden="true" />
            </button>
          </div>
        </div>

        {sci && (
          <div className="grid grid-cols-5 gap-2" dir="ltr">
            <CalcKey small pad={{ label: '2nd', a11y: (t) => t('Second functions'), key: { kind: 'clear' }, look: 'fn' }} on={second} onPress={() => setSecond((v) => !v)} />
            <CalcKey small pad={{ label: angle === 'deg' ? 'DEG' : 'RAD', a11y: (t) => t('Degrees or radians'), key: { kind: 'clear' }, look: 'fn' }} onPress={() => setAngle(angle === 'deg' ? 'rad' : 'deg')} />
            {scientific(second).map((pad) => (
              <CalcKey key={pad.label} small pad={pad} onPress={() => press(pad.key)} />
            ))}
          </div>
        )}
        <div className="grid grid-cols-4 gap-2" dir="ltr">
          {BASIC.map((pad) => (
            <CalcKey key={pad.label} pad={pad} onPress={() => press(pad.key)} />
          ))}
        </div>
      </section>
      <div className={showHistory ? 'block' : 'hidden lg:block'}>{historyPanel}</div>
    </div>
  );
}

function CalcKey({ pad, onPress, small, on }: { pad: Pad; onPress: () => void; small?: boolean; on?: boolean }) {
  const t = useT();
  const look =
    on || pad.look === 'equals'
      ? 'bg-category text-white'
      : pad.look === 'op'
        ? 'bg-category-tint text-category'
        : pad.look === 'clear'
          ? 'bg-danger-soft text-error'
          : pad.look === 'fn'
            ? 'bg-fill text-text'
            : 'bg-surface text-text border border-line';
  return (
    <button
      type="button"
      aria-label={pad.a11y(t)}
      aria-pressed={on}
      onClick={onPress}
      className={`${small ? 'min-h-11 text-[15px]' : 'min-h-14 text-[22px]'} rounded-tile font-medium ${look} hover:brightness-95 active:scale-95 transition-transform focus-visible:outline-2 focus-visible:outline-primary`}
    >
      {pad.label}
    </button>
  );
}
