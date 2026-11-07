import type { Metadata } from 'next';
import { Sparkles } from 'lucide-react';
import { isLanguage, tr } from '@/i18n';
import { PLAY_URL } from '@/config';

// Ask Zee (the app's ZeeScreen). The web version needs Firebase AI Logic with App Check for the web
// (docs/WEB_PLAN.md W4); until then this page points to the app.
export async function generateMetadata({ params }: PageProps<'/[lang]/zee'>): Promise<Metadata> {
  const { lang } = await params;
  return { title: tr(isLanguage(lang) ? lang : 'en', 'Ask Zee') };
}

export default async function ZeePage({ params }: PageProps<'/[lang]/zee'>) {
  const { lang: l } = await params;
  const lang = isLanguage(l) ? l : 'en';
  const t = (s: string) => tr(lang, s);
  return (
    <div className="pt-8 max-w-2xl mx-auto">
      <div className="card p-8 sm:p-10 flex flex-col items-center text-center gap-3">
        <span className="size-16 rounded-full lime-fill grid place-items-center">
          <Sparkles size={30} aria-hidden="true" />
        </span>
        <h1 className="text-[28px] leading-[34px] font-semibold tracking-[-0.8px]">{t('Ask Zee')}</h1>
        <p className="text-[17px] font-semibold">{t('Coming to the web soon')}</p>
        <p className="text-[15px] text-muted max-w-md">{t('Zee answers your questions and makes papers, notes and lists in the ZipyZee Android app today.')}</p>
        <a href={PLAY_URL} target="_blank" rel="noopener noreferrer" className="lime-fill rounded-full min-h-12 px-6 inline-flex items-center font-semibold mt-2">
          {t('Get the Android app')}
        </a>
      </div>
    </div>
  );
}
