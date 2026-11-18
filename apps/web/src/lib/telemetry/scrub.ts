/**
 * Removes anything personal from an error message before it is stored
 * (admin dashboard, #244). Order matters: URLs and emails go first so their
 * parts aren't half-matched by the later rules.
 *
 * Replaced: emails, URLs, uuids (ICS and invite tokens), Postgres
 * `Key (col)=(value)` details, quoted strings, hyphenated slugs (recipe IDs
 * embed titles), long token-like strings and runs of 5+ digits. The result
 * is whitespace-collapsed and truncated to 300 characters.
 */

export const MAX_MESSAGE_LENGTH = 300;

const RULES: Array<[RegExp, string]> = [
  [/\bhttps?:\/\/[^\s"'`<>)]+/gi, '[url]'],
  [/[^\s@"'`<>()]+@[^\s@"'`<>()]+\.[^\s@"'`<>()]+/g, '[email]'],
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[id]'],
  // Postgres: Key (id)=(some-recipe-id) already exists.
  [/\(([^()]*)\)=\(([^()]*)\)/g, '($1)=([value])'],
  // 'single', "double" or `backtick` quoted text, but not an apostrophe inside a word (can't).
  [/(?<![\w])(["'`])(?:(?!\1).)*\1(?![\w])/g, '[str]'],
  // Hyphenated slugs of 3+ parts with a letter in them, e.g. ai-quick-chicken-skillet (not a date, 2026-11-16).
  [/\b(?=[a-z0-9-]*[a-z])[a-z0-9]+(?:-[a-z0-9]+){2,}\b/gi, '[slug]'],
  // Long opaque tokens (base64, hex, nanoid) that contain a digit.
  [/\b(?=[A-Za-z0-9_]*\d)[A-Za-z0-9_]{20,}\b/g, '[token]'],
  [/\d{5,}/g, '[n]'],
];

export function scrub(message: string | null | undefined): string {
  let text = String(message ?? '');
  for (const [pattern, replacement] of RULES) text = text.replace(pattern, replacement);
  text = text.replace(/\s+/g, ' ').trim();
  return text.length > MAX_MESSAGE_LENGTH ? text.slice(0, MAX_MESSAGE_LENGTH) : text;
}
