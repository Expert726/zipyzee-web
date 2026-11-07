// Every English key the web shows: t('...') / tr(lang, '...') calls, plus the text fields of the registry, options and
// categories (English keys translated where they're shown).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { TOOLS } from '@/tools/registry';
import { TOOL_OPTIONS } from '@/tools/options';
import { CATEGORY_NAMES } from '@/tools/categories';

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(f) && !/ur(Web)?\.ts$/.test(f) ? [p] : [];
  });

const CALL = /\b(?:t|tr\(\s*lang\s*,)\s*\(?\s*'((?:[^'\\]|\\.)*)'/g;

export function usedKeys(): Set<string> {
  const keys = new Set<string>();
  for (const file of walk(join(__dirname, '..', 'src'))) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(CALL)) keys.add(m[1].replace(/\\'/g, "'"));
  }
  for (const x of TOOLS) [x.name, x.description, x.verb, x.processing].forEach((k) => keys.add(k));
  for (const o of Object.values(TOOL_OPTIONS))
    for (const f of o.fields) {
      if ('label' in f) keys.add(f.label);
      if ('options' in f) f.options.forEach((c) => /[a-z]/.test(c.label) && keys.add(c.label));
      if ('sub' in f && f.sub) keys.add(f.sub);
      if ('hint' in f && f.hint) keys.add(f.hint);
      if (f.kind === 'note') keys.add(f.text);
      if (f.kind === 'groups') f.groups.forEach((g) => [g.label, ...g.options.map((c) => c.label)].forEach((k) => /[a-z]/.test(k) && keys.add(k)));
    }
  Object.values(CATEGORY_NAMES).forEach((k) => keys.add(k));
  return keys;
}
