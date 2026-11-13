'use client';
// The team's "Account deletion requests" (the ZipyZee Team account only: users/{uid}.role == 'admin', set in the
// Firebase console). People ask on the Delete account page; their account is hidden at once. Waiting: the 7 days
// aren't over (or they may still sign in again, which withdraws the request). Ready: delete it now. Done: carried out,
// only the dates kept. The Google sign-in itself can only be removed in the Firebase console (a link is shown).
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Clock, ExternalLink, Loader2, ShieldAlert, UserX } from 'lucide-react';
import { useLanguage, useT } from '@/i18n/client';
import { FIREBASE_CONFIG } from '@/config';
import { adminDeleteAccount, ChatError, signInGoogle, watchAuth, watchDeleteRequests, watchProfile, type AuthUser, type DeleteRequest } from '@/chat/firebase';
import type { Profile } from '@/chat/types';
import { zeeReady } from '@/lib/firebase';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';

type Tab = 'ready' | 'waiting' | 'done';
const DAY = 24 * 3600_000;
const CONSOLE_USERS = `https://console.firebase.google.com/project/${FIREBASE_CONFIG.projectId}/authentication/users`;

export function DeleteRequests() {
  const t = useT();
  const lang = useLanguage();
  const [user, setUser] = useState<AuthUser | null | undefined>(() => (zeeReady() ? undefined : null));
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [list, setList] = useState<DeleteRequest[] | null>(null);
  const [tab, setTab] = useState<Tab>('ready');
  // the clock starts in the browser (Next pre-renders this page, where "now" must not be read)
  const [now, setNow] = useState(0);
  const [toDelete, setToDelete] = useState<DeleteRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justDone, setJustDone] = useState<string | null>(null);

  useEffect(() => (zeeReady() ? watchAuth(setUser) : undefined), []);
  useEffect(() => (user ? watchProfile(user.uid, setProfile) : undefined), [user]);
  const admin = profile?.role === 'admin';
  useEffect(() => (admin ? watchDeleteRequests(setList, () => setError(t('Requests could not load.'))) : undefined), [admin, t]);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  const groups = useMemo(() => {
    const all = list ?? [];
    return {
      ready: all.filter((r) => r.status === 'pending' && r.deleteAt <= now),
      waiting: all.filter((r) => r.status === 'pending' && r.deleteAt > now),
      done: all.filter((r) => r.status === 'deleted').sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0)),
    };
  }, [list, now]);
  const day = (ms: number) => (ms ? new Date(ms).toLocaleDateString(lang === 'ur' ? 'ur-PK' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

  const run = async () => {
    if (!toDelete) return;
    setBusy(true);
    setError(null);
    try {
      await adminDeleteAccount(toDelete);
      setJustDone(toDelete.email || toDelete.username);
      setToDelete(null);
    } catch (e) {
      setToDelete(null);
      setError(e instanceof ChatError ? e.message : t('Could not delete the account. Try again.'));
    }
    setBusy(false);
  };

  if (user === undefined || (user && profile === undefined)) return <Loader2 size={28} className="animate-spin text-primary mx-auto my-24" aria-label={t('Loading')} />;
  if (!user)
    return (
      <div className="card p-8 max-w-md mx-auto flex flex-col items-center text-center gap-4">
        <ShieldAlert size={32} className="text-primary" aria-hidden="true" />
        <p className="text-[16px] font-semibold">{t('Sign in with the ZipyZee Team account')}</p>
        <Button arrow onClick={() => void signInGoogle().catch(() => setError(t('Something went wrong. Try again.')))}>
          {t('Sign in with Google')}
        </Button>
      </div>
    );
  if (!admin)
    return (
      <div className="card p-8 max-w-md mx-auto flex flex-col items-center text-center gap-3">
        <ShieldAlert size={32} className="text-secondary" aria-hidden="true" />
        <p className="text-[16px] font-semibold">{t('This page is for the ZipyZee team.')}</p>
        <Link href={`/${lang}`} className="text-primary font-semibold hover:underline">
          {t('Back to home')}
        </Link>
      </div>
    );

  const shown = groups[tab];
  const tabs: [Tab, string, number][] = [
    ['ready', t('Ready to delete'), groups.ready.length],
    ['waiting', t('Waiting (7 days)'), groups.waiting.length],
    ['done', t('Deleted'), groups.done.length],
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2" role="tablist">
        {tabs.map(([k, label, n]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`px-4 min-h-10 rounded-full text-[14px] font-medium border inline-flex items-center gap-2 ${tab === k ? 'bg-ink text-on-ink border-transparent' : 'bg-surface border-line-strong hover:bg-fill'}`}>
            {label}
            <span className={`min-w-6 h-6 px-1.5 rounded-full text-[12px] font-bold grid place-items-center ${k === 'ready' && n ? 'bg-error text-white' : 'bg-fill'}`}>{n}</span>
          </button>
        ))}
      </div>

      {justDone && (
        <div className="card p-4 flex items-start gap-3 bg-success/10" role="status">
          <CheckCircle2 size={20} className="text-success shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1 text-[14px] flex flex-col gap-1">
            <p className="font-semibold">{t('Account data deleted.')}</p>
            <p>{t('Last step: remove the Google sign-in for {who} in the Firebase console, under Authentication.', { who: justDone })}</p>
            <a href={CONSOLE_USERS} target="_blank" rel="noopener noreferrer" className="self-start inline-flex items-center gap-1 text-primary font-semibold hover:underline">
              {t('Open Firebase Authentication')}
              <ExternalLink size={14} aria-hidden="true" />
            </a>
          </div>
        </div>
      )}
      {error && (
        <p className="flex items-start gap-2 text-[14px] text-error" role="alert">
          <AlertTriangle size={16} aria-hidden="true" className="shrink-0 mt-0.5" />
          {error}
        </p>
      )}

      {list === null ? (
        <Loader2 size={24} className="animate-spin text-primary mx-auto my-10" aria-label={t('Loading')} />
      ) : !shown.length ? (
        <p className="card p-8 text-center text-[14px] text-secondary">
          {tab === 'ready' ? t('Nothing to delete right now.') : tab === 'waiting' ? t('No one is waiting.') : t('No accounts deleted yet.')}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((r) => {
            const left = Math.max(0, Math.ceil((r.deleteAt - now) / DAY));
            return (
              <li key={r.uid} className="card p-4 flex flex-wrap items-center gap-3">
                <span className={`size-10 rounded-full grid place-items-center shrink-0 ${r.status === 'deleted' ? 'bg-fill text-secondary' : tab === 'ready' ? 'bg-error/10 text-error' : 'bg-warning-soft text-warning-text'}`}>
                  {r.status === 'deleted' ? <CheckCircle2 size={18} aria-hidden="true" /> : tab === 'ready' ? <UserX size={18} aria-hidden="true" /> : <Clock size={18} aria-hidden="true" />}
                </span>
                <span className="flex-1 min-w-[12rem]">
                  <span className="block font-semibold truncate" dir="auto">
                    {r.status === 'deleted' ? t('Deleted account') : `${r.name || '—'}${r.username ? ` (@${r.username})` : ''}`}
                  </span>
                  {r.email && (
                    <span className="block text-[13px] text-secondary truncate" dir="ltr">
                      {r.email}
                    </span>
                  )}
                  <span className="block text-[12px] text-secondary">
                    {r.status === 'deleted'
                      ? t('Asked {asked} · deleted {done}', { asked: day(r.requestedAt), done: day(r.doneAt ?? 0) })
                      : tab === 'waiting'
                        ? t('Asked {asked} · can be deleted {date} ({days} days left)', { asked: day(r.requestedAt), date: day(r.deleteAt), days: left })
                        : t('Asked {asked} · 7 days are over', { asked: day(r.requestedAt) })}
                  </span>
                </span>
                {r.status === 'pending' && (
                  <button
                    type="button"
                    disabled={tab !== 'ready' || busy}
                    onClick={() => setToDelete(r)}
                    title={tab !== 'ready' ? t('Available after the 7 days') : undefined}
                    className="px-4 min-h-10 rounded-full bg-error text-white text-[14px] font-semibold disabled:opacity-35 hover:brightness-95 inline-flex items-center gap-1.5"
                  >
                    <UserX size={16} aria-hidden="true" />
                    {t('Delete now')}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-[13px] text-secondary">{t('If a person signs in again before you delete it, their request disappears from this list and their account stays.')}</p>

      <ConfirmDialog
        open={!!toDelete}
        busy={busy}
        icon={<UserX size={22} aria-hidden="true" />}
        title={t('Delete this account for good?')}
        body={toDelete ? t('{who}: profile, username, private data and Zee conversations are deleted. This can\'t be undone.', { who: toDelete.email || `@${toDelete.username}` }) : undefined}
        confirm={busy ? t('Deleting...') : t('Delete now')}
        danger
        onCancel={() => !busy && setToDelete(null)}
        onConfirm={() => void run()}
      />
    </div>
  );
}
