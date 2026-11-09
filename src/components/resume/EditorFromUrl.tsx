'use client';
import { useSearchParams } from 'next/navigation';
import { ResumeEditor } from './ResumeEditor';

export function EditorFromUrl({ lang }: { lang: string }) {
  return <ResumeEditor id={useSearchParams().get('id')} lang={lang} />;
}
