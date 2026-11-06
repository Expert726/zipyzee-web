// From the app's src/lib/format.ts (the parts the web uses).
export function formatBytes(bytes?: number): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function fileStem(name: string): string {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(0, i) : name;
}

export function fileExt(name: string): string {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(i + 1).toUpperCase() : '';
}

/** Today as in the designs' file names: '16-oct'. */
export function dayStamp(d = new Date()): string {
  return `${d.getDate()}-${d.toLocaleString('en', { month: 'short' }).toLowerCase()}`;
}
