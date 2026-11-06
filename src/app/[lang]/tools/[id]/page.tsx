import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, Smartphone } from 'lucide-react';
import { isLanguage, LANGUAGES, tr } from '@/i18n';
import { ToolFlow } from '@/components/flow/ToolFlow';
import { getTool, TOOLS } from '@/tools/registry';
import { CATEGORY_NAMES } from '@/tools/categories';
import { PLAY_URL } from '@/config';

// One static page per tool and language (good for search: "merge pdf free").
export const generateStaticParams = () => LANGUAGES.flatMap((lang) => TOOLS.map((x) => ({ lang, id: x.id })));

export async function generateMetadata({ params }: PageProps<'/[lang]/tools/[id]'>): Promise<Metadata> {
  const { lang, id } = await params;
  const tool = getTool(id);
  if (!tool || !isLanguage(lang)) return {};
  return {
    title: tr(lang, tool.name),
    description: tr(lang, tool.description),
    alternates: { languages: { en: `/en/tools/${id}`, ur: `/ur/tools/${id}` } },
  };
}

export default async function ToolPage({ params }: PageProps<'/[lang]/tools/[id]'>) {
  const { lang, id } = await params;
  const tool = getTool(id);
  if (!tool || !isLanguage(lang)) notFound();
  const t = (s: string) => tr(lang, s);
  const Icon = tool.icon;
  const ready = tool.web && !tool.comingSoon;
  return (
    <div className="pt-4 max-w-4xl mx-auto">
      <Link href={`/${lang}/tools#${tool.category}`} className="inline-flex items-center gap-1 text-sm font-medium text-secondary hover:text-text mb-4">
        <ChevronLeft size={18} className="flip-rtl" aria-hidden="true" />
        {t(CATEGORY_NAMES[tool.category])}
      </Link>
      <header className="flex items-center gap-4 mb-6">
        <span className="size-14 rounded-tile bg-surface shadow-soft grid place-items-center">
          <Icon size={28} aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-[28px] leading-[34px] font-semibold tracking-[-0.8px]">{t(tool.name)}</h1>
          <p className="text-[15px] text-secondary">{t(tool.description)}</p>
        </div>
      </header>
      {ready ? (
        <ToolFlow toolId={tool.id} />
      ) : (
        <div className="card p-8 flex flex-col items-center text-center gap-3">
          <Smartphone size={36} className="text-primary" aria-hidden="true" />
          <p className="text-[17px] font-semibold">{t('Coming to the web soon')}</p>
          <p className="text-[15px] text-muted max-w-md">{t('This tool works in the ZipyZee Android app today.')}</p>
          <a href={PLAY_URL} target="_blank" rel="noopener noreferrer" className="lime-fill rounded-full min-h-12 px-6 inline-flex items-center font-semibold mt-2">
            {t('Get the Android app')}
          </a>
        </div>
      )}
    </div>
  );
}
