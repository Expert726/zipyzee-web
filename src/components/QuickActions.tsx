import Link from 'next/link';
import { ArrowRight, NotebookPen, Sparkles, WandSparkles } from 'lucide-react';
import { tr, type Language } from '@/i18n';

/**
 * Home's three quick actions, up top like the app's ActionCards (Text editor, Make with Zee, Ask Zee), made bigger
 * for the web: on phones 3 small cards in a row like the app, from sm a row of wide cards with an arrow. Ask Zee, the AI, is the lime one.
 */
export function QuickActions({ lang }: { lang: Language }) {
  const t = (s: string) => tr(lang, s);
  const items = [
    { href: `/${lang}/tools/text-editor`, icon: NotebookPen, label: t('Text editor'), sub: t('Write and print') },
    { href: `/${lang}/tools/make-doc`, icon: WandSparkles, label: t('Make with Zee'), sub: t('Papers and notes') },
    { href: `/${lang}/zee`, icon: Sparkles, label: t('Ask Zee'), sub: t('AI answers'), lime: true },
  ];
  return (
    <ul className="grid grid-cols-3 gap-2 sm:gap-3 w-full max-w-4xl">
      {items.map(({ href, icon: Icon, label, sub, lime }) => (
        <li key={href}>
          <Link
            href={href}
            className={`group h-full flex flex-col sm:flex-row items-center gap-2 sm:gap-4 px-2 py-4 sm:p-5 rounded-row sm:rounded-card text-center sm:text-start transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
              lime ? 'lime-fill shadow-soft' : 'card'
            }`}
          >
            <span className={`size-10 sm:size-12 shrink-0 rounded-tile grid place-items-center ${lime ? 'bg-on-ink text-ink' : 'bg-category-tint text-category'}`}>
              <Icon size={22} aria-hidden="true" />
            </span>
            <span className="sm:flex-1 min-w-0 w-full">
              <span className="block text-[14px] sm:text-[17px] leading-5 sm:leading-6 font-semibold">{label}</span>
              <span className={`block text-[11px] sm:text-[13px] ${lime ? 'text-ink-muted' : 'text-secondary'}`}>{sub}</span>
            </span>
            <ArrowRight size={20} className={`hidden sm:block flip-rtl shrink-0 transition-transform group-hover:translate-x-0.5 ${lime ? '' : 'text-secondary'}`} aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
