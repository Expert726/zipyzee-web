'use client';
// Business card to contact (the app: ML Kit reads the card, custom/card/CardResultStep): the card is read as soon as
// it opens (src/lib/ocr.ts), split into fields (src/tools/card.ts parseCard), every field shown to fix, then a .vcf
// that phones, Outlook and Google Contacts import (handlers/ocrTools.ts). Phones, emails and websites can be added.
import { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import { useT } from '@/i18n/client';
import { decodeImage } from '@/lib/image';
import { readText } from '@/lib/ocr';
import { emptyCard, parseCard, type CardFields } from '@/tools/card';
import { capLongest } from '@/tools/image/sizes';
import { Button } from '../../../ui/Button';
import type { CustomSetupProps } from '../index';

type ListKey = 'phones' | 'emails' | 'websites';

export function CardEditor({ files, onStart }: CustomSetupProps) {
  const t = useT();
  const file = files[0];
  const [url, setUrl] = useState<string | null>(null);
  const [card, setCard] = useState<CardFields | null>(null);
  const [status, setStatus] = useState<string | null>(t('Reading the card'));
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const bmp = await decodeImage(file);
        const s = capLongest({ w: bmp.width, h: bmp.height }, 2400);
        const c = document.createElement('canvas');
        c.width = s.w;
        c.height = s.h;
        c.getContext('2d')!.drawImage(bmp, 0, 0, s.w, s.h);
        bmp.close();
        if (!alive) return;
        setUrl(c.toDataURL('image/jpeg', 0.85));
        const r = await readText(c, ['eng'], (pct, what) => alive && setStatus(what === 'download' ? `${t('Getting the text reader ready (one time only)…')} ${pct}%` : `${t('Reading the card')} ${pct}%`));
        if (!alive) return;
        const parsed = parseCard(r.text);
        setCard(parsed);
        if (!r.text) setNote(t('No text found on the card. Fill in the details yourself, or try a sharper photo.'));
      } catch {
        if (!alive) return;
        setCard(emptyCard());
        setNote(t('The card couldn\'t be read. Fill in the details yourself.'));
      }
      if (alive) setStatus(null);
    })();
    return () => {
      alive = false;
    };
  }, [file, t]);

  const set = (patch: Partial<CardFields>) => setCard((c) => (c ? { ...c, ...patch } : c));
  const lists = useMemo(
    () =>
      [
        ['phones', t('Phone'), 'tel'],
        ['emails', t('Email'), 'email'],
        ['websites', t('Website'), 'url'],
      ] as [ListKey, string, string][],
    [t],
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px] items-start">
      <section className="card p-3 sm:p-5 grid place-items-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- the card photo */}
        {url ? <img src={url} alt="" className="block max-w-full max-h-[60vh] rounded-md" /> : <Loader2 size={26} className="animate-spin text-primary my-20" aria-hidden="true" />}
      </section>
      <aside className="card p-5 flex flex-col gap-3 lg:sticky lg:top-20">
        {status || !card ? (
          <p className="flex items-center gap-2 text-[14px] text-secondary py-8 justify-center" role="status">
            <Loader2 size={18} className="animate-spin text-primary" aria-hidden="true" />
            {status}
          </p>
        ) : (
          <>
            {note && <p className="text-[13px] text-warning">{note}</p>}
            <p className="text-[13px] text-secondary">{t('Check the details. Cards are hard to read, so fix anything that came out wrong.')}</p>
            {(
              [
                ['name', t('Name')],
                ['title', t('Job title')],
                ['company', t('Company')],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="flex flex-col gap-1 text-[13px] font-semibold">
                {label}
                <input value={card[k]} onChange={(e) => set({ [k]: e.target.value })} dir="auto" className="min-h-11 rounded-tile bg-surface border border-line-strong px-3 text-[15px] font-normal" />
              </label>
            ))}
            {lists.map(([k, label, type]) => (
              <div key={k} className="flex flex-col gap-1.5">
                <span className="text-[13px] font-semibold">{label}</span>
                {(card[k].length ? card[k] : ['']).map((v, i) => (
                  <span key={i} className="flex gap-1.5">
                    <input
                      value={v}
                      type={type}
                      dir="ltr"
                      onChange={(e) => set({ [k]: (card[k].length ? card[k] : ['']).map((x, j) => (j === i ? e.target.value : x)) })}
                      aria-label={label}
                      className="flex-1 min-w-0 min-h-11 rounded-tile bg-surface border border-line-strong px-3 text-[15px]"
                    />
                    {card[k].length > 1 && (
                      <button type="button" onClick={() => set({ [k]: card[k].filter((_, j) => j !== i) })} aria-label={t('Remove')} className="size-11 rounded-full grid place-items-center hover:bg-fill">
                        <X size={16} aria-hidden="true" />
                      </button>
                    )}
                  </span>
                ))}
                <button type="button" onClick={() => set({ [k]: [...(card[k].length ? card[k] : ['']), ''] })} className="self-start inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline">
                  <Plus size={14} aria-hidden="true" />
                  {t('Add another')}
                </button>
              </div>
            ))}
            <label className="flex flex-col gap-1 text-[13px] font-semibold">
              {t('Address')}
              <textarea value={card.address} onChange={(e) => set({ address: e.target.value })} rows={2} dir="auto" className="rounded-tile bg-surface border border-line-strong px-3 py-2 text-[15px] font-normal" />
            </label>
            <Button arrow onClick={() => onStart({ card })} className="w-full mt-1">
              {t('Save contact')}
            </Button>
          </>
        )}
      </aside>
    </div>
  );
}
