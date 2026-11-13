'use client';
// Delete account on the web (Google Play asks for a web page where people can delete their account; the app has the
// same in Settings). Sign in with Google, see which account it is, tick "I understand", confirm: the account is
// hidden at once and a request goes to the team (chat/firebase.ts scheduleDeletion), who delete it after 7 days on
// the admin page. Signing in again before then keeps it; this page shows the date and "Keep my account" meanwhile. Without access to the Google account any more, an email request instead.
import { useEffect, useState } from 'react';
import { AlertTriangle, CalendarClock, Loader2, LogIn, Mail, RotateCcw, UserX } from 'lucide-react';
import { useLanguage, useT } from '@/i18n/client';
import { FEEDBACK_EMAIL } from '@/config';
import { ChatError, restoreAccount, scheduleDeletion, signInGoogle, signOut, watchAuth, watchProfile, type AuthUser } from '@/chat/firebase';
import type { Profile } from '@/chat/types';
import { zeeReady } from '@/lib/firebase';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';

export function DeleteAccount() {
  const t = useT();
  const lang = useLanguage();
  // undefined = still checking; null = signed out (or Firebase isn't set up for this site)
  const [user, setUser] = useState<AuthUser | null | undefined>(() => (zeeReady() ? undefined : null));
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [understood, setUnderstood] = useState(false);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [scheduled, setScheduled] = useState<number | null>(null);
  const [kept, setKept] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => (zeeReady() ? watchAuth(setUser) : undefined), []);
  useEffect(() => (user ? watchProfile(user.uid, setProfile) : undefined), [user]);

  const day = (ms: number) => new Date(ms).toLocaleDateString(lang === 'ur' ? 'ur-PK' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      setScheduled(await scheduleDeletion());
      setAsking(false);
    } catch (e) {
      setAsking(false);
      setError(e instanceof ChatError ? e.message : t('Could not delete the account. Try again.'));
    }
    setBusy(false);
  };
  const keep = async () => {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      await restoreAccount(user.uid);
      setKept(true);
    } catch {
      setError(t('Something went wrong. Try again.'));
    }
    setBusy(false);
  };

  const mail = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent('Delete my ZipyZee account')}&body=${encodeURIComponent('Please delete my ZipyZee account and its data.\n\nGoogle email on the account: \nUsername (if you remember it): @')}`;
  const pending = profile?.deleteAt && !kept ? profile.deleteAt : null;

  return (
    <div className="flex flex-col gap-6">
      <section className="card p-6 flex flex-col gap-4">
        <h2 className="text-[18px] font-semibold">{t('How deleting works')}</h2>
        <ul className="list-disc ps-6 flex flex-col gap-1.5 text-[15px] leading-relaxed">
          <li>{t('Your request goes to the ZipyZee team. Your account is hidden at once (people can\'t find you in search), and the team deletes it after 7 days.')}</li>
          <li>{t('Changed your mind? Sign in to ZipyZee again within the 7 days and your account stays, just as it was.')}</li>
          <li>{t('After 7 days, your profile (name, username, "I am a"), your saved resume details, blocked people and notification settings are deleted for good, and your username becomes free for others.')}</li>
          <li>{t('Messages you already sent delete with their own timers (1 hour after they\'re seen, or 24 hours). It is one account for the website and the Android app.')}</li>
        </ul>
        <p className="text-[14px] text-secondary">{t('Files you made with the tools are never on our servers: they stay on your devices until you delete them.')}</p>
      </section>

      <section className="card p-6 flex flex-col gap-4" aria-live="polite">
        {scheduled ? (
          <div className="flex flex-col items-center text-center gap-3 py-4">
            <CalendarClock size={40} className="text-primary" aria-hidden="true" />
            <p className="text-[18px] font-semibold">{t('Your account will be deleted after {date}', { date: day(scheduled) })}</p>
            <p className="text-[14px] text-secondary max-w-md">{t('Your request is with the ZipyZee team and you\'re signed out. Changed your mind? Sign in to ZipyZee again before then and your account stays.')}</p>
          </div>
        ) : user === undefined || (user && profile === undefined) ? (
          <Loader2 size={26} className="animate-spin text-primary mx-auto my-6" aria-label={t('Loading')} />
        ) : !user ? (
          <div className="flex flex-col gap-3">
            <h2 className="text-[18px] font-semibold">{t('Sign in to delete your account')}</h2>
            <p className="text-[14px] text-secondary">{t('Sign in with the Google account you use in ZipyZee. Nothing is deleted until you confirm.')}</p>
            <Button
              arrow
              onClick={() => {
                setError(null);
                void signInGoogle().catch((e: unknown) => setError(e instanceof ChatError ? e.message : t('Something went wrong. Try again.')));
              }}
            >
              <LogIn size={16} aria-hidden="true" className="inline me-1.5 flip-rtl" />
              {t('Sign in with Google')}
            </Button>
          </div>
        ) : !profile ? (
          <div className="flex flex-col gap-3">
            <p className="text-[16px] font-semibold">{t('There\'s no ZipyZee account for {email}', { email: user.email ?? '' })}</p>
            <p className="text-[14px] text-secondary">{t('Nothing is stored for this Google account. If you used another one, sign out and sign in with that.')}</p>
            <button type="button" onClick={() => void signOut()} className="self-start text-[14px] font-semibold text-primary hover:underline">
              {t('Sign out')}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="size-11 rounded-full bg-error/10 text-error grid place-items-center shrink-0">
                <UserX size={20} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold truncate">
                  {profile.name} (@{profile.username})
                </span>
                <span className="block text-[13px] text-secondary truncate" dir="ltr">
                  {user.email}
                </span>
              </span>
              <button type="button" onClick={() => void signOut()} className="ms-auto text-[13px] font-medium text-primary hover:underline shrink-0">
                {t('Not you?')}
              </button>
            </div>
            {kept ? (
              <p className="rounded-xl bg-success/10 px-4 py-3 text-[14px]" role="status">
                {t('Your account is kept. Nothing will be deleted.')}
              </p>
            ) : pending ? (
              <div className="flex flex-col gap-3 rounded-xl bg-warning-soft px-4 py-3">
                <p className="text-[14px] font-semibold">{t('Your account will be deleted after {date}', { date: day(pending) })}</p>
                <Button arrow disabled={busy} onClick={() => void keep()}>
                  <RotateCcw size={16} aria-hidden="true" className="inline me-1.5" />
                  {t('Keep my account')}
                </Button>
              </div>
            ) : (
              <>
                <label className="flex items-start gap-2.5 text-[14px]">
                  <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} className="size-4 mt-0.5 accent-[var(--error)]" />
                  {t('I understand my ZipyZee account and its data are deleted in 7 days, on the website and in the app, unless I sign in again before then.')}
                </label>
                <button
                  type="button"
                  disabled={!understood || busy}
                  onClick={() => setAsking(true)}
                  className="self-start px-6 min-h-12 rounded-full bg-error text-white font-semibold disabled:opacity-40 hover:brightness-95 inline-flex items-center gap-2"
                >
                  <UserX size={18} aria-hidden="true" />
                  {t('Delete my account')}
                </button>
              </>
            )}
          </div>
        )}
        {error && (
          <p className="flex items-start gap-2 text-[14px] text-error" role="alert">
            <AlertTriangle size={16} aria-hidden="true" className="shrink-0 mt-0.5" />
            {error}
          </p>
        )}
      </section>

      <section className="card p-6 flex flex-col gap-3">
        <h2 className="text-[16px] font-semibold">{t('Can\'t sign in any more?')}</h2>
        <p className="text-[14px] text-secondary">{t('Email us from the Google address on the account, and we\'ll delete it for you within 30 days.')}</p>
        <a href={mail} className="self-start inline-flex items-center gap-2 text-primary font-semibold hover:underline">
          <Mail size={16} aria-hidden="true" />
          {t('Ask us to delete it')}
        </a>
      </section>

      <ConfirmDialog
        open={asking}
        busy={busy}
        icon={<UserX size={22} aria-hidden="true" />}
        title={t('Delete your account?')}
        body={t('It will be deleted in 7 days, on the website and in the app, and you\'ll be signed out. Sign in again before then to keep it.')}
        confirm={busy ? t('Deleting...') : t('Delete my account')}
        danger
        onCancel={() => !busy && setAsking(false)}
        onConfirm={() => void remove()}
      />
    </div>
  );
}
