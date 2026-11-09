'use client';
// Chats on the web (the app's Chats tab): signed out -> Google sign-in; no profile yet -> Create account; then the
// list (the pinned ZipyZee Team chat first, unread counts, previews) beside the open chat (stacked on phones), and New
// chat by @username. The open chat is in the address (?c=<chatId>) so Back and refresh keep it. Same Firestore data
// and rules as the app, so the phone and the web show the same chats.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, CheckCheck, Loader2, LogOut, MessageSquarePlus, Search, Timer, X } from 'lucide-react';
import { useT } from '@/i18n/client';
import { ChatError, getProfile, openDirectChat, openSupportChat, searchUsers, signOut, supportUid, touchPresence, watchAuth, watchChats, watchProfile, type AuthUser } from '@/chat/firebase';
import { chatTime, cleanUsername, firstName, isSupportChat, previewText } from '@/chat/format';
import type { Chat, Profile } from '@/chat/types';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Avatar } from './Avatar';
import { Login, Setup } from './Auth';
import { Thread } from './Thread';

/** Profiles by uid, fetched once each (names and usernames for the list and the chat header). */
export function useProfiles(uids: string[]): Record<string, Profile | null> {
  const [found, setFound] = useState<Record<string, Profile | null>>({});
  const key = [...new Set(uids)].sort().join(',');
  useEffect(() => {
    let alive = true;
    const missing = key.split(',').filter((u) => u && !(u in found));
    if (!missing.length) return;
    void Promise.all(missing.map((u) => getProfile(u).catch(() => null))).then((ps) => {
      if (!alive) return;
      setFound((f) => ({ ...f, ...Object.fromEntries(missing.map((u, i) => [u, ps[i]])) }));
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- by the set of uids
  }, [key]);
  return found;
}

export function ChatsApp() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const open = params.get('c');
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [chats, setChats] = useState<Chat[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [support, setSupport] = useState<string | null>(null);
  const [finding, setFinding] = useState(false);
  const [askSignOut, setAskSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => watchAuth(setUser), []);
  useEffect(() => {
    if (!user) return;
    return watchProfile(user.uid, setProfile);
  }, [user]);
  useEffect(() => {
    if (!user || !profile) return;
    void supportUid().then(setSupport);
    return watchChats(user.uid, setChats, setError);
  }, [user, profile]);
  // "Online" for the others while this page is open and showing (the app's presence)
  useEffect(() => {
    if (!user || !profile) return;
    const beat = () => document.visibilityState === 'visible' && void touchPresence(user.uid).catch(() => {});
    beat();
    const id = setInterval(beat, 60_000);
    document.addEventListener('visibilitychange', beat);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', beat);
    };
  }, [user, profile]);

  const go = useCallback((chatId: string | null) => router.push(chatId ? `?c=${encodeURIComponent(chatId)}` : '?', { scroll: false }), [router]);

  const others = useMemo(() => (chats ?? []).flatMap((c) => c.members).filter((u) => u !== user?.uid), [chats, user]);
  const profiles = useProfiles(others);

  if (user === undefined || (user && profile === undefined)) {
    return <Loader2 size={28} className="animate-spin text-primary mx-auto my-24" aria-label={t('Loading')} />;
  }
  if (!user) return <Login />;
  if (!profile) return <Setup user={user} />;

  const me = user.uid;
  const titleOf = (c: Chat) => {
    if (c.type === 'group') return c.name ?? t('Group');
    if (isSupportChat(c.id, support)) return t('ZipyZee Team');
    const o = profiles[c.members.find((u) => u !== me) ?? ''];
    return o === null ? t('Deleted account') : o?.name ?? '…';
  };
  const supportChat = (chats ?? []).find((c) => isSupportChat(c.id, support));
  const rest = (chats ?? []).filter((c) => c !== supportChat);
  const current = open ? (chats ?? []).find((c) => c.id === open) : undefined;

  const openSupport = async () => {
    try {
      go(await openSupportChat(me));
    } catch (e) {
      setError(e instanceof ChatError ? e.message : t('Could not open the chat. Try again.'));
    }
  };

  const row = (c: Chat, pinned = false) => {
    const unread = c.unread[me] ?? 0;
    const other = c.members.find((u) => u !== me) ?? '';
    const fromName = c.last && c.type === 'group' && c.last.from !== me ? firstName(profiles[c.last.from]?.name ?? '') : undefined;
    return (
      <li key={c.id}>
        <button type="button" onClick={() => go(c.id)} aria-current={c.id === open ? 'true' : undefined} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-row text-start ${c.id === open ? 'bg-fill' : 'hover:bg-fill/60'}`}>
          <Avatar uid={pinned ? 'zipyzee' : c.type === 'group' ? c.id : other} name={titleOf(c)} team={pinned} group={c.type === 'group'} />
          <span className="flex-1 min-w-0">
            <span className="flex items-baseline gap-2">
              <span className="flex-1 truncate font-semibold text-[15px]" dir="auto">
                {titleOf(c)}
              </span>
              {c.last && <span className={`text-[11px] shrink-0 ${unread ? 'text-primary font-semibold' : 'text-secondary'}`}>{chatTime(c.last.at)}</span>}
            </span>
            <span className="flex items-center gap-2">
              <span className="flex-1 min-w-0 flex items-center gap-1 text-[13px] text-secondary">
                {/* my last message: ✓ sent, green ✓✓ seen by everyone (like WhatsApp) */}
                {c.last && c.last.from === me && c.last.kind !== 'system' && (
                  c.members.filter((u) => u !== me).every((u) => (c.readAt[u] ?? 0) >= c.last!.at)
                    ? <CheckCheck size={14} className="shrink-0 text-[#1D7A2E]" aria-label={t('Seen')} />
                    : <Check size={14} className="shrink-0" aria-label={t('Sent')} />
                )}
                <span className="truncate" dir="auto">
                  {c.last ? previewText(c.last, me, c.type === 'group', fromName) : pinned ? t('Tell us what you need') : ''}
                </span>
              </span>
              {unread > 0 && <span className="min-w-5 h-5 px-1.5 rounded-full lime-fill text-[11px] font-bold grid place-items-center shrink-0">{unread > 99 ? '99+' : unread}</span>}
            </span>
          </span>
        </button>
      </li>
    );
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)] items-start">
      <section className={`card p-3 flex flex-col gap-2 lg:sticky lg:top-20 ${open ? 'hidden lg:flex' : ''}`} aria-label={t('Chats')}>
        <div className="flex items-center gap-2 px-1">
          <Avatar uid={me} name={profile.name} />
          <span className="flex-1 min-w-0">
            <span className="block font-semibold text-[14px] truncate">{profile.name}</span>
            <span className="block text-[12px] text-secondary truncate" dir="ltr">@{profile.username}</span>
          </span>
          <button type="button" onClick={() => setFinding((f) => !f)} aria-label={t('New chat')} title={t('New chat')} className="size-10 rounded-full grid place-items-center hover:bg-fill">
            <MessageSquarePlus size={19} aria-hidden="true" />
          </button>
          <button type="button" onClick={() => setAskSignOut(true)} aria-label={t('Sign out')} title={t('Sign out')} className="size-10 rounded-full grid place-items-center hover:bg-fill">
            <LogOut size={18} aria-hidden="true" className="flip-rtl" />
          </button>
        </div>
        {finding && <NewChat me={me} onOpen={(id) => { setFinding(false); go(id); }} onClose={() => setFinding(false)} />}
        {error && <p className="text-[13px] text-error px-2" role="alert">{error}</p>}
        {chats == null ? (
          <Loader2 size={22} className="animate-spin text-primary mx-auto my-8" aria-label={t('Loading chats')} />
        ) : (
          <ul className="flex flex-col">
            {support && support !== me && (supportChat ? row(supportChat, true) : (
              <li>
                <button type="button" onClick={() => void openSupport()} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-row text-start hover:bg-fill/60">
                  <Avatar uid="zipyzee" name={t('ZipyZee Team')} team />
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold text-[15px]">{t('ZipyZee Team')}</span>
                    <span className="block text-[13px] text-secondary truncate">{t('Tell us what you need')}</span>
                  </span>
                </button>
              </li>
            ))}
            {rest.map((c) => row(c))}
            {!rest.length && <li className="text-[13px] text-secondary text-center py-8 px-4">{t('No chats yet. Start one with New chat, or open a chat from the app.')}</li>}
          </ul>
        )}
        {chats != null && (
          <p className="mt-1 flex items-start gap-1.5 rounded-xl bg-warning-soft/70 px-3 py-2 text-[12px] text-secondary">
            <Timer size={14} aria-hidden="true" className="shrink-0 mt-px" />
            <span>{t('Once seen, messages and files delete after 1 hour. Not seen, after 24 hours')}</span>
          </p>
        )}
      </section>

      <ConfirmDialog
        open={askSignOut}
        icon={<LogOut size={22} aria-hidden="true" className="flip-rtl" />}
        title={t('Sign out?')}
        body={t('You can sign in again any time with the same Google account. Your chats stay in your account and on your phone.')}
        confirm={t('Sign out')}
        danger
        busy={signingOut}
        onCancel={() => setAskSignOut(false)}
        onConfirm={async () => {
          setSigningOut(true);
          go(null);
          await signOut().catch(() => {});
          setSigningOut(false);
          setAskSignOut(false);
        }}
      />
      <section className={open ? '' : 'hidden lg:block'}>
        {open ? (
          <Thread key={open} chatId={open} chat={current} me={me} myName={profile.name} support={support} title={current ? titleOf(current) : '…'} profiles={profiles} onBack={() => go(null)} />
        ) : (
          <div className="card p-10 text-center text-secondary text-[14px] min-h-80 grid place-items-center">{t('Choose a chat, or start a new one.')}</div>
        )}
      </section>
    </div>
  );
}

function NewChat({ me, onOpen, onClose }: { me: string; onOpen: (chatId: string) => void; onClose: () => void }) {
  const t = useT();
  const [text, setText] = useState('');
  const [found, setFound] = useState<Profile[] | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const q = cleanUsername(text);
    let alive = true;
    const id = setTimeout(() => {
      if (q.length < 2) return void (alive && setFound(null));
      void searchUsers(q).then((r) => alive && setFound(r.filter((p) => p.uid !== me)));
    }, 300);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [text, me]);
  return (
    <div className="rounded-row bg-fill p-2.5 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="relative flex-1">
          <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-secondary" aria-hidden="true" />
          <input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder={t('Search by @username')} dir="ltr" autoCapitalize="none" className="w-full min-h-10 rounded-full bg-surface border border-line-strong ps-9 pe-3 text-[14px]" aria-label={t('New chat')} />
        </span>
        <button type="button" onClick={onClose} aria-label={t('Close')} className="size-9 rounded-full grid place-items-center hover:bg-fill-strong">
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      {found && !found.length && <p className="text-[13px] text-secondary px-1">{t('No one with a username starting with @{text}.', { text: cleanUsername(text) })}</p>}
      {found?.map((p) => (
        <button
          key={p.uid}
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              onOpen(await openDirectChat(me, p.uid));
            } finally {
              setBusy(false);
            }
          }}
          className="flex items-center gap-3 px-2 py-1.5 rounded-row hover:bg-surface text-start"
        >
          <Avatar uid={p.uid} name={p.name} />
          <span className="min-w-0">
            <span className="block font-semibold text-[14px] truncate">{p.name}</span>
            <span className="block text-[12px] text-secondary" dir="ltr">@{p.username}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
