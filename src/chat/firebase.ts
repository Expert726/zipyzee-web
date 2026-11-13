'use client';
// Chat on the web, on the same Firebase project, data layout and rules as the app (the app's src/chat/firebase.ts,
// firestore.rules), so a chat started on the phone shows here and the other way round. Accounts: Google sign-in only;
// the first sign-in shows Create account (name, a username that can't change later, "I am a"). Messages carry
// expiresAt (24 hours, 1 hour after they're seen, 30 days in the ZipyZee Team chat) like in the app.
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut as authSignOut, type User } from 'firebase/auth';
import {
  arrayRemove, arrayUnion, collection, deleteDoc, disableNetwork, doc, enableNetwork, getDoc, getDocs, getFirestore, limit, onSnapshot, orderBy, query,
  serverTimestamp, setDoc, Timestamp, updateDoc, where, writeBatch, type DocumentData,
} from 'firebase/firestore';
import { t } from '@/i18n';
import { SUPPORT_USERNAME } from '@/config';
import { firebase } from '@/lib/firebase';
import { directChatId, HEARD_LIFE_MS, heardByAll, lastPreview, messageLifeMs, SEEN_LIFE_MS, usernameBase, usernameCandidates } from './format';
import type { Chat, ChatFile, Message, Profile, Role } from './types';
import { commit, CommitError, plusOne, serverTime } from './rest';

/** A failure whose message is safe to show. */
export class ChatError extends Error {}

const db = () => getFirestore(firebase());
const auth = () => getAuth(firebase());
const ms = (v: unknown): number => (v instanceof Timestamp ? v.toMillis() : typeof v === 'number' ? v : 0);

// ---------- accounts ----------

export type AuthUser = { uid: string; email: string | null; name: string | null; photo: string | null };
const toAuthUser = (u: User): AuthUser => ({ uid: u.uid, email: u.email, name: u.displayName, photo: u.photoURL });

export const watchAuth = (cb: (u: AuthUser | null) => void) => onAuthStateChanged(auth(), (u) => cb(u ? toAuthUser(u) : null));

/** Google's account picker in a popup (a full-page redirect when the browser blocks popups). Google only, like the app. */
export async function signInGoogle(): Promise<boolean> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await signInWithPopup(auth(), provider);
    return true;
  } catch (e) {
    const code = (e as { code?: string })?.code ?? '';
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return false;
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth(), provider);
      return false;
    }
    if (code === 'auth/network-request-failed') throw new ChatError(t('No internet connection. Try again.'));
    if (code === 'auth/unauthorized-domain') throw new ChatError(t('This website isn\'t allowed to sign in yet. Add its domain in Firebase, Authentication, Settings, Authorized domains.'));
    throw new ChatError(t('Something went wrong. Try again.'));
  }
}

export const signOut = () => authSignOut(auth());
export const currentUid = (): string | null => auth().currentUser?.uid ?? null;

/** Delete account waits this long; signing in again before then keeps the account. */
export const DELETE_AFTER_MS = 7 * 24 * 3600_000;
const PRIVATE_DOCS = ['tokens', 'account', 'resumeDetails', 'blocks'];

/** The documents that hold the account: profile, username, private data (only those that exist). */
async function accountDocs(uid: string): Promise<{ name: string; username: string | null; findable: boolean; deleteAt: number; privates: string[] }> {
  const prof = await getDoc(doc(db(), 'users', uid));
  if (!prof.exists()) throw new ChatError(t('This account doesn\'t exist any more.'));
  const d = prof.data();
  const privates: string[] = [];
  for (const name of PRIVATE_DOCS) if ((await getDoc(doc(db(), 'users', uid, 'private', name)).catch(() => null))?.exists()) privates.push(name);
  return { name: String(d.name ?? ''), username: typeof d.username === 'string' && d.username ? d.username : null, findable: d.findable !== false, deleteAt: ms(d.deleteAt), privates };
}

