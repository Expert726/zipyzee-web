'use client';
// Text editor (the app's custom/text/TextEditorStep): "My documents" when there are any, else straight into a new
// document. The open document is in the URL (?doc=<id>), so Back returns to the list and a reload keeps it open.
import { useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { docsApi, flushDocs, useDocs } from '@/textdocs/store';
import { DocList } from './DocList';
import { Editor } from './Editor';

export function TextEditor() {
  const { ready, docs } = useDocs();
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const docId = params.get('doc');
  const list = useMemo(() => Object.values(docs).sort((a, b) => b.updatedAt - a.updatedAt), [docs]);
  const doc = docId ? docs[docId] : undefined;

  const open = (id: string) => router.push(`${path}?doc=${id}`, { scroll: false });
  const openNew = () => open(docsApi.create());

  // nothing saved yet: straight to a new document (replace, so Back leaves the tool)
  useEffect(() => {
    if (ready && !docId && !list.length) router.replace(`${path}?doc=${docsApi.create()}`, { scroll: false });
  }, [ready, docId, list.length, path, router]);

  // a document that isn't here (deleted, another browser): back to the list
  useEffect(() => {
    if (ready && docId && !docs[docId]) router.replace(path, { scroll: false });
  }, [ready, docId, docs, path, router]);

  if (!ready) return <div className="card min-h-64" aria-busy="true" />;
  if (doc) {
    return (
      <Editor
        key={doc.id}
        doc={doc}
        onBack={() => {
          // an empty document isn't kept
          const d = docsApi.get(doc.id);
          if (d && !d.text.trim() && !d.title.trim() && !/<img\b/i.test(d.html)) docsApi.remove(doc.id);
          void flushDocs();
          router.push(path, { scroll: false });
        }}
      />
    );
  }
  return <DocList docs={list} onOpen={open} onNew={openNew} />;
}
