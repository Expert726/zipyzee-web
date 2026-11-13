'use client';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createPortal } from 'react-dom';
import { ArrowLeftRight, ChevronDown, FileUser, Languages, Menu, MessageCircle, Moon, Sun, X } from 'lucide-react';
import { useLanguage, useT } from '@/i18n/client';
import type { Translate } from '@/i18n';
import { getTool, HOME_CATEGORIES, toolsIn } from '@/tools/registry';
import { CATEGORY_NAMES } from '@/tools/categories';
import { ZipyMark } from './ZipyMark';
import { useTheme } from './useTheme';
import { Dropdown } from './nav/Dropdown';
import { ToolLink } from './nav/ToolLink';
import { convertGroups, MEGA, POPULAR, readyFirst } from './nav/menus';

/** The site header: logo, the most used tools, Convert and All tools menus (a drawer on phones), language, theme. */
/** Re-renders on scroll (useSyncExternalStore reads window.scrollY). */
function onScroll(notify: () => void) {
  window.addEventListener('scroll', notify, { passive: true });
  return () => window.removeEventListener('scroll', notify);
}

export function SiteHeader() {
  const t = useT();
  const lang = useLanguage();
  const path = usePathname();
  const other = lang === 'en' ? 'ur' : 'en';
  const otherPath = path.replace(/^\/(en|ur)(?=\/|$)/, `/${other}`);
  const { dark, toggle } = useTheme();
  const current = path.split('/')[3];
  const currentTool = current ? getTool(current) : undefined;
  // the drawer belongs to the page it was opened on, so navigating closes it
  const [drawerAt, setDrawerAt] = useState<string | null>(null);
  const drawer = drawerAt === path;
  const closeDrawer = useCallback(() => setDrawerAt(null), []);
  // at the top the header is part of the page's lime glow (no band of its own); once the page scrolls under it, it
  // gets a frosted background and a line so the menu stays readable over content
  const scrolled = useSyncExternalStore(onScroll, () => window.scrollY > 8, () => false);

  return (
    <header className={`sticky top-0 z-30 border-b transition-[background-color,border-color,backdrop-filter] duration-200 ${scrolled ? 'bg-background/80 backdrop-blur border-line' : 'bg-transparent border-transparent'}`}>
      <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-2">
        <Link href={`/${lang}`} className="flex items-center gap-2 font-semibold text-lg tracking-tight me-4 shrink-0">
          <ZipyMark />
          <span>ZipyZee</span>
        </Link>

        <nav className="hidden lg:flex items-center" aria-label={t('Tools')}>
          {POPULAR.map((id) => {
            const x = getTool(id)!;
            return (
              <Link key={id} href={`/${lang}/tools/${id}`} className={`px-3 h-16 flex items-center text-[14px] font-semibold hover:text-primary ${current === id ? 'text-primary' : ''}`}>
                {t(x.name)}
              </Link>
            );
          })}
          <Dropdown label={t('Convert')} active={currentTool?.category === 'convert'}>
            {(close) => (
              <div className="grid grid-cols-3 gap-6 min-w-[720px]">
                {convertGroups().map((g) => (
                  <div key={g.title}>
                    <p className="text-[12px] font-semibold uppercase tracking-wide text-secondary px-2 mb-2">{t(g.title)}</p>
                    {readyFirst(g.tools).map((x) => (
                      <ToolLink key={x.id} tool={x} lang={lang} t={t} onNavigate={close} />
                    ))}
                  </div>
                ))}
              </div>
            )}
          </Dropdown>
          <Dropdown label={t('All tools')} mega active={path.endsWith('/tools')}>
            {(close) => <MegaMenu lang={lang} t={t} close={close} />}
          </Dropdown>
        </nav>

        <div className="ms-auto flex items-center gap-1">
          {/* text, photos and files between two devices */}
          <Link href={`/${lang}/zeeshare`} title={t('ZeeShare')} className={`h-10 px-3 rounded-full hover:bg-fill inline-flex items-center gap-1.5 text-[14px] font-semibold ${path.startsWith(`/${lang}/zeeshare`) ? 'text-primary' : ''}`}>
            <ArrowLeftRight size={18} aria-hidden="true" />
            <span className="hidden xl:inline">{t('ZeeShare')}</span>
          </Link>
          <Link href={`/${lang}/resume`} title={t('Resume')} className={`h-10 px-3 rounded-full hover:bg-fill inline-flex items-center gap-1.5 text-[14px] font-semibold ${path.startsWith(`/${lang}/resume`) ? 'text-primary' : ''}`}>
            <FileUser size={18} aria-hidden="true" />
            <span className="hidden xl:inline">{t('Resume')}</span>
          </Link>
          {/* the same chats as the app (Google sign-in) */}
          <Link href={`/${lang}/chats`} title={t('Chats')} className={`h-10 px-3 rounded-full hover:bg-fill inline-flex items-center gap-1.5 text-[14px] font-semibold ${path.startsWith(`/${lang}/chats`) ? 'text-primary' : ''}`}>
            <MessageCircle size={18} aria-hidden="true" />
            <span className="hidden xl:inline">{t('Chats')}</span>
          </Link>
          <Link
            href={otherPath}
            onClick={() => {
              document.cookie = `lang=${other}; path=/; max-age=31536000; SameSite=Lax`;
            }}
            className="px-3 h-10 rounded-full hover:bg-fill flex items-center gap-1.5 text-[14px] font-medium"
            hrefLang={other}
          >
            <Languages size={18} aria-hidden="true" />
            <span>{other === 'ur' ? 'اردو' : 'English'}</span>
          </Link>
          <button type="button" onClick={toggle} className="size-10 rounded-full hover:bg-fill grid place-items-center" aria-label={dark ? t('Light theme') : t('Dark theme')}>
            {dark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
          </button>
          <button type="button" onClick={() => setDrawerAt(path)} className="lg:hidden size-10 rounded-full hover:bg-fill grid place-items-center" aria-label={t('All tools')} aria-expanded={drawer}>
            <Menu size={22} aria-hidden="true" />
          </button>
        </div>
      </div>
      {/* in <body>: the header's backdrop blur would trap a fixed panel inside it */}
      {drawer && createPortal(<Drawer lang={lang} t={t} onClose={closeDrawer} />, document.body)}
    </header>
  );
}

function MegaMenu({ lang, t, close }: { lang: string; t: Translate; close: () => void }) {
  return (
    <div className="grid grid-cols-5 gap-6">
      {MEGA.map((col, i) => (
        <div key={i} className={`flex flex-col gap-5 ${col.wide ? 'col-span-2' : ''}`}>
          {col.categories.map((c) => (
            <div key={c}>
              <Link href={`/${lang}?c=${c}`} onClick={close} className="block text-[12px] font-semibold uppercase tracking-wide text-secondary hover:text-primary px-2 mb-2">
                {t(CATEGORY_NAMES[c])}
              </Link>
              <div className={col.wide ? 'grid grid-cols-2 gap-x-4' : ''}>
                {readyFirst(toolsIn(c)).map((x) => (
                  <ToolLink key={x.id} tool={x} lang={lang} t={t} onNavigate={close} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Phones and tablets: every tool by category, in a panel over the page. */
function Drawer({ lang, t, onClose }: { lang: string; t: Translate; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={t('All tools')}>
      <button type="button" className="absolute inset-0 bg-overlay" onClick={onClose} aria-label={t('Close')} tabIndex={-1} />
      <div className="absolute inset-y-0 end-0 w-[min(420px,92vw)] bg-surface shadow-raised flex flex-col">
        <div className="h-16 px-4 flex items-center border-b border-line">
          <p className="font-semibold text-[17px] flex-1">{t('All tools')}</p>
          <button type="button" onClick={onClose} className="size-10 rounded-full hover:bg-fill grid place-items-center" aria-label={t('Close')} autoFocus>
            <X size={22} aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {HOME_CATEGORIES.map((c, i) => (
            <details key={c} open={i === 0} className="group border-b border-line last:border-0">
              <summary className="flex items-center min-h-12 px-2 font-semibold cursor-pointer list-none">
                <span className="flex-1">{t(CATEGORY_NAMES[c])}</span>
                <span className="text-secondary text-sm me-2">{toolsIn(c).length}</span>
                <ChevronDown size={18} className="transition-transform group-open:rotate-180 text-secondary" aria-hidden="true" />
              </summary>
              <div className="pb-3">
                {readyFirst(toolsIn(c)).map((x) => (
                  <ToolLink key={x.id} tool={x} lang={lang} t={t} onNavigate={onClose} />
                ))}
              </div>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
