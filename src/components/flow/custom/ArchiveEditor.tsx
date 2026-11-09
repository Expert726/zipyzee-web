'use client';
// Extract ZIP / RAR (the app's custom/archive/ArchiveStep): what's inside ("142 files, 38 MB, 3 folders"), folder by
// folder with breadcrumbs, tick files or whole folders (Select all / none), a password when the archive has one, then
// Extract the ticked files (handlers/archiveTools.ts). Opened in the browser (src/lib/archive.ts).
import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, File as FileIcon, Folder, Loader2, Lock } from 'lucide-react';
import { useT } from '@/i18n/client';
import { openArchive, PasswordError, type OpenArchive } from '@/lib/archive';
import { formatBytes } from '@/lib/format';
import { breadcrumbs, filesOf, folderState, listDir, selectedFiles, summary } from '@/tools/archive';
import { Button } from '../../ui/Button';
import type { CustomSetupProps } from './index';

export function ArchiveEditor({ files, onStart, onReplace }: CustomSetupProps) {
  const t = useT();
  const file = files[0];
  const [archive, setArchive] = useState<OpenArchive | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [askPassword, setAskPassword] = useState(false);
  const [wrong, setWrong] = useState(false);
  const [dir, setDir] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(true);

  const open = async (pw?: string) => {
    setBusy(true);
    setError(null);
    try {
      const a = await openArchive(file, pw);
      setArchive(a);
      setAskPassword(a.needsPassword && !pw);
      setWrong(false);
      setPicked(new Set(filesOf(a.entries).map((f) => f.path)));
    } catch (e) {
      if (e instanceof PasswordError) {
        setAskPassword(true);
        setWrong(!!pw);
      } else setError(/too many/.test(String(e)) ? t('This archive has too many files to open here.') : t('{name} couldn\'t be opened. It may be damaged or not a ZIP, RAR or 7z file.', { name: file.name }));
    }
    setBusy(false);
  };

  useEffect(() => {
    void Promise.resolve().then(() => open());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per file
  }, [file]);

  const all = useMemo(() => (archive ? filesOf(archive.entries) : []), [archive]);
  const here = useMemo(() => listDir(all, dir), [all, dir]);
  const sum = summary(all);
  const chosen = selectedFiles(all, picked);
  const toggle = (path: string, on: boolean, isFolder: boolean) => {
    setPicked((p) => {
      const next = new Set(p);
      const under = isFolder ? all.filter((f) => f.path.startsWith(`${path}/`)).map((f) => f.path) : [path];
      for (const x of under) {
        if (on) next.add(x);
        else next.delete(x);
      }
      return next;
    });
  };

  if (error) {
    return (
      <div className="card p-8 text-center flex flex-col items-center gap-3" role="alert">
        <p className="text-[17px] font-semibold">{error}</p>
        <Button variant="secondary" onClick={onReplace}>
          {t('Choose a ZIP, RAR or 7z file')}
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
      <section className="card p-4 sm:p-5 flex flex-col gap-3 min-h-64">
        {busy && !archive ? (
          <p className="flex items-center gap-2 text-[14px] text-secondary m-auto" role="status">
            <Loader2 size={18} className="animate-spin text-primary" aria-hidden="true" />
            {t('Opening the archive…')}
          </p>
        ) : !archive ? (
          <p className="text-[14px] text-secondary m-auto">{t('This archive needs its password to show what\'s inside.')}</p>
        ) : (
          <>
            <nav className="flex flex-wrap items-center gap-1 text-[14px]" aria-label={t('Folder')}>
              <button type="button" onClick={() => setDir('')} className="font-semibold hover:underline">
                {file.name}
              </button>
              {breadcrumbs(dir).map((b) => (
                <span key={b.path} className="inline-flex items-center gap-1">
                  <ChevronRight size={14} className="text-secondary flip-rtl" aria-hidden="true" />
                  <button type="button" onClick={() => setDir(b.path)} className="hover:underline">
                    {b.name}
                  </button>
                </span>
              ))}
            </nav>
            <ul className="flex flex-col divide-y divide-line">
              {here.folders.map((f) => {
                const st = folderState(all, picked, f.path);
                return (
                  <li key={f.path} className="flex items-center gap-3 py-2">
                    <input type="checkbox" checked={st === 'all'} ref={(el) => void (el && (el.indeterminate = st === 'some'))} onChange={(e) => toggle(f.path, e.target.checked, true)} aria-label={f.name} className="size-5 accent-[var(--primary)]" />
                    <button type="button" onClick={() => setDir(f.path)} className="flex-1 min-w-0 flex items-center gap-2 text-start">
                      <Folder size={18} className="text-primary shrink-0" aria-hidden="true" />
                      <span className="truncate font-medium text-[14px]">{f.name}</span>
                      <span className="ms-auto text-[12px] text-secondary shrink-0">
                        {t('{count} files', { count: f.files })} · {formatBytes(f.size)}
                      </span>
                    </button>
                  </li>
                );
              })}
              {here.files.map((f) => (
                <li key={f.path} className="flex items-center gap-3 py-2">
                  <input type="checkbox" checked={picked.has(f.path)} onChange={(e) => toggle(f.path, e.target.checked, false)} aria-label={f.name} className="size-5 accent-[var(--primary)]" />
                  <FileIcon size={18} className="text-secondary shrink-0" aria-hidden="true" />
                  <span className="flex-1 min-w-0 truncate text-[14px]" dir="auto">
                    {f.name}
                  </span>
                  {f.encrypted && <Lock size={14} className="text-secondary shrink-0" aria-label={t('Password protected')} />}
                  <span className="text-[12px] text-secondary shrink-0">{formatBytes(f.size)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <aside className="card p-5 flex flex-col gap-4 lg:sticky lg:top-20">
        {archive && (
          <p className="text-[14px]">
            {t('{files} files, {size}, {folders} folders', { files: sum.files, size: formatBytes(sum.size), folders: sum.folders })}
          </p>
        )}
        {askPassword && (
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void open(password);
            }}
          >
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
              {t('Password')}
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" dir="ltr" className="min-h-11 rounded-tile bg-surface border border-line-strong px-3 text-[15px] font-normal" />
            </label>
            {wrong && <p className="text-[13px] text-error">{t('Wrong password. Try again.')}</p>}
            <Button type="submit" variant="secondary" disabled={!password || busy}>
              {t('Open')}
            </Button>
          </form>
        )}
        {archive && (
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setPicked(new Set(all.map((f) => f.path)))}>
              {t('Select all')}
            </Button>
            <Button variant="ghost" onClick={() => setPicked(new Set())}>
              {t('Select none')}
            </Button>
          </div>
        )}
        <Button arrow disabled={!archive || !chosen.length || (askPassword && !password)} onClick={() => archive && onStart({ archive, paths: chosen.map((f) => f.path), password })} className="w-full">
          {chosen.length === all.length ? t('Extract all') : t('Extract {count} files', { count: chosen.length })}
        </Button>
      </aside>
    </div>
  );
}
