import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { Smartphone } from 'lucide-react';
import { BackLink } from '@/components/nav/BackLink';
import { isLanguage, LANGUAGES, tr } from '@/i18n';
import { ToolFlow } from '@/components/flow/ToolFlow';
import { CustomTool } from '@/components/custom';
import { CUSTOM_IDS } from '@/tools/handlers/ids';
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

// The tool comes from the URL, so it's read inside Suspense: a click on a tool link shows the page frame and a
// skeleton at once (Partial Prefetching's App Shell), then the tool. Each tool page is still prerendered in full.
export default function ToolPage({ params }: PageProps<'/[lang]/tools/[id]'>) {
  return (
    <div className="pt-4 pb-8">
      <Suspense fallback={<ToolSkeleton />}>
        <ToolContent params={params} />
      </Suspense>
    </div>
  );
}

function ToolSkeleton() {
  return (
    <div className="animate-pulse" aria-busy="true">
      <div className="h-5 w-28 rounded-full bg-fill" />
      <div className="flex flex-col items-center gap-3 mt-4 mb-10">
        <div className="size-16 rounded-[20px] bg-fill" />
        <div className="h-10 w-72 max-w-full rounded-full bg-fill" />
        <div className="h-5 w-96 max-w-full rounded-full bg-fill" />
      </div>
      <div className="h-16 w-72 max-w-full rounded-[20px] bg-fill mx-auto" />
    </div>
  );
}

async function ToolContent({ params }: { params: PageProps<'/[lang]/tools/[id]'>['params'] }) {
  const { lang, id } = await params;
  const tool = getTool(id);
  if (!tool || !isLanguage(lang)) notFound();
  const t = (s: string) => tr(lang, s);
  const Icon = tool.icon;
  const ready = tool.web && !tool.comingSoon;
  return (
    <>
      <BackLink href={`/${lang}?c=${tool.category}`} label={t(CATEGORY_NAMES[tool.category])} />
      <header className="flex flex-col items-center text-center gap-3 mt-4 mb-8 sm:mb-10">
        <span className="size-16 rounded-[20px] bg-category-tint text-category grid place-items-center">
          <Icon size={32} aria-hidden="true" />
        </span>
        <h1 className="text-[30px] sm:text-[42px] leading-tight font-semibold tracking-[-0.03em]">{t(tool.name)}</h1>
        <p className="text-[16px] sm:text-[18px] text-muted max-w-xl">{t(tool.description)}</p>
      </header>
      <div className="max-w-5xl mx-auto">
        {ready ? (
          CUSTOM_IDS.has(tool.id) ? <CustomTool id={tool.id} /> : <ToolFlow toolId={tool.id} />
        ) : (
          <div className="card p-8 sm:p-10 flex flex-col items-center text-center gap-3 max-w-xl mx-auto">
            <Smartphone size={36} className="text-primary" aria-hidden="true" />
            <p className="text-[17px] font-semibold">{t('Coming to the web soon')}</p>
            <p className="text-[15px] text-muted max-w-md">{t('This tool works in the ZipyZee Android app today.')}</p>
            <a href={PLAY_URL} target="_blank" rel="noopener noreferrer" className="lime-fill rounded-full min-h-12 px-6 inline-flex items-center font-semibold mt-2">
              {t('Get the Android app')}
            </a>
          </div>
        )}
      </div>
    </>
  );
}
