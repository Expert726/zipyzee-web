'use client';
// Home's tools: filter pills (All + the app's categories) over a grid of tool cards. Tools that work on the web come
// first in every filter. The filter lives in the URL (?c=pdf), so Back, reload and shared links keep it. Arrow keys
// move between the pills (ARIA tabs pattern).
import { useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useLanguage, useT } from '@/i18n/client';
import { HOME_CATEGORIES, toolsIn } from '@/tools/registry';
import { CATEGORY_NAMES } from '@/tools/categories';
import type { CategoryId, Tool } from '@/tools/types';
import { ToolCard } from './ToolCard';

type Filter = 'all' | CategoryId;
const FILTERS: Filter[] = ['all', ...HOME_CATEGORIES];
const filterOf = (v: string | null): Filter => (v && (FILTERS as string[]).includes(v) ? (v as Filter) : 'all');

const isReady = (x: Tool) => x.web && !x.comingSoon;
/** Web-ready tools first, the app's order kept inside each group. */
const readyFirst = (list: Tool[]) => [...list.filter(isReady), ...list.filter((x) => !isReady(x))];

/** Reads and writes the filter in the URL. Needs a Suspense boundary (the page shows <HomeTools /> meanwhile). */
export function HomeTabs() {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const filter = filterOf(params.get('c'));
  const setFilter = (f: Filter) => router.replace(f === 'all' ? path : `${path}?c=${f}`, { scroll: false });
  return <HomeTools filter={filter} onFilter={setFilter} />;
}

/** The pills and the grid for one filter (also the static first paint, filter "all"). */
export function HomeTools({ filter = 'all', onFilter }: { filter?: Filter; onFilter?: (f: Filter) => void }) {
  const t = useT();
  const lang = useLanguage();
  const setFilter = (f: Filter) => onFilter?.(f);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKey = (e: React.KeyboardEvent, i: number) => {
    const rtl = document.documentElement.dir === 'rtl';
    const step = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1, Home: -i, End: FILTERS.length - 1 - i }[e.key];
    if (step == null) return;
    e.preventDefault();
    const j = (i + step + FILTERS.length) % FILTERS.length;
    setFilter(FILTERS[j]);
    refs.current[j]?.focus();
  };

  const tools = readyFirst(filter === 'all' ? HOME_CATEGORIES.flatMap(toolsIn) : toolsIn(filter));

  return (
    <section>
      <div role="tablist" aria-label={t('Tool categories')} className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-8">
        {FILTERS.map((id, i) => {
          const on = id === filter;
          return (
            <button
              key={id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              id={`tab-${id}`}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls="home-tools"
              tabIndex={on ? 0 : -1}
              onClick={() => setFilter(id)}
              onKeyDown={(e) => onKey(e, i)}
              className={`min-h-11 px-5 rounded-full text-[15px] font-medium whitespace-nowrap border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                on ? 'lime-fill border-transparent font-semibold' : 'bg-surface border-line-strong text-text hover:bg-fill'
              }`}
            >
              {id === 'all' ? t('All') : t(CATEGORY_NAMES[id])}
            </button>
          );
        })}
      </div>

      <div id="home-tools" role="tabpanel" aria-labelledby={`tab-${filter}`} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {tools.map((x) => (
          <ToolCard key={x.id} tool={x} lang={lang} />
        ))}
      </div>

      <p className="text-center mt-10">
        <Link href={`/${lang}/tools`} className="text-sm font-medium text-primary hover:underline">
          {t('See all tools')}
        </Link>
      </p>
    </section>
  );
}
