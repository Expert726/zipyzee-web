// Calculator (new, no board; added on request for students): the maths, pure and unit-tested. The expression is
// kept as the keys' tokens ("sin(", "3", "0", ")"), shown joined, and read by our own recursive-descent parser:
// never eval, so nothing typed can run as code.
//   expr    := term (("+" | "−") term)*
//   term    := unary (("×" | "÷") unary | unary)*        a missing operator multiplies: 2π, 3(4), (2)(3)
//   unary   := ("−" | "+") unary | power
//   power   := postfix ("^" unary)?                       right to left: 2^3^2 = 2^9; −2^2 = −4
//   postfix := primary ("!" | "%" | "²" | "⁻¹")*
//   primary := number | π | e | Ans | name "(" expr ")" | "(" expr ")"
// Missing ")" at the end are closed for you; "a + b%" adds b% of a, "a × b%" multiplies by b/100.
import { t } from '@/i18n';

export type Angle = 'deg' | 'rad';
export type CalcErrorCode = 'divZero' | 'brackets' | 'domain' | 'syntax' | 'overflow';

export class CalcError extends Error {
  constructor(public code: CalcErrorCode) {
    super(code);
  }
}

export function calcErrorText(code: CalcErrorCode): string {
  switch (code) {
    case 'divZero':
      return t('Can\'t divide by 0');
    case 'brackets':
      return t('Check the brackets');
    case 'domain':
      return t('Not defined for this number');
    case 'overflow':
      return t('Number too large');
    default:
      return t('Check the expression');
  }
}

// ---------- Tokens ----------

type Tok = { k: 'num'; v: number } | { k: 'const'; v: 'π' | 'e' | 'Ans' } | { k: 'fn'; v: string } | { k: 'op'; v: string };

const FUNCS = ['sin⁻¹', 'cos⁻¹', 'tan⁻¹', 'sin', 'cos', 'tan', 'ln', 'log', 'abs', '√', '∛'];
const OPS: Record<string, string> = { '+': '+', '−': '−', '-': '−', '×': '×', '*': '×', '÷': '÷', '/': '÷', '^': '^', '(': '(', ')': ')', '!': '!', '%': '%', '²': '²' };

function tokenize(s: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === ' ') {
      i++;
      continue;
    }
    const num = /^(\d+\.?\d*|\.\d+)(E[+−-]?\d+)?/.exec(s.slice(i));
    if (num) {
      const v = Number(num[0].replace('−', '-'));
      if (Number.isNaN(v)) throw new CalcError('syntax');
      out.push({ k: 'num', v });
      i += num[0].length;
      continue;
    }
    const fn = FUNCS.find((f) => s.startsWith(f, i));
    if (fn) {
      out.push({ k: 'fn', v: fn });
      i += fn.length;
      continue;
    }
    if (s.startsWith('Ans', i)) {
      out.push({ k: 'const', v: 'Ans' });
      i += 3;
      continue;
    }
    if (s.startsWith('⁻¹', i)) {
      out.push({ k: 'op', v: '⁻¹' });
      i += 2;
      continue;
    }
    if (c === 'π' || c === 'e') {
      out.push({ k: 'const', v: c });
      i++;
      continue;
    }
    if (OPS[c]) {
      out.push({ k: 'op', v: OPS[c] });
      i++;
      continue;
    }
    throw new CalcError('syntax');
  }
  return out;
}

// ---------- Evaluate ----------

type Opts = { angle: Angle; ans?: number | null };

const FACT_MAX = 170;
/** sin(π) is 1.2e-16 in floating point; a calculator says 0. */
const snap = (x: number) => (Math.abs(x) < 1e-14 ? 0 : x);

