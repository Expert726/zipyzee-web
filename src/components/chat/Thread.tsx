'use client';
// One chat (the app's screens/chats/ChatThreadScreen + thread/Bubble): messages oldest to newest with day headings;
// text (links clickable), link cards, files (photos shown, others downloaded), voice messages (played here; heard by
// everyone = gone in a minute); my messages: Seen ticks, Edit within 5 minutes, Delete for everyone. Opening it clears
// my unread count; messages everyone has seen are moved to "1 hour" (not in the ZipyZee Team chat), expired ones are
// removed: all as in the app, on the same data.
import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, Check, CheckCheck, Clock, Download, ExternalLink, FileText, Loader2, Paperclip, Pause, Pencil, Play, Send, Timer, Trash2, X } from 'lucide-react';
import { useT } from '@/i18n/client';
import { MAX_CHAT_FILE_MB } from '@/config';
import { ChatError, newMessageId, reconnect, watchProfile, deleteExpired, deleteMessage, editMessage, markHeard, markRead, readFile, sendFile, sendLink, sendText, shortenSeen, watchMessages } from '@/chat/firebase';
import { canEdit, clockText, dayLabel, fileMeta, hoursLeft, isExpired, isSupportChat, parseLink, sameDay, seenToShorten, SUPPORT_DAYS, timeOfDay } from '@/chat/format';
import type { Chat, Message, Profile } from '@/chat/types';
import { formatBytes } from '@/lib/format';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Avatar } from './Avatar';

const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g;

/** Text with its web links clickable. */
function Linked({ text }: { text: string }) {
  const parts = text.split(URL_RE);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 ? (
          <a key={i} href={p} target="_blank" rel="noopener noreferrer" className="underline break-all">
            {p}
          </a>
        ) : (
          p
        ),
      )}
    </>
  );
}

function FileBody({ chatId, m, mine }: { chatId: string; m: Message; mine: boolean }) {
  const t = useT();
  const f = m.file!;
  const image = /^image\/(jpeg|png|webp|gif|avif)$/.test(f.mimeType);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!image) return;
    let alive = true;
    let made: string | null = null;
    void readFile(chatId, m.id, f)
      .then((b) => {
        made = URL.createObjectURL(b);
        if (alive) setUrl(made);
      })
      .catch(() => alive && setError(t('This file has been deleted.')));
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [chatId, m.id, f, image, t]);

  const download = async () => {
    setBusy(true);
    try {
      const blob = await readFile(chatId, m.id, f);
      const u = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = u;
      a.download = f.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(u), 3000);
    } catch (e) {
      setError(e instanceof ChatError ? e.message : t('Could not open it'));
    }
    setBusy(false);
  };

  return (
    <div className="flex flex-col gap-1.5 min-w-48">
      {image &&
        (url ? (
          // eslint-disable-next-line @next/next/no-img-element -- a photo sent in the chat
          <img src={url} alt={f.name} className="max-w-full max-h-72 rounded-lg object-contain bg-black/5" />
        ) : !error ? (
          <span className="h-40 w-56 rounded-lg bg-black/5 grid place-items-center">
            <Loader2 size={18} className="animate-spin opacity-60" aria-hidden="true" />
          </span>
        ) : null)}
      <div className="flex items-center gap-2.5">
        {!image && <FileText size={26} className="shrink-0 opacity-80" aria-hidden="true" />}
        <span className="flex-1 min-w-0">
          <span className="block truncate font-medium text-[14px]" dir="auto">
            {f.name}
          </span>
          <span className={`block text-[11px] ${mine ? 'opacity-75' : 'text-secondary'}`}>{fileMeta(f.size, f.pages, formatBytes)}</span>
        </span>
        {m.allowSave !== false && (
          <button type="button" onClick={() => void download()} disabled={busy} aria-label={t('Save to Downloads')} title={t('Save to Downloads')} className="size-9 rounded-full grid place-items-center bg-black/10 hover:bg-black/15 shrink-0">
            {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}
          </button>
        )}
      </div>
      {error && <span className="text-[12px] opacity-80">{error}</span>}
    </div>
  );
}

