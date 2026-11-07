import { describe, expect, it } from 'vitest';
import { crc32, zipFiles } from '@/lib/zip';

describe('ZIP of results', () => {
  it('has the standard CRC', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });

  it('stores every file with its name, unique and UTF-8', async () => {
    const files = [
      { name: 'page-1.jpg', blob: new Blob(['one']) },
      { name: 'page-1.jpg', blob: new Blob(['two']) },
      { name: 'اردو.txt', blob: new Blob(['three']) },
    ];
    const zip = new Uint8Array(await (await zipFiles(files)).arrayBuffer());
    const text = new TextDecoder().decode(zip);
    expect(zip[0]).toBe(0x50); // PK
    expect(text).toContain('page-1.jpg');
    expect(text).toContain('page-1 (2).jpg');
    expect(text).toContain('اردو.txt');
    // end of central directory: 3 entries
    const end = zip.length - 22;
    expect(new DataView(zip.buffer).getUint32(end, true)).toBe(0x06054b50);
    expect(new DataView(zip.buffer).getUint16(end + 10, true)).toBe(3);
  });
});
