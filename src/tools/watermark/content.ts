// Remove watermark (PDF), the content-stream side (pure, unit-tested): a small tokenizer for a page's drawing
// instructions, and finding the parts that are a watermark drawn as its own layer:
//   layer   - marked content "/Artifact <</Subtype /Watermark>> BDC ... EMC" (ZipyZee, Acrobat, Word) or an /OC group
//             whose name says Watermark;
//   overlay - a q ... Q group that sets a see-through graphics state (ca / CA < 1) and only draws text or images;
//   stamp   - an image drawn with Do that's the same object on most pages (a logo stamp), with its q ... Q wrapper.
// The text is handled as latin1 (one char per byte) so it can be cut and written back byte for byte.

export type Token =
  | { type: 'op'; value: string; start: number; end: number }
  | { type: 'name'; value: string; start: number; end: number }
  | { type: 'num' | 'str' | 'hex' | 'inline'; start: number; end: number }
  | { type: 'array'; items: Token[]; start: number; end: number }
  | { type: 'dict'; entries: Record<string, Token>; start: number; end: number };

export type Op = { op: string; args: Token[]; start: number; end: number };

const WS = new Set([0, 9, 10, 12, 13, 32]);
const DELIM = new Set(['(', ')', '<', '>', '[', ']', '{', '}', '/', '%']);
const isWs = (s: string, i: number) => WS.has(s.charCodeAt(i));
const isDelim = (c: string) => DELIM.has(c);

/** Every operator with its operands, in order. Unknown or broken input stops quietly where it can't go on. */
export function parseOps(s: string): Op[] {
  let i = 0;

  const skip = () => {
    while (i < s.length) {
      if (isWs(s, i)) i++;
      else if (s[i] === '%') while (i < s.length && s[i] !== '\n' && s[i] !== '\r') i++;
      else break;
    }
  };

  const word = () => {
    const start = i;
    while (i < s.length && !isWs(s, i) && !isDelim(s[i])) i++;
    return s.slice(start, i);
  };

  const value = (): Token | null => {
    skip();
    if (i >= s.length) return null;
    const start = i;
    const c = s[i];
    if (c === '(') {
      let depth = 0;
      for (; i < s.length; i++) {
        if (s[i] === '\\') i++;
        else if (s[i] === '(') depth++;
        else if (s[i] === ')' && --depth === 0) break;
      }
      i++;
      return { type: 'str', start, end: i };
    }
    if (c === '<' && s[i + 1] === '<') {
      i += 2;
      const entries: Record<string, Token> = {};
      for (;;) {
        skip();
        if (i >= s.length) break;
        if (s[i] === '>' && s[i + 1] === '>') {
          i += 2;
          break;
        }
        const key = value();
        if (!key) break;
        const v = value();
        if (key.type === 'name' && v) entries[key.value] = v;
      }
      return { type: 'dict', entries, start, end: i };
    }
    if (c === '<') {
      i = s.indexOf('>', i);
      i = i < 0 ? s.length : i + 1;
      return { type: 'hex', start, end: i };
    }
    if (c === '[') {
      i++;
      const items: Token[] = [];
      for (;;) {
        skip();
        if (i >= s.length) break;
        if (s[i] === ']') {
          i++;
          break;
        }
        const v = value();
        if (!v) break;
        items.push(v);
      }
      return { type: 'array', items, start, end: i };
    }
    if (c === '/') {
      i++;
      return { type: 'name', value: word(), start, end: i };
    }
    if (c === ']' || c === '>' || c === ')' || c === '{' || c === '}') {
      i++;
      return { type: 'op', value: c, start, end: i };
    }
    const w = word();
    if (!w) {
      i++;
      return { type: 'op', value: c, start, end: i };
    }
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(w)) return { type: 'num', start, end: i };
    if (w === 'BI') {
      // inline image: BI <dict> ID <binary data> EI - one token
      const id = s.indexOf('ID', i);
      let j = id < 0 ? s.length : id + 3;
      for (; j < s.length; j++) {
        if (s[j] === 'E' && s[j + 1] === 'I' && (j === 0 || isWs(s, j - 1)) && (j + 2 >= s.length || isWs(s, j + 2) || isDelim(s[j + 2]))) break;
      }
      i = Math.min(s.length, j + 2);
      return { type: 'inline', start, end: i };
    }
    return { type: 'op', value: w, start, end: i };
  };

  const ops: Op[] = [];
  let args: Token[] = [];
  for (;;) {
    const v = value();
    if (!v) break;
    if (v.type === 'op') {
      ops.push({ op: v.value, args, start: args.length ? args[0].start : v.start, end: v.end });
      args = [];
    } else if (v.type === 'inline') {
      ops.push({ op: 'BI', args: [], start: v.start, end: v.end });
    } else {
      args.push(v);
    }
  }
  return ops;
}

export type WmKind = 'layer' | 'overlay' | 'stamp';
export type Range = { start: number; end: number };

