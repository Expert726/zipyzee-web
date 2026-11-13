import type { Metadata } from 'next';
import Link from 'next/link';
import { isLanguage, tr } from '@/i18n';
import { DeleteAccount } from '@/components/account/DeleteAccount';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return { title: tr(isLanguage(lang) ? lang : 'en', 'Delete account') };
}

/** Delete account (also the page Google Play links to for account deletion). */
export default async function DeleteAccountPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: l } = await params;
  const lang = isLanguage(l) ? l : 'en';
  const t = (s: string) => tr(lang, s);
  return (
    <div className="max-w-2xl mx-auto py-10 flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-[32px] sm:text-[40px] font-semibold tracking-tight">{t('Delete account')}</h1>
        <p className="text-secondary text-[16px]">{t('Delete your ZipyZee account and its data. In the Android app it\'s also in Settings, Delete account.')}</p>
      </header>
      <DeleteAccount />
      <p className="text-[14px] text-secondary">
        <Link href={`/${lang}/privacy`} className="text-primary font-semibold hover:underline">
          {t('Privacy policy')}
        </Link>
        {' · '}
        <Link href={`/${lang}/contact`} className="text-primary font-semibold hover:underline">
          {t('Contact us')}
        </Link>
      </p>
    </div>
  );
}
