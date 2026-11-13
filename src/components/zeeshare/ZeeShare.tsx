'use client';
// ZeeShare's page: pair two devices once (code + QR, Allow), then send text, photos and files both ways. The pairing
// stays until someone taps Disconnect: reloading or closing the page reconnects by itself. After it ends the chat stays,
// and the session continues with the same code (Continue on the host, Join again on the other). See src/zeeshare/session.ts.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, ArrowLeftRight, Check, CheckCheck, Clock, Copy, Download, ExternalLink, FileText, Loader2, Paperclip, Radio, RefreshCw, Send, ShieldCheck, Smartphone, Trash2, Unplug, X } from 'lucide-react';
import { useT } from '@/i18n/client';
import { ZeeSession, type Item, type Problem, type Snapshot } from '@/zeeshare/session';
import { cleanCode, onlyLink, RELAY_MAX_BYTES, showCode } from '@/zeeshare/protocol';
import { qrSvg } from '@/lib/qrDraw';
import { formatBytes } from '@/lib/format';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';

const IDLE: Snapshot = { state: 'idle', items: [] };

function useProblemText() {
  const t = useT();
  return (p?: Problem) =>
    p === 'notFound'
      ? t('No device is waiting with this code. Check the code on the other device.')
      : p === 'expired'
        ? t('This code has run out (codes work for 15 minutes). Make a new one.')
        : p === 'taken'
          ? t('Another device has already used this code. Make a new one.')
          : p === 'declined'
            ? t('The other device said no.')
            : p === 'unsupported'
              ? t('This browser can\'t connect to other devices. Try Chrome, Edge, Firefox or Safari.')
              : p === 'network'
                ? t('No internet connection. Try again.')
                : t('Something went wrong. Try again.');
}

function ItemView({ it, peer, onRetry }: { it: Item; peer: string; onRetry: () => void }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const link = it.kind === 'text' ? onlyLink(it.text ?? '') : null;
  const image = it.kind === 'file' && it.url && it.mime?.startsWith('image/');
  return (
    <li className={`flex flex-col max-w-[88%] ${it.mine ? 'self-end items-end' : 'self-start items-start'}`}>
      <div className={`rounded-2xl px-3.5 py-2.5 text-[14px] flex flex-col gap-2 ${it.mine ? 'lime-fill rounded-ee-md' : 'bg-fill rounded-ss-md'}`}>
        {it.kind === 'text' &&
          (link ? (
            <a href={link} target="_blank" rel="noopener noreferrer" className="underline break-all inline-flex items-center gap-1.5" dir="ltr">
              <ExternalLink size={14} aria-hidden="true" className="shrink-0" />
              {link}
            </a>
          ) : (
            <p className="whitespace-pre-wrap break-words" dir="auto">
              {it.text}
            </p>
          ))}
        {it.kind === 'file' && (
          <>
            {image && (
              // eslint-disable-next-line @next/next/no-img-element -- a shared photo (an object URL)
              <img src={it.url} alt={it.name ?? ''} className="max-h-72 max-w-full rounded-lg object-contain bg-black/5" />
            )}
            <span className="flex items-center gap-2 min-w-0">
              {!image && <FileText size={18} aria-hidden="true" className="shrink-0" />}
              <span className="min-w-0">
                <span className="block font-semibold truncate max-w-[16rem]" dir="auto">
                  {it.name}
                </span>
                <span className="block text-[12px] opacity-70">{formatBytes(it.size ?? 0)}</span>
              </span>
            </span>
            {!it.done && !it.failed && (
              <span className="block h-1.5 w-48 max-w-full rounded-full bg-black/10 overflow-hidden" role="progressbar" aria-valuenow={Math.round(it.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
                <span className="block h-full bg-primary transition-[width]" style={{ width: `${Math.round(it.progress * 100)}%` }} />
              </span>
            )}
          </>
        )}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-secondary">
        {it.failed === 'tooBig' ? (
          <span className="text-error inline-flex items-center gap-1">
            <AlertCircle size={13} aria-hidden="true" />
            {t('Too big without a direct link (up to {size}).', { size: formatBytes(RELAY_MAX_BYTES) })}
          </span>
        ) : it.failed ? (
          <button type="button" onClick={onRetry} className="text-error inline-flex items-center gap-1 hover:underline">
            <AlertCircle size={13} aria-hidden="true" />
            {t('Not sent. Tap to try again.')}
          </button>
        ) : it.mine ? (
          it.delivered ? (
            <span className="inline-flex items-center gap-1">
              <CheckCheck size={14} aria-hidden="true" />
              {t('Received')}
            </span>
          ) : it.waiting ? (
            <span className="inline-flex items-center gap-1">
              <Clock size={13} aria-hidden="true" />
              {t('Waiting for {device}', { device: peer })}
            </span>
          ) : it.done ? (
            <span className="inline-flex items-center gap-1">
              <Check size={14} aria-hidden="true" />
              {t('Sent')}
            </span>
          ) : (
            <span>{t('Sending {percent}%', { percent: Math.round(it.progress * 100) })}</span>
          )
        ) : null}
        {it.kind === 'text' && (
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(it.text ?? '').then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              });
            }}
            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
          >
            {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
            {copied ? t('Copied') : t('Copy')}
          </button>
        )}
        {it.kind === 'file' && it.url && it.done && (
          <a href={it.url} download={it.name} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
            <Download size={13} aria-hidden="true" />
            {t('Download')}
          </a>
        )}
      </div>
    </li>
  );
}