/** What a name in the page's resources is (the PDF side answers: src/tools/watermark/pdf.ts). */
export type Resolvers = {
  /** /OC /MC0 BDC: does the optional-content group /MC0 say it's a watermark? */
  isWatermarkGroup: (name: string) => boolean;
  /** /GS1 gs: does this graphics state make drawing see-through (ca or CA < 1)? */
  isSeeThrough: (name: string) => boolean;
  /** /Im1 Do: is this an image? */
  isImage: (name: string) => boolean;
  /** /Im1 Do: is this the image stamped on most pages? */
  isStamp: (name: string) => boolean;
};

const nameArg = (o: Op, k = 0) => (o.args[k]?.type === 'name' ? (o.args[k] as { value: string }).value : '');
const isNameValue = (tk: Token | undefined, v: string) => tk?.type === 'name' && tk.value === v;

/** Text and image drawing, and the state they need: what a watermark overlay may contain (no shapes). */
const OVERLAY_OPS = new Set([
  'q', 'Q', 'cm', 'gs', 'BT', 'ET', 'Tf', 'Tj', 'TJ', "'", '"', 'Td', 'TD', 'Tm', 'T*', 'Tc', 'Tw', 'Tz', 'TL', 'Ts', 'Tr',
  'g', 'G', 'rg', 'RG', 'k', 'K', 'cs', 'CS', 'sc', 'scn', 'SC', 'SCN', 'Do', 'BDC', 'BMC', 'EMC', 'MP', 'DP', 'w',
]);

/** Where each q (or BDC / BMC) is closed: index of the matching Q (EMC), or the end. */
function matching(ops: Op[], i: number, open: string[], close: string): number {
  let depth = 0;
  for (let j = i; j < ops.length; j++) {
    if (open.includes(ops[j].op)) depth++;
    else if (ops[j].op === close && --depth === 0) return j;
  }
  return ops.length - 1;
}

/** The parts of one page's content that are a watermark, by kind (ranges in the text, never overlapping). */
export function findWatermarks(ops: Op[], r: Resolvers): Record<WmKind, Range[]> {
  const found: Record<WmKind, Range[]> = { layer: [], overlay: [], stamp: [] };
  const taken: Range[] = [];
  const inside = (a: number, b: number) => taken.some((x) => a >= x.start && b <= x.end);
  const add = (kind: WmKind, from: number, to: number) => {
    const range = { start: ops[from].start, end: ops[to].end };
    if (inside(range.start, range.end)) return;
    found[kind].push(range);
    taken.push(range);
  };

  // layers first: marked content saying Watermark
  for (let i = 0; i < ops.length; i++) {
    const o = ops[i];
    if (o.op !== 'BDC') continue;
    const tag = nameArg(o);
    const props = o.args[1];
    const watermark =
      (tag === 'Artifact' && props?.type === 'dict' && isNameValue(props.entries.Subtype, 'Watermark')) ||
      (tag === 'OC' && props?.type === 'name' && r.isWatermarkGroup(props.value));
    if (watermark) add('layer', i, matching(ops, i, ['BDC', 'BMC'], 'EMC'));
  }

  for (let i = 0; i < ops.length; i++) {
    if (ops[i].op !== 'q') continue;
    const end = matching(ops, i, ['q'], 'Q');
    const body = ops.slice(i, end + 1);
    const seeThrough = body.some((o) => o.op === 'gs' && r.isSeeThrough(nameArg(o)));
    const draws = body.some((o) => ['Tj', 'TJ', "'", '"'].includes(o.op) || (o.op === 'Do' && r.isImage(nameArg(o))));
    const onlyOverlay = body.every((o) => OVERLAY_OPS.has(o.op) && (o.op !== 'Do' || r.isImage(nameArg(o))));
    if (seeThrough && draws && onlyOverlay) add('overlay', i, end);
  }

  // a logo stamp: its q ... cm ... Do ... Q wrapper when that's all the group does, else just the Do
  for (let i = 0; i < ops.length; i++) {
    const o = ops[i];
    if (o.op !== 'Do' || !r.isStamp(nameArg(o))) continue;
    let from = i;
    let to = i;
    for (let j = i - 1, depth = 0; j >= 0; j--) {
      if (ops[j].op === 'Q') depth++;
      else if (ops[j].op === 'q') {
        if (depth === 0) {
          const end = matching(ops, j, ['q'], 'Q');
          if (ops.slice(j, end + 1).every((x) => ['q', 'Q', 'cm', 'gs', 'Do'].includes(x.op))) {
            from = j;
            to = end;
          }
          break;
        }
        depth--;
      }
    }
    add('stamp', from, to);
  }
  return found;
}

/** The content with these ranges cut out (sorted, merged), a space left so neighbours don't run together. */
export function cutRanges(s: string, ranges: Range[]): string {
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  let out = '';
  let at = 0;
  for (const rg of sorted) {
    if (rg.start < at) continue;
    out += `${s.slice(at, rg.start)} `;
    at = rg.end;
  }
  return out + s.slice(at);
}
