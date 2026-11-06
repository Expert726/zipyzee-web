/** The languages alone (no dictionary), for the proxy. */
export const LANGUAGES = ['en', 'ur'] as const;
export type Language = (typeof LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = 'en';
