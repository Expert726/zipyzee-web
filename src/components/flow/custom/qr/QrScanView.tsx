'use client';
// QR and barcode, Scan (the app's custom/qr/QrScan + ResultSheet, design/QrResult.dc.html): the camera with a green
// frame (back camera first; switch camera; torch where the phone allows), "Scan from a photo", or paste a screenshot
// (Ctrl+V). The first code found opens the result card with actions for its kind (src/tools/qr.ts): link, links,
// text, Wi-Fi, contact (.vcf), phone, email, product barcode.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Copy, ExternalLink, ImageIcon, Loader2, Mail, Phone, RefreshCw, Search, Share2, SwitchCamera, UserPlus, Zap } from 'lucide-react';
import { useT } from '@/i18n/client';
import { readCodes } from '@/lib/qrScan';
import { linksText } from '@/tools/qrLinks';
import { SCAN_LABEL, scanValue, toVcard, type ScanResult } from '@/tools/qr';
import { Button } from '../../../ui/Button';

const search = (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;

export function QrScanView() {
  const t = useT();
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [on, setOn] = useState(false);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [torch, setTorch] = useState<boolean | null>(null); // null: this camera has no torch
  const [result, setResult] = useState<ScanResult | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const photo = useRef<HTMLInputElement>(null);

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((tr) => tr.stop());
    stream.current = null;
    setOn(false);
  }, []);

  const start = useCallback(
    async (side = facing) => {
      setNote(null);
      stop();
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: side }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        stream.current = s;
        const v = video.current;
        if (v) {
          v.srcObject = s;
          await v.play().catch(() => {});
        }
        const caps = (s.getVideoTracks()[0]?.getCapabilities?.() ?? {}) as { torch?: boolean };
        setTorch(caps.torch ? false : null);
        setOn(true);
      } catch {
        setNote(t('Camera not available. Allow the camera for this site, or scan from a photo.'));
      }
    },
    [facing, stop, t],
  );

  // read the camera a few times a second until a code turns up
  useEffect(() => {
    if (!on || result) return;
    let alive = true;
    let timer = 0;
    const tick = async () => {
      const v = video.current;
      if (alive && v && v.readyState >= 2) {
        try {
          const [r] = await readCodes(v);
          if (r && alive) {
            setResult(r);
            navigator.vibrate?.(60);
            return;
          }
        } catch {
          // a frame the reader couldn't take: the next one
        }
      }
      if (alive) timer = window.setTimeout(tick, 250);
    };
    void tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [on, result]);

  useEffect(() => stop, [stop]);

  const fromImage = async (blob: Blob) => {
    setBusy(true);
    setNote(null);
    try {
      const bmp = await createImageBitmap(blob);
      const [r] = await readCodes(bmp);
      bmp.close();
      if (r) setResult(r);
      else setNote(t('No code found. Try a sharper photo with the whole code in it.'));
    } catch {
      setNote(t('Could not read this photo. Try another photo.'));
    }
    setBusy(false);
  };

  // a screenshot pasted with Ctrl+V / Cmd+V
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'));
      const f = item?.getAsFile();
      if (f) void fromImage(f);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  });

  const copy = async (text: string, label = t('Copied')) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      setNote(t('Couldn\'t copy. Select the text and copy it yourself.'));
    }
  };
  const share = (text: string) => (navigator.share ? navigator.share({ text }).catch(() => {}) : copy(text));
  const open = (url: string) => window.open(url, '_blank', 'noopener,noreferrer');
  const saveContact = (r: Extract<ScanResult, { kind: 'contact' }>) => {
    const url = URL.createObjectURL(new Blob([toVcard(r.contact)], { type: 'text/vcard' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(r.contact.name || 'contact').replace(/[^\w\s-]/g, '').trim() || 'contact'}.vcf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const actions = (r: ScanResult): { label: string; icon: typeof Copy; run: () => void; main?: boolean }[] => {
    const val = scanValue(r);
    const sh = { label: t('Share'), icon: Share2, run: () => void share(r.kind === 'link' ? r.url : val || r.raw) };
    switch (r.kind) {
      case 'link':
        return [{ label: t('Open link'), icon: ExternalLink, run: () => open(r.url), main: true }, { label: t('Copy'), icon: Copy, run: () => void copy(r.url) }, sh];
      case 'links':
        return [{ label: t('Copy all'), icon: Copy, run: () => void copy(linksText(r.page)) }, { label: t('Share'), icon: Share2, run: () => void share(linksText(r.page)) }];
      case 'text':
        return [{ label: t('Copy text'), icon: Copy, run: () => void copy(r.text), main: true }, sh, { label: t('Search'), icon: Search, run: () => open(search(r.text)) }];
      case 'wifi':
        return [
          ...(r.wifi.password ? [{ label: t('Copy password'), icon: Copy, run: () => void copy(r.wifi.password, t('Password copied')), main: true }] : []),
          { label: t('Copy network name'), icon: Copy, run: () => void copy(r.wifi.ssid) },
        ];
      case 'contact':
        return [{ label: t('Add to contacts'), icon: UserPlus, run: () => saveContact(r), main: true }, { label: t('Copy'), icon: Copy, run: () => void copy(r.raw) }, sh];
      case 'phone':
        return [{ label: t('Call'), icon: Phone, run: () => open(`tel:${r.phone}`), main: true }, { label: t('Copy'), icon: Copy, run: () => void copy(r.phone) }, sh];
      case 'email':
        return [{ label: t('Send email'), icon: Mail, run: () => open(`mailto:${r.email}`), main: true }, { label: t('Copy'), icon: Copy, run: () => void copy(r.email) }, sh];
      case 'product':
        return [{ label: t('Search'), icon: Search, run: () => open(search(r.code)), main: true }, { label: t('Copy'), icon: Copy, run: () => void copy(r.code) }, sh];
    }
  };

  const sub = (r: ScanResult) =>
    r.kind === 'wifi'
      ? r.wifi.password
        ? t('{security} network, password included', { security: r.wifi.security === 'NOPASS' ? t('Open') : r.wifi.security })
        : t('Open network')
      : r.kind === 'contact'
        ? [r.contact.phones[0], r.contact.emails[0], r.contact.org].filter(Boolean).join(', ')
        : r.kind === 'links'
          ? r.page.note
          : undefined;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] items-start">
      <section className="card p-3 sm:p-5 flex flex-col items-center gap-4">
        <div className="relative w-full max-w-xl aspect-[4/3] rounded-lg overflow-hidden bg-[#111]">
          <video ref={video} muted playsInline className={`absolute inset-0 size-full object-cover ${on ? '' : 'hidden'} ${facing === 'user' ? '-scale-x-100' : ''}`} />
          {on ? (
            <svg viewBox="0 0 240 240" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[55%] max-w-64 pointer-events-none" aria-hidden="true">
              <path d="M4 50V20a16 16 0 0 1 16-16h30M190 4h30a16 16 0 0 1 16 16v30M236 190v30a16 16 0 0 1-16 16h-30M50 236H20a16 16 0 0 1-16-16v-30" fill="none" stroke="#22C55E" strokeWidth="6" strokeLinecap="round" />
            </svg>
          ) : (
            <div className="absolute inset-0 grid place-items-center p-6 text-center">
              <div className="flex flex-col items-center gap-3">
                <Camera size={34} className="text-white/70" aria-hidden="true" />
                <Button onClick={() => void start()}>{t('Start camera')}</Button>
                <p className="text-[12px] text-white/60 max-w-xs">{t('Or scan from a photo, or paste a screenshot (Ctrl+V).')}</p>
              </div>
            </div>
          )}
          {on && (
            <div className="absolute top-2 end-2 flex gap-2">
              <button type="button" onClick={() => { const f = facing === 'user' ? 'environment' : 'user'; setFacing(f); void start(f); }} aria-label={t('Switch camera')} title={t('Switch camera')} className="size-10 rounded-full bg-black/55 text-white grid place-items-center">
                <SwitchCamera size={18} aria-hidden="true" />
              </button>
              {torch != null && (
                <button
                  type="button"
                  aria-pressed={torch}
                  onClick={async () => {
                    const track = stream.current?.getVideoTracks()[0];
                    await track?.applyConstraints({ advanced: [{ torch: !torch } as MediaTrackConstraintSet] }).catch(() => {});
                    setTorch(!torch);
                  }}
                  aria-label={t('Torch')}
                  title={t('Torch')}
                  className={`size-10 rounded-full grid place-items-center ${torch ? 'bg-[#CFF26B] text-black' : 'bg-black/55 text-white'}`}
                >
                  <Zap size={18} aria-hidden="true" />
                </button>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <input
            ref={photo}
            type="file"
            accept="image/*"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void fromImage(f);
            }}
          />
          <Button variant="secondary" onClick={() => photo.current?.click()}>
            {busy ? <Loader2 size={18} className="inline me-2 animate-spin" aria-hidden="true" /> : <ImageIcon size={18} aria-hidden="true" className="inline me-2" />}
            {t('Scan from a photo')}
          </Button>
          {on && (
            <Button variant="ghost" onClick={stop}>
              {t('Stop camera')}
            </Button>
          )}
        </div>
        {note && (
          <p className="text-[13px] text-warning text-center" role="status">
            {note}
          </p>
        )}
      </section>

      <aside className="card p-5 flex flex-col gap-4 lg:sticky lg:top-20" aria-live="polite" aria-label={t('Scan result')}>
        {!result ? (
          <p className="text-[14px] text-secondary">{t('Point the camera at a QR code or barcode. What it says shows here.')}</p>
        ) : (
          <>
            <div>
              <p className="text-[12px] font-semibold text-secondary uppercase tracking-wide">{SCAN_LABEL[result.kind]}</p>
              <p className="text-[17px] font-semibold break-words mt-1" dir="auto">
                {scanValue(result)}
              </p>
              {sub(result) && <p className="text-[13px] text-secondary mt-1">{sub(result)}</p>}
            </div>
            {result.kind === 'wifi' && result.wifi.password && (
              <p className="text-[13px] rounded-tile bg-fill p-3">
                {t('Password')}: <span className="font-mono font-semibold break-all">{result.wifi.password}</span>
                <span className="block text-[12px] text-secondary mt-1">{t('A browser can\'t join Wi-Fi by itself: copy the password and pick the network in your settings.')}</span>
              </p>
            )}
            {result.kind === 'links' && (
              <ul className="flex flex-col gap-2">
                {result.page.links.map((l, i) => (
                  <li key={i} className="flex items-center gap-2 rounded-row bg-fill p-2.5">
                    <span className="flex-1 min-w-0">
                      <span className="block font-medium text-[14px] truncate">{l.label}</span>
                      <span className="block text-[12px] text-secondary truncate" dir="ltr">{l.url}</span>
                    </span>
                    <button type="button" onClick={() => void copy(l.url)} aria-label={t('Copy {name}', { name: l.label })} className="size-9 rounded-full grid place-items-center hover:bg-fill-strong">
                      <Copy size={16} aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => open(l.url)} className="px-3 min-h-9 rounded-full lime-fill text-[13px] font-semibold">
                      {t('Open')}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-col gap-2">
              {actions(result).map((a) => (
                <Button key={a.label} variant={a.main ? 'primary' : 'secondary'} onClick={a.run}>
                  <a.icon size={17} aria-hidden="true" className="inline me-2" />
                  {a.label}
                </Button>
              ))}
            </div>
            {copied && <p className="text-[13px] text-success text-center" role="status">{copied}</p>}
            <Button variant="ghost" onClick={() => setResult(null)}>
              <RefreshCw size={17} aria-hidden="true" className="inline me-2" />
              {t('Scan again')}
            </Button>
          </>
        )}
      </aside>
    </div>
  );
}