/**
 * Delete account (the web's Delete account page): nothing goes at once. The profile, username and private data get
 * deleteAt = in 7 days, the profile is hidden from search, a request goes to the team (deleteRequests/{uid}), and the
 * person is signed out. Signing in again before the team has deleted it keeps everything (restoreAccount); after the
 * 7 days the team deletes it (the admin page, adminDeleteAccount). Returns the date the team may delete it.
 */
export async function scheduleDeletion(): Promise<number> {
  const user = auth().currentUser;
  if (!user) throw new ChatError(t('Sign in first.'));
  const uid = user.uid;
  const at = Date.now() + DELETE_AFTER_MS;
  const deleteAt = Timestamp.fromMillis(at);
  try {
    const a = await accountDocs(uid);
    await commit([
      { path: `deleteRequests/${uid}`, data: { uid, name: a.name.slice(0, 60), username: a.username ?? '', email: user.email ?? '', deleteAt, status: 'pending' }, transforms: [serverTime('requestedAt')] },
      { path: `users/${uid}`, data: { deleteAt, findable: false, wasFindable: a.findable }, mask: ['deleteAt', 'findable', 'wasFindable'], exists: true },
      ...(a.username ? [{ path: `usernames/${a.username}`, data: { deleteAt }, mask: ['deleteAt'], exists: true }] : []),
      ...a.privates.map((name) => ({ path: `users/${uid}/private/${name}`, data: { deleteAt }, mask: ['deleteAt'], exists: true })),
    ]);
  } catch (e) {
    if (e instanceof ChatError) throw e;
    throw new ChatError(t('Could not delete the account. Check your connection and try again.'));
  }
  await authSignOut(auth()).catch(() => {});
  return at;
}

/** Signed in again within the 7 days: the deletion is called off and the account is back as it was. True if it was waiting. */
export async function restoreAccount(uid: string): Promise<boolean> {
  const a = await accountDocs(uid);
  if (!a.deleteAt) return false;
  const was = (await getDoc(doc(db(), 'users', uid))).data()?.wasFindable;
  // a field in the mask but not in the data is removed; the request to the team is withdrawn
  await commit([
    { path: `deleteRequests/${uid}`, delete: true },
    { path: `users/${uid}`, data: { findable: was !== false }, mask: ['deleteAt', 'findable', 'wasFindable'], exists: true },
    ...(a.username ? [{ path: `usernames/${a.username}`, data: {}, mask: ['deleteAt'], exists: true }] : []),
    ...a.privates.map((name) => ({ path: `users/${uid}/private/${name}`, data: {}, mask: ['deleteAt'], exists: true })),
  ]);
  return true;
}

// ---------- the team: account deletion requests ----------

export type DeleteRequest = { uid: string; name: string; username: string; email: string; requestedAt: number; deleteAt: number; status: 'pending' | 'deleted'; doneAt?: number };

/** Every deletion request (the admin page; the rules let only the team read them), oldest deadline first. */
export function watchDeleteRequests(cb: (list: DeleteRequest[]) => void, onError?: () => void) {
  return onSnapshot(
    collection(db(), 'deleteRequests'),
    (snap) =>
      cb(
        snap.docs
          .map((d) => {
            const x = d.data();
            return { uid: d.id, name: String(x.name ?? ''), username: String(x.username ?? ''), email: String(x.email ?? ''), requestedAt: ms(x.requestedAt), deleteAt: ms(x.deleteAt), status: x.status === 'deleted' ? 'deleted' : 'pending', doneAt: ms(x.doneAt) || undefined } as DeleteRequest;
          })
          .sort((a, b) => a.deleteAt - b.deleteAt),
      ),
    () => onError?.(),
  );
}

/**
 * The team carries out a request once its 7 days are over: deletes the person's profile, username, private data and
 * Zee conversations, then marks the request done (keeping only the dates). The Google sign-in itself can only be
 * removed in the Firebase console (Authentication) or by a server; the admin page says so.
 */
