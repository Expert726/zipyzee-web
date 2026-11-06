import type { Metadata } from 'next';
import { isLanguage, tr } from '@/i18n';
import { AllTools } from '@/components/AllTools';

export async function generateMetadata({ params }: PageProps<'/[lang]/tools'>): Promise<Metadata> {
  const { lang } = await params;
  return { title: tr(isLanguage(lang) ? lang : 'en', 'All tools'), alternates: { languages: { en: '/en/tools', ur: '/ur/tools' } } };
}

export default async function AllToolsPage({ params }: PageProps<'/[lang]/tools'>) {
  const { lang } = await params;
  return (
    <div className="pt-6">
      <h1 className="text-[28px] leading-[34px] font-semibold tracking-[-0.8px] mb-5">{tr(isLanguage(lang) ? lang : 'en', 'All tools')}</h1>
      <AllTools />
    </div>
  );
}