export function ZeeShare({ lang }: { lang: string }) {
  const t = useT();
  const problemText = useProblemText();
  const [session] = useState(() => new ZeeSession());
  const snap = useSyncExternalStore(session.subscribe, session.get, () => IDLE);
  const params = useSearchParams();
  const [typed, setTyped] = useState('');
  const [text, setText] = useState('');
  const [dragging, setDragging] = useState(false);
  const [askEnd, setAskEnd] = useState(false);
  const [askClear, setAskClear] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  // opening the page: back into the saved session, or join from a scanned QR (/zeeshare?join=123456)
  const fromLink = cleanCode(params.get('join') ?? '');
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void session.restore().then((had) => {
      if (!had && fromLink) void session.join(fromLink);
    });
    if (fromLink) window.history.replaceState(null, '', `/${lang}/zeeshare`);
  }, [fromLink, session, lang]);

  // the session outlives the page: leaving only closes the link; back online / back to the tab reconnects
  useEffect(() => {
    const away = () => session.suspend();
    const back = () => document.visibilityState === 'visible' && session.nudge();
    window.addEventListener('pagehide', away);
    window.addEventListener('online', back);
    document.addEventListener('visibilitychange', back);
    return () => {
      window.removeEventListener('pagehide', away);
      window.removeEventListener('online', back);
      document.removeEventListener('visibilitychange', back);
    };
  }, [session]);
  useEffect(() => () => session.suspend(), [session]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [snap.items.length]);

  const connected = snap.state === 'connected';
  const peer = snap.peer ?? '';
  const send = () => {
    if (!text.trim()) return;
    session.sendText(text);
    setText('');
  };
  const addFiles = (list: FileList | File[] | null | undefined) => {
    const files = [...(list ?? [])];
    if (files.length && connected) session.sendFiles(files);
  };
  const joinTyped = () => {
    const code = cleanCode(typed);
    if (code) void session.join(code);
  };
  const qr = snap.code && snap.state === 'waiting' ? qrSvg(`${window.location.origin}/${lang}/zeeshare?join=${snap.code}`, { ink: '#111827', background: '#FFFFFF' }) : null;

  // ---------- start ----------
  if (snap.state === 'idle')
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <section className="card p-6 flex flex-col gap-4">
          <span className="size-12 rounded-tile lime-fill grid place-items-center">
            <Radio size={24} aria-hidden="true" />
          </span>
          <h2 className="text-[20px] font-semibold">{t('Share from this device')}</h2>
          <p className="text-[14px] text-secondary">{t('Get a code, then type it on the other device or scan its QR code with the phone\'s camera.')}</p>
          <Button arrow onClick={() => void session.host()}>
            {t('Get a code')}
          </Button>
        </section>
        <section className="card p-6 flex flex-col gap-4">
          <span className="size-12 rounded-tile bg-fill grid place-items-center">
            <Smartphone size={24} aria-hidden="true" />
          </span>
          <h2 className="text-[20px] font-semibold">{t('Have a code?')}</h2>
          <p className="text-[14px] text-secondary">{t('Type the 6 digits shown on the other device.')}</p>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              joinTyped();
            }}
          >
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value.replace(/[^\d ]/g, '').slice(0, 7))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123 456"
              aria-label={t('Code')}
              dir="ltr"
              className="flex-1 min-w-0 min-h-12 rounded-full bg-surface border border-line-strong px-5 text-[20px] font-semibold tracking-[0.2em] text-center"
            />
            <Button type="submit" disabled={!cleanCode(typed)}>
              {t('Connect')}
            </Button>
          </form>
        </section>
        <p className="md:col-span-2 flex items-start gap-2 text-[13px] text-secondary px-1">
          <ShieldCheck size={16} aria-hidden="true" className="shrink-0 mt-0.5 text-primary" />
          {t('Works between any two devices with a browser: phone and computer, or two computers. No account needed. The two stay paired until one taps Disconnect, even after closing the page. Files go straight from one device to the other.')}
        </p>
      </div>
    );

  // ---------- pairing ----------
  if (snap.state === 'waiting' && snap.code)
    return (
      <section className="card p-6 sm:p-8 max-w-xl mx-auto w-full flex flex-col items-center gap-5 text-center">
        <h2 className="text-[20px] font-semibold">{snap.continuing ? t('Waiting for {device}', { device: peer }) : t('Connect the other device')}</h2>
        <p className="text-[14px] text-secondary">
          {snap.continuing
            ? t('On {device}, open ZeeShare and tap Join again. Or type this code there.', { device: peer })
            : t('On the other device, open ZeeShare and type this code, or scan the QR code with the phone\'s camera.')}
        </p>
        <p className="text-[44px] font-semibold tracking-[0.15em] tabular-nums" dir="ltr" aria-label={snap.code.split('').join(' ')}>
          {showCode(snap.code)}
        </p>
        {qr && <div className="size-52 rounded-xl bg-white p-3 border border-line [&>svg]:size-full" aria-label={t('QR code')} role="img" dangerouslySetInnerHTML={{ __html: qr }} />}
        <p className="inline-flex items-center gap-2 text-[13px] text-secondary">
          <Loader2 size={15} className="animate-spin" aria-hidden="true" />
          {t('Waiting for the other device... The code works for 15 minutes.')}
        </p>
        <Button variant="secondary" onClick={() => session.reset()}>
          {t('Cancel')}
        </Button>
      </section>
    );

  if (snap.state === 'asking')
    return (
      <section className="card p-6 sm:p-8 max-w-md mx-auto w-full flex flex-col items-center gap-4 text-center" role="alertdialog" aria-labelledby="zs-ask">
        <span className="size-14 rounded-full lime-fill grid place-items-center">
          <ArrowLeftRight size={26} aria-hidden="true" />
        </span>
        <h2 id="zs-ask" className="text-[20px] font-semibold">
          {t('{device} wants to connect', { device: peer })}
        </h2>
        <p className="text-[14px] text-secondary">{t('Allow it only if this is your device or someone you\'re sharing with right now.')}</p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => void session.decline()}>
            {t('Decline')}
          </Button>
          <Button arrow onClick={() => void session.accept()}>
            {t('Allow')}
          </Button>
        </div>
      </section>
    );

  if (snap.state === 'creating' || snap.state === 'joining' || snap.state === 'waitingAccept' || snap.state === 'connecting' || snap.state === 'restoring')
    return (
      <section className="card p-8 max-w-md mx-auto w-full flex flex-col items-center gap-4 text-center">
        <Loader2 size={30} className="animate-spin text-primary" aria-hidden="true" />
        <p className="text-[16px] font-semibold">
          {snap.state === 'creating'
            ? t('Getting a code...')
            : snap.state === 'joining'
              ? t('Looking for the device...')
              : snap.state === 'waitingAccept'
                ? snap.continuing
                  ? t('Reconnecting to {device}...', { device: peer })
                  : t('Tap Allow on {device}', { device: peer })
                : snap.state === 'restoring'
                  ? t('Reconnecting to {device}...', { device: peer })
                  : t('Connecting...')}
        </p>
        {snap.state !== 'restoring' && (
          <Button variant="secondary" onClick={() => session.reset()}>
            {t('Cancel')}
          </Button>
        )}
      </section>
    );

  if (snap.state === 'error')
    return (
      <section className="card p-8 max-w-md mx-auto w-full flex flex-col items-center gap-4 text-center" role="alert">
        <AlertCircle size={30} className="text-error" aria-hidden="true" />
        <p className="text-[16px] font-semibold">
          {snap.continuing && snap.problem === 'notFound' ? t('{device} hasn\'t reopened the code yet. On {device}, tap Continue, then Join again here.', { device: peer }) : problemText(snap.problem)}
        </p>
        <Button
          arrow
          onClick={() => {
            session.reset();
            void session.showLast();
          }}
        >
          {snap.continuing ? t('Back') : t('Start again')}
        </Button>
      </section>
    );

  // ---------- paired (or just ended: what was shared stays on screen) ----------
  return (
    <section
      className={`card flex flex-col h-[calc(100dvh-12rem)] min-h-[30rem] overflow-hidden ${dragging ? 'ring-3 ring-primary' : ''}`}
      onDragOver={(e) => {
        if (!connected) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        addFiles(e.dataTransfer.files);
      }}
    >
      <header className="flex items-center gap-3 px-4 py-3 border-b border-line">
        <span className={`relative size-10 rounded-full grid place-items-center shrink-0 ${connected ? 'lime-fill' : 'bg-fill'}`}>
          {connected ? <ArrowLeftRight size={18} aria-hidden="true" /> : <Unplug size={18} aria-hidden="true" />}
          {connected && <span className={`absolute -bottom-0.5 -end-0.5 size-3.5 rounded-full border-2 border-surface ${snap.link === 'direct' ? 'bg-success' : 'bg-warning-text'}`} aria-hidden="true" />}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-semibold truncate">{connected ? t('Paired with {device}', { device: peer }) : snap.endedByOther ? t('{device} ended the session', { device: peer || t('The other device') }) : t('Session ended')}</span>
          <span className="block text-[12px] text-secondary">
            {!connected
              ? snap.role === 'host'
                ? t('What was shared stays here. Tap Continue to open the same code again; {device} taps Join again.', { device: peer || t('The other device') })
                : t('What was shared stays here. When {device} taps Continue, tap Join again.', { device: peer || t('The other device') })
              : snap.link === 'direct'
                ? t('Direct link: files go straight between the devices, any size.')
                : t('{device} isn\'t linked right now. What you send waits for it (files up to {size}).', { device: peer, size: formatBytes(RELAY_MAX_BYTES) })}
          </span>
        </span>
        {connected ? (
          <Button variant="secondary" onClick={() => setAskEnd(true)}>
            <X size={16} aria-hidden="true" className="inline me-1" />
            {t('Disconnect')}
          </Button>
        ) : (
          <span className="flex items-center gap-1 shrink-0">
            <button type="button" onClick={() => setAskClear(true)} aria-label={t('Clear history')} title={t('Clear history')} className="size-10 rounded-full grid place-items-center hover:bg-fill">
              <Trash2 size={18} aria-hidden="true" />
            </button>
            {snap.code ? (
              <Button arrow onClick={() => session.continueLast()}>
                <RefreshCw size={16} aria-hidden="true" className="inline me-1.5" />
                {snap.role === 'host' ? t('Continue') : t('Join again')}
              </Button>
            ) : (
              <Button onClick={() => void session.clearHistory()}>{t('Share again')}</Button>
            )}
          </span>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {!snap.items.length && (
          <p className="h-full grid place-items-center text-center text-[14px] text-secondary max-w-sm mx-auto">{t('Type a message, or add photos and files. You can also drop them here or paste a picture.')}</p>
        )}
        <ul className="flex flex-col gap-3">
          {snap.items.map((it) => (
            <ItemView key={it.id} it={it} peer={peer} onRetry={() => session.retry(it.id)} />
          ))}
        </ul>
        <div ref={bottom} />
      </div>

      {connected && (
        <form
          className="flex items-end gap-2 p-3 border-t border-line"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <button type="button" onClick={() => fileInput.current?.click()} aria-label={t('Add photos or files')} title={t('Add photos or files')} className="size-11 rounded-full grid place-items-center hover:bg-fill shrink-0">
            <Paperclip size={20} aria-hidden="true" />
          </button>
          <input
            ref={fileInput}
            type="file"
            multiple
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
            onPaste={(e) => {
              const files = [...e.clipboardData.files];
              if (files.length) {
                e.preventDefault();
                addFiles(files);
              }
            }}
            rows={1}
            placeholder={t('Type or paste text, a link, a code...')}
            aria-label={t('Message')}
            dir="auto"
            className="flex-1 min-w-0 max-h-40 min-h-11 rounded-3xl bg-fill px-4 py-2.5 text-[15px] resize-none field-sizing-content"
          />
          <button type="submit" disabled={!text.trim()} aria-label={t('Send')} className="size-11 rounded-full lime-fill grid place-items-center shrink-0 disabled:opacity-40">
            <Send size={18} aria-hidden="true" className="flip-rtl" />
          </button>
        </form>
      )}

      <ConfirmDialog
        open={askEnd}
        icon={<Unplug size={22} aria-hidden="true" />}
        title={t('Disconnect from {device}?', { device: peer })}
        body={t('The session ends on both devices. What was shared stays here, and you can continue later with the same code.')}
        confirm={t('Disconnect')}
        danger
        onCancel={() => setAskEnd(false)}
        onConfirm={() => {
          setAskEnd(false);
          void session.disconnect();
        }}
      />
      <ConfirmDialog
        open={askClear}
        icon={<Trash2 size={22} aria-hidden="true" />}
        title={t('Clear this chat?')}
        body={t('Everything shared with {device} is removed from this browser, and the next share starts fresh with a new code.', { device: peer || t('The other device') })}
        confirm={t('Clear history')}
        danger
        onCancel={() => setAskClear(false)}
        onConfirm={() => {
          setAskClear(false);
          void session.clearHistory();
        }}
      />
    </section>
  );
}
