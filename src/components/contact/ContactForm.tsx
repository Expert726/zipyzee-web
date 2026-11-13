'use client';
// The Contact us form. There's no server behind it: Send opens the person's own email app with everything filled in,
// addressed to us, so nothing is stored on the way and our reply goes straight back to them.
import { useState } from 'react';
import { Send } from 'lucide-react';
import { useT } from '@/i18n/client';
import { FEEDBACK_EMAIL } from '@/config';
import { Button } from '../ui/Button';

const TOPICS = ['Something isn\'t working', 'An idea or a tool I need', 'Account or privacy', 'Business or partnership', 'Something else'] as const;
type Topic = (typeof TOPICS)[number];

const field = 'w-full min-h-12 rounded-tile bg-surface border border-line-strong px-4 text-[15px]';

export function ContactForm() {
  const t = useT();
  const [name, setName] = useState('');
  const [topic, setTopic] = useState<Topic>(TOPICS[0]);
  const [message, setMessage] = useState('');
  const [opened, setOpened] = useState(false);
  const ready = message.trim().length >= 5;

  const send = () => {
    if (!ready) return;
    const subject = `ZipyZee: ${t(topic)}`;
    const body = [message.trim(), '', name.trim() ? `— ${name.trim()}` : '', `(${navigator.userAgent})`].filter((x, i) => x || i === 1).join('\n');
    window.location.href = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setOpened(true);
  };

  return (
    <form
      className="card p-6 flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <h2 className="text-[20px] font-semibold">{t('Write to us')}</h2>
      <fieldset>
        <legend className="text-[13px] font-semibold mb-2">{t('About')}</legend>
        <div className="flex flex-wrap gap-2">
          {TOPICS.map((x) => (
            <button
              key={x}
              type="button"
              aria-pressed={topic === x}
              onClick={() => setTopic(x)}
              className={`px-4 min-h-10 rounded-full text-[14px] font-medium border ${topic === x ? 'bg-ink text-on-ink border-transparent' : 'bg-surface border-line-strong hover:bg-fill'}`}
            >
              {t(x)}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
        {t('Your name (optional)')}
        <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" dir="auto" className={field} />
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
        {t('Message')}
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={7}
          maxLength={4000}
          dir="auto"
          placeholder={t('Tell us what happened or what you need. For a problem, say which tool and what you tried.')}
          className={`${field} py-3 leading-relaxed`}
        />
      </label>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Button type="submit" arrow disabled={!ready}>
          <Send size={16} aria-hidden="true" className="inline me-1.5 flip-rtl" />
          {t('Send')}
        </Button>
        <p className="text-[13px] text-secondary" role="status">
          {opened ? t('Your email app should open with the message ready. If it didn\'t, copy our address and write to us from your email.') : t('Send opens your email app with the message ready to go.')}
        </p>
      </div>
    </form>
  );
}
