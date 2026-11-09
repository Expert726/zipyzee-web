'use client';
// Chat writes over Firestore's REST API (documents:commit) instead of the SDK's streaming write channel. The SDK queues
// writes and silently retries some failures for ever, so a dead or blocked write channel left messages on 🕓 while
// reading still worked. A commit is one HTTPS call, signed with the person's Google login (the same security rules
// apply), all its writes land together or none do, and a failure comes back at once with its reason.
import { getAuth } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';
import { appCheckToken, firebase } from '@/lib/firebase';
import { FIREBASE_CONFIG } from '@/config';

const ROOT = `projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents`;

type Value =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { stringValue: string }
  | { timestampValue: string }
  | { arrayValue: { values: Value[] } }
  | { mapValue: { fields: Record<string, Value> } };

/** A JS value as a Firestore REST value (strings, numbers, booleans, null, Timestamps, arrays, plain objects). */
export function encode(v: unknown): Value {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (v instanceof Timestamp) return { timestampValue: v.toDate().toISOString() };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encode) } };
  return { mapValue: { fields: fields(v as Record<string, unknown>) } };
}

const fields = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, x]) => x !== undefined).map(([k, x]) => [k, encode(x)]));

export type Transform = { fieldPath: string; setToServerValue: 'REQUEST_TIME' } | { fieldPath: string; increment: Value };
export const serverTime = (fieldPath: string): Transform => ({ fieldPath, setToServerValue: 'REQUEST_TIME' });
export const plusOne = (fieldPath: string): Transform => ({ fieldPath, increment: { integerValue: '1' } });

export type Write = {
  /** e.g. chats/abc/messages/xyz */
  path: string;
  data: Record<string, unknown>;
  /** only these top-level fields change (an update); without it the document is replaced (a set) */
  mask?: string[];
  transforms?: Transform[];
  /** the document must (true) or must not (false) exist already */
  exists?: boolean;
};

/** A failed commit, with Firestore's status (PERMISSION_DENIED, RESOURCE_EXHAUSTED...) or 'network'. */
export class CommitError extends Error {
  constructor(
    readonly status: string,
    message: string,
  ) {
    super(message);
  }
}

export async function commit(writes: Write[], signal?: AbortSignal): Promise<void> {
  const user = getAuth(firebase()).currentUser;
  if (!user) throw new CommitError('UNAUTHENTICATED', 'Not signed in');
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` };
  const check = await appCheckToken();
  if (check) headers['X-Firebase-AppCheck'] = check;
  const body = {
    writes: writes.map((w) => ({
      update: { name: `${ROOT}/${w.path}`, fields: fields(w.data) },
      ...(w.mask ? { updateMask: { fieldPaths: w.mask } } : {}),
      ...(w.transforms?.length ? { updateTransforms: w.transforms } : {}),
      ...(w.exists !== undefined ? { currentDocument: { exists: w.exists } } : {}),
    })),
  };
  let res: Response;
  try {
    res = await fetch(`https://firestore.googleapis.com/v1/${ROOT}:commit?key=${FIREBASE_CONFIG.apiKey}`, { method: 'POST', headers, body: JSON.stringify(body), signal });
  } catch (e) {
    throw new CommitError('network', String((e as Error)?.message ?? e));
  }
  if (res.ok) return;
  const err = (await res.json().catch(() => null)) as { error?: { status?: string; message?: string } } | null;
  const status = err?.error?.status ?? String(res.status);
  // shown in the console so a stuck chat can be explained (quota, rules, App Check...)
  console.warn('[chat] Firestore commit failed:', status, err?.error?.message ?? '');
  throw new CommitError(status, err?.error?.message ?? res.statusText);
}
