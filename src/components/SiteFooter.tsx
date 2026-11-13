import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { tr, type Language } from '@/i18n';
import { PLAY_URL } from '@/config';
import { toolsIn } from '@/tools/registry';
import { CATEGORY_NAMES } from '@/tools/categories';
import type { CategoryId } from '@/tools/types';
import { ZipyMark } from './ZipyMark';

const COLUMNS: CategoryId[] = ['pdf', 'image', 'everyday'];

/** Brand and privacy line, the web-ready tools by category, then ZipyZee links. */
export function SiteFooter({ lang }: { lang: Language }) {
  const t = (s: string) => tr(lang, s);
  return (
    <footer className="mt-20 lime-glow-bottom">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div className="flex flex-col gap-3 max-w-xs">
          <Link href={`/${lang}`} className="flex items-center gap-2 font-semibold text-lg">
            <ZipyMark />
            ZipyZee
          </Link>
          <p className="text-[14px] text-text flex gap-2">
            <ShieldCheck size={18} className="text-brand shrink-0 mt-0.5" aria-hidden="true" />
            {t('Your files are processed in your browser and never uploaded.')}
          </p>
        </div>
        {COLUMNS.map((c) => {
          const ready = toolsIn(c).filter((x) => x.web && !x.comingSoon);
          return (
            <nav key={c} aria-label={t(CATEGORY_NAMES[c])}>
              <h2 className="text-[13px] font-semibold mb-3">{t(CATEGORY_NAMES[c])}</h2>
              <ul className="flex flex-col gap-2">
                {ready.map((x) => (
                  <li key={x.id}>
                    <Link href={`/${lang}/tools/${x.id}`} className="text-[14px] text-text hover:text-primary hover:underline underline-offset-4">
                      {t(x.name)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          );
        })}
        <nav aria-label="ZipyZee">
          <h2 className="text-[13px] font-semibold mb-3">ZipyZee</h2>
          <ul className="flex flex-col gap-2 text-[14px]">
            <li>
              <Link href={`/${lang}/tools`} className="text-text hover:text-primary hover:underline underline-offset-4">
                {t('All tools')}
              </Link>
            </li>
            <li>
              <Link href={`/${lang}/zee`} className="text-text hover:text-primary hover:underline underline-offset-4">
                {t('Ask Zee')}
              </Link>
            </li>
            <li>
              <Link href={`/${lang}/contact`} className="text-text hover:text-primary hover:underline underline-offset-4">
                {t('Contact us')}
              </Link>
            </li>
            <li>
              <a href={PLAY_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
                {t('Get the Android app')}
              </a>
            </li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-line/50">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-text">
          <p className="me-auto">© ZipyZee</p>
          <Link href={`/${lang}/privacy`} className="hover:text-primary hover:underline underline-offset-4">
            {t('Privacy policy')}
          </Link>
          <Link href={`/${lang}/contact`} className="hover:text-primary hover:underline underline-offset-4">
            {t('Contact us')}
          </Link>
          <Link href={`/${lang}/account/delete`} className="hover:text-primary hover:underline underline-offset-4">
            {t('Delete account')}
          </Link>
        </div>
      </div>
    </footer>
  );
}
