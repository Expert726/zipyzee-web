'use client';
// ZeeShare: two devices (browser and browser, phone and computer) share text, photos and files, and stay paired until
// one of them taps Disconnect.
//
// Pairing (once):
// 1. One device opens a room: a 6-digit code (and a QR code of a link with it). Its WebRTC offer and an ECDH public key
//    wait in Firestore at zeeshareRooms/{code} for 15 minutes. No account is needed.
// 2. The other device types the code or scans the QR; it writes its answer, its name and its own public key there.
// 3. The first device is asked "<device> wants to connect" (Allow / Decline): someone guessing codes gets nowhere.
// 4. On Allow, both work out the same secret from the two public keys (ECDH): the session's address,
//    zeeshare/{sid}. Someone who saw the room (it holds only public keys) can't work it out. The room is deleted.
//
// The session (until Disconnect; 30 days unopened at most):
// - Direct: a WebRTC data channel between the devices (encrypted by WebRTC): any size, nothing stored on a server.
// - When there's no direct link (the other device is closed, or the network doesn't allow one), what you send waits
//   in zeeshare/{sid}/items (files in pieces, 15 MB at most, 7 days at most); the other device takes it and deletes
//   it as soon as it has it ("Received" on yours).
// - Reloading, closing the tab or losing the network doesn't end anything: both devices keep {sid, role} in this
//   browser and reconnect by themselves. The host makes every new offer (sig), the guest answers (sigAnswer) or asks
//   for one (sigWant), so the two never offer at once.
// - History stays in this browser (IndexedDB, per "thread") even after the session ends; only Clear history removes it.
// - An ended session (Disconnect by mistake, or the session gone) continues: the host reopens the SAME code (Continue),
//   the guest joins it again (Join again). The guest proves it's the same device with sha256(old sid + code), which
//   only the two paired devices can make, so the host lets it in without asking; the chat goes on in the same thread.
// Writes use the REST commit (src/chat/rest.ts): they land or fail at once.
import { collection, doc, getDoc, getFirestore, onSnapshot, query, Timestamp, where, type Unsubscribe } from 'firebase/firestore';
import { commit, CommitError, serverTime } from '@/chat/rest';
import { firebase } from '@/lib/firebase';
import { getAll, write } from '@/lib/idb';
import { deviceName, HIGH_WATER, ITEM_LIFE_MS, itemId, MAX_TEXT, parseWire, PIECE_BYTES, RELAY_MAX_BYTES, RELAY_PIECE_CHARS, ROOM_LIFE_MS, roomCode, safeName, SESSION_LIFE_MS, type Wire } from './protocol';

export type ItemKind = 'text' | 'file';
export type Item = {
  id: string;
  mine: boolean;
  kind: ItemKind;
  text?: string;
  name?: string;
  mime?: string;
  size?: number;
  /** files: the file itself, and a URL for showing / saving it */
  blob?: Blob;
  url?: string;
  /** 0..1 while it's on its way */
  progress: number;
  done: boolean;
  /** mine: the other device has it */
  delivered?: boolean;
  /** mine: sent while there was no direct link (it waits for the other device) */
  waiting?: boolean;
  failed?: 'tooBig' | 'send';
  at: number;
};

export type State =
  | 'idle'
  | 'restoring' // opening a saved session
  | 'creating' // making the room
  | 'waiting' // showing the code
  | 'asking' // someone wants to connect
  | 'joining' // typed a code
  | 'waitingAccept' // waiting for the other device to allow
  | 'connecting' // allowed, first link
  | 'connected' // paired (link: direct or not right now)
  | 'ended' // someone tapped Disconnect
  | 'error';
export type Problem = 'notFound' | 'expired' | 'taken' | 'declined' | 'network' | 'failed' | 'unsupported';
export type Snapshot = {
  state: State;
  code?: string;
  peer?: string;
  link?: 'direct' | 'relay';
  items: Item[];
  problem?: Problem;
  endedByOther?: boolean;
  /** which side this device was: the host can Continue (same code), the guest can Join again */
  role?: 'host' | 'guest';
  /** reopening an ended session (the other device recognised, no Allow needed) */
  continuing?: boolean;
};

type Role = 'host' | 'guest';
type Saved = { sid: string; role: Role; peer: string; code: string; thread: string };
/** The session that ended last: its history, and what's needed to continue it. */
type Last = { role: Role; peer: string; code: string; thread: string; prevSid?: string };
type StoredItem = Omit<Item, 'url' | 'progress'> & { thread: string };

const ICE: RTCConfiguration = { iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }] };
const DIRECT_WAIT_MS = 12_000;
const HEARTBEAT_MS = 5 * 60_000;
const SAVED_KEY = 'zeeshare:session';
const LAST_KEY = 'zeeshare:last';
const db = () => getFirestore(firebase());
const roomPath = (code: string) => `zeeshareRooms/${code}`;
const sessionPath = (sid: string) => `zeeshare/${sid}`;
const later = (ms: number) => Timestamp.fromMillis(Date.now() + ms);
const anon = { anonymous: true };

// ---------- small helpers ----------

