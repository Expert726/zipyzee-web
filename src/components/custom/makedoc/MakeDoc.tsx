'use client';
// Make with Zee (the app's custom/makedocs/MakeStep): "Make something new" beside the last 24 hours' documents, or the
// open document's editor. The open document is in the URL (?doc=<id>): Back returns to the start, reload keeps it.
// While Zee writes, a "making" panel with Cancel; a failure says what to do and keeps what was typed.
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useT } from '@/i18n/client';
import { kindLabel } from '@/makedocs/kinds';
import { makeDoc, type MakeRequest } from '@/makedocs/ai';
import { flushZeeDocs, useZeeDocs, zeeDocs } from '@/makedocs/store';
import type { DocKind } from '@/makedocs/types';
import { ZeeError, zeeReady } from '@/lib/firebase';
import { Button } from '../../ui/Button';
import { DocEditor } from './DocEditor';
import { NewDoc } from './NewDoc';
import { RecentDocs } from './RecentDocs';

export function MakeDoc() {
  const t = useT();
  const { ready, docs } = useZeeDocs();
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const docId = params.get('doc');
  const doc = docId ? docs[docId] : undefined;
  const list = useMemo(() => Object.values(docs).sort((a, b) => b.updatedAt - a.updatedAt), [docs]);
  const [making, setMaking] = useState<DocKind | 'any' | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const canMake = zeeReady();

  const open = (id: string) => router.push(`${path}?doc=${id}`, { scroll: false });

  useEffect(() => {
    if (ready && docId && !docs[docId]) router.replace(path, { scroll: false });
  }, [ready, docId, docs, path, router]);

  const make = async (r: MakeRequest) => {
    setFailed(null);
    if (!navigator.onLine) return setFailed(t('Zee needs the internet to make it. You can start blank and fill it in yourself.'));
    const ctl = new AbortController();
    abort.current = ctl;
    setMaking(r.kind ?? 'any');
    try {
      const made = await makeDoc(r, ctl.signal);
      if (ctl.signal.aborted) return;
      open(zeeDocs.create({ kind: made.kind, title: made.title, language: made.language, blocks: made.blocks }));
    } catch (e) {
      if (!ctl.signal.aborted) setFailed(e instanceof ZeeError ? e.message : t('Zee couldn\'t make it this time. Try again.'));
    } finally {
      if (abort.current === ctl) {
        abort.current = null;
        setMaking(null);
      }
    }
  };

  if (!ready) return <div className="card min-h-64" aria-busy="true" />;

  if (doc) {
    return (
      <DocEditor
        key={doc.id}
        doc={doc}
        onBack={() => {
          void flushZeeDocs();
          router.push(path, { scroll: false });
        }}
      />
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] items-start">
      <div className="flex flex-col gap-4">
        {!canMake && (
          <p className="card !rounded-row p-4 flex gap-3 items-start bg-warning-soft text-[14px]" role="status">
            <AlertTriangle size={18} className="text-warning shrink-0 mt-0.5" aria-hidden="true" />
            <span>{t('Zee isn\'t set up on this website yet. You can still start blank and fill it in yourself.')}</span>
          </p>
        )}
        {failed && (
          <p className="card !rounded-row p-4 flex gap-3 items-start bg-danger-soft text-[14px]" role="alert">
            <AlertTriangle size={18} className="text-error shrink-0 mt-0.5" aria-hidden="true" />
            <span>{failed}</span>
          </p>
        )}
        <NewDoc canMake={canMake && !making} onMake={(r) => void make(r)} onBlank={open} />
      </div>
      <RecentDocs docs={list} onOpen={open} />

      {making && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-overlay p-4" role="dialog" aria-modal="true" aria-label={t('Zee is making it…')}>
          <div className="card p-8 max-w-sm w-full flex flex-col items-center text-center gap-3 shadow-raised" role="status" aria-live="polite">
            <span className="size-16 rounded-full lime-fill grid place-items-center">
              <Loader2 size={28} className="animate-spin" aria-hidden="true" />
            </span>
            <p className="text-[17px] font-semibold">{making === 'any' ? t('Zee is making it…') : t('Zee is making your {kind}…', { kind: kindLabel(making).toLowerCase() })}</p>
            <p className="text-[14px] text-secondary">{t('This takes a few seconds.')}</p>
            <Button
              variant="secondary"
              onClick={() => {
                abort.current?.abort();
                abort.current = null;
                setMaking(null);
              }}
            >
              {t('Cancel')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
