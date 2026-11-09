// Copied from the app (src/chat/types.ts); keep the two the same.
// Chat data as the app sees it (Firestore timestamps turned into ms). Firestore layout: firestore.rules at the repo root.
/** admin: the ZipyZee Team account only, set in the Firebase console (the app never offers or sets it). */
export type Role = 'student' | 'professional' | 'other' | 'admin';

/** findable: shows up in New chat's @username search (Settings, "Who can message me": Anyone). */
/** gone: no profile any more (the account was deleted); kept so the app stops looking it up and says so. */
export type Profile = { uid: string; name: string; username: string; role: Role; lastSeen?: number; findable?: boolean; gone?: boolean };

/** chunks: the file is stored in Firestore as this many pieces (chats/{chatId}/files/{msgId}/chunks/{0..}). */
export type ChatFile = { path: string; name: string; size: number; mimeType: string; pages?: number; chunks?: number };

export type ChatLink = { url: string; domain: string; title?: string };

export type Message = {
  id: string;
  from: string;
  kind: 'text' | 'file' | 'link' | 'voice';
  text?: string;
  /** Missing once a view-once file has been opened (the file is deleted). */
  file?: ChatFile;
  link?: ChatLink;
  viewOnce?: boolean;
  /** false = view only in the app (no Open with, Share or Download). */
  allowSave?: boolean;
  opened?: boolean;
  /** Voice messages: length in seconds, and who has played it (it deletes a minute after everyone has). */
  duration?: number;
  heard?: string[];
  createdAt: number;
  expiresAt: number;
  /** Text messages the sender changed (within EDIT_WINDOW_MS of sending): when; the bubble says "Edited". */
  editedAt?: number;
  /** Web only: still on this device, not yet saved on the server (the 🕓 before the first tick). */
  pending?: boolean;
  /** the web chat's outbox: sending failed (tap to try again) */
  failed?: boolean;
};

/**
 * Latest message, for the Chats list (written by the onMessageCreated Cloud Function). text: the message text, the
 * file name or the group's system line; opened: a view-once file that has been opened.
 */
export type ChatLast = {
  id?: string;
  kind: 'text' | 'file' | 'link' | 'viewOnce' | 'system' | 'voice';
  text: string;
  from: string;
  at: number;
  expiresAt: number;
  opened?: boolean;
};

export type Chat = {
  id: string;
  type: 'direct' | 'group';
  members: string[];
  /** Group name. */
  name?: string;
  /** Who made the chat (a group made by someone I blocked is hidden). */
  createdBy?: string;
  last?: ChatLast;
  /** Unread count per member uid. */
  unread: Record<string, number>;
  /** When each member last read the chat (ms). */
  readAt: Record<string, number>;
  /** Emergency voice (1-to-1): who has it on. On for the chat when both have. */
  emergency?: Record<string, boolean>;
};
