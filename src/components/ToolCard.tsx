import Link from 'next/link';
import { Smartphone } from 'lucide-react';
import { tr, type Language } from '@/i18n';
import type { Tool } from '@/tools/types';

/**
 * A tool card for the web (on phones: icon beside the text; from sm: a tall card): big icon tile in the category green, name, description. A tool that isn't on the web yet
 * says so quietly at the bottom (it opens the page with the app link).
 */
export function ToolCard({ tool, lang }: { tool: Tool; lang: Language }) {
  const Icon = tool.icon;
  const ready = tool.web && !tool.comingSoon;
  return (
    <Link
      href={`/${lang}/tools/${tool.id}`}
      className="group card h-full p-4 sm:p-6 grid grid-cols-[auto_1fr] sm:flex sm:flex-col gap-x-4 gap-y-2 sm:gap-4 items-start outline-2 outline-transparent hover:outline-primary focus-visible:outline-primary transition-[outline-color,transform] hover:-translate-y-0.5"
    >
      <span className="row-span-2 size-12 sm:size-14 rounded-tile bg-category-tint text-category grid place-items-center">
        <Icon size={26} aria-hidden="true" />
      </span>
      <span className="flex flex-col gap-1 sm:gap-1.5 flex-1">
        <span className="text-[16px] leading-[22px] sm:text-[19px] sm:leading-6 font-semibold tracking-[-0.3px]">{tr(lang, tool.name)}</span>
        <span className="text-[14px] leading-[21px] text-secondary">{tr(lang, tool.description)}</span>
      </span>
      {!ready && (
        <span className="flex items-center gap-1.5 text-[12px] font-medium text-secondary">
          <Smartphone size={14} aria-hidden="true" />
          {tr(lang, 'In the app now, coming to the web')}
        </span>
      )}
    </Link>
  );
}
