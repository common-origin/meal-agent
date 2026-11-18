/**
 * Groups equal errors: a sha1 over source + kind + route pattern + the
 * normalised message, or over source + route + label when the caller gave a
 * developer-written label (a label is stable; messages can vary). Node only,
 * since it uses node:crypto.
 */

import { createHash } from 'node:crypto';

/** Lower-cased, with every digit run collapsed, so "after 31ms" and "after 8ms" group together. */
export function normaliseMessage(scrubbedMessage: string): string {
  return scrubbedMessage.toLowerCase().replace(/\d+/g, '0').replace(/\s+/g, ' ').trim();
}

export interface FingerprintInput {
  source: string;
  kind: string;
  route: string | null;
  /** Already scrubbed. */
  message: string;
  label?: string | null;
}

export function fingerprint({ source, kind, route, message, label }: FingerprintInput): string {
  const parts = label
    ? [source, route ?? '', 'label', label]
    : [source, kind, route ?? '', normaliseMessage(message)];
  return createHash('sha1').update(parts.join('\n')).digest('hex');
}
