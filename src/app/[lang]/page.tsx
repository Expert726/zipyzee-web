import Link from 'next/link';
import { ShieldCheck, Zap, BadgeCheck } from 'lucide-react';
import { isLanguage, tr } from '@/i18n';
import { ToolCard } from '@/components/ToolCard';
import { HOME_CATEGORIES, homePicks, TOOL_COUNT } from '@/tools/registry';
import { CATEGORY_NAMES } from '@/tools/categories';

export default async function HomePage({ params }: PageProps<'/[lang]'>) {
  const { lang: l } = await params;
  const lang = isLanguage(l) ? l : 'en';
  const t = (s: string, v?: Record<string, string | number>) => tr(lang, s, v);
  return (
    <>
      <section className="pt-10 pb-12 sm:pt-16 sm:pb-16 text-center flex flex-col items-center gap-5">
        <h1 className="text-[34px] sm:text-[48px] leading-tight font-semibold tracking-[-0.03em] max-w-3xl">{t('{count} free tools for PDFs, photos and scans', { count: TOOL_COUNT })}</h1>
        <p className="text-[17px] text-muted max-w-xl">{t('Merge, split and compress PDFs, resize and convert photos. Free, and your files never leave your computer.')}</p>
        <Link href={`/${lang}/tools`} className="lime-fill rounded-full min-h-14 ps-6 pe-6 inline-flex items-center font-semibold text-base hover:brightness-95">
          {t('See all tools')}
        </Link>
        <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-[13px] text-muted mt-2">
          <li className="flex items-center gap-1.5"><ShieldCheck size={16} className="text-brand" aria-hidden="true" />{t('Files stay on your computer')}</li>
          <li className="flex items-center gap-1.5"><Zap size={16} className="text-brand" aria-hidden="true" />{t('No sign-up')}</li>
          <li className="flex items-center gap-1.5"><BadgeCheck size={16} className="text-brand" aria-hidden="true" />{t('Free, no watermark')}</li>
        </ul>
      </section>
      {HOME_CATEGORIES.map((c) => {
        const picks = homePicks(c);
        if (!picks.length) return null;
        return (
          <section key={c} className="mb-10" aria-labelledby={`cat-${c}`}>
            <div className="flex items-baseline mb-3">
              <h2 id={`cat-${c}`} className="text-[17px] font-semibold">{t(CATEGORY_NAMES[c])}</h2>
              <Link href={`/${lang}/tools#${c}`} className="ms-auto text-sm font-medium text-primary hover:underline">{t('See all')}</Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {picks.map((x) => <ToolCard key={x.id} tool={x} lang={lang} />)}
            </div>
          </section>
        );
      })}
    </>
  );
}