function VoiceBody({ chatId, m, onHeard }: { chatId: string; m: Message; onHeard: () => void }) {
  const t = useT();
  const audio = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'playing'>('idle');
  const [left, setLeft] = useState(m.duration ?? 0);
  const play = async () => {
    if (state === 'playing') {
      audio.current?.pause();
      setState('idle');
      return;
    }
    if (!audio.current) {
      setState('loading');
      try {
        const blob = await readFile(chatId, m.id, m.file!);
        const a = new Audio(URL.createObjectURL(blob));
        a.ontimeupdate = () => setLeft(Math.max(0, (a.duration || m.duration || 0) - a.currentTime));
        a.onended = () => {
          setState('idle');
          onHeard();
        };
        audio.current = a;
      } catch {
        setState('idle');
        return;
      }
    }
    await audio.current.play().catch(() => {});
    setState('playing');
  };
  useEffect(() => () => audio.current?.pause(), []);
  return (
    <div className="flex items-center gap-3 min-w-48">
      <button type="button" onClick={() => void play()} aria-label={state === 'playing' ? t('Pause') : t('Play')} className="size-10 rounded-full grid place-items-center bg-black/10 hover:bg-black/15">
        {state === 'loading' ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : state === 'playing' ? <Pause size={17} aria-hidden="true" /> : <Play size={17} aria-hidden="true" />}
      </button>
      <span className="text-[13px] font-medium">🎤 {clockText(left)}</span>
    </div>
  );
}

