import { describe, expect, it } from 'vitest';
import { makeZipBlob, openArchive, PasswordError } from '@/lib/archive';
import { filesOf } from '@/tools/archive';

const file = (blob: Blob, name: string) => new File([blob], name, { type: 'application/zip' });

describe('ZIP on the web', () => {
  it('makes a ZIP and opens it again, folders kept', async () => {
    const zip = await makeZipBlob([{ path: 'notes/a.txt', blob: new Blob(['hello']) }, { path: 'b.txt', blob: new Blob(['world']) }], 'normal');
    const a = await openArchive(file(zip, 'x.zip'));
    expect(filesOf(a.entries).map((f) => f.path).sort()).toEqual(['b.txt', 'notes/a.txt']);
    expect(await (await a.read('notes/a.txt')).text()).toBe('hello');
  });

  it('protects a ZIP with a password (AES-256) and refuses a wrong one', async () => {
    const zip = await makeZipBlob([{ path: 'secret.txt', blob: new Blob(['ali 4821']) }], 'max', 'p@ss-1234');
    const a = await openArchive(file(zip, 'locked.zip'));
    expect(a.needsPassword).toBe(true);
    await expect(a.read('secret.txt', 'wrong')).rejects.toBeInstanceOf(PasswordError);
    expect(await (await a.read('secret.txt', 'p@ss-1234')).text()).toBe('ali 4821');
  });
});
