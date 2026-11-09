import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { ChatsApp } from '@/components/chat/ChatsApp';

// Chats on the web: the same chats as the ZipyZee app (Firestore, Google sign-in). Everything happens in the browser
// after sign-in; the page shell is static. The open chat is in ?c=, read inside Suspense (Next's instant-shell rule).
export default function ChatsPage() {
  return (
    <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <Suspense fallback={<Loader2 size={28} className="animate-spin text-primary mx-auto my-24" />}>
        <ChatsApp />
      </Suspense>
    </main>
  );
}