export function Thread({ chatId, chat, me, support, title, profiles, onBack }: { chatId: string; chat?: Chat; me: string; myName: string; support: string | null; title: string; profiles: Record<string, Profile | null>; onBack: () => void }) {
  const t = useT();
  const [msgs, setMsgs] = useState<Message[] | null>(null);
  const [text, setText] = useState('');
  const [editing, setEditing] = useState<Message | null>(null);
  const [toDelete, setToDelete] = useState<Message | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const bottom = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const removing = useRef(new Set<string>());
  const isSupport = isSupportChat(chatId, support);
  const directOther = chat?.type === 'direct' ? chat.members.find((u) => u !== me) : undefined;
  const [liveOther, setLiveOther] = useState<Profile | null>(null);
  useEffect(() => (directOther ? watchProfile(directOther, setLiveOther) : undefined), [directOther]);

  useEffect(() => watchMessages(chatId, setMsgs, () => setError(t('Messages could not load'))), [chatId, t]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // a dead connection (sleep, Wi-Fi change, a frozen background tab) leaves writes queued for ever: restart Firestore's
  // connection when my message waits more than a few seconds, when the tab is shown again and when the network is back
  // messages I sent from this page, shown at once (🕓) until the server's copy arrives in `msgs`
  const [outbox, setOutbox] = useState<Message[]>([]);
  useEffect(() => {
    const wake = () => {
      if (document.visibilityState === 'visible') void reconnect().catch(() => {});
    };
    window.addEventListener('online', wake);
    document.addEventListener('visibilitychange', wake);
    return () => {
      window.removeEventListener('online', wake);
      document.removeEventListener('visibilitychange', wake);
    };
  }, []);

  const live = useMemo(() => {
    const server = (msgs ?? []).filter((m) => !isExpired(m.expiresAt, now)).reverse();
    const have = new Set(server.map((m) => m.id));
    return [...server, ...outbox.filter((m) => !have.has(m.id))];
  }, [msgs, outbox, now]);

  // expired messages go for everyone; opening clears my unread count; seen ones move to "1 hour"
  useEffect(() => {
    for (const m of msgs ?? []) {
      if (!isExpired(m.expiresAt, now) || removing.current.has(m.id)) continue;
      removing.current.add(m.id);
      void deleteExpired(chatId, m).catch(() => {});
    }
  }, [msgs, now, chatId]);
  const unreadForMe = chat?.unread[me] ?? 0;
  useEffect(() => {
    if (document.visibilityState === 'visible') void markRead(chatId, me).catch(() => {});
  }, [chatId, me, unreadForMe, msgs?.length]);
  useEffect(() => {
    if (!chat || !msgs || isSupport) return;
    const due = seenToShorten(msgs, chat.members, chat.readAt, me, Date.now());
    if (due.length) void shortenSeen(chatId, due, chat.last?.id).catch(() => {});
  }, [msgs, chat, me, chatId, isSupport]);
  // braces: Chrome's scrollIntoView now returns a Promise, and an effect may only return a clean-up function
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [live.length]);

  const others = (chat?.members ?? []).filter((u) => u !== me);
  const other = others.length === 1 ? liveOther ?? profiles[others[0]] : undefined;
  const status = isSupport
    ? t('Messages and files here delete after {days} days', { days: SUPPORT_DAYS })
    : chat?.type === 'group'
      ? t('{count} members', { count: chat.members.length })
      : other?.lastSeen && now - other.lastSeen < 3 * 60_000
        ? t('Online')
        : other
          ? `@${other.username}`
          : '';
  // 🕓 sending -> ✓ sent -> ✓✓ delivered (they've been online since) -> green ✓✓ seen (they opened the chat)
  const seenByAll = (m: Message) => others.length > 0 && others.every((u) => (chat?.readAt[u] ?? 0) >= m.createdAt);
  const deliveredToAll = (m: Message) => others.length > 0 && others.every((u) => (chat?.readAt[u] ?? 0) >= m.createdAt || ((u === others[0] && liveOther?.lastSeen) || profiles[u]?.lastSeen || 0) >= m.createdAt);

  // like WhatsApp: the box clears and the message shows at once (🕓 until the server has it); no waiting here
  const send = () => {
    const body = text.trim();
    if (!body) return;
    setError(null);
    setText('');
    const failed = () => {
      setError(t('Not sent. Check your connection and try again.'));
      setText((cur) => cur || body);
    };
    if (editing) {
      setEditing(null);
      void editMessage(chatId, editing.id, body).catch(failed);
      return;
    }
    const link = parseLink(body);
    const asLink = !!link && link.url === body.replace(/\s+/g, '');
    // eslint-disable-next-line react-hooks/purity -- runs on Send, not during render
    const at = Date.now();
    const m: Message = { id: newMessageId(chatId), from: me, kind: asLink ? 'link' : 'text', ...(asLink ? { link } : { text: body }), createdAt: at, expiresAt: at + 24 * 3600_000, viewOnce: false, allowSave: true, opened: false, pending: true };
    setOutbox((o) => [...o, m]);
    deliver(m);
  };

  /** Sends an outbox message (again); a failure marks it red with the reason, tap it to try again. */
  const deliver = (m: Message) => {
    setOutbox((o) => o.map((x) => (x.id === m.id ? { ...x, failed: false } : x)));
    const known = chat ? { members: chat.members, support } : undefined;
    const sent = m.kind === 'link' && m.link ? sendLink(chatId, me, m.link, undefined, known, m.id) : sendText(chatId, me, m.text ?? '', known, m.id);
    sent.catch((e: unknown) => {
      setOutbox((o) => o.map((x) => (x.id === m.id ? { ...x, failed: true } : x)));
      const status = (e as { status?: string })?.status;
      setError(
        status === 'RESOURCE_EXHAUSTED'
          ? t('Chat has reached today\'s free limit. Try again later.')
          : status === 'PERMISSION_DENIED'
            ? t('This message wasn\'t allowed. You may have been removed from this chat.')
            : t('Not sent. Check your connection and try again.'),
      );
    });
  };

  const attach = async (f: File) => {
    if (f.size > MAX_CHAT_FILE_MB * 1024 * 1024) return setError(t('Files up to {mb} MB can be sent.', { mb: MAX_CHAT_FILE_MB }));
    setSending(true);
    setError(null);
    try {
      await sendFile(chatId, me, f);
    } catch (e) {
      setError(e instanceof ChatError ? e.message : t('Could not send the file. Try again.'));
    }
    setSending(false);
  };

  return (
    <div className="card flex flex-col h-[calc(100dvh-7rem)] min-h-[28rem] overflow-hidden">
      <header className="flex items-center gap-3 px-3 py-2.5 border-b border-line">
        <button type="button" onClick={onBack} aria-label={t('Back')} className="size-10 rounded-full grid place-items-center hover:bg-fill lg:hidden">
          <ArrowLeft size={19} aria-hidden="true" className="flip-rtl" />
        </button>
        <Avatar uid={isSupport ? 'zipyzee' : chat?.type === 'group' ? chatId : others[0] ?? ''} name={title} team={isSupport} group={chat?.type === 'group'} />
        <span className="min-w-0">
          <span className="block font-semibold truncate" dir="auto">
            {title}
          </span>
          <span className={`block text-[12px] truncate ${status === t('Online') ? 'text-success' : 'text-secondary'}`}>{status}</span>
        </span>
      </header>

      <div className="flex-1 overflow-y-auto px-3 sm:px-5 py-4 flex flex-col gap-1.5" aria-live="polite">
        {msgs == null ? (
          <Loader2 size={22} className="animate-spin text-primary m-auto" aria-label={t('Loading messages')} />
        ) : (
          <>
            {/* the auto-delete disclaimer, like the app's pill at the top of a thread */}
            <p className="self-center mb-2 max-w-md flex items-start gap-1.5 rounded-xl bg-warning-soft/70 px-3 py-2 text-center text-[12px] text-secondary">
              <Timer size={14} aria-hidden="true" className="shrink-0 mt-px" />
              <span>{isSupport ? t('Messages and files here delete after {days} days', { days: SUPPORT_DAYS }) : t('Once seen, messages, files and links delete after 1 hour. Not seen, after 24 hours. You can delete them sooner.')}</span>
            </p>
            {isSupport && (
              <div className="self-start max-w-[80%] rounded-2xl rounded-ss-md bg-fill px-3.5 py-2.5 text-[14px]">{t('Hi! 👋 This is the ZipyZee team. Tell us a tool you need, a problem you ran into, or how we can make the app better. We read every message and reply here.')}</div>
            )}
            {live.map((m, i) => {
              const mine = m.from === me;
              const prev = live[i - 1];
              const day = !prev || !sameDay(prev.createdAt, m.createdAt);
              const sender = chat?.type === 'group' && !mine && (!prev || prev.from !== m.from) ? profiles[m.from]?.name : undefined;
              return (
                <div key={m.id} className="flex flex-col">
                  {day && <p className="self-center my-2 px-3 py-1 rounded-full bg-fill text-[11px] font-medium text-secondary">{dayLabel(m.createdAt || now)}</p>}
                  <div className={`group flex items-end gap-1.5 max-w-[85%] ${mine ? 'self-end flex-row-reverse' : 'self-start'}`}>
                    <div className={`rounded-2xl px-3.5 py-2 text-[14px] ${mine ? 'lime-fill rounded-ee-md' : 'bg-fill rounded-ss-md'}`}>
                      {sender && <p className="text-[12px] font-semibold text-primary mb-0.5">{sender}</p>}
                      {m.kind === 'text' && (
                        <p className="whitespace-pre-wrap break-words" dir="auto">
                          <Linked text={m.text ?? ''} />
                        </p>
                      )}
                      {m.kind === 'link' && m.link && (
                        <a href={m.link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg bg-black/5 px-2.5 py-2 hover:bg-black/10">
                          <ExternalLink size={16} aria-hidden="true" className="shrink-0" />
                          <span className="min-w-0">
                            <span className="block font-semibold truncate">{m.link.title || m.link.domain}</span>
                            <span className="block text-[12px] opacity-75 truncate" dir="ltr">{m.link.url}</span>
                          </span>
                        </a>
                      )}
                      {m.kind === 'link' && m.text && <p className="mt-1 whitespace-pre-wrap break-words" dir="auto">{m.text}</p>}
                      {m.kind === 'file' && m.file && <FileBody chatId={chatId} m={m} mine={mine} />}
                      {m.kind === 'file' && !m.file && <p className="italic opacity-75">{t('View-once file, opened')}</p>}
                      {m.kind === 'voice' && m.file && <VoiceBody chatId={chatId} m={m} onHeard={() => chat && void markHeard(chatId, m, chat.members, me, chat.last?.id).catch(() => {})} />}
                      <p className={`mt-0.5 flex items-center justify-end gap-1 text-[10px] ${mine ? 'opacity-70' : 'text-secondary'}`}>
                        {m.editedAt && <span>{t('Edited')} ·</span>}
                        <span title={t('Deletes in {n} h', { n: hoursLeft(m.expiresAt, now) })}>{timeOfDay(m.createdAt || now)}</span>
                        {mine &&
                          (m.failed ? (
                            <button type="button" onClick={() => deliver(m)} title={t('Not sent. Tap to try again.')} aria-label={t('Not sent. Tap to try again.')} className="text-error">
                              <AlertCircle size={13} aria-hidden="true" />
                            </button>
                          ) : m.pending ? (
                            <Clock size={12} aria-label={t('Sending')} />
                          ) : seenByAll(m) ? (
                            <CheckCheck size={14} className="text-[#1D7A2E]" aria-label={t('Seen')} />
                          ) : deliveredToAll(m) ? (
                            <CheckCheck size={14} aria-label={t('Delivered')} />
                          ) : (
                            <Check size={14} aria-label={t('Sent')} />
                          ))}
                      </p>
                    </div>
                    {mine && (
                      <span className="flex gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
                        {m.kind === 'text' && canEdit(m, me, now) && (
                          <button type="button" onClick={() => { setEditing(m); setText(m.text ?? ''); }} aria-label={t('Edit')} title={t('Edit')} className="size-7 rounded-full grid place-items-center hover:bg-fill">
                            <Pencil size={13} aria-hidden="true" />
                          </button>
                        )}
                        <button type="button" onClick={() => setToDelete(m)} aria-label={t('Delete')} title={t('Delete')} className="size-7 rounded-full grid place-items-center hover:bg-fill">
                          <Trash2 size={13} aria-hidden="true" />
                        </button>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}
        <div ref={bottom} />
      </div>

      <ConfirmDialog
        open={!!toDelete}
        icon={<Trash2 size={22} aria-hidden="true" />}
        title={t('Delete message?')}
        body={t('It is deleted for everyone in this chat.')}
        confirm={t('Delete')}
        danger
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          const m = toDelete;
          setToDelete(null);
          if (m) void deleteMessage(chatId, m.id).catch(() => setError(t('Not deleted')));
        }}
      />
      {error && <p className="px-4 py-1.5 text-[13px] text-error border-t border-line" role="alert">{error}</p>}
      {editing && (
        <p className="px-4 py-1.5 text-[12px] text-secondary border-t border-line flex items-center gap-2">
          <Pencil size={13} aria-hidden="true" />
          <span className="flex-1">{t('Editing message')}</span>
          <button type="button" onClick={() => { setEditing(null); setText(''); }} aria-label={t('Cancel editing')} className="size-7 rounded-full grid place-items-center hover:bg-fill">
            <X size={14} aria-hidden="true" />
          </button>
        </p>
      )}
      <form
        className="flex items-end gap-2 p-2.5 border-t border-line"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input
          ref={fileInput}
          type="file"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void attach(f);
          }}
        />
        {!editing && (
          <button type="button" onClick={() => fileInput.current?.click()} disabled={sending} aria-label={t('Send a file')} title={t('Send a file')} className="size-11 rounded-full grid place-items-center hover:bg-fill shrink-0">
            {sending ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Paperclip size={19} aria-hidden="true" />}
          </button>
        )}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          dir="auto"
          placeholder={t('Message')}
          aria-label={t('Message')}
          className="flex-1 min-h-11 max-h-36 resize-none rounded-[22px] bg-fill px-4 py-2.5 text-[15px] focus:outline-2 focus:outline-primary"
        />
        <button type="submit" disabled={!text.trim()} aria-label={editing ? t('Save') : t('Send')} title={editing ? t('Save') : t('Send')} className="size-11 rounded-full lime-fill grid place-items-center shrink-0 disabled:opacity-50">
          {editing ? <Check size={19} aria-hidden="true" /> : <Send size={18} aria-hidden="true" className="flip-rtl" />}
        </button>
      </form>
    </div>
  );
}
