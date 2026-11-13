'use client';
import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useT } from '@/i18n/client';
import { FEEDBACK_EMAIL } from '@/config';

/** "Copy" next to our email address, for people whose browser has no email app set up. */
export function CopyEmail() {
  const t = useT();
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(FEEDBACK_EMAIL).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="self-start inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline"
    >
      {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      {copied ? t('Copied') : t('Copy')}
    </button>
  );
}
