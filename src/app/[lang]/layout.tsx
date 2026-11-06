import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Noto_Naskh_Arabic, Poppins } from 'next/font/google';
import { I18nProvider } from '@/i18n/client';
import { isLanguage, isRTLLanguage, LANGUAGES, tr } from '@/i18n';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { SITE_NAME, SITE_URL } from '@/config';
import { TOOL_COUNT } from '@/tools/registry';
import '../globals.css';

// Poppins 400 / 500 / 600 (the lime look) first in both languages; it has Latin letters only, so Urdu letters fall
// through to Noto Naskh (whose own Latin letters are serif and must not win). No generated fallbacks: Poppins' one
// is Arial, which has Arabic letters and would catch Urdu before Naskh.
const poppins = Poppins({ weight: ['400', '500', '600'], subsets: ['latin'], variable: '--font-poppins', display: 'swap', adjustFontFallback: false, fallback: [] });
const naskh = Noto_Naskh_Arabic({ weight: ['400', '500', '600'], subsets: ['arabic'], variable: '--font-naskh', display: 'swap', adjustFontFallback: false, fallback: [] });

export const generateStaticParams = () => LANGUAGES.map((lang) => ({ lang }));

export async function generateMetadata({ params }: LayoutProps<'/[lang]'>): Promise<Metadata> {
  const { lang } = await params;
  if (!isLanguage(lang)) return {};
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: `${SITE_NAME}: ${tr(lang, '{count} free tools for PDFs, photos and scans', { count: TOOL_COUNT })}`, template: `%s | ${SITE_NAME}` },
    description: tr(lang, 'Merge, split and compress PDFs, resize and convert photos. Free, and your files never leave your computer.'),
    alternates: { languages: { en: '/en', ur: '/ur' } },
  };
}

/** Sets data-theme before the first paint (saved choice; none = follow the system), so there's no flash. */
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export default async function RootLayout({ children, params }: LayoutProps<'/[lang]'>) {
  const { lang } = await params;
  if (!isLanguage(lang)) notFound();
  return (
    <html lang={lang} dir={isRTLLanguage(lang) ? 'rtl' : 'ltr'} className={`${poppins.variable} ${naskh.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="lime-glow min-h-dvh flex flex-col">
        <I18nProvider lang={lang}>
          <SiteHeader />
          <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6">{children}</main>
          <SiteFooter />
        </I18nProvider>
      </body>
    </html>
  );
}
