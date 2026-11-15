// @vitest-environment node
/**
 * The downloadable Coles extension zip (#229): apps/coles-extension's
 * scripts/package.mjs, run on a small fixture and read back with a minimal
 * zip reader, so a malformed archive fails here rather than in a
 * household's unzip.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crc32, inflateRawSync } from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const SCRIPT = join(__dirname, '../../../coles-extension/scripts/package.mjs');

/** Every file in a zip, via its central directory: name to contents. */
function unzip(zip: Buffer): Map<string, Buffer> {
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = zip.readUInt16LE(end + 10);
  let at = zip.readUInt32LE(end + 16);
  const files = new Map<string, Buffer>();
  for (let i = 0; i < count; i++) {
    expect(zip.readUInt32LE(at)).toBe(0x02014b50);
    const method = zip.readUInt16LE(at + 10);
    const crc = zip.readUInt32LE(at + 16);
    const compressedSize = zip.readUInt32LE(at + 20);
    const size = zip.readUInt32LE(at + 24);
    const nameLength = zip.readUInt16LE(at + 28);
    const extraLength = zip.readUInt16LE(at + 30);
    const commentLength = zip.readUInt16LE(at + 32);
    const localAt = zip.readUInt32LE(at + 42);
    const name = zip.toString('utf8', at + 46, at + 46 + nameLength);

    expect(zip.readUInt32LE(localAt)).toBe(0x04034b50);
    const dataAt = localAt + 30 + zip.readUInt16LE(localAt + 26) + zip.readUInt16LE(localAt + 28);
    const raw = zip.subarray(dataAt, dataAt + compressedSize);
    const data = method === 8 ? inflateRawSync(raw) : raw;
    expect(data.length).toBe(size);
    expect(crc32(data)).toBe(crc);
    files.set(name, data);
    at += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

let dir: string;
const pack = () => execFileSync(process.execPath, [SCRIPT, join(dir, 'out'), join(dir, 'dist')], { stdio: 'pipe' });

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'coles-extension-'));
  mkdirSync(join(dir, 'dist/icons'), { recursive: true });
  writeFileSync(join(dir, 'dist/manifest.json'), JSON.stringify({ manifest_version: 3, version: '1.2.3' }));
  writeFileSync(join(dir, 'dist/sidepanel.js'), 'console.log("hello");\n'.repeat(200));
  writeFileSync(join(dir, 'dist/icons/icon.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 3]));
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('Coles extension download (#229)', () => {
  it('zips every built file into one folder to Load unpacked, intact', () => {
    pack();
    const files = unzip(readFileSync(join(dir, 'out/coles-extension.zip')));
    expect([...files.keys()]).toEqual([
      'meal-agent-for-coles/icons/icon.png',
      'meal-agent-for-coles/manifest.json',
      'meal-agent-for-coles/sidepanel.js',
    ]);
    for (const [name, data] of files) {
      expect(data.equals(readFileSync(join(dir, 'dist', name.replace('meal-agent-for-coles/', ''))))).toBe(true);
    }
  });

  it("records the manifest's version for Settings", () => {
    pack();
    expect(JSON.parse(readFileSync(join(dir, 'out/coles-extension.json'), 'utf8'))).toEqual({ version: '1.2.3', folder: 'meal-agent-for-coles' });
  });

  it('gives the same zip for the same build', () => {
    pack();
    const first = readFileSync(join(dir, 'out/coles-extension.zip'));
    pack();
    expect(readFileSync(join(dir, 'out/coles-extension.zip')).equals(first)).toBe(true);
  });

  it('refuses a dist/ with no manifest (the extension was never built)', () => {
    expect(() => execFileSync(process.execPath, [SCRIPT, join(dir, 'out'), join(dir, 'dist/icons')], { stdio: 'pipe' })).toThrow(/build the extension first/);
  });
});