export async function adminDeleteAccount(req: DeleteRequest): Promise<void> {
  if (req.deleteAt > Date.now()) throw new ChatError(t('This account can be deleted from {date}.', { date: new Date(req.deleteAt).toLocaleDateString() }));
  const uid = req.uid;
  // signed in again in the meantime? Then the request was withdrawn and there's nothing to do
  const prof = await getDoc(doc(db(), 'users', uid)).catch(() => null);
  if (prof?.exists() && !prof.data().deleteAt) throw new ChatError(t('This person signed in again, so the account stays.'));
  try {
    const writes: Parameters<typeof commit>[0] = [];
    const zee = await getDocs(collection(db(), 'users', uid, 'zee')).catch(() => null);
    for (const conv of zee?.docs ?? []) {
      const msgs = await getDocs(collection(db(), 'users', uid, 'zee', conv.id, 'messages')).catch(() => null);
      for (const m of msgs?.docs ?? []) writes.push({ path: `users/${uid}/zee/${conv.id}/messages/${m.id}`, delete: true });
      writes.push({ path: `users/${uid}/zee/${conv.id}`, delete: true });
    }
    for (const name of PRIVATE_DOCS) writes.push({ path: `users/${uid}/private/${name}`, delete: true });
    const username = prof?.data()?.username ?? req.username;
    if (typeof username === 'string' && username) writes.push({ path: `usernames/${username}`, delete: true });
    writes.push({ path: `users/${uid}`, delete: true });
    // Firestore takes up to 500 writes at once; the request is marked done with the last batch
    const done = { path: `deleteRequests/${uid}`, data: { uid, requestedAt: Timestamp.fromMillis(req.requestedAt || Date.now()), deleteAt: Timestamp.fromMillis(req.deleteAt), status: 'deleted' }, transforms: [serverTime('doneAt')] };
    for (let i = 0; i < writes.length; i += 450) {
      const part = writes.slice(i, i + 450);
      await commit(i + 450 >= writes.length ? [...part, done] : part);
    }
  } catch (e) {
    if (e instanceof ChatError) throw e;
    throw new ChatError(t('Could not delete the account. Check your connection and try again.'));
  }
}

// ---------- profiles and usernames ----------

const toProfile = (uid: string, d: DocumentData): Profile => ({ uid, name: d.name, username: d.username, role: d.role, lastSeen: ms(d.lastSeen) || undefined, findable: d.findable !== false, deleteAt: ms(d.deleteAt) || undefined });

export async function isUsernameFree(username: string): Promise<boolean> {
  return !(await getDoc(doc(db(), 'usernames', username))).exists();
}

/** usernames/{name}, the public profile and the private account record in one batch (the rules check all three). */
export async function claimProfile(uid: string, p: { name: string; username: string; role: Role }) {
  const u = auth().currentUser;
  const batch = writeBatch(db());
  batch.set(doc(db(), 'usernames', p.username), { uid });
  batch.set(doc(db(), 'users', uid), { name: p.name.trim(), username: p.username, role: p.role, findable: true, lastSeen: serverTimestamp() });
  if (u?.email) batch.set(doc(db(), 'users', uid, 'private', 'account'), { email: u.email, provider: 'google', createdAt: serverTimestamp() });
  try {
    await batch.commit();
  } catch (e) {
    if ((e as { code?: string }).code === 'permission-denied' && !(await isUsernameFree(p.username).catch(() => true))) throw new ChatError(t('This username was just taken. Try another.'));
    throw new ChatError(t('Could not save your profile. Try again.'));
  }
}

export async function suggestUsername(email: string | null, name: string | null): Promise<string> {
  const names = usernameCandidates(usernameBase(email, name));
  for (const u of names) if (await isUsernameFree(u).catch(() => false)) return u;
  return names[0] ?? '';
}

export const watchProfile = (uid: string, cb: (p: Profile | null) => void) => onSnapshot(doc(db(), 'users', uid), (s) => cb(s.exists() ? toProfile(uid, s.data()) : null), () => cb(null));

export async function getProfile(uid: string): Promise<Profile | null> {
  const s = await getDoc(doc(db(), 'users', uid));
  return s.exists() ? toProfile(uid, s.data()) : null;
}

export async function profileByUsername(username: string): Promise<Profile | null> {
  const s = await getDoc(doc(db(), 'usernames', username));
  const uid = s.exists() ? (s.data().uid as string) : null;
  return uid ? getProfile(uid) : null;
}

