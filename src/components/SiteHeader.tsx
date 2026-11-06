'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Languages, Moon, Sun } from 'lucide-react';
import { useLanguage, useT } from '@/i18n/client';
import { ZipyMark } from './ZipyMark';
import { useTheme } from './useTheme';

export function SiteHeader() {
  const t = useT();
  const lang = useLanguage();
  const path = usePathname();
  const other = lang === 'en' ? 'ur' : 'en';
  // the same page in the other language
  const otherPath = path.replace(/^\/(en|ur)(?=\/|$)/, `/${other}`);
  const { dark, toggle } = useTheme();

  return (
    <header className="w-full max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
      <Link href={`/${lang}`} className="flex items-center gap-2 font-semibold text-lg tracking-tight">
        <ZipyMark />
        <span>ZipyZee</span>
      </Link>
      <nav className="ms-auto flex items-center gap-1 sm:gap-2 text-sm font-medium">
        <Link href={`/${lang}/tools`} className="px-3 py-2 rounded-full hover:bg-fill">
          {t('All tools')}
        </Link>
        <Link
          href={otherPath}
          onClick={() => {
            document.cookie = `lang=${other}; path=/; max-age=31536000; SameSite=Lax`;
          }}
          className="px-3 py-2 rounded-full hover:bg-fill flex items-center gap-1.5"
          hrefLang={other}
        >
          <Languages size={18} aria-hidden="true" />
          <span>{other === 'ur' ? 'اردو' : 'English'}</span>
        </Link>
        <button
          type="button"
          onClick={toggle}
          className="size-10 rounded-full hover:bg-fill grid place-items-center"
          aria-label={dark ? t('Light theme') : t('Dark theme')}
        >
          {dark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
        </button>
      </nav>
    </header>
  );
}
