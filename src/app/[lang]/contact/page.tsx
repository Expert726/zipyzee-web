import type { Metadata } from 'next';
import Link from 'next/link';
import { Mail, MessageCircle, Smartphone, UserX } from 'lucide-react';
import { isLanguage, tr } from '@/i18n';
import { FEEDBACK_EMAIL, PLAY_URL } from '@/config';
import { ContactForm } from '@/components/contact/ContactForm';
import { CopyEmail } from '@/components/contact/CopyEmail';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return { title: tr(isLanguage(lang) ? lang : 'en', 'Contact us') };
}

/** Contact us: write to us (the form opens your email app), email, the ZipyZee Team chat, the app, account deletion. */
export default async function ContactPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: l } = await params;
  const lang = isLanguage(l) ? l : 'en';
  const t = (s: string) => tr(lang, s);
  const card = 'card p-5 flex items-start gap-4';
  const icon = 'size-11 rounded-tile bg-category-tint text-category grid place-items-center shrink-0';
  return (
    <div className="max-w-5xl mx-auto py-10 flex flex-col gap-8">
      <header className="text-center flex flex-col gap-2">
        <h1 className="text-[32px] sm:text-[40px] font-semibold tracking-tight">{t('Contact us')}</h1>
        <p className="text-secondary text-[16px]">{t('A problem, an idea, a tool you need? We read every message and reply within a few days.')}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] items-start">
        <ContactForm />

        <aside className="flex flex-col gap-3">
          <div className={card}>
            <span className={icon}>
              <Mail size={20} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex flex-col gap-1">
              <h2 className="font-semibold">{t('Email')}</h2>
              <a href={`mailto:${FEEDBACK_EMAIL}`} className="text-primary text-[14px] break-all hover:underline" dir="ltr">
                {FEEDBACK_EMAIL}
              </a>
              <CopyEmail />
            </div>
          </div>
          <Link href={`/${lang}/chats`} className={`${card} hover:shadow-raised transition-shadow`}>
            <span className={icon}>
              <MessageCircle size={20} aria-hidden="true" />
            </span>
            <span className="flex flex-col gap-1">
              <span className="font-semibold">{t('Chat with the ZipyZee Team')}</span>
              <span className="text-[14px] text-secondary">{t('Sign in with Google and open the ZipyZee Team chat, here or in the app.')}</span>
            </span>
          </Link>
          <a href={PLAY_URL} target="_blank" rel="noopener noreferrer" className={`${card} hover:shadow-raised transition-shadow`}>
            <span className={icon}>
              <Smartphone size={20} aria-hidden="true" />
            </span>
            <span className="flex flex-col gap-1">
              <span className="font-semibold">{t('Get the Android app')}</span>
              <span className="text-[14px] text-secondary">{t('Leave a review on Google Play, or write to us from the app (Settings, Send feedback).')}</span>
            </span>
          </a>
          <Link href={`/${lang}/account/delete`} className={`${card} hover:shadow-raised transition-shadow`}>
            <span className={icon}>
              <UserX size={20} aria-hidden="true" />
            </span>
            <span className="flex flex-col gap-1">
              <span className="font-semibold">{t('Delete your account')}</span>
              <span className="text-[14px] text-secondary">{t('Remove your chat account and its data.')}</span>
            </span>
          </Link>
          <p className="text-[13px] text-secondary px-1">
            {t('How we handle your data:')}{' '}
            <Link href={`/${lang}/privacy`} className="text-primary font-semibold hover:underline">
              {t('Privacy policy')}
            </Link>
          </p>
        </aside>
      </div>
    </div>
  );
}
