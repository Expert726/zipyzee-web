import { ResumeHome } from '@/components/resume/ResumeHome';
import { isLanguage, tr } from '@/i18n';

// Resume builder: 100 templates (the app's 50 + 50 web ones), your resumes kept in this browser.
export default async function ResumePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const l = isLanguage(lang) ? lang : 'en';
  return (
    <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-[32px] sm:text-[40px] font-semibold tracking-tight text-center">{tr(l, 'Resume builder')}</h1>
      <p className="text-center text-secondary mt-2 mb-8">{tr(l, 'Pick a template, fill in your details, download a PDF.')}</p>
      <ResumeHome lang={lang} />
    </main>
  );
}
