import { ShieldCheck, Zap, BadgeCheck } from 'lucide-react';
import { isLanguage, tr } from '@/i18n';
import { Suspense } from 'react';
import { HomeTabs, HomeTools } from '@/components/HomeTabs';
import { QuickActions } from '@/components/QuickActions';
import { TOOL_COUNT } from '@/tools/registry';

export default async function HomePage({ params }: PageProps<'/[lang]'>) {
  const { lang: l } = await params;
  const lang = isLanguage(l) ? l : 'en';
  const t = (s: string, v?: Record<string, string | number>) => tr(lang, s, v);
  return (
    <>
      <section className="pt-8 pb-12 sm:pt-12 sm:pb-14 text-center flex flex-col items-center gap-4">
        <h1 className="text-[30px] sm:text-[44px] leading-tight font-semibold tracking-[-0.03em] max-w-3xl">{t('{count} free tools for PDFs, photos and scans', { count: TOOL_COUNT })}</h1>
        <p className="text-[16px] sm:text-[17px] text-muted max-w-xl mb-4">{t('Merge, split and compress PDFs, resize and convert photos. Free, and your files never leave your computer.')}</p>
        <QuickActions lang={lang} />
        <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-[13px] text-muted mt-4">
          <li className="flex items-center gap-1.5"><ShieldCheck size={16} className="text-brand" aria-hidden="true" />{t('Files stay on your computer')}</li>
          <li className="flex items-center gap-1.5"><Zap size={16} className="text-brand" aria-hidden="true" />{t('No sign-up')}</li>
          <li className="flex items-center gap-1.5"><BadgeCheck size={16} className="text-brand" aria-hidden="true" />{t('Free, no watermark')}</li>
        </ul>
      </section>
      <Suspense fallback={<HomeTools />}>
        <HomeTabs />
      </Suspense>
    </>
  );
}
