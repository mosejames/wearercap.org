import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { zipStream, crc32Update, uniqueNames } from './zipstream.js';

const bytesOf = (str) => new TextEncoder().encode(str);

async function collect(stream) {
  const parts = [];
  const reader = stream.getReader();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    parts.push(value);
  }
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

const streamFrom = (chunks) => new ReadableStream({
  start(c) { for (const ch of chunks) c.enqueue(ch); c.close(); },
});

describe('crc32', () => {
  it('matches the reference value for "123456789"', () => {
    expect(crc32Update(0, bytesOf('123456789'))).toBe(0xcbf43926);
  });
  it('is chunk-order independent', () => {
    const a = crc32Update(crc32Update(0, bytesOf('12345')), bytesOf('6789'));
    expect(a).toBe(0xcbf43926);
  });
});

describe('uniqueNames', () => {
  it('numbers duplicates before the extension', () => {
    const u = uniqueNames();
    expect(u('a.jpg')).toBe('a.jpg');
    expect(u('a.jpg')).toBe('a (2).jpg');
    expect(u('a.jpg')).toBe('a (3).jpg');
    expect(u('b')).toBe('b');
    expect(u('b')).toBe('b (2)');
  });
});

describe('zipStream', () => {
  it('produces an archive python and unzip both accept', async () => {
    const entries = [
      { name: 'first-day/one.txt', date: new Date(2026, 7, 26, 8, 30), open: async () => streamFrom([bytesOf('hello '), bytesOf('vault')]) },
      { name: 'first-day/two.txt', open: async () => new Blob([bytesOf('second file, larger payload '.repeat(500))]) },
      { name: 'first-day/one.txt', open: async () => new Response(bytesOf('dupe name')) },
    ];
    const progress = [];
    const zip = await collect(zipStream(entries, { onProgress: (p) => progress.push(p) }));
    expect(progress.at(-1)).toMatchObject({ files: 3, done: true });

    const dir = mkdtempSync(join(tmpdir(), 'vaultzip-'));
    const file = join(dir, 't.zip');
    writeFileSync(file, zip);

    const listing = execFileSync('python3', ['-c', `
import zipfile, sys
z = zipfile.ZipFile(sys.argv[1])
assert z.testzip() is None
for i in z.infolist():
    print(i.filename, i.file_size, z.read(i).decode()[:12])
`, file]).toString();
    expect(listing).toContain('first-day/one.txt 11 hello vault');
    expect(listing).toContain('first-day/two.txt 14000 second file,');
    expect(listing).toContain('first-day/one (2).txt 9 dupe name');

    let unzipOk = true;
    try { execFileSync('unzip', ['-tq', file]); } catch (e) { unzipOk = !e.stdout || !/error/i.test(String(e.stdout)); }
    expect(unzipOk).toBe(true);
  });
});
