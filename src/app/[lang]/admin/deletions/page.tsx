import type { Metadata } from 'next';
import { isLanguage, tr } from '@/i18n';
import { DeleteRequests } from '@/components/admin/DeleteRequests';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  // a team page: kept out of search engines
  return { title: tr(isLanguage(lang) ? lang : 'en', 'Account deletion requests'), robots: { index: false, follow: false } };
}

/** The ZipyZee team's account deletion requests (admin only; the component checks the role, the rules enforce it). */
export default async function DeletionRequestsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: l } = await params;
  const lang = isLanguage(l) ? l : 'en';
  return (
    <div className="max-w-4xl mx-auto py-10 flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-[32px] font-semibold tracking-tight">{tr(lang, 'Account deletion requests')}</h1>
        <p className="text-secondary">{tr(lang, 'People who asked to delete their account. Their account is hidden at once; you delete it after 7 days.')}</p>
      </header>
      <DeleteRequests />
    </div>
  );
}
