/** The web site's own settings. The app's src/config.ts holds the phone side. */
export const SITE_NAME = 'ZipyZee';
/** Set NEXT_PUBLIC_SITE_URL when the domain is bought (docs/WEB_PLAN.md). Used for canonical links and the sitemap. */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
/** The Android app on Google Play (the app's PLAY_URL). */
export const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.zipyzee';

/**
 * The processing screen stays at least this long (the app's MIN_PROCESSING_MS is 10 s, room for an ad later): the
 * progress ring sweeps evenly, never ahead of the real work (src/lib/processingPace.ts). 0 in tests.
 */
export const MIN_PROCESSING_MS = 6000;

/** The app's Firebase Hosting site (the app's INVITE_URL): the Links QR page lives at /l there, so a Links code made
 *  here opens on any phone and in the app's scanner the same way. */
export const INVITE_URL = 'https://zipyzee-e92f1.web.app';

/**
 * The Firebase project the app uses (zipyzee-e92f1), its web app. Public by design (every Firebase web page ships it);
 * what anyone may read or write is decided by firestore.rules, the same rules the app's chat follows. .env.local can
 * override any of these.
 */
export const FIREBASE_CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyA6vu2G40ZKNMiLXcoNTcykg-iMC-gF-Uw',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'zipyzee-e92f1.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'zipyzee-e92f1',
  storageBucket: 'zipyzee-e92f1.firebasestorage.app',
  messagingSenderId: '813467827726',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:813467827726:web:3f730b575a2c4f39d8465f',
  measurementId: 'G-CMNJLQWQGQ',
};

/** Where people write to us (the app's FEEDBACK_EMAIL): Contact us, the privacy policy, account deletion requests. */
export const FEEDBACK_EMAIL = 'apps.zeestudio@gmail.com';

/** The ZipyZee Team account (the app's SUPPORT_USERNAME; Firestore config/support can override it). */
export const SUPPORT_USERNAME = 'zipyzee';
/** Biggest file in a chat (the app's MAX_CHAT_FILE_MB). */
export const MAX_CHAT_FILE_MB = 5;
