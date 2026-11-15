// Zips the built extension (dist/) for download from Settings (#229).
//
//   node scripts/package.mjs <out-dir> [dist-dir]
//
// Writes <out-dir>/coles-extension.zip, whose files sit in one folder
// (meal-agent-for-coles/) so unzipping gives the folder to choose in
// Chrome's "Load unpacked", and <out-dir>/coles-extension.json with the
// manifest's version for Settings to show. No zip binary or dependency:
// Vercel's build image isn't guaranteed to have one. Timestamps are fixed,
// so the same build gives the same zip.

import { deflateRawSync, crc32 } from 'node:zlib';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const FOLDER = 'meal-agent-for-coles';
// 1 January 2026, 00:00, in MS-DOS date and time format.
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;

const outDir = process.argv[2];
// The extension's own dist/ unless given (tests pass a fixture).
const distDir = resolve(process.argv[3] ?? join(dirname(fileURLToPath(import.meta.url)), '../dist'));
if (!outDir) {
  console.error('usage: node scripts/package.mjs <out-dir> [dist-dir]');
  process.exit(1);
}

function filesIn(dir) {
  return readdirSync(dir).sort().flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesIn(path) : [path];
  });
}

/** A zip of `entries` ({ name, data }), each deflated. */
function zip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBytes = Buffer.from(name, 'utf8');
    const compressed = deflateRawSync(data, { level: 9 });
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // local file header signature
    local.writeUInt16LE(20, 4); // version needed (2.0)
    local.writeUInt16LE(0x0800, 6); // flags: UTF-8 names
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28); // extra length
    locals.push(local, nameBytes, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); // central directory header signature
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    // extra, comment, disk start, internal attributes: 0
    central.writeUInt32LE(0, 38); // external attributes
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBytes);

    offset += local.length + nameBytes.length + compressed.length;
  }
  const centralDir = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); // end of central directory signature
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDir.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralDir, end]);
}

const files = filesIn(distDir);
if (!files.some((path) => relative(distDir, path) === 'manifest.json')) {
  console.error(`No manifest.json in ${distDir}: build the extension first.`);
  process.exit(1);
}
const entries = files.map((path) => ({
  name: `${FOLDER}/${relative(distDir, path).split(sep).join('/')}`,
  data: readFileSync(path),
}));
const { version } = JSON.parse(readFileSync(join(distDir, 'manifest.json'), 'utf8'));

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'coles-extension.zip'), zip(entries));
writeFileSync(join(outDir, 'coles-extension.json'), `${JSON.stringify({ version, folder: FOLDER })}\n`);
console.log(`Packaged Meal Agent for Coles ${version} (${entries.length} files) into ${outDir}/coles-extension.zip`);