/** People whose username starts with `prefix` (New chat), the exact one first; not those who only take invites. */
export async function searchUsers(prefix: string): Promise<Profile[]> {
  if (!prefix) return [];
  const exact = await profileByUsername(prefix).catch(() => null);
  const found = exact && exact.findable !== false ? [exact] : [];
  try {
    const snap = await getDocs(query(collection(db(), 'users'), where('username', '>=', prefix), where('username', '<=', `${prefix}`), orderBy('username'), limit(20)));
    for (const d of snap.docs) if (d.id !== exact?.uid && d.data().findable !== false && found.length < 10) found.push(toProfile(d.id, d.data()));
  } catch {
    // offline: the exact match (if any) is still shown
  }
  return found;
}

export const updateProfile = (uid: string, p: { name: string; role: Role }) => updateDoc(doc(db(), 'users', uid), { name: p.name.trim(), role: p.role });
export const setFindable = (uid: string, findable: boolean) => updateDoc(doc(db(), 'users', uid), { findable });
export const touchPresence = (uid: string) => updateDoc(doc(db(), 'users', uid), { lastSeen: serverTimestamp() });

// ---------- chats ----------

const toChat = (id: string, d: DocumentData): Chat => {
  const readAt: Record<string, number> = {};
  for (const [k, v] of Object.entries(d.readAt ?? {})) readAt[k] = ms(v);
  return {
    id,
    type: d.type,
    members: d.members ?? [],
    name: d.name,
    createdBy: typeof d.createdBy === 'string' ? d.createdBy : undefined,
    last: d.last ? { id: d.last.id, kind: d.last.kind ?? 'text', text: d.last.text ?? '', from: d.last.from, at: ms(d.last.at), expiresAt: ms(d.last.expiresAt), opened: !!d.last.opened } : undefined,
    unread: d.unread ?? {},
    readAt,
    emergency: d.emergency ?? {},
  };
};

/** My chats with a message, newest first (sorted here, so no composite index is needed; like the app). */
export function watchChats(uid: string, cb: (chats: Chat[]) => void, onError?: (reason: string) => void) {
  const q = query(collection(db(), 'chats'), where('members', 'array-contains', uid), limit(300));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => toChat(d.id, d.data({ serverTimestamps: 'estimate' }))).filter((c) => c.last).sort((a, b) => (b.last?.at ?? 0) - (a.last?.at ?? 0)).slice(0, 100)),
    (e) => {
      const code = String((e as { code?: string })?.code ?? '');
      onError?.(code === 'permission-denied' ? t('Firestore refused the chat list (security rules). Deploy the rules, then try again.') : code === 'unavailable' ? t('Check your connection and try again.') : t('Something went wrong ({code}). Try again.', { code: code || 'unknown' }));
    },
  );
}

export const watchChat = (chatId: string, cb: (c: Chat | null) => void) =>
  onSnapshot(doc(db(), 'chats', chatId), (s) => cb(s.exists() ? toChat(s.id, s.data({ serverTimestamps: 'estimate' })) : null), () => cb(null));

let support: Promise<string | null> | null = null;
/** The ZipyZee Team account's uid (config/support can name another username); null when it isn't there. */
export function supportUid(): Promise<string | null> {
  support ??= (async () => {
    const set = await getDoc(doc(db(), 'config', 'support')).then((s) => s.data()?.username).catch(() => null);
    const name = typeof set === 'string' && set ? set : SUPPORT_USERNAME;
    const uid = (await getDoc(doc(db(), 'usernames', name))).data()?.uid;
    return typeof uid === 'string' ? uid : null;
  })().catch(() => {
    support = null;
    return null;
  });
  return support;
}

export async function openSupportChat(me: string): Promise<string> {
  const uid = await supportUid();
  if (!uid || uid === me) throw new ChatError(t('Support chat isn\'t available right now. Try again later.'));
  return openDirectChat(me, uid);
}

