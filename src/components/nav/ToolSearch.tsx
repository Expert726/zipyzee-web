'use client';
// Quick access to any tool: the search box on Home, under the three cards. Finds tools by name and description in the
// current language and in English, plus the site's pages (Resume, Chats, ZeeShare, Zee). Results drop down as you type;
// arrow keys move, Enter opens, Esc clears. "/" or Ctrl / ⌘ K jumps to the box.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftRight, CornerDownLeft, FileUser, MessageCircle, Search, Sparkles, X, type LucideIcon } from 'lucide-react';
import { useLanguage, useT } from '@/i18n/client';
import type { Translate } from '@/i18n';
import { TOOL_COUNT, TOOLS } from '@/tools/registry';
import { CATEGORY_NAMES } from '@/tools/categories';

type Hit = { key: string; href: string; name: string; note: string; icon: LucideIcon; ready: boolean; score: number };

const PAGES = (t: Translate): Omit<Hit, 'score'>[] => [
  { key: 'resume', href: 'resume', name: t('Resume builder'), note: t('Pick a template, fill in your details, download a PDF.'), icon: FileUser, ready: true },
  { key: 'zeeshare', href: 'zeeshare', name: t('ZeeShare'), note: t('Send text, photos and files between your phone and computer, or any two browsers.'), icon: ArrowLeftRight, ready: true },
  { key: 'chats', href: 'chats', name: t('Chats'), note: t('Chats'), icon: MessageCircle, ready: true },
  { key: 'zee', href: 'zee', name: t('Ask Zee'), note: t('AI answers'), icon: Sparkles, ready: true },
];

/** Higher is better: the name starting with the words, a word in the name, then the description. 0 = no match. */
export function matchScore(q: string, name: string, more: string[]): number {
  const n = name.toLowerCase();
  if (n.startsWith(q)) return 100 - n.length / 100;
  if (n.split(/[\s/-]+/).some((w) => w.startsWith(q))) return 80;
  if (n.includes(q)) return 60;
  const words = q.split(/\s+/).filter(Boolean);
  const all = [n, ...more.map((s) => s.toLowerCase())].join(' ');
  if (words.length > 1 && words.every((w) => all.includes(w))) return 40;
  return more.some((s) => s.toLowerCase().includes(q)) ? 20 : 0;
}

function useHits(query: string, t: Translate): Hit[] {
  const q = query.trim().toLowerCase();
  return useMemo(() => {
    if (!q) return [];
    const tools: Hit[] = TOOLS.filter((x) => !(x.comingSoon && x.category === 'ai')).map((x) => ({
      key: x.id,
      href: `tools/${x.id}`,
      name: t(x.name),
      note: t(x.description),
      icon: x.icon,
      ready: !!x.web && !x.comingSoon,
      score: Math.max(matchScore(q, t(x.name), [t(x.description), x.description, t(CATEGORY_NAMES[x.category])]), matchScore(q, x.name, [x.description])),
    }));
    const pages: Hit[] = PAGES(t).map((p) => ({ ...p, score: matchScore(q, p.name, [p.note, p.key]) }));
    // ready tools before "soon" ones with the same score
    return [...pages, ...tools]
      .filter((h) => h.score > 0)
      .sort((a, b) => b.score + (b.ready ? 1 : 0) - (a.score + (a.ready ? 1 : 0)))
      .slice(0, 12);
  }, [q, t]);
}

export function ToolSearchBox() {
  const t = useT();
  const lang = useLanguage();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [focused, setFocused] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const hits = useHits(query, t);
  const open = focused && !!query.trim();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
      if (((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault();
        input.current?.focus();
        input.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    list.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const go = (h: Hit | undefined) => {
    if (!h) return;
    setQuery('');
    router.push(`/${lang}/${h.href}`);
  };

  return (
    <div className="relative w-full max-w-4xl">
      <label className="relative block">
        <span className="sr-only">{t('Search {count} tools', { count: TOOL_COUNT })}</span>
        <Search size={20} className="absolute start-5 top-1/2 -translate-y-1/2 text-secondary pointer-events-none" aria-hidden="true" />
        <input
          ref={input}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onFocus={() => setFocused(true)}
          // a click on a result lands before the list closes
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(hits.length - 1, a + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              go(hits[active]);
            } else if (e.key === 'Escape') {
              setQuery('');
            }
          }}
          placeholder={t('Search {count} tools, like "merge" or "photo to PDF"', { count: TOOL_COUNT })}
          role="combobox"
          aria-expanded={open}
          aria-controls="home-tool-search"
          aria-activedescendant={open && hits[active] ? `hs-${hits[active].key}` : undefined}
          autoComplete="off"
          dir="auto"
          className="w-full h-14 rounded-full bg-surface shadow-soft border border-line ps-13 pe-24 text-[16px] focus:outline-2 focus:outline-primary [&::-webkit-search-cancel-button]:hidden"
        />
        {query ? (
          <button type="button" onClick={() => setQuery('')} aria-label={t('Clear')} className="absolute end-3 top-1/2 -translate-y-1/2 size-9 rounded-full grid place-items-center hover:bg-fill">
            <X size={18} aria-hidden="true" />
          </button>
        ) : (
          <kbd className="hidden md:block absolute end-5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-secondary rounded border border-line-strong px-1.5 py-0.5">/</kbd>
        )}
      </label>
      {open && (
        <ul ref={list} id="home-tool-search" role="listbox" className="absolute z-20 inset-x-0 top-full mt-2 card shadow-raised max-h-[60vh] overflow-y-auto p-2 text-start">
          {hits.map((h, i) => {
            const Icon = h.icon;
            return (
              <li key={h.key} id={`hs-${h.key}`} role="option" aria-selected={i === active} data-i={i}>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onMouseMove={() => setActive(i)} onClick={() => go(h)} className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-start ${i === active ? 'bg-fill' : ''}`}>
                  <span className={`size-9 shrink-0 rounded-md grid place-items-center ${h.ready ? 'bg-category-tint text-category' : 'bg-fill text-secondary'}`}>
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[14px] font-semibold truncate">{h.name}</span>
                    <span className="block text-[12px] text-secondary truncate">{h.note}</span>
                  </span>
                  {!h.ready && <span className="shrink-0 text-[10px] font-semibold uppercase text-secondary">{t('Soon')}</span>}
                  {i === active && <CornerDownLeft size={15} aria-hidden="true" className="shrink-0 text-secondary flip-rtl" />}
                </button>
              </li>
            );
          })}
          {!hits.length && <li className="px-3 py-6 text-center text-[14px] text-secondary">{t('No tools match "{query}"', { query: query.trim() })}</li>}
        </ul>
      )}
    </div>
  );
}