function apply(fn: string, x: number, angle: Angle): number {
  const toRad = (a: number) => (angle === 'deg' ? (a * Math.PI) / 180 : a);
  const fromRad = (a: number) => (angle === 'deg' ? (a * 180) / Math.PI : a);
  switch (fn) {
    case 'sin':
      return snap(Math.sin(toRad(x)));
    case 'cos':
      return snap(Math.cos(toRad(x)));
    case 'tan': {
      // tan 90° (and 270°...) doesn't exist
      if (angle === 'deg' && Math.abs(((x % 180) + 180) % 180 - 90) < 1e-9) throw new CalcError('domain');
      const r = Math.tan(toRad(x));
      if (!Number.isFinite(r) || Math.abs(r) > 1e15) throw new CalcError('domain');
      return snap(r);
    }
    case 'sin⁻¹':
    case 'cos⁻¹':
      if (x < -1 || x > 1) throw new CalcError('domain');
      return fromRad(fn === 'sin⁻¹' ? Math.asin(x) : Math.acos(x));
    case 'tan⁻¹':
      return fromRad(Math.atan(x));
    case 'ln':
    case 'log':
      if (x <= 0) throw new CalcError('domain');
      return fn === 'ln' ? Math.log(x) : Math.log10(x);
    case 'abs':
      return Math.abs(x);
    case '√':
      if (x < 0) throw new CalcError('domain');
      return Math.sqrt(x);
    case '∛':
      return Math.cbrt(x);
  }
  throw new CalcError('syntax');
}

function factorial(x: number): number {
  if (x < 0 || !Number.isInteger(x)) throw new CalcError('domain');
  if (x > FACT_MAX) throw new CalcError('overflow');
  let r = 1;
  for (let k = 2; k <= x; k++) r *= k;
  return r;
}

/** The value of an expression. Throws CalcError. */
export function evaluate(expr: string, opts: Opts): number {
  const toks = tokenize(expr);
  if (!toks.length) throw new CalcError('syntax');
  // close the brackets left open at the end
  let depth = 0;
  for (const tk of toks) {
    if (tk.k === 'op' && tk.v === '(') depth++;
    if (tk.k === 'op' && tk.v === ')' && --depth < 0) throw new CalcError('brackets');
  }
  for (; depth > 0; depth--) toks.push({ k: 'op', v: ')' });

  let i = 0;
  const peek = () => toks[i];
  const isOp = (v: string) => peek()?.k === 'op' && (peek() as { v: string }).v === v;
  const startsPrimary = () => {
    const p = peek();
    return !!p && (p.k === 'num' || p.k === 'const' || p.k === 'fn' || (p.k === 'op' && p.v === '('));
  };

  type Val = { v: number; pct: boolean };

  const primary = (): number => {
    const p = toks[i++];
    if (!p) throw new CalcError('syntax');
    if (p.k === 'num') return p.v;
    if (p.k === 'const') {
      if (p.v === 'π') return Math.PI;
      if (p.v === 'e') return Math.E;
      if (opts.ans == null) throw new CalcError('syntax');
      return opts.ans;
    }
    if (p.k === 'fn') {
      if (!isOp('(')) throw new CalcError('syntax');
      i++;
      const x = expr0();
      if (!isOp(')')) throw new CalcError('brackets');
      i++;
      return apply(p.v, x, opts.angle);
    }
    if (p.v === '(') {
      const x = expr0();
      if (!isOp(')')) throw new CalcError('brackets');
      i++;
      return x;
    }
    throw new CalcError(p.v === ')' ? 'brackets' : 'syntax');
  };

  const postfix = (): Val => {
    let v = primary();
    let pct = false;
    for (;;) {
      if (isOp('!')) v = factorial(v);
      else if (isOp('%')) v /= 100;
      else if (isOp('²')) v *= v;
      else if (isOp('⁻¹')) {
        if (v === 0) throw new CalcError('divZero');
        v = 1 / v;
      } else break;
      pct = isOp('%');
      i++;
    }
    return { v, pct };
  };

  const power = (): Val => {
    const base = postfix();
    if (!isOp('^')) return base;
    i++;
    const exp = unary();
    const r = Math.pow(base.v, exp.v);
    if (Number.isNaN(r)) throw new CalcError('domain');
    return { v: r, pct: false };
  };

  const unary = (): Val => {
    if (isOp('−')) {
      i++;
      const x = unary();
      return { v: -x.v, pct: x.pct };
    }
    if (isOp('+')) {
      i++;
      return unary();
    }
    return power();
  };

  const term = (): Val => {
    let left = unary();
    for (;;) {
      if (isOp('×') || isOp('÷')) {
        const op = (toks[i++] as { v: string }).v;
        const right = unary();
        if (op === '÷' && right.v === 0) throw new CalcError('divZero');
        left = { v: op === '×' ? left.v * right.v : left.v / right.v, pct: false };
      } else if (startsPrimary()) {
        left = { v: left.v * unary().v, pct: false };
      } else return left;
    }
  };

  function expr0(): number {
    let left = term().v;
    while (isOp('+') || isOp('−')) {
      const op = (toks[i++] as { v: string }).v;
      const right = term();
      // 200 + 10% = 220
      const r = right.pct ? left * right.v : right.v;
      left = op === '+' ? left + r : left - r;
    }
    return left;
  }

  const result = expr0();
  if (i < toks.length) throw new CalcError(isOp(')') ? 'brackets' : 'syntax');
  if (!Number.isFinite(result)) throw new CalcError('overflow');
  return result;
}