/** The 1-to-1 chat with someone (same id as the app makes: both uids sorted); created the first time. */
export async function openDirectChat(me: string, other: string): Promise<string> {
  const id = directChatId(me, other);
  const r = doc(db(), 'chats', id);
  if (!(await getDoc(r)).exists()) await setDoc(r, { type: 'direct', members: [me, other].sort(), createdBy: me, unread: { [me]: 0, [other]: 0 }, readAt: {} });
  return id;
}

export async function createGroup(me: string, name: string, others: string[]): Promise<string> {
  const r = doc(collection(db(), 'chats'));
  const members = [me, ...others.filter((u) => u !== me)];
  await setDoc(r, {
    type: 'group', name: name.trim(), members, createdBy: me, unread: Object.fromEntries(members.map((u) => [u, 0])), readAt: {},
    last: { kind: 'system', text: 'Group created', from: me, at: serverTimestamp(), expiresAt: Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000) },
  });
  return r.id;
}

export const leaveGroup = (chatId: string, me: string) => updateDoc(doc(db(), 'chats', chatId), { members: arrayRemove(me) });
export const markRead = (chatId: string, me: string) => updateDoc(doc(db(), 'chats', chatId), { [`unread.${me}`]: 0, [`readAt.${me}`]: serverTimestamp() });

const chunksOf = (chatId: string, msgId: string) => collection(db(), 'chats', chatId, 'files', msgId, 'chunks');

/** "Deletes 1 hour after it's seen": the reader moves these messages (and their file pieces) to an hour from now. */
export async function shortenSeen(chatId: string, msgs: Message[], lastId?: string) {
  if (!msgs.length) return;
  const at = Timestamp.fromMillis(Date.now() + SEEN_LIFE_MS);
  const batch = writeBatch(db());
  for (const m of msgs.slice(0, 40)) {
    batch.update(doc(db(), 'chats', chatId, 'messages', m.id), { expiresAt: at });
    for (let i = 0; i < (m.file?.chunks ?? 0); i++) batch.update(doc(chunksOf(chatId, m.id), String(i)), { expiresAt: at });
  }
  if (lastId && msgs.some((m) => m.id === lastId)) batch.update(doc(db(), 'chats', chatId), { 'last.expiresAt': at });
  await batch.commit();
}

export const setBlocked = (me: string, uid: string, on: boolean) => setDoc(doc(db(), 'users', me, 'private', 'blocks'), { uids: on ? arrayUnion(uid) : arrayRemove(uid) }, { merge: true });

export async function blockedUids(me: string): Promise<string[]> {
  const d = await getDoc(doc(db(), 'users', me, 'private', 'blocks')).catch(() => null);
  return (d?.data()?.uids as string[] | undefined) ?? [];
}

// ---------- messages ----------

const toMessage = (id: string, d: DocumentData): Message => ({
  id, from: d.from, kind: d.kind, text: d.text, file: d.file?.path || d.file?.name ? d.file : undefined, link: d.link,
  viewOnce: !!d.viewOnce, allowSave: d.allowSave !== false, opened: !!d.opened, duration: typeof d.duration === 'number' ? d.duration : undefined,
  heard: Array.isArray(d.heard) ? d.heard : undefined, createdAt: ms(d.createdAt), expiresAt: ms(d.expiresAt), editedAt: d.editedAt ? ms(d.editedAt) : undefined,
});

/**
 * Newest first, like the app. My own new messages show at once (Firestore keeps local writes), marked `pending` until
 * the server has them; then a second snapshot clears it (metadata changes are listened to for that).
 */
export function watchMessages(chatId: string, cb: (m: Message[]) => void, onError?: () => void) {
  const q = query(collection(db(), 'chats', chatId, 'messages'), orderBy('createdAt', 'desc'), limit(300));
  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snap) => cb(snap.docs.map((d) => ({ ...toMessage(d.id, d.data({ serverTimestamps: 'estimate' })), pending: d.metadata.hasPendingWrites }))),
    () => (onError ? onError() : cb([])),
  );
}

let reconnecting: Promise<void> | null = null;
/** Drops Firestore's connection and opens a new one, so queued writes go (one at a time). */
export function reconnect(): Promise<void> {
  if (!navigator.onLine) return Promise.resolve();
  reconnecting ??= (async () => {
    try {
      await disableNetwork(db());
    } finally {
      await enableNetwork(db());
      reconnecting = null;
    }
  })();
  return reconnecting;
}

