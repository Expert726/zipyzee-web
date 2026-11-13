import type { Metadata } from 'next';
import Link from 'next/link';
import { isLanguage, tr } from '@/i18n';
import { PRIVACY_WEB_EFFECTIVE, privacyWebIntro, privacyWebSections } from '@/legal/privacyWeb';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return { title: tr(isLanguage(lang) ? lang : 'en', 'Privacy policy') };
}

/** The website's privacy policy (src/legal/privacyWeb.ts), with a contents list. */
export default async function PrivacyPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: l } = await params;
  const lang = isLanguage(l) ? l : 'en';
  const t = (s: string, v?: Record<string, string | number>) => tr(lang, s, v);
  const sections = privacyWebSections(t);
  return (
    <article className="max-w-3xl mx-auto py-10 flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <h1 className="text-[32px] sm:text-[40px] font-semibold tracking-tight">{t('Privacy policy')}</h1>
        <p className="text-[13px] text-secondary">{t('Effective {date}. For the ZipyZee website; the Android app has its own policy.', { date: PRIVACY_WEB_EFFECTIVE })}</p>
        <p className="text-[16px] leading-relaxed">{privacyWebIntro(t)}</p>
      </header>

      <nav className="card p-5" aria-label={t('Contents')}>
        <p className="text-[13px] font-semibold mb-2">{t('Contents')}</p>
        <ol className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-[14px]">
          {sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-primary hover:underline underline-offset-4">
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {sections.map((s) => (
        <section key={s.id} id={s.id} className="flex flex-col gap-3 scroll-mt-24">
          <h2 className="text-[20px] font-semibold">{s.title}</h2>
          {s.paragraphs?.map((p) => (
            <p key={p} className="text-[15px] leading-relaxed">
              {p}
            </p>
          ))}
          {s.bullets && (
            <ul className="list-disc ps-6 flex flex-col gap-1.5 text-[15px] leading-relaxed">
              {s.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}
          {s.rows && (
            <div className="grid gap-3">
              {s.rows.map((r) => (
                <div key={r.what} className="card p-4 grid gap-1.5 sm:grid-cols-3 sm:gap-4 text-[14px]">
                  <p>
                    <span className="block text-[12px] font-semibold text-secondary">{t('What')}</span>
                    {r.what}
                  </p>
                  <p>
                    <span className="block text-[12px] font-semibold text-secondary">{t('Why')}</span>
                    {r.why}
                  </p>
                  <p>
                    <span className="block text-[12px] font-semibold text-secondary">{t('Kept')}</span>
                    {r.kept}
                  </p>
                </div>
              ))}
            </div>
          )}
          {s.after?.map((p) => (
            <p key={p} className="text-[15px] leading-relaxed">
              {p}
            </p>
          ))}
        </section>
      ))}

      <p className="text-[14px] text-secondary border-t border-line pt-6">
        <Link href={`/${lang}/contact`} className="text-primary font-semibold hover:underline">
          {t('Contact us')}
        </Link>
        {' · '}
        <Link href={`/${lang}/account/delete`} className="text-primary font-semibold hover:underline">
          {t('Delete account')}
        </Link>
      </p>
    </article>
  );
}