/** Waits until the browser has found its network addresses (all go in one offer / answer: one write each). */
function gathered(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((done) => {
    const finish = () => {
      clearTimeout(timer);
      pc.removeEventListener('icegatheringstatechange', check);
      done();
    };
    const check = () => pc.iceGatheringState === 'complete' && finish();
    const timer = setTimeout(finish, 3000);
    pc.addEventListener('icegatheringstatechange', check);
  });
}

const toBase64 = (b: Blob) =>
  new Promise<string>((ok, no) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(',')[1] ?? '');
    r.onerror = () => no(r.error);
    r.readAsDataURL(b);
  });
function fromBase64(b64: string, type: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const b64u = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

/** This device's half of the key exchange. Without WebCrypto (a plain-http address), null: a random secret instead. */
async function newKeys(): Promise<{ pub: string; derive: (otherPub: string) => Promise<string> } | null> {
  if (!globalThis.crypto?.subtle) return null;
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
  const pub = b64u(await crypto.subtle.exportKey('raw', pair.publicKey));
  return {
    pub,
    derive: async (otherPub) => {
      const other = await crypto.subtle.importKey('raw', fromB64u(otherPub), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
      const bits = await crypto.subtle.deriveBits({ name: 'ECDH', public: other }, pair.privateKey, 256);
      return hex(await crypto.subtle.digest('SHA-256', bits)).slice(0, 32);
    },
  };
}
const randomSid = () => hex(crypto.getRandomValues(new Uint8Array(16)).buffer);

function readJson<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') as T | null;
  } catch {
    return null;
  }
}
function writeJson(key: string, v: unknown) {
  try {
    if (v) localStorage.setItem(key, JSON.stringify(v));
    else localStorage.removeItem(key);
  } catch {
    // private window: the session still works while this page is open
  }
}
const okRole = (r: unknown): r is Role => r === 'host' || r === 'guest';
function readSaved(): Saved | null {
  const v = readJson<Saved>(SAVED_KEY);
  return v && /^[0-9a-f]{32}$/.test(v.sid) && okRole(v.role) ? { ...v, thread: v.thread || v.sid, code: v.code || '' } : null;
}
const save = (v: Saved | null) => writeJson(SAVED_KEY, v);
function readLast(): Last | null {
  const v = readJson<Last>(LAST_KEY);
  return v && okRole(v.role) && typeof v.thread === 'string' && /^\d{6}$/.test(v.code) ? v : null;
}
const saveLast = (v: Last | null) => writeJson(LAST_KEY, v);
const newThread = () => hex(crypto.getRandomValues(new Uint8Array(8)).buffer);