/** What the open chat already knows, so a message is written at once (no reads first, like WhatsApp: no wait). */
export type SendContext = { members: string[]; support: string | null };

type NewMessage = { kind: 'text' | 'file' | 'link' | 'voice'; text?: string; link?: { url: string; domain: string }; file?: ChatFile; viewOnce?: boolean; allowSave?: boolean; duration?: number };

/** A new message's id (made here, so the chat can show it before the server has it). */
export const newMessageId = (chatId: string) => doc(collection(db(), 'chats', chatId, 'messages')).id;

/**
 * The message and, in the same commit, the chat's preview and +1 unread for everyone else (firestore.rules
 * sentMessage). Sent over REST (rest.ts): one HTTPS call that lands or fails at once, never queued for ever.
 */
async function postMessage(chatId: string, from: string, m: NewMessage, msgId = newMessageId(chatId), known?: SendContext) {
  const members: string[] = known?.members ?? (((await getDoc(doc(db(), 'chats', chatId))).data()?.members as string[] | undefined) ?? []);
  const expiresAt = Timestamp.fromMillis(Date.now() + messageLifeMs(chatId, known ? known.support : await supportUid()));
  const others = members.filter((u) => u !== from);
  try {
    await commit([
      { path: `chats/${chatId}/messages/${msgId}`, data: { from, expiresAt, ...m }, transforms: [serverTime('createdAt')], exists: false },
      {
        path: `chats/${chatId}`,
        data: { last: { id: msgId, ...lastPreview(m), from, expiresAt } },
        mask: ['last'],
        transforms: [serverTime('last.at'), ...others.map((u) => plusOne(`unread.${fieldName(u)}`))],
        exists: true,
      },
    ]);
  } catch (e) {
    // already there: an earlier try did land (the answer was lost on the way back)
    if (e instanceof CommitError && (e.status === 'ALREADY_EXISTS' || e.status === 'FAILED_PRECONDITION') && (await getDoc(doc(db(), 'chats', chatId, 'messages', msgId)).then((d) => d.exists(), () => false))) return msgId;
    throw e;
  }
  return msgId;
}

