'use client';
// Firebase for the web: only Zee's Gemini calls (Firebase AI Logic) go through it, protected by App Check, like the
// app's src/chat/firebase.ts. No API key of ours is in the site: the Firebase web config is public by design, and
// App Check (reCAPTCHA Enterprise) proves requests come from this site. Settings: .env.local (see .env.example).
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getToken, initializeAppCheck, ReCaptchaEnterpriseProvider, type AppCheck } from 'firebase/app-check';
import { getAI, getGenerativeModel, GoogleAIBackend, Schema, type ObjectSchema } from 'firebase/ai';
import { t } from '@/i18n';
import { FIREBASE_CONFIG } from '@/config';

/** The same model as the app (src/config.ts ZEE_MODEL): fast, no long thinking. */
export const ZEE_MODEL = process.env.NEXT_PUBLIC_ZEE_MODEL || 'gemini-3.1-flash-lite';

const config = FIREBASE_CONFIG;
const RECAPTCHA_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

/** Zee works on this site (the Firebase web app is set up in .env.local). */
export const zeeReady = () => !!(config.apiKey && config.projectId && config.appId);

/** A failure with a message that is safe (and translated) to show. */
export class ZeeError extends Error {}

let app: FirebaseApp | null = null;
let appCheck: AppCheck | null = null;
/** The site's Firebase app (Zee and chat), App Check started once. */
export function firebase(): FirebaseApp {
  if (app) return app;
  if (!zeeReady()) throw new ZeeError(t('Zee isn\'t set up on this website yet. Try the ZipyZee Android app.'));
  app = getApps().length ? getApp() : initializeApp(config);
  if (process.env.NODE_ENV !== 'production') {
    // development: App Check prints a debug token in the console; add it in Firebase console → App Check → Manage debug tokens
    (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string }).FIREBASE_APPCHECK_DEBUG_TOKEN = process.env.NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN || true;
  }
  if (RECAPTCHA_KEY || process.env.NODE_ENV !== 'production') {
    appCheck = initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_KEY || 'debug'), isTokenAutoRefreshEnabled: true });
  }
  return app;
}

/** This site's App Check token for a direct REST call (null when App Check isn't running or has no token). */
export async function appCheckToken(): Promise<string | null> {
  firebase();
  if (!appCheck) return null;
  try {
    return (await getToken(appCheck, false)).token || null;
  } catch {
    return null;
  }
}

/** Firebase errors as something a person can act on. */
function zeeError(e: unknown): ZeeError {
  if (e instanceof ZeeError) return e;
  const msg = String((e as { message?: string })?.message ?? e).toLowerCase();
  if (!navigator.onLine || msg.includes('failed to fetch') || msg.includes('network')) return new ZeeError(t('Zee needs the internet for this.'));
  if (msg.includes('quota') || msg.includes('429') || msg.includes('resource-exhausted') || msg.includes('rate')) return new ZeeError(t('Zee is busy right now. Try again in a minute.'));
  if (msg.includes('app-check') || msg.includes('appcheck') || msg.includes('recaptcha') || msg.includes('403') || msg.includes('permission')) {
    return new ZeeError(t('Zee couldn\'t confirm this website. Reload the page and try again.'));
  }
  return new ZeeError(t('Zee couldn\'t make it this time. Try again.'));
}

/** One JSON answer in `schema` (the app's generateJson). */
export async function generateJson(prompt: string, systemInstruction: string, schema: (S: typeof Schema) => ObjectSchema, signal?: AbortSignal): Promise<unknown> {
  try {
    const ai = getAI(firebase(), { backend: new GoogleAIBackend() });
    // no thinking setting, like the app (ZEE_THINKING = ''): the answer starts sooner
    const res = await getGenerativeModel(ai, {
      model: ZEE_MODEL,
      systemInstruction,
      generationConfig: { responseMimeType: 'application/json', responseSchema: schema(Schema) },
    }).generateContent(prompt, signal ? { signal } : undefined);
    if (signal?.aborted) throw new ZeeError(t('Cancelled'));
    return JSON.parse(res.response.text());
  } catch (e) {
    if (signal?.aborted) throw new ZeeError(t('Cancelled'));
    if (e instanceof SyntaxError) throw new ZeeError(t('Zee couldn\'t make it this time. Try again.'));
    throw zeeError(e);
  }
}
