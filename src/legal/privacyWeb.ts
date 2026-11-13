// The website's privacy policy (/privacy). It describes the website only; the Android app has its own (the app's
// src/legal/privacy.ts and hosting/privacy.html). Change it whenever what leaves the browser changes: a new tool that
// uploads, a new service, analytics or ads.
import type { Translate } from '@/i18n';
import { FEEDBACK_EMAIL } from '@/config';

export const PRIVACY_WEB_EFFECTIVE = '10 November 2026';

/** One "What / Why / Kept" row. */
export type DataRow = { what: string; why: string; kept: string };
export type PolicySection = { id: string; title: string; paragraphs?: string[]; bullets?: string[]; rows?: DataRow[]; after?: string[] };

export const privacyWebIntro = (t: Translate) =>
  t('ZipyZee is a set of free tools for PDFs, photos and scans, with optional chat, ZeeShare and AI. This page says exactly what leaves your browser on this website, why, and when it is deleted. We don\'t sell your data, and we use it only to run ZipyZee.');

export function privacyWebSections(t: Translate): PolicySection[] {
  return [
    {
      id: 'tools',
      title: t('1. Tools work in your browser'),
      paragraphs: [
        t('Every tool on this website runs inside your browser: merging, splitting and compressing PDFs, photo tools, scanning, text recognition, QR codes, the text editor, the resume builder and the rest. Your files are not uploaded to us or anyone else. What you make stays on your computer or phone until you download it.'),
        t('Some tools need an engine or model the first time you use them (or when the home page gets them ready for you). Your browser downloads it once, like any other file, from:'),
      ],
      bullets: [
        t('Hugging Face (huggingface.co): Background remover, Change background, Sticker maker, Passport photo, Upscale image and Object eraser'),
        t('Google (storage.googleapis.com): face detection for Blur faces and Passport photo'),
        t('jsDelivr (cdn.jsdelivr.net): language files for text recognition'),
      ],
      after: [t('These services see an ordinary download request (your IP address and browser), never your files.')],
    },
    {
      id: 'browser',
      title: t('2. What this website keeps in your browser'),
      paragraphs: [t('This is stored only on your device, in your browser\'s storage. We never receive it. Clearing this site\'s data in your browser removes all of it.')],
      rows: [
        { what: t('Your language and light / dark theme'), why: t('Showing the site the way you chose'), kept: t('Until you change it (the language is a cookie for 1 year)') },
        { what: t('Recent photos'), why: t('Picking them again quickly in photo tools'), kept: t('1 hour') },
        { what: t('Text editor documents, resumes and Make with Zee documents'), why: t('So your work is there when you come back'), kept: t('Until you delete them (Make with Zee: 24 hours after the last change)') },
        { what: t('ZeeShare history'), why: t('Showing what you shared with your other device'), kept: t('Until you tap Clear history') },
      ],
      after: [t('We don\'t use advertising or tracking cookies, and there is no analytics on this website.')],
    },
    {
      id: 'ai',
      title: t('3. Make with Zee (AI)'),
      paragraphs: [
        t('When you ask Zee to make or change a document, what you typed (and, for a change, the document\'s text) is sent to Google\'s Gemini through Google Firebase to write the answer. We don\'t keep it. Google handles it under its own terms for the Gemini API.'),
        t('To stop misuse, these requests are checked by Firebase App Check, which uses Google reCAPTCHA. reCAPTCHA may look at signals from your browser; Google\'s privacy policy applies to it.'),
      ],
    },
    {
      id: 'chat',
      title: t('4. Accounts and chat (optional)'),
      paragraphs: [
        t('You only need an account for chat. You sign in with Google, and we never see your password. It is the same account as in the ZipyZee Android app, so your chats are on both. We use Google Firebase to store:'),
      ],
      rows: [
        { what: t('Your Google name and email'), why: t('Signing in. Your email stays private: other people only see your name and username.'), kept: t('Until 7 days after you delete your account') },
        { what: t('Name, username and "I am a"'), why: t('So people can find and recognise you'), kept: t('Until 7 days after you delete your account') },
        {
          what: t('Messages, links and files you send'),
          why: t('Delivering them to the people you chose'),
          kept: t('Once everyone has seen them, 1 hour. Not seen, 24 hours (30 days in the ZipyZee Team chat). Sooner when you delete them'),
        },
        { what: t('The people you block'), why: t('Keeping them from messaging you'), kept: t('Until you unblock them or delete your account') },
      ],
    },
    {
      id: 'zeeshare',
      title: t('5. ZeeShare'),
      paragraphs: [
        t('ZeeShare sends text, photos and files straight from one of your devices to the other over an encrypted WebRTC link. No account is needed, and what goes over the direct link is not stored anywhere.'),
        t('To connect the two devices, a pairing room with the 6-digit code, the connection details and the device names (like "Chrome on Android") is kept in Google Firebase for up to 15 minutes. Google\'s STUN servers see both devices\' IP addresses to set up the direct link.'),
        t('While the devices are paired, a small session record (the device names and connection details) stays in Firebase so they can reconnect. It is deleted when either device taps Disconnect, or after 30 days without use.'),
        t('When there\'s no direct link (the other device is closed, or the network doesn\'t allow one), what you send waits in Firebase for the other device: up to 7 days, and it is deleted as soon as the other device receives it.'),
      ],
    },
    {
      id: 'share',
      title: t('6. Who we share data with'),
      paragraphs: [t('Only the services above, and only to do what you asked: Google (Firebase for chat, ZeeShare and AI; Gemini; reCAPTCHA; STUN), Hugging Face and jsDelivr for downloads. We don\'t sell or rent your data, and we don\'t show ads on this website.')],
    },
    {
      id: 'children',
      title: t('7. Children'),
      paragraphs: [t('ZipyZee is not meant for children under 13, and chat needs a Google account. If you think a child has given us personal data, write to us and we\'ll delete it.')],
    },
    {
      id: 'rights',
      title: t('8. Your choices'),
      bullets: [
        t('Ask to delete your account any time on the Delete account page. It is hidden at once, and our team deletes it for good after 7 days; signing in again before then keeps it.'),
        t('Delete any chat message you sent, and clear ZeeShare history, whenever you like.'),
        t('Clear this site\'s data in your browser to remove everything kept on your device.'),
        t('Ask us what we hold about you, or to correct or delete it: {email}.', { email: FEEDBACK_EMAIL }),
      ],
    },
    {
      id: 'changes',
      title: t('9. Changes to this policy'),
      paragraphs: [t('When what leaves your browser changes, we update this page first and change the date at the top.')],
    },
    {
      id: 'contact',
      title: t('10. Contact'),
      paragraphs: [t('Questions about privacy: {email}. We answer within a few days.', { email: FEEDBACK_EMAIL })],
    },
  ];
}
