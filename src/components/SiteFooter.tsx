'use client';
import { useT } from '@/i18n/client';
import { PLAY_URL } from '@/config';

export function SiteFooter() {
  const t = useT();
  return (
    <footer className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-10 mt-16 text-sm text-secondary flex flex-col sm:flex-row gap-3 sm:items-center">
      <p>{t('Your files are processed in your browser and never uploaded.')}</p>
      <a href={PLAY_URL} className="sm:ms-auto font-medium text-primary hover:underline" target="_blank" rel="noopener noreferrer">
        {t('Get the Android app')}
      </a>
    </footer>
  );
}