/** A map key in a REST field path (back-quoted unless it's a plain name). */
const fieldName = (k: string) => (/^[A-Za-z_][A-Za-z0-9_]*$/.test(k) ? k : '`' + k.replace(/[`\\]/g, (c) => '\\' + c) + '`');

export const sendText = (chatId: string, from: string, text: string, known?: SendContext, id?: string) => postMessage(chatId, from, { kind: 'text', text: text.trim() }, id, known);
export const sendLink = (chatId: string, from: string, link: { url: string; domain: string }, text?: string, known?: SendContext, id?: string) =>
  postMessage(chatId, from, { kind: 'link', link, ...(text?.trim() ? { text: text.trim() } : {}) }, id, known);

/** One piece of a chat file: 800,000 base64 characters (the app's CHUNK_CHARS), inside Firestore's 1 MiB per document. */
export const CHUNK_CHARS = 800_000;

const toBase64 = async (blob: Blob): Promise<string> => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

/** A file sent as base64 pieces under chats/{chatId}/files/{msgId}/chunks (the app's sendFile; free Firebase plan). */
export async function sendFile(chatId: string, from: string, file: File, extra: { viewOnce?: boolean; allowSave?: boolean; pages?: number } = {}) {
  const msgRef = doc(collection(db(), 'chats', chatId, 'messages'));
  const expiresAt = Timestamp.fromMillis(Date.now() + messageLifeMs(chatId, await supportUid()));
  const b64 = await toBase64(file);
  const chunkPath = (i: number) => `chats/${chatId}/files/${msgRef.id}/chunks/${i}`;
  const count = Math.max(1, Math.ceil(b64.length / CHUNK_CHARS));
  try {
    for (let i = 0; i < count; i++) await commit([{ path: chunkPath(i), data: { d: b64.slice(i * CHUNK_CHARS, (i + 1) * CHUNK_CHARS), from, expiresAt } }]);
  } catch {
    await Promise.all(Array.from({ length: count }, (_, i) => deleteDoc(doc(chunksOf(chatId, msgRef.id), String(i))).catch(() => {})));
    throw new ChatError(t('Could not send the file. Try again.'));
  }
  const name = file.name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 120) || 'file';
  const meta: ChatFile = { path: `chats/${chatId}/${msgRef.id}/${name}`, name, size: file.size, mimeType: file.type || 'application/octet-stream', chunks: count, ...(extra.pages ? { pages: extra.pages } : {}) };
  await postMessage(chatId, from, { kind: 'file', file: meta, ...(extra.viewOnce ? { viewOnce: true } : {}), ...(extra.allowSave === false ? { allowSave: false } : {}) }, msgRef.id);
}

/** A chat file's contents, put back together from its pieces. */
export async function readFile(chatId: string, msgId: string, file: ChatFile): Promise<Blob> {
  const parts: string[] = [];
  for (let i = 0; i < (file.chunks ?? 0); i++) {
    const s = await getDoc(doc(chunksOf(chatId, msgId), String(i)));
    if (!s.exists()) throw new ChatError(t('This file has been deleted.'));
    parts.push(s.data().d as string);
  }
  const bin = atob(parts.join(''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: file.mimeType || 'application/octet-stream' });
}

/** I played someone's voice message: when everyone it was sent to has, it goes in a minute (the app's markHeard). */
export async function markHeard(chatId: string, m: Message, members: string[], me: string, lastId?: string) {
  if (m.from === me || m.heard?.includes(me)) return;
  const batch = writeBatch(db());
  const all = heardByAll(m, members, me);
  const at = Timestamp.fromMillis(Date.now() + HEARD_LIFE_MS);
  batch.update(doc(db(), 'chats', chatId, 'messages', m.id), all ? { heard: arrayUnion(me), expiresAt: at } : { heard: arrayUnion(me) });
  if (all) {
    for (let i = 0; i < (m.file?.chunks ?? 0); i++) batch.update(doc(chunksOf(chatId, m.id), String(i)), { expiresAt: at });
    if (lastId === m.id) batch.update(doc(db(), 'chats', chatId), { 'last.expiresAt': at });
  }
  await batch.commit();
}

/** A message past its time, gone for everyone (any member may; the TTL policy would too). */
export async function deleteExpired(chatId: string, m: Message) {
  const batch = writeBatch(db());
  batch.delete(doc(db(), 'chats', chatId, 'messages', m.id));
  for (let i = 0; i < (m.file?.chunks ?? 0); i++) batch.delete(doc(chunksOf(chatId, m.id), String(i)));
  await batch.commit();
}

/** The sender changes a text message within 5 minutes (firestore.rules editText). */
export async function editMessage(chatId: string, msgId: string, text: string) {
  await updateDoc(doc(db(), 'chats', chatId, 'messages', msgId), { text, editedAt: serverTimestamp() });
  const chatRef = doc(db(), 'chats', chatId);
  if ((await getDoc(chatRef)).data()?.last?.id === msgId) await updateDoc(chatRef, { 'last.text': text }).catch(() => {});
}

/** Delete for everyone (the sender): the message, its file pieces, and the chat preview when it was the latest. */
export async function deleteMessage(chatId: string, msgId: string) {
  const chatRef = doc(db(), 'chats', chatId);
  const last = (await getDoc(chatRef)).data()?.last as DocumentData | undefined;
  const msg = (await getDoc(doc(db(), 'chats', chatId, 'messages', msgId))).data();
  const batch = writeBatch(db());
  batch.delete(doc(db(), 'chats', chatId, 'messages', msgId));
  for (let i = 0; i < Number(msg?.file?.chunks ?? 0); i++) batch.delete(doc(chunksOf(chatId, msgId), String(i)));
  // stored in English like the group's system line; shown with t() (previewText)
  if (last?.id === msgId) batch.update(chatRef, { last: { kind: 'system', text: 'Message deleted', from: last.from, at: last.at, expiresAt: last.expiresAt } });
  await batch.commit();
}