/** 12 significant figures, floating noise gone (0.1 + 0.2 = 0.3); very large or small numbers as 1.23E+15. */
export function formatNumber(n: number): string {
  if (n === 0) return '0';
  const a = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (a >= 1e15 || a < 1e-6) {
    const [m, e] = a.toExponential(9).split('e');
    const mant = m.replace(/0+$/, '').replace(/\.$/, '');
    return `${sign}${mant}E${e.startsWith('-') ? e : `+${e.replace('+', '')}`}`;
  }
  return sign + String(Number(a.toPrecision(12)));
}

/** "1234567.5" -> "1,234,567.5" for the big answer. */
export const groupDigits = (s: string) => (s.includes('E') ? s : s.replace(/^([−]?)(\d+)/, (_, sign, int) => sign + int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')));

// ---------- Keypad ----------

export type CalcState = {
  tokens: string[];
  /** The expression of the last "=", shown above the answer. */
  prev: string | null;
  /** "=" was just pressed: a digit starts again, an operator carries on with the answer. */
  done: boolean;
  ans: number | null;
  error: CalcErrorCode | null;
};

export const EMPTY: CalcState = { tokens: [], prev: null, done: false, ans: null, error: null };

export type Key =
  | { kind: 'digit'; v: string } // 0-9 or "."
  | { kind: 'op'; v: '+' | '−' | '×' | '÷' | '^' }
  | { kind: 'fn'; v: string } // "sin(", "√(", "e^(", "10^("...
  | { kind: 'const'; v: 'π' | 'e' | 'Ans' }
  | { kind: 'post'; v: '!' | '%' | '²' | '⁻¹' }
  | { kind: 'paren' }
  | { kind: 'sign' }
  | { kind: 'exp' } // EE
  | { kind: 'back' }
  | { kind: 'clear' }
  | { kind: 'equals' };

const BIN = ['+', '−', '×', '÷', '^'];
const isDigit = (s?: string) => !!s && /^[\d.]$/.test(s);
/** Ends a value: a number, a constant, ")" or a postfix. */
const endsValue = (s?: string) => !!s && (isDigit(s) || s === ')' || s === 'π' || s === 'e' || s === 'Ans' || ['!', '%', '²', '⁻¹'].includes(s));

export const exprText = (tokens: string[]) => tokens.join('');

/** The answer as tokens, so it can be carried on with or edited. */
const answerTokens = (n: number) => {
  const s = formatNumber(n);
  return s.includes('E') ? [s] : s.split('');
};

/** What one key does to the calculator. */
export function pressKey(s: CalcState, key: Key, opts: { angle: Angle }): CalcState {
  const base = { ...s, error: null };
  const last = s.tokens[s.tokens.length - 1];
  const fresh = (tokens: string[]): CalcState => ({ ...base, tokens, done: false, prev: null });

  switch (key.kind) {
    case 'clear':
      return { ...EMPTY, ans: s.ans };
    case 'back':
      if (s.done) return { ...base, tokens: [], done: false, prev: null };
      return { ...base, tokens: s.tokens.slice(0, -1) };
    case 'digit': {
      const start = s.done ? [] : s.tokens;
      const tail = start[start.length - 1];
      if (key.v === '.') {
        // one point per number
        let j = start.length - 1;
        while (j >= 0 && isDigit(start[j])) {
          if (start[j] === '.') return base;
          j--;
        }
        return fresh(isDigit(tail) ? [...start, '.'] : [...start, '0', '.']);
      }
      return fresh([...start, key.v]);
    }
    case 'const':
    case 'fn': {
      const start = s.done ? [] : s.tokens;
      return fresh([...start, key.v]);
    }
    case 'op': {
      const start = s.done && s.ans != null ? answerTokens(s.ans) : s.tokens;
      const tail = start[start.length - 1];
      if (!start.length) return key.v === '−' ? fresh(['−']) : base;
      if (BIN.includes(tail)) {
        // × then − is a negative number; otherwise the new operator replaces the old one
        if (key.v === '−' && tail !== '−' && tail !== '+') return fresh([...start, '−']);
        if (start.length === 1) return base;
        return fresh([...start.slice(0, -1), key.v]);
      }
      if (tail === '(' || (tail ?? '').endsWith('(')) return key.v === '−' ? fresh([...start, '−']) : base;
      return fresh([...start, key.v]);
    }
    case 'post': {
      const start = s.done && s.ans != null ? answerTokens(s.ans) : s.tokens;
      if (!endsValue(start[start.length - 1])) return base;
      return fresh([...start, key.v]);
    }
    case 'paren': {
      const start = s.done ? [] : s.tokens;
      const open = start.filter((x) => x.endsWith('(')).length - start.filter((x) => x === ')').length;
      const tail = start[start.length - 1];
      return fresh([...start, open > 0 && endsValue(tail) ? ')' : '(']);
    }
    case 'exp':
      if (s.done || !isDigit(last) || last === '.') return base;
      return fresh([...s.tokens, 'E']);
    case 'sign': {
      const start = s.done && s.ans != null ? answerTokens(s.ans) : s.tokens;
      // the last number or constant, and a "−" just before it if that's a sign (not a subtraction)
      let j = start.length;
      while (j > 0 && (isDigit(start[j - 1]) || ['π', 'e', 'Ans'].includes(start[j - 1]))) j--;
      if (j === start.length) return base;
      const before = start[j - 1];
      const signed = before === '−' && (j - 1 === 0 || BIN.includes(start[j - 2]) || start[j - 2].endsWith('('));
      const tokens = signed ? [...start.slice(0, j - 1), ...start.slice(j)] : [...start.slice(0, j), '−', ...start.slice(j)];
      return fresh(tokens);
    }
    case 'equals': {
      if (!s.tokens.length || s.done) return base;
      const expr = exprText(s.tokens);
      try {
        const v = evaluate(expr, { angle: opts.angle, ans: s.ans });
        return { tokens: answerTokens(v), prev: expr, done: true, ans: v, error: null };
      } catch (e) {
        return { ...base, error: e instanceof CalcError ? e.code : 'syntax' };
      }
    }
  }
}

/** The answer as you type (null while it can't be worked out yet, or when it's just the number typed). */
export function preview(s: CalcState, angle: Angle): string | null {
  if (s.done || !s.tokens.length) return null;
  const toks = s.tokens.filter((x, k) => !(k === s.tokens.length - 1 && (BIN.includes(x) || x === 'E')));
  if (toks.every((x) => isDigit(x))) return null;
  try {
    return formatNumber(evaluate(exprText(toks), { angle, ans: s.ans }));
  } catch {
    return null;
  }
}
