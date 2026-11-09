'use client';
// Chats sign-in and Create account (the app's screens/chats/auth/LoginView + SetupView): Google only; the first time,
// Create account filled in from Google (name, a free username to keep or change, "I am a"). The username can't change
// later and is the same one the app shows: one account for the phone and the web.
import { useEffect, useState } from 'react';
import { Check, Loader2, MessageCircle, X } from 'lucide-react';
import { useT } from '@/i18n/client';
import { ChatError, claimProfile, isUsernameFree, signInGoogle, suggestUsername, type AuthUser } from '@/chat/firebase';
import { cleanUsername, usernameProblem } from '@/chat/format';
import type { Role } from '@/chat/types';
import { Button } from '../ui/Button';
import { Choice } from '../custom/makedoc/parts';

function Google() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export function Login() {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="card p-8 sm:p-12 max-w-lg mx-auto flex flex-col items-center text-center gap-4">
      <span className="size-16 rounded-full bg-category-tint text-category grid place-items-center">
        <MessageCircle size={30} aria-hidden="true" />
      </span>
      <h2 className="text-[22px] font-semibold">{t('Sign in to chat and share')}</h2>
      <p className="text-[14px] text-secondary">{t('Send PDFs and links to classmates and coworkers. All tools still work without an account.')}</p>
      <p className="text-[13px] text-secondary">{t('Your chats are the same as in the ZipyZee app: sign in with the same Google account.')}</p>
      <Button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await signInGoogle();
          } catch (e) {
            setError(e instanceof ChatError ? e.message : t('Something went wrong. Try again.'));
          }
          setBusy(false);
        }}
        className="w-full max-w-xs"
      >
        <span className="inline-flex items-center gap-2.5">
          {busy ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Google />}
          {t('Continue with Google')}
        </span>
      </Button>
      <p className="text-[12px] text-secondary max-w-sm">{t('We use your Google name and email to make your account. Your email stays private.')}</p>
      {error && <p className="text-[13px] text-error" role="alert">{error}</p>}
    </div>
  );
}

export function Setup({ user }: { user: AuthUser }) {
  const t = useT();
  const [name, setName] = useState(user.name ?? '');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<Role>('student');
  const [free, setFree] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void suggestUsername(user.email, user.name).then((u) => alive && setUsername((cur) => cur || u)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [user.email, user.name]);

  const problem = usernameProblem(username);
  useEffect(() => {
    let alive = true;
    const id = setTimeout(() => {
      if (problem || username.length < 3) return;
      void isUsernameFree(username).then((f) => alive && setFree(f)).catch(() => {});
    }, 350);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [username, problem]);

  const create = async () => {
    if (!name.trim()) return setError(t('Enter your name.'));
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      if (!(await isUsernameFree(username))) {
        setFree(false);
        throw new ChatError(t('This username is taken. Try another.'));
      }
      await claimProfile(user.uid, { name, username, role });
    } catch (e) {
      setError(e instanceof ChatError ? e.message : t('Could not set up your account. Try again.'));
    }
    setBusy(false);
  };

  return (
    <form
      className="card p-6 sm:p-8 max-w-lg mx-auto flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void create();
      }}
    >
      <h2 className="text-[22px] font-semibold">{t('Create your account')}</h2>
      <p className="text-[14px] text-secondary -mt-2">{t('We filled this in from Google. Check it, then create your account.')}</p>
      <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
        {t('Full name')}
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} dir="auto" className="min-h-12 rounded-tile bg-surface border border-line-strong px-3 text-[15px] font-normal" />
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
        {t('Username')}
        <span className="relative">
          <span className="absolute start-3 top-1/2 -translate-y-1/2 text-secondary">@</span>
          <input
            value={username}
            onChange={(e) => {
              setUsername(cleanUsername(e.target.value).slice(0, 20));
              setFree(null);
            }}
            dir="ltr"
            autoCapitalize="none"
            spellCheck={false}
            className="w-full min-h-12 rounded-tile bg-surface border border-line-strong ps-8 pe-24 text-[15px] font-normal"
          />
          {!problem && free != null && (
            <span className={`absolute end-3 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 text-[12px] font-semibold ${free ? 'text-success' : 'text-error'}`}>
              {free ? <Check size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
              {free ? t('Available') : t('Taken')}
            </span>
          )}
        </span>
        <span className="text-[12px] font-normal text-secondary">{problem && username.length >= 3 ? problem : t('People find you by this name. It can\'t be changed later.')}</span>
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
        {t('Email')}
        <input value={user.email ?? ''} readOnly dir="ltr" className="min-h-12 rounded-tile bg-fill border border-line px-3 text-[15px] font-normal text-secondary" />
        <span className="text-[12px] font-normal text-secondary">{t('From your Google account. Only you can see it.')}</span>
      </label>
      <Choice label={t('I am a')} value={role} options={[['student', t('Student')], ['professional', t('Working professional')], ['other', t('Other')]]} onChange={setRole} />
      {error && <p className="text-[13px] text-error" role="alert">{error}</p>}
      <Button type="submit" arrow disabled={busy || free === false}>
        {t('Create account')}
      </Button>
    </form>
  );
}
