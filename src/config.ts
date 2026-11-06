/** The web site's own settings. The app's src/config.ts holds the phone side. */
export const SITE_NAME = 'ZipyZee';
/** Set NEXT_PUBLIC_SITE_URL when the domain is bought (docs/WEB_PLAN.md). Used for canonical links and the sitemap. */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
/** The Android app on Google Play (the app's PLAY_URL). */
export const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.zipyzee';
