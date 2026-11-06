import { NextResponse, type NextRequest } from 'next/server';
import { DEFAULT_LANGUAGE, LANGUAGES, type Language } from '@/i18n/languages';

/** The saved choice (cookie, set by the language switch), else the browser's languages, else English. */
function pickLanguage(req: NextRequest): Language {
  const saved = req.cookies.get('lang')?.value;
  if (saved && (LANGUAGES as readonly string[]).includes(saved)) return saved as Language;
  const accept = req.headers.get('accept-language') ?? '';
  return /(^|,)\s*ur\b/i.test(accept) ? 'ur' : DEFAULT_LANGUAGE;
}

// Every page lives under /en or /ur; anything else is sent there.
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (LANGUAGES.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`))) return;
  req.nextUrl.pathname = `/${pickLanguage(req)}${pathname === '/' ? '' : pathname}`;
  return NextResponse.redirect(req.nextUrl);
}

export const config = {
  // not Next's files, the API, or files with an extension (favicon.ico, robots.txt, sitemap.xml, images)
  matcher: ['/((?!_next|api|.*\\..*).*)'],
};
