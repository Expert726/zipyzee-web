import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { EditorFromUrl } from '@/components/resume/EditorFromUrl';

// The resume editor: ?id=<resume> (read inside Suspense: Next's instant-shell rule).
export default async function ResumeEditPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  return (
    <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <Suspense fallback={<Loader2 size={28} className="animate-spin text-primary mx-auto my-24" />}>
        <EditorFromUrl lang={lang} />
      </Suspense>
    </main>
  );
}