/** Proof that this is the device of an earlier session: only the two paired devices know the old session id. */
async function proofOf(prevSid: string, code: string): Promise<string | null> {
  if (!globalThis.crypto?.subtle) return null;
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${prevSid}:${code}`)));
}

async function historyOf(thread: string): Promise<Item[]> {
  const stored = (await getAll<StoredItem>('zeeshare').catch(() => [] as StoredItem[])).filter((x) => x.thread === thread);
  return stored
    .map((x) => ({ id: x.id, mine: x.mine, kind: x.kind, text: x.text, name: x.name, mime: x.mime, size: x.size, blob: x.blob, done: x.done, delivered: x.delivered, waiting: x.waiting, failed: x.failed, at: x.at, progress: 1, ...(x.blob ? { url: URL.createObjectURL(x.blob) } : {}) }))
    .sort((a, b) => a.at - b.at);
}

export class ZeeSession {
  private snap: Snapshot = { state: 'idle', items: [] };
  private listeners = new Set<() => void>();
  private role: Role = 'host';
  private sid: string | null = null;
  private thread: string | null = null; // local history (kept across Continue)
  private code = '';
  private prevSid: string | null = null; // continuing: the session that ended
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private roomUnsubs: Unsubscribe[] = [];
  private sessionUnsubs: Unsubscribe[] = [];
  private timers: ReturnType<typeof setTimeout>[] = [];
  private beat: ReturnType<typeof setInterval> | null = null;
  private keys: Awaited<ReturnType<typeof newKeys>> = null;
  private answer: { sdp: string; guestPub?: string; guestName: string } | null = null;
  private myOffer = 0; // epoch of my offer waiting for an answer (host)
  private answered = 0; // newest offer epoch I answered (guest)
  private wantSeen = 0; // newest "send me an offer" handled (host)
  private pendingAccept: (() => void) | null = null; // guest: the link opening means the host allowed it
  private retryDelay = 15_000;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private queue: Promise<void> = Promise.resolve();
  private incoming: { id: string; mime: string; size: number; parts: ArrayBuffer[]; got: number } | null = null;
  private relayed = new Set<string>();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  readonly myName = typeof navigator === 'undefined' ? 'Browser' : deviceName(navigator.userAgent);

  // ---------- state for React (useSyncExternalStore) ----------

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  get = () => this.snap;
  private set(patch: Partial<Snapshot>) {
    this.snap = { ...this.snap, ...patch };
    this.listeners.forEach((f) => f());
  }
  private addItem(it: Item) {
    this.set({ items: [...this.snap.items.filter((x) => x.id !== it.id), it].sort((a, b) => a.at - b.at) });
    if (it.done) this.store(it);
  }
  private patchItem(id: string, patch: Partial<Item>, soon = false) {
    const i = this.snap.items.findIndex((x) => x.id === id);
    if (i < 0) return;
    // progress updates are many: changed in place, shown at most every 120 ms
    if (soon) {
      this.snap.items[i] = { ...this.snap.items[i], ...patch };
      this.flushTimer ??= setTimeout(() => {
        this.flushTimer = null;
        this.set({ items: [...this.snap.items] });
      }, 120);
      return;
    }
    const it = { ...this.snap.items[i], ...patch };
    this.set({ items: this.snap.items.map((x) => (x.id === id ? it : x)) });
    if (it.done || it.delivered || it.failed) this.store(it);
  }
  /** History, kept in this browser until Clear history. */
  private store(it: Item) {
    if (!this.thread) return;
    const { id, mine, kind, text, name, mime, size, blob, done, delivered, waiting, failed, at } = it;
    void write<StoredItem>('zeeshare', [{ id, mine, kind, text, name, mime, size, blob, done, delivered, waiting, failed, at, thread: this.thread }]).catch(() => {});
  }
  private fail(problem: Problem) {
    this.stopAll();
    this.set({ state: 'error', problem });
  }
  private after(fn: () => void, ms: number) {
    this.timers.push(setTimeout(fn, ms));
  }

  static supported() {
    return typeof RTCPeerConnection !== 'undefined';
  }

  // ---------- opening a saved session (page load) ----------

  /** Reconnects to the session this browser was in, or shows the one that ended (true when there was one). */
  async restore(): Promise<boolean> {
    if (this.snap.state !== 'idle') return false;
    const saved = readSaved();
    if (!saved) return this.showLast();
    this.role = saved.role;
    this.sid = saved.sid;
    this.thread = saved.thread;
    this.code = saved.code;
    this.set({ state: 'restoring', peer: saved.peer, role: saved.role, code: saved.code || undefined });
    // still there? (just after a page load Firestore may think it's offline for a moment: try a few times; if it
    // can't tell, carry on, the session's listener notices a Disconnect)
    let exists = true;
    for (let i = 0; i < 4; i++) {
      try {
        exists = (await getDoc(doc(db(), 'zeeshare', saved.sid))).exists();
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 800));
      }
    }
    this.set({ items: await historyOf(saved.thread) });
    if (!exists) {
      // the other device disconnected while this one was away: the chat stays, and can go on (Continue / Join again)
      this.ended(true);
      return true;
    }
    this.startSession();
    // a fresh link: the host offers; the guest answers the waiting offer (via the listener) or asks for one
    if (this.role === 'host') void this.offer();
    else this.after(() => this.snap.link !== 'direct' && this.askForOffer(), 4000);
    return true;
  }

  /** The session that ended last, with its history and Continue / Join again (true when there is one). */
  async showLast(): Promise<boolean> {
    const last = readLast();
    if (!last) return false;
    this.role = last.role;
    this.thread = last.thread;
    this.code = last.code;
    this.set({ state: 'ended', role: last.role, peer: last.peer, code: last.code, items: await historyOf(last.thread) });
    return true;
  }

  /** Continue the ended session: the host reopens the same code, the guest joins it again. */
  continueLast() {
    const last = readLast();
    if (!last) return;
    const opts = { code: last.code, thread: last.thread, prevSid: last.prevSid, peer: last.peer };
    if (last.role === 'host') void this.host(opts);
    else void this.join(last.code, opts);
  }

  /** Removes the ended session's history from this browser and starts fresh. */
  async clearHistory() {
    const thread = this.thread ?? readLast()?.thread;
    saveLast(null);
    this.reset();
    if (!thread) return;
    const ids = (await getAll<StoredItem>('zeeshare').catch(() => [] as StoredItem[])).filter((x) => x.thread === thread).map((x) => x.id);
    if (ids.length) await write('zeeshare', [], ids).catch(() => {});
  }

  // ---------- pairing: this device opens a room ----------

  async host(opts: { code?: string; thread?: string; prevSid?: string; peer?: string } = {}) {
    if (!ZeeSession.supported()) return this.set({ state: 'error', problem: 'unsupported' });
    this.reset(!!opts.thread);
    this.role = 'host';
    this.thread = opts.thread ?? null;
    this.prevSid = opts.prevSid ?? null;
    this.set({ state: 'creating', role: 'host', continuing: !!opts.thread, peer: opts.peer });
    try {
      this.keys = await newKeys();
      const pc = this.newPeer();
      this.wire(pc.createDataChannel('share', { ordered: true }));
      await pc.setLocalDescription(await pc.createOffer());
      await gathered(pc);
      let code = '';
      for (let attempt = 0; attempt < 5 && !code; attempt++) {
        // continuing: the same code as before (the other device remembers it), unless someone else has it now
        const c = attempt === 0 && opts.code ? opts.code : roomCode();
        try {
          await commit(
            [{ path: roomPath(c), data: { offer: pc.localDescription?.sdp ?? '', hostName: this.myName, hostPub: this.keys?.pub ?? '', expiresAt: later(ROOM_LIFE_MS) }, transforms: [serverTime('createdAt')], exists: false }],
            anon,
          );
          code = c;
        } catch (e) {
          // that code is in use: another one
          if (!(e instanceof CommitError) || (e.status !== 'FAILED_PRECONDITION' && e.status !== 'ALREADY_EXISTS')) throw e;
        }
      }
      if (!code) throw new Error('no free code');
      this.code = code;
      this.set({ state: 'waiting', code });
      this.after(() => this.snap.state === 'waiting' && this.fail('expired'), ROOM_LIFE_MS);
      const expected = this.prevSid ? await proofOf(this.prevSid, code) : null;
      this.roomUnsubs.push(
        onSnapshot(doc(db(), 'zeeshareRooms', code), (s) => {
          const d = s.data();
          if (!d || typeof d.answer !== 'string' || this.answer || this.snap.state !== 'waiting') return;
          this.answer = { sdp: d.answer, guestPub: typeof d.guestPub === 'string' && d.guestPub ? d.guestPub : undefined, guestName: String(d.guestName ?? '').slice(0, 60) || 'Browser' };
          // the device from the session that ended: straight back in; anyone else is asked about
          if (expected && d.proof === expected) {
            this.set({ peer: this.answer.guestName });
            void this.accept();
          } else this.set({ state: 'asking', peer: this.answer.guestName });
        }),
      );
    } catch (e) {
      this.fail(e instanceof CommitError && e.status !== 'network' ? 'failed' : 'network');
    }
  }

  /** The other device may connect: the session starts. */
  async accept() {
    const code = this.snap.code;
    const a = this.answer;
    if (!code || !a || !this.pc) return;
    this.set({ state: 'connecting' });
    try {
      // the same secret on both devices, never written anywhere. Without ECDH on either side (a plain-http address
      // while developing) a random one goes in the room for the guest to read.
      const sid = this.keys && a.guestPub ? await this.keys.derive(a.guestPub) : randomSid();
      this.sid = sid;
      await commit([{ path: sessionPath(sid), data: { hostName: this.myName, guestName: a.guestName, expiresAt: later(SESSION_LIFE_MS) }, transforms: [serverTime('createdAt')], exists: false }], anon);
      if (this.keys && a.guestPub) void commit([{ path: roomPath(code), delete: true }], anon).catch(() => {});
      else await commit([{ path: roomPath(code), data: { sid }, mask: ['sid'], exists: true }], anon);
      this.thread ??= newThread();
      save({ sid, role: 'host', peer: a.guestName, code, thread: this.thread });
      saveLast(null);
      this.stopRoom();
      await this.pc.setRemoteDescription({ type: 'answer', sdp: a.sdp });
      this.startSession();
      this.waitForDirect();
    } catch {
      this.fail('network');
    }
  }

  /** Not this one: the room closes. */
  async decline() {
    const code = this.snap.code;
    if (code) await commit([{ path: roomPath(code), delete: true }], anon).catch(() => {});
    this.stopAll();
    this.set({ state: 'idle', code: undefined, peer: undefined });
  }

  // ---------- pairing: this device joins with a code ----------

  async join(code: string, opts: { thread?: string; prevSid?: string; peer?: string } = {}) {
    if (!ZeeSession.supported()) return this.set({ state: 'error', problem: 'unsupported' });
    this.reset(!!opts.thread);
    this.role = 'guest';
    this.code = code;
    this.thread = opts.thread ?? null;
    this.set({ state: 'joining', code, role: 'guest', continuing: !!opts.thread, peer: opts.peer });
    try {
      const s = await getDoc(doc(db(), 'zeeshareRooms', code));
      const d = s.data();
      if (!d) return this.fail('notFound');
      if (d.expiresAt instanceof Timestamp && d.expiresAt.toMillis() < Date.now()) return this.fail('expired');
      if (d.answer) return this.fail('taken');
      const hostName = String(d.hostName ?? '').slice(0, 60) || 'Browser';
      const hostPub = typeof d.hostPub === 'string' ? d.hostPub : '';
      this.keys = hostPub ? await newKeys() : null;
      const pc = this.newPeer();
      pc.ondatachannel = (e) => this.wire(e.channel);
      await pc.setRemoteDescription({ type: 'offer', sdp: String(d.offer) });
      await pc.setLocalDescription(await pc.createAnswer());
      await gathered(pc);
      // continuing: proof that this is the same device as before, so the host doesn't have to Allow again
      const proof = opts.prevSid ? await proofOf(opts.prevSid, code) : null;
      try {
        await commit(
          [{ path: roomPath(code), data: { answer: pc.localDescription?.sdp ?? '', guestName: this.myName, guestPub: this.keys?.pub ?? '', ...(proof ? { proof } : {}) }, mask: ['answer', 'guestName', 'guestPub', ...(proof ? ['proof'] : [])], exists: true }],
          anon,
        );
      } catch (e) {
        return this.fail(e instanceof CommitError && e.status === 'network' ? 'network' : 'taken');
      }
      this.set({ state: 'waitingAccept', peer: hostName });
      const sid = this.keys ? await this.keys.derive(hostPub) : null;
      const accepted = (id: string) => {
        if (this.sid) return;
        this.pendingAccept = null;
        this.sid = id;
        this.thread ??= newThread();
        save({ sid: id, role: 'guest', peer: hostName, code, thread: this.thread });
        saveLast(null);
        this.stopRoom();
        if (this.snap.state !== 'connected') this.set({ state: 'connecting' });
        this.startSession();
        this.waitForDirect();
      };
      // allowed = the session appears (at the address only these two devices can work out), or the link opens (the
      // host only links after Allow); declined = the room goes
      if (sid) this.pendingAccept = () => accepted(sid);
      if (sid) this.roomUnsubs.push(onSnapshot(doc(db(), 'zeeshare', sid), (x) => x.exists() && accepted(sid)));
      this.roomUnsubs.push(
        onSnapshot(doc(db(), 'zeeshareRooms', code), (x) => {
          const r = x.data();
          if (r && typeof r.sid === 'string' && /^[0-9a-f]{32}$/.test(r.sid)) return accepted(r.sid);
          // the room is gone: allowed (the session exists) or declined. Asked directly, a few times, so a slow
          // network never turns an Allow into a Decline.
          if (!x.exists() && !this.sid)
            void (async () => {
              for (let i = 0; i < 5 && !this.sid; i++) {
                if (sid) {
                  const there = await getDoc(doc(db(), 'zeeshare', sid)).then((d) => d.exists(), () => null);
                  if (there) return accepted(sid);
                  if (there === false && i >= 2) break;
                }
                await new Promise((r) => setTimeout(r, 1500));
              }
              if (!this.sid && this.snap.state === 'waitingAccept') this.fail('declined');
            })();
        }),
      );
      this.after(() => this.snap.state === 'waitingAccept' && this.fail('expired'), ROOM_LIFE_MS);
    } catch {
      this.fail('network');
    }
  }

  // ---------- the session: listening, reconnecting, staying alive ----------

  private startSession() {
    const sid = this.sid;
    if (!sid || this.sessionUnsubs.length) return;
    if (this.snap.state !== 'connecting') this.set({ state: 'connected', link: this.dc?.readyState === 'open' ? 'direct' : 'relay' });
    const other: Role = this.role === 'host' ? 'guest' : 'host';
    this.sessionUnsubs.push(
      onSnapshot(doc(db(), 'zeeshare', sid), (s) => {
        const d = s.data();
        if (!d) {
          // the other device tapped Disconnect
          if (this.snap.state === 'connected' || this.snap.state === 'connecting') void this.endedByOther();
          return;
        }
        // the guest answers each new offer; the host takes the answer to its own offer, and offers when asked
        const sig = d.sig as { epoch?: number; by?: string; offer?: string } | undefined;
        if (this.role === 'guest' && sig?.by === 'host' && typeof sig.offer === 'string' && (sig.epoch ?? 0) > this.answered) void this.answerOffer(sig.epoch ?? 0, sig.offer);
        const ans = d.sigAnswer as { epoch?: number; answer?: string } | undefined;
        if (this.role === 'host' && this.myOffer && ans?.epoch === this.myOffer && typeof ans.answer === 'string') {
          const sdp = ans.answer;
          this.myOffer = 0;
          void this.pc?.setRemoteDescription({ type: 'answer', sdp }).catch(() => {});
        }
        const want = typeof d.sigWant === 'number' ? d.sigWant : 0;
        if (this.role === 'host' && want > this.wantSeen) {
          const fresh = this.wantSeen > 0 || Date.now() - want < 60_000;
          this.wantSeen = want;
          if (fresh) void this.offer();
        }
      }),
      onSnapshot(query(collection(db(), 'zeeshare', sid, 'items'), where('from', '==', other)), (s) => {
        for (const ch of s.docChanges()) if (ch.type === 'added') void this.relayReceive(sid, ch.doc.id, ch.doc.data());
      }),
      // the other device deletes what it has received: that's my "Received" tick
      onSnapshot(query(collection(db(), 'zeeshare', sid, 'items'), where('from', '==', this.role)), (s) => {
        for (const ch of s.docChanges()) if (ch.type === 'removed') this.patchItem(ch.doc.id, { delivered: true, done: true, progress: 1, waiting: false });
      }),
    );
    // still here: the session stays (30 days from the last time either device had it open)
    this.scheduleRetry();
    const alive = () => void commit([{ path: sessionPath(sid), data: { expiresAt: later(SESSION_LIFE_MS) }, mask: ['expiresAt'], exists: true }], anon).catch(() => {});
    alive();
    this.beat = setInterval(alive, HEARTBEAT_MS);
  }

  /** Host: a new offer for a new direct link (on opening, when asked, when the link drops). */
  private async offer() {
    const sid = this.sid;
    if (!sid || this.role !== 'host') return;
    try {
      this.closePeer();
      const pc = this.newPeer();
      this.wire(pc.createDataChannel('share', { ordered: true }));
      await pc.setLocalDescription(await pc.createOffer());
      await gathered(pc);
      if (this.pc !== pc) return;
      const epoch = Date.now();
      this.myOffer = epoch;
      await commit([{ path: sessionPath(sid), data: { sig: { epoch, by: 'host', offer: pc.localDescription?.sdp ?? '' } }, mask: ['sig'], exists: true }], anon);
    } catch {
      // offline: the next chance (reload, the network back) tries again
    }
  }

  /** Guest: answers the host's newest offer. */
  private async answerOffer(epoch: number, sdp: string) {
    const sid = this.sid;
    if (!sid) return;
    this.answered = epoch;
    try {
      this.closePeer();
      const pc = this.newPeer();
      pc.ondatachannel = (e) => this.wire(e.channel);
      await pc.setRemoteDescription({ type: 'offer', sdp });
      await pc.setLocalDescription(await pc.createAnswer());
      await gathered(pc);
      if (this.pc !== pc) return;
      await commit([{ path: sessionPath(sid), data: { sigAnswer: { epoch, by: 'guest', answer: pc.localDescription?.sdp ?? '' } }, mask: ['sigAnswer'], exists: true }], anon);
    } catch {
      // a newer offer will come
    }
  }

  /** Guest: asks the host for a new offer. */
  private askForOffer() {
    const sid = this.sid;
    if (!sid || this.role !== 'guest' || this.snap.link === 'direct') return;
    void commit([{ path: sessionPath(sid), data: { sigWant: Date.now() }, mask: ['sigWant'], exists: true }], anon).catch(() => {});
  }

  /** No direct link: try again after 15 s, 30 s, 1 min, then every 2 min (the guest asks, the host offers). */
  private scheduleRetry() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (this.snap.state !== 'connected' && this.snap.state !== 'connecting') return;
      if (this.snap.link !== 'direct') {
        if (this.role === 'guest') this.askForOffer();
        this.retryDelay = Math.min(this.retryDelay * 2, 120_000);
      }
      this.scheduleRetry();
    }, this.retryDelay);
  }

  /** The direct link dropped (the other tab reloaded, the network changed): try again in a moment. */
  private linkLost() {
    if (this.snap.state !== 'connected') return;
    this.retryDelay = 15_000;
    this.set({ link: 'relay' });
    this.after(() => this.nudge(), 2500);
  }

  /** Back online, or the tab shown again: a new direct link if there isn't one. */
  nudge() {
    if (this.snap.state !== 'connected' || this.snap.link === 'direct') return;
    if (this.role === 'host') void this.offer();
    else this.askForOffer();
  }

  // ---------- the direct link ----------

  private newPeer() {
    const pc = new RTCPeerConnection(ICE);
    this.pc = pc;
    pc.onconnectionstatechange = () => {
      if (this.pc !== pc) return;
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        if (this.snap.state === 'connecting') this.set({ state: 'connected', link: 'relay' });
        else if (this.snap.link === 'direct') this.linkLost();
      }
    };
    return pc;
  }

  private closePeer() {
    const pc = this.pc;
    const dc = this.dc;
    this.pc = null;
    this.dc = null;
    try {
      dc?.close();
      pc?.close();
    } catch {
      // already closed
    }
  }

  /** No direct link in 12 s: paired anyway, things go through ZipyZee until one comes. */
  private waitForDirect() {
    this.after(() => {
      if (this.snap.state === 'connecting') this.set({ state: 'connected', link: 'relay' });
    }, DIRECT_WAIT_MS);
  }

  private wire(dc: RTCDataChannel) {
    this.dc = dc;
    dc.binaryType = 'arraybuffer';
    dc.bufferedAmountLowThreshold = 1024 * 1024;
    dc.onopen = () => {
      if (this.dc !== dc) return;
      this.pendingAccept?.();
      this.retryDelay = 15_000;
      this.sendWire({ t: 'hello', name: this.myName });
      this.set({ state: 'connected', link: 'direct' });
    };
    dc.onmessage = (e) => (typeof e.data === 'string' ? this.onWire(parseWire(e.data)) : this.onPiece(e.data as ArrayBuffer));
    dc.onclose = () => {
      if (this.dc === dc && this.snap.link === 'direct') this.linkLost();
    };
  }

  private sendWire(w: Wire) {
    if (this.dc?.readyState === 'open') this.dc.send(JSON.stringify(w));
  }

  private onWire(w: Wire | null) {
    if (!w) return;
    switch (w.t) {
      case 'hello':
        this.set({ peer: w.name });
        return;
      case 'text':
        this.addItem({ id: w.id, mine: false, kind: 'text', text: w.text, progress: 1, done: true, at: Date.now() });
        return this.sendWire({ t: 'got', id: w.id });
      case 'file':
        this.incoming = { id: w.id, mime: w.mime, size: w.size, parts: [], got: 0 };
        return this.addItem({ id: w.id, mine: false, kind: 'file', name: w.name, mime: w.mime, size: w.size, progress: 0, done: false, at: Date.now() });
      case 'end': {
        const f = this.incoming;
        if (!f || f.id !== w.id) return;
        this.incoming = null;
        const blob = new Blob(f.parts, { type: f.mime || 'application/octet-stream' });
        this.patchItem(f.id, { blob, url: URL.createObjectURL(blob), progress: 1, done: true });
        return this.sendWire({ t: 'got', id: w.id });
      }
      case 'got':
        return this.patchItem(w.id, { delivered: true, done: true, progress: 1 });
      case 'bye':
        void this.endedByOther();
        return;
    }
  }

  private onPiece(buf: ArrayBuffer) {
    const f = this.incoming;
    if (!f) return;
    f.parts.push(buf);
    f.got += buf.byteLength;
    this.patchItem(f.id, { progress: f.size ? Math.min(1, f.got / f.size) : 1 }, true);
  }

  // ---------- sending ----------

  sendText(text: string) {
    const body = text.trim().slice(0, MAX_TEXT);
    if (!body || !this.sid) return;
    const id = itemId();
    const at = Date.now();
    this.addItem({ id, mine: true, kind: 'text', text: body, progress: 0, done: false, at });
    this.enqueue(async () => {
      if (this.dc?.readyState === 'open') {
        this.sendWire({ t: 'text', id, text: body, at });
        this.patchItem(id, { progress: 1, done: true });
      } else {
        await commit([{ path: `${sessionPath(this.sid!)}/items/${id}`, data: { from: this.role, kind: 'text', text: body, at, expiresAt: later(ITEM_LIFE_MS) } }], anon);
        this.patchItem(id, { progress: 1, done: true, waiting: true });
      }
    }, id);
  }

  sendFiles(files: File[]) {
    if (!this.sid) return;
    for (const file of files) {
      const id = itemId();
      const at = Date.now();
      this.addItem({ id, mine: true, kind: 'file', name: safeName(file.name), mime: file.type, size: file.size, blob: file, url: URL.createObjectURL(file), progress: 0, done: false, at });
      this.enqueue(() => (this.dc?.readyState === 'open' ? this.directFile(id, file, at) : this.relayFile(id, file, at)), id);
    }
  }

  /** Tap a failed one to try again. */
  retry(id: string) {
    const it = this.snap.items.find((x) => x.id === id && x.mine && x.failed === 'send');
    if (!it) return;
    this.patchItem(id, { failed: undefined, progress: 0, done: false });
    if (it.kind === 'text' && it.text) {
      const body = it.text;
      this.enqueue(async () => {
        if (this.dc?.readyState === 'open') {
          this.sendWire({ t: 'text', id, text: body, at: it.at });
          this.patchItem(id, { progress: 1, done: true });
        } else {
          await commit([{ path: `${sessionPath(this.sid!)}/items/${id}`, data: { from: this.role, kind: 'text', text: body, at: it.at, expiresAt: later(ITEM_LIFE_MS) } }], anon);
          this.patchItem(id, { progress: 1, done: true, waiting: true });
        }
      }, id);
    } else if (it.blob) {
      const file = new File([it.blob], it.name ?? 'file', { type: it.mime });
      this.enqueue(() => (this.dc?.readyState === 'open' ? this.directFile(id, file, it.at) : this.relayFile(id, file, it.at)), id);
    }
  }

  /** One at a time, so one file's pieces never mix with another's. */
  private enqueue(job: () => Promise<void>, id: string) {
    this.queue = this.queue.then(job).catch(() => this.patchItem(id, { failed: 'send' }));
  }

  private async directFile(id: string, file: File, at: number) {
    const dc = this.dc;
    if (!dc || dc.readyState !== 'open') return this.relayFile(id, file, at);
    this.sendWire({ t: 'file', id, name: file.name, mime: file.type, size: file.size, at });
    for (let o = 0; o < file.size; o += PIECE_BYTES) {
      const piece = await file.slice(o, o + PIECE_BYTES).arrayBuffer();
      while (dc.bufferedAmount > HIGH_WATER) {
        await new Promise<void>((ok) => {
          dc.addEventListener('bufferedamountlow', () => ok(), { once: true });
          setTimeout(ok, 1000);
        });
        if (dc.readyState !== 'open') throw new Error('closed');
      }
      dc.send(piece);
      this.patchItem(id, { progress: Math.min(1, (o + piece.byteLength) / file.size) }, true);
    }
    this.sendWire({ t: 'end', id });
    this.patchItem(id, { progress: 1, done: true });
  }

  // ---------- through ZipyZee (no direct link right now) ----------

  private async relayFile(id: string, file: File, at: number) {
    if (file.size > RELAY_MAX_BYTES) {
      this.patchItem(id, { failed: 'tooBig' });
      return;
    }
    const base = sessionPath(this.sid!);
    const b64 = await toBase64(file);
    const count = Math.max(1, Math.ceil(b64.length / RELAY_PIECE_CHARS));
    for (let i = 0; i < count; i++) {
      await commit([{ path: `${base}/pieces/${id}_${i}`, data: { d: b64.slice(i * RELAY_PIECE_CHARS, (i + 1) * RELAY_PIECE_CHARS), expiresAt: later(ITEM_LIFE_MS) } }], anon);
      this.patchItem(id, { progress: (i + 1) / (count + 1) }, true);
    }
    await commit([{ path: `${base}/items/${id}`, data: { from: this.role, kind: 'file', name: file.name.slice(0, 255), mime: file.type.slice(0, 120), size: file.size, pieces: count, at, expiresAt: later(ITEM_LIFE_MS) } }], anon);
    this.patchItem(id, { progress: 1, done: true, waiting: true });
  }

  private async relayReceive(sid: string, id: string, d: Record<string, unknown>) {
    if (this.relayed.has(id) || !/^[a-z0-9]{1,40}$/.test(id) || this.snap.items.some((x) => x.id === id && x.done)) return;
    this.relayed.add(id);
    const at = typeof d.at === 'number' ? d.at : Date.now();
    const base = sessionPath(sid);
    if (d.kind === 'text' && typeof d.text === 'string') {
      this.addItem({ id, mine: false, kind: 'text', text: d.text.slice(0, MAX_TEXT), progress: 1, done: true, at });
      await commit([{ path: `${base}/items/${id}`, delete: true }], anon).catch(() => {});
      return;
    }
    if (d.kind !== 'file') return;
    const pieces = Math.min(32, Math.max(0, Number(d.pieces) || 0));
    const mime = typeof d.mime === 'string' ? d.mime.slice(0, 120) : 'application/octet-stream';
    this.addItem({ id, mine: false, kind: 'file', name: safeName(String(d.name ?? 'file')), mime, size: Number(d.size) || 0, progress: 0, done: false, at });
    try {
      const parts: string[] = [];
      for (let i = 0; i < pieces; i++) {
        const p = await getDoc(doc(db(), 'zeeshare', sid, 'pieces', `${id}_${i}`));
        parts.push(String(p.data()?.d ?? ''));
        this.patchItem(id, { progress: (i + 1) / pieces }, true);
      }
      const blob = fromBase64(parts.join(''), mime);
      this.patchItem(id, { blob, url: URL.createObjectURL(blob), progress: 1, done: true });
      // received: gone from Firestore at once
      await commit([{ path: `${base}/items/${id}`, delete: true }, ...Array.from({ length: pieces }, (_, i) => ({ path: `${base}/pieces/${id}_${i}`, delete: true as const }))], anon).catch(() => {});
    } catch {
      this.relayed.delete(id);
      this.patchItem(id, { failed: 'send' });
    }
  }

  // ---------- ending ----------

  /** Disconnect: the session ends on both devices (the other one is told). The chat stays; it can be continued. */
  async disconnect() {
    const sid = this.sid;
    this.sendWire({ t: 'bye' });
    this.ended(false);
    if (sid) await commit([{ path: sessionPath(sid), delete: true }], anon).catch(() => {});
  }

  private async endedByOther() {
    this.ended(true);
  }

  /** Ended (by either side, or the session is gone): the history stays here, with Continue / Join again. */
  private ended(byOther: boolean) {
    const sid = this.sid;
    this.stopAll();
    if (this.thread && /^\d{6}$/.test(this.code)) saveLast({ role: this.role, peer: this.snap.peer ?? '', code: this.code, thread: this.thread, ...(sid ? { prevSid: sid } : {}) });
    save(null);
    this.sid = null;
    this.set({ state: 'ended', endedByOther: byOther, link: undefined, role: this.role, code: this.code || undefined, continuing: false });
  }

  /** The page is going away: the session stays (both devices reconnect later); only the link closes. */
  suspend() {
    this.stopAll();
  }

  private stopRoom() {
    this.roomUnsubs.forEach((u) => u());
    this.roomUnsubs = [];
  }

  private stopAll() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
    if (this.beat) clearInterval(this.beat);
    this.beat = null;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.stopRoom();
    this.sessionUnsubs.forEach((u) => u());
    this.sessionUnsubs = [];
    this.closePeer();
  }

  /** Back to the start (a new code, or after an ended session). `keepItems`: continuing, the chat stays on screen. */
  reset(keepItems = false) {
    const code = this.snap.code;
    if (code && this.role === 'host' && (this.snap.state === 'waiting' || this.snap.state === 'asking')) void commit([{ path: roomPath(code), delete: true }], anon).catch(() => {});
    this.stopAll();
    const items = keepItems ? this.snap.items : [];
    if (!keepItems) for (const it of this.snap.items) if (it.url) URL.revokeObjectURL(it.url);
    this.sid = null;
    this.thread = null;
    this.prevSid = null;
    this.answer = null;
    this.keys = null;
    this.myOffer = 0;
    this.answered = 0;
    this.wantSeen = 0;
    this.pendingAccept = null;
    this.retryDelay = 15_000;
    this.incoming = null;
    this.relayed.clear();
    this.queue = Promise.resolve();
    this.snap = { state: 'idle', items };
    this.listeners.forEach((f) => f());
  }
}
