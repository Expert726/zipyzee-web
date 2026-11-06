import Link from 'next/link';
import { tr, type Language } from '@/i18n';
import type { Tool } from '@/tools/types';

/** A tool tile (the app's ToolCard): ink icon on the muted fill, name, description, "Soon" when not on the web yet. */
export function ToolCard({ tool, lang }: { tool: Tool; lang: Language }) {
  const Icon = tool.icon;
  const ready = tool.web && !tool.comingSoon;
  return (
    <Link
      href={`/${lang}/tools/${tool.id}`}
      className="card p-4 flex gap-3 items-start hover:-translate-y-0.5 transition-transform focus-visible:outline-2 focus-visible:outline-primary"
    >
      <span className="size-11 shrink-0 rounded-tile bg-fill grid place-items-center text-text">
        <Icon size={22} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="font-semibold text-[15px] leading-5">{tr(lang, tool.name)}</span>
          {!ready && <span className="text-[10px] font-semibold uppercase rounded-full px-2 py-0.5 bg-fill text-secondary">{tr(lang, 'Soon')}</span>}
        </span>
        <span className="block text-[13px] leading-[18px] text-secondary mt-0.5">{tr(lang, tool.description)}</span>
      </span>
    </Link>
  );
}
