import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { ZeeShare } from '@/components/zeeshare/ZeeShare';
import { isLanguage, tr } from '@/i18n';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  return { title: tr(isLanguage(lang) ? lang : 'en', 'ZeeShare') };
}

// ZeeShare: text, photos and files between two devices (browser to browser, phone to computer), paired until Disconnect.
export default async function ZeeSharePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const l = isLanguage(lang) ? lang : 'en';
  return (
    <main className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-[32px] sm:text-[40px] font-semibold tracking-tight text-center">{tr(l, 'ZeeShare')}</h1>
      <p className="text-center text-secondary mt-2 mb-8">{tr(l, 'Send text, photos and files between your phone and computer, or any two browsers.')}</p>
      {/* ?join=<code> (a scanned QR) is read inside Suspense */}
      <Suspense fallback={<Loader2 size={28} className="animate-spin text-primary mx-auto my-24" />}>
        <ZeeShare lang={lang} />
      </Suspense>
    </main>
  );
}
