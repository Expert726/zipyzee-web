'use client';
// The result screen (the app's ResultStep, laid out for the web): the title, one big Download (or Download all),
// round actions (back to the options, share, start over), every file when there are several, then "Continue to…":
// tools that take this result, opened with the file already in them (src/lib/handoff.ts).
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, ChevronDown, ChevronRight, Download, Eye, FileText, Image as ImageIcon, RotateCcw, Share2, Smartphone } from 'lucide-react';
import { useLanguage, useT } from '@/i18n/client';
import { formatBytes } from '@/lib/format';
import { handOff } from '@/lib/handoff';
import { zipFiles } from '@/lib/zip';
import { allToolsFor, CONTINUE_FIRST, filesFor } from '@/tools/suggest';
import type { Tool, ToolResult } from '@/tools/types';
import { PLAY_URL } from '@/config';
import { FileViewer } from './FileViewer';

const asFiles = (r: ToolResult) => r.files.map((f) => new File([f.blob], f.name, { type: f.blob.type }));

export function Result({ tool, result, urls, onBack, onReset }: { tool: Tool; result: ToolResult; urls: string[]; onBack: () => void; onReset: () => void }) {
  const t = useT();
  const lang = useLanguage();
  const one = result.files.length === 1;
  const names = result.files.map((f) => f.name);
  const all = allToolsFor(tool, names);
  const next = all.slice(0, CONTINUE_FIRST);
  const pdfResult = names.every((n) => /\.pdf$/i.test(n));
  const [seeAll, setSeeAll] = useState(false);
  const total = result.files.reduce((n, f) => n + f.blob.size, 0);
  const [viewing, setViewing] = useState<number | null>(null);
  const shareable = typeof navigator !== 'undefined' && !!navigator.canShare?.({ files: asFiles(result) });

  // several files: one ZIP (src/lib/zip.ts), made once and kept for repeat clicks
  const [zipping, setZipping] = useState(false);
  const [zipUrl, setZipUrl] = useState<string | null>(null);
  const zipName = result.zipName ?? `${result.files[0]?.name.replace(/(-\d+)?\.[^.]+$/, '') || 'files'}.zip`;
  const downloadAll = async () => {
    let url = zipUrl;
    if (!url) {
      setZipping(true);
      try {
        url = URL.createObjectURL(await zipFiles(result.files));
        setZipUrl(url);
      } finally {
        setZipping(false);
      }
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = zipName;
    a.click();
  };
  useEffect(() => () => {
    if (zipUrl) URL.revokeObjectURL(zipUrl);
  }, [zipUrl]);
  const share = async () => {
    try {
      await navigator.share({ files: asFiles(result), title: result.title });
    } catch {
      // closed the share sheet
    }
  };

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="flex flex-col items-center text-center gap-2" role="status">
        <CheckCircle2 size={44} className="text-success" aria-hidden="true" />
        <h2 className="text-[26px] sm:text-[34px] font-semibold tracking-tight">{result.title}</h2>
        {result.subtitle && <p className="text-[16px] text-secondary">{result.subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        <Round label={t('Back to edit')} onClick={onBack} dark>
          <ArrowLeft size={20} className="flip-rtl" />
        </Round>
        {one ? (
          <a href={urls[0]} download={result.files[0].name} className="lime-fill rounded-[20px] min-h-16 sm:min-h-[72px] px-8 sm:px-12 inline-flex items-center gap-3 text-[18px] sm:text-[20px] font-semibold shadow-soft hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            <Download size={24} aria-hidden="true" />
            {t('Download')}
          </a>
        ) : (
          <button type="button" onClick={() => void downloadAll()} disabled={zipping} aria-busy={zipping} className="lime-fill rounded-[20px] min-h-16 sm:min-h-[72px] px-8 sm:px-12 inline-flex items-center gap-3 text-[18px] sm:text-[20px] font-semibold shadow-soft hover:brightness-95 disabled:opacity-70">
            <Download size={24} aria-hidden="true" />
            {t('Download all (ZIP)')}
          </button>
        )}
        <div className="flex flex-col gap-2">
          <Round label={t('Preview')} onClick={() => setViewing(0)}>
            <Eye size={18} />
          </Round>
          {shareable && (
            <Round label={t('Share')} onClick={share}>
              <Share2 size={18} />
            </Round>
          )}
          <Round label={t('Start over')} onClick={onReset}>
            <RotateCcw size={18} />
          </Round>
        </div>
      </div>
      <p className="text-[13px] text-secondary -mt-4 flex flex-wrap items-center justify-center gap-x-3">
        <span>{one ? `${result.files[0].name} · ${formatBytes(total)}` : t('{count} files · {size}', { count: result.files.length, size: formatBytes(total) })}</span>
        <button type="button" onClick={() => setViewing(0)} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
          <Eye size={15} aria-hidden="true" />
          {t('Preview')}
        </button>
      </p>
      {one && /\.(jpe?g|png|webp)$/i.test(result.files[0].name) && (
        <button type="button" onClick={() => setViewing(0)} aria-label={t('Preview')} className="card !rounded-row p-2 -mt-3 hover:outline-2 hover:outline-primary">
          {/* eslint-disable-next-line @next/next/no-img-element -- a local result */}
          <img src={urls[0]} alt="" className="max-h-56 max-w-[min(420px,80vw)] rounded-lg object-contain" />
        </button>
      )}

      {!one && (
        <ul className="w-full max-w-3xl flex flex-col gap-2">
          {result.files.map((f, i) => (
            <li key={i} className="card !rounded-row p-3 ps-4 flex items-center gap-3">
              <span className="size-10 shrink-0 rounded-tile bg-fill grid place-items-center" aria-hidden="true">
                {/\.pdf$/i.test(f.name) ? <FileText size={20} /> : <ImageIcon size={20} />}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block truncate font-medium text-[15px]" dir="auto">
                  {f.name}
                </span>
                <span className="block text-[12px] text-secondary">{formatBytes(f.blob.size)}</span>
              </span>
              <button type="button" onClick={() => setViewing(i)} aria-label={`${t('Preview')}: ${f.name}`} title={t('Preview')} className="size-10 rounded-full grid place-items-center border border-line-strong hover:bg-fill">
                <Eye size={16} aria-hidden="true" />
              </button>
              <a href={urls[i]} download={f.name} className="rounded-full min-h-10 px-4 inline-flex items-center gap-2 font-semibold text-sm border border-line-strong hover:bg-fill">
                <Download size={16} aria-hidden="true" />
                {t('Download')}
              </a>
            </li>
          ))}
        </ul>
      )}

      {all.length > 0 && (
        <section className="card w-full max-w-4xl p-5 sm:p-7" aria-labelledby="continue-to">
          <div className="flex items-center gap-3 mb-4">
            <h3 id="continue-to" className="text-[17px] font-semibold flex-1">
              {t('Continue to…')}
            </h3>
            {all.length > next.length && (
              <button
                type="button"
                aria-expanded={seeAll}
                aria-controls="continue-all"
                onClick={() => setSeeAll((v) => !v)}
                className="inline-flex items-center gap-1 min-h-9 px-3 rounded-full text-[14px] font-semibold text-primary hover:bg-fill"
              >
                {seeAll ? t('Show less') : t('See all ({count})', { count: all.length })}
                <ChevronDown size={18} className={`transition-transform ${seeAll ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>
            )}
          </div>
          <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
            {next.map((x) => (
              <li key={x.id}>
                <ContinueLink tool={x} lang={lang} onGo={() => handOff(x.id, filesFor(x, asFiles(result)))} />
              </li>
            ))}
          </ul>
          {seeAll && (
            <div id="continue-all" className="mt-4 pt-4 border-t border-line animate-[fade_0.25s_ease-out] motion-reduce:animate-none">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-secondary mb-2 px-3">
                {pdfResult ? t('All tools for PDFs') : t('All tools for photos')}
              </p>
              <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                {all
                  .filter((x) => !next.includes(x))
                  .map((x) => (
                    <li key={x.id}>
                      <ContinueLink tool={x} lang={lang} onGo={() => handOff(x.id, filesFor(x, asFiles(result)))} />
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <p className="w-full max-w-4xl flex items-center gap-3 rounded-row border border-line bg-info-soft px-4 py-3 text-[14px] text-info-ink">
        <Smartphone size={18} className="shrink-0" aria-hidden="true" />
        <span className="flex-1">{t('On your phone? ZipyZee for Android has scanning, chat and more tools.')}</span>
        <a href={PLAY_URL} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
          {t('Get the app')}
        </a>
      </p>
      {viewing != null && <FileViewer files={result.files} urls={urls} start={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

/** A tool in "Continue to…": opens it with the result already in it. */
function ContinueLink({ tool: x, lang, onGo }: { tool: Tool; lang: string; onGo: () => void }) {
  const t = useT();
  const Icon = x.icon;
  return (
    <Link
      href={`/${lang}/tools/${x.id}`}
      onClick={onGo}
      title={t('Continue to {name}', { name: t(x.name) })}
      className="group flex items-center gap-3 rounded-tile px-3 py-2.5 hover:bg-fill focus-visible:outline-2 focus-visible:outline-primary"
    >
      <span className="size-10 shrink-0 rounded-tile grid place-items-center bg-category-tint text-category">
        <Icon size={20} aria-hidden="true" />
      </span>
      <span className="flex-1 min-w-0 text-[15px] font-medium truncate group-hover:text-primary">{t(x.name)}</span>
      <ChevronRight size={18} className="flip-rtl text-secondary group-hover:text-primary" aria-hidden="true" />
    </Link>
  );
}

function Round({ label, onClick, dark, children }: { label: string; onClick: () => void; dark?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className={`size-11 rounded-full grid place-items-center shadow-soft focus-visible:outline-2 focus-visible:outline-primary ${dark ? 'bg-text text-background hover:opacity-90' : 'bg-surface border border-line hover:bg-fill'}`}>
      {children}
    </button>
  );
}
