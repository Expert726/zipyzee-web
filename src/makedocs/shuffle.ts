// Paper B: the same paper with each section's questions in another order and MCQ choices shuffled (the right answer
// follows its choice), so students sitting side by side can't copy. Seeded, so B is the same every time it's saved.
import type { Block } from './types';

/* eslint-disable no-bitwise -- a seeded random number generator works on 32-bit integers */
/** mulberry32: a small seeded random number generator (0..1). */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(list: T[], rand: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Questions keep their section (between headings) and other blocks keep their place. */
export function paperB(blocks: Block[], seed = 7): Block[] {
  const rand = seeded(seed);
  const out: Block[] = [];
  let run: Block[] = [];
  const flush = () => {
    out.push(...shuffled(run, rand));
    run = [];
  };
  for (const b of blocks) {
    if (b.type !== 'question') {
      flush();
      out.push(b);
      continue;
    }
    const q = b.q;
    if (q.type === 'mcq' && q.options && q.options.length > 1) {
      const order = shuffled(q.options.map((_, i) => i), rand);
      run.push({ ...b, q: { ...q, options: order.map((i) => q.options![i]), answer: order.indexOf(q.answer ?? 0) } });
    } else {
      run.push(b);
    }
  }
  flush();
  return out;
}

/** Match the columns: the right column in a mixed order for printing (the left keeps 1, 2, 3; the key says which). */
export function matchOrder(count: number, seed: number): number[] {
  const order = shuffled(Array.from({ length: count }, (_, i) => i), seeded(seed));
  // never leave it in the right order
  if (count > 1 && order.every((v, i) => v === i)) order.push(order.shift()!);
  return order;
}
