import Link from 'next/link';
import type { Translate } from '@/i18n';
import type { Tool } from '@/tools/types';

/** A tool in a menu: small icon tile, name, "Soon" when it isn't on the web yet. */
export function ToolLink({ tool, lang, t, onNavigate }: { tool: Tool; lang: string; t: Translate; onNavigate?: () => void }) {
  const Icon = tool.icon;
  const ready = tool.web && !tool.comingSoon;
  return (
    <Link
      href={`/${lang}/tools/${tool.id}`}
      onClick={onNavigate}
      className={`group flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[14px] hover:bg-fill focus-visible:outline-2 focus-visible:outline-primary ${ready ? 'text-text' : 'text-secondary'}`}
    >
      <span className={`size-7 shrink-0 rounded-md grid place-items-center ${ready ? 'bg-category-tint text-category' : 'bg-fill text-secondary'}`}>
        <Icon size={16} aria-hidden="true" />
      </span>
      <span className="truncate group-hover:text-text">{t(tool.name)}</span>
      {!ready && <span className="ms-auto shrink-0 text-[10px] font-semibold uppercase text-secondary">{t('Soon')}</span>}
    </Link>
  );
}
