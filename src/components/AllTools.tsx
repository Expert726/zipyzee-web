'use client';
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useLanguage, useT } from '@/i18n/client';
import { ALL_CATEGORIES, toolsIn, TOOL_COUNT } from '@/tools/registry';
import { CATEGORY_NAMES } from '@/tools/categories';
import { ToolCard } from './ToolCard';

/** All tools with search (the app's All tools: sections per category, search in the current language and English). */
export function AllTools() {
  const t = useT();
  const lang = useLanguage();
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const sections = useMemo(
    () =>
      ALL_CATEGORIES.map((c) => ({
        c,
        tools: toolsIn(c).filter((x) => !q || [x.name, x.description, t(x.name), t(x.description)].some((s) => s.toLowerCase().includes(q))),
      })).filter((s) => s.tools.length),
    [q, t],
  );
  return (
    <>
      <label className="relative block mb-8 max-w-xl">
        <span className="sr-only">{t('Search {count} tools', { count: TOOL_COUNT })}</span>
        <Search size={20} className="absolute start-4 top-1/2 -translate-y-1/2 text-secondary" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('Search {count} tools', { count: TOOL_COUNT })}
          className="w-full min-h-13 rounded-full bg-surface shadow-soft border border-line ps-12 pe-4 text-[15px] focus:outline-2 focus:outline-primary"
        />
      </label>
      {!sections.length && <p className="text-secondary">{t('No tools match "{query}". Try another word.', { query })}</p>}
      {sections.map(({ c, tools }) => (
        <section key={c} id={c} className="mb-10 scroll-mt-6" aria-labelledby={`h-${c}`}>
          <h2 id={`h-${c}`} className="text-[17px] font-semibold mb-3">{t(CATEGORY_NAMES[c])}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {tools.map((x) => <ToolCard key={x.id} tool={x} lang={lang} />)}
          </div>
        </section>
      ))}
    </>
  );
}
