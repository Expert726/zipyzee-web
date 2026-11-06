import type { LucideIcon } from 'lucide-react';

export type CategoryId = 'pdf' | 'image' | 'scan' | 'convert' | 'everyday' | 'ai';

/** device = on the phone (in the browser on the web), server = our conversion server, api = AI through our backend. */
export type Engine = 'device' | 'server' | 'api';

/** What step 1 (Choose files) asks for. */
export type InputKind = 'pdf' | 'pdfs' | 'image' | 'images' | 'office' | 'camera' | 'url' | 'archive' | 'files' | 'sheet' | 'sheets';

/** Tools that take several files (a list you can add to and reorder). */
export const multiInput = (input: InputKind) => input === 'pdfs' || input === 'images' || input === 'files' || input === 'sheets';

/** Text fields are English keys (translate them where shown). */
export type Tool = {
  id: string;
  name: string;
  description: string;
  category: CategoryId;
  icon: LucideIcon;
  engine: Engine;
  input: InputKind;
  homePick?: boolean;
  comingSoon?: boolean;
  minFiles?: number;
  /** Main button on the setup step; `{count}` = number of files. */
  verb: string;
  processing: string;
  next?: string;
  /** Works on the web site now. */
  web: boolean;
};

// ---- options rendered by the setup step (src/tools/options.ts) ----
export type Choice = { label: string; value: string };
export type OptionField =
  | { kind: 'segmented'; key: string; label: string; options: Choice[]; default: string }
  | { kind: 'toggle'; key: string; label: string; sub?: string; default: boolean }
  | { kind: 'chips'; key: string; label: string; options: Choice[]; default: string }
  | { kind: 'text'; key: string; label: string; default: string; hint?: string; placeholder?: string; numeric?: boolean }
  | { kind: 'slider'; key: string; label: string; min: number; max: number; step?: number; default: number; unit?: string }
  | { kind: 'note'; text: string };

export type OptionValue = string | number | boolean;
export type OptionValues = Record<string, OptionValue>;

export type ToolOptions = {
  fields: OptionField[];
  visible?: (key: string, v: OptionValues) => boolean;
  /** An error to show under the button (already translated, browser-only t()), or null. */
  validate?: (v: OptionValues, files: File[]) => string | null;
};

// ---- handlers ----
export type OutputFile = { name: string; blob: Blob };
export type ToolResult = { title: string; subtitle?: string; files: OutputFile[] };

export type ToolContext = {
  tool: Tool;
  files: File[];
  options: OptionValues;
  onProgress: (done: number, total: number, label: string) => void;
  signal: { cancelled: boolean };
};

export type ToolHandler = (ctx: ToolContext) => Promise<ToolResult>;

/** A failure with a message that is safe (and translated) to show. */
export class ToolError extends Error {}
