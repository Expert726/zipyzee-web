'use client';
// A picked file's preview in the options step's list: the photo itself (on a checkerboard, so a see-through PNG
// shows as one) with its size in pixels, or page 1 of a PDF. Click it to see it full size (FileViewer).
import { useState } from 'react';
import { FileText } from 'lucide-react';
import { useT } from '@/i18n/client';
import { usePdfThumbs } from '@/lib/usePdfThumbs';
import { FileViewer } from './FileViewer';
import { useObjectUrl, useObjectUrls } from '@/lib/objectUrls';

export const isPhoto = (f: File) => /^image\//.test(f.type) || /\.(jpe?g|png|webp|gif|bmp|avif|heic|heif)$/i.test(f.name);
const isPdfFile = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);

const BOX = 'size-14 shrink-0 rounded-tile overflow-hidden grid place-items-center';
const CHECKER = 'bg-[repeating-conic-gradient(#e5e7eb_0_25%,#fff_0_50%)] bg-[length:10px_10px]';

/** The thumbnail (a button when it can open full size) and, for photos, "W × H" through onSize. */
export function PickedPreview({ file, onOpen, onSize }: { file: File; onOpen?: () => void; onSize?: (s: string) => void }) {
  const t = useT();
  const photo = isPhoto(file);
  const url = useObjectUrl(photo ? file : null);
  const [broken, setBroken] = useState(false);

  if (isPdfFile(file)) return <PdfThumb file={file} onOpen={onOpen} />;
  if (!url || broken) {
    return (
      <span className={`${BOX} bg-surface text-text`} aria-hidden="true">
        <FileText size={20} />
      </span>
    );
  }
  return (
    <button type="button" onClick={onOpen} className={`${BOX} ${CHECKER} hover:opacity-90 focus-visible:outline-2 focus-visible:outline-primary`} aria-label={t('Preview {name}', { name: file.name })} title={t('Preview')}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a photo picked in this browser */}
      <img
        src={url}
        alt=""
        className="size-full object-contain"
        onLoad={(e) => onSize?.(`${e.currentTarget.naturalWidth} × ${e.currentTarget.naturalHeight}`)}
        onError={() => setBroken(true)}
      />
    </button>
  );
}

function PdfThumb({ file, onOpen }: { file: File; onOpen?: () => void }) {
  const t = useT();
  const pages = usePdfThumbs(file, 40, 1);
  const first = pages.urls[0];
  return (
    <button type="button" onClick={onOpen} className={`${BOX} bg-paper border border-line hover:opacity-90 focus-visible:outline-2 focus-visible:outline-primary`} aria-label={t('Preview {name}', { name: file.name })} title={t('Preview')}>
      {first ? (
        // eslint-disable-next-line @next/next/no-img-element -- page 1, drawn in the browser
        <img src={first} alt="" className="size-full object-contain" />
      ) : (
        <FileText size={20} className="text-secondary" aria-hidden="true" />
      )}
    </button>
  );
}

/** The picked files full size (photos as they are, PDFs in the browser's viewer), starting at `start`. */
export function PickedViewer({ files, start, onClose }: { files: File[]; start: number; onClose: () => void }) {
  const urls = useObjectUrls(files);
  return <FileViewer files={files.map((f) => ({ name: f.name, blob: f }))} urls={urls as string[]} start={start} onClose={onClose} />;
}
