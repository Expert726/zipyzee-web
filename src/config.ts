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
