import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';

/**
 * App code takes its colours from @common-origin/design-system's semantic
 * tokens (#169): no hard-coded colours, and none of the token paths decision
 * 0031 deprecated (removed in the design system's 3.0).
 */

const SRC = path.resolve(__dirname, '../..');

/** Out of scope: internal tools, and email HTML (email clients can't read CSS variables or tokens). */
const EXCLUDED_DIRS = ['app/debug', 'app/admin', 'app/analytics', 'emails', '__tests__'];

/** Colours that aren't UI styling, with why. */
const ALLOWED: Record<string, string> = {
  // The white behind a transparent image when it's flattened to JPEG: pixel data, not UI
  'lib/client/resizeImage.ts': "'#fff'",
};

const NAMED = 'white|black|red|green|blue|gr[ae]y|orange|yellow|purple|pink|brown|navy|silver';
const COLOUR = new RegExp(
  [
    // Hex, including digit-only greys like #333 and #000000
    String.raw`(?<![\w&/])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b`,
    String.raw`\b(?:rgba?|hsla?)\(`,
    // A named colour as a colour property's value, in CSS or a style object
    String.raw`\b(?:color|background(?:-color|Color)?|border(?:-\w+)?(?:Color)?|outline(?:Color)?|fill|stroke)\s*[:=]\s*[\x60'"]?[^;,}]*\b(?:${NAMED})\b`,
  ].join('|')
);
const DEPRECATED = /color\.background\.|text\.subdued|icon\.subdued|color\.border\.(?:strong|interactive)\b/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    const rel = path.relative(SRC, full);
    if (EXCLUDED_DIRS.some((excluded) => rel === excluded || rel.startsWith(`${excluded}/`) || rel.includes(`/${excluded}/`))) return [];
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(tsx?|css)$/.test(name) && !/\.test\./.test(name) ? [full] : [];
  });
}

/** Lines of code, without comments (which is where issue references like (#169) live). */
function codeLines(file: string): { line: number; text: string }[] {
  const source = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '));
  return source.split('\n').flatMap((text, i) => {
    const code = text.replace(/(^|[^:])\/\/.*$/, '$1');
    return code.trim() ? [{ line: i + 1, text: code }] : [];
  });
}

function findings(pattern: RegExp): string[] {
  return sourceFiles(SRC).flatMap((file) => {
    const rel = path.relative(SRC, file);
    return codeLines(file)
      .filter(({ text }) => pattern.test(text) && !(ALLOWED[rel] && text.includes(ALLOWED[rel])))
      .map(({ line, text }) => `${rel}:${line}  ${text.trim()}`);
  });
}

describe('design system colours in app code (#169)', () => {
  it('has no hard-coded colours', () => {
    expect(findings(COLOUR)).toEqual([]);
  });

  it('uses no deprecated token paths', () => {
    expect(findings(DEPRECATED)).toEqual([]);
  });
});
