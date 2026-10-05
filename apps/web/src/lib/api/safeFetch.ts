/**
 * Fetch a user-supplied URL's HTML without turning the server into an open
 * proxy (SSRF): only public http(s) hosts on default ports, every redirect
 * hop re-validated, and bounded time and size.
 *
 * Accepted residual risk: DNS rebinding. We resolve and check the host, then
 * fetch() resolves it again when connecting, so a hostile DNS server could
 * answer differently the second time. Pinning the resolved IP isn't worth
 * the complexity for a recipe importer (#79).
 */

import dns from 'node:dns';
import { isIP } from 'node:net';
import { raceAbort } from '@/lib/utils/async';

export type SafeFetchErrorCode =
  | 'invalid_url'
  | 'blocked_host'
  | 'timeout'
  | 'too_large'
  | 'not_html'
  | 'http_error';

export class SafeFetchError extends Error {
  constructor(
    public readonly code: SafeFetchErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'SafeFetchError';
  }
}

export const SAFE_FETCH_TIMEOUT_MS = 10_000;
export const SAFE_FETCH_MAX_BYTES = 3 * 1024 * 1024;
export const SAFE_FETCH_MAX_REDIRECTS = 3;

const ALLOWED_PORTS = new Set(['', '80', '443']);
const HTML_TYPES = ['text/html', 'application/xhtml+xml'];

const REQUEST_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml',
};

export async function safeFetchHtml(rawUrl: string): Promise<{ html: string; finalUrl: string }> {
  const signal = AbortSignal.timeout(SAFE_FETCH_TIMEOUT_MS);

  try {
    let url = parseAllowedUrl(rawUrl);

    for (let redirects = 0; ; redirects++) {
      await assertPublicHost(url.hostname, signal);

      const response = await fetch(url, { redirect: 'manual', signal, headers: REQUEST_HEADERS });

      const location = response.headers.get('location');
      if (response.status >= 300 && response.status < 400 && location) {
        await response.body?.cancel();
        if (redirects >= SAFE_FETCH_MAX_REDIRECTS) {
          throw new SafeFetchError('http_error', `More than ${SAFE_FETCH_MAX_REDIRECTS} redirects`);
        }
        url = parseAllowedUrl(new URL(location, url).toString());
        continue;
      }

      if (!response.ok) {
        await response.body?.cancel();
        throw new SafeFetchError('http_error', `HTTP ${response.status}`);
      }

      const contentType = (response.headers.get('content-type') || '').toLowerCase();
      if (!HTML_TYPES.some((type) => contentType.startsWith(type))) {
        await response.body?.cancel();
        throw new SafeFetchError('not_html', `Content type ${contentType || '(none)'} is not HTML`);
      }

      const html = await readCapped(response, contentType);
      return { html, finalUrl: url.toString() };
    }
  } catch (error) {
    if (error instanceof SafeFetchError) throw error;
    if (signal.aborted) {
      throw new SafeFetchError('timeout', `Took longer than ${SAFE_FETCH_TIMEOUT_MS / 1000}s`);
    }
    throw new SafeFetchError('http_error', error instanceof Error ? error.message : String(error));
  }
}

/** Parses the URL and applies the scheme, port and credentials rules. */
function parseAllowedUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SafeFetchError('invalid_url', 'Not a valid URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new SafeFetchError('invalid_url', `Scheme ${url.protocol} is not allowed`);
  }
  if (!ALLOWED_PORTS.has(url.port)) {
    throw new SafeFetchError('invalid_url', `Port ${url.port} is not allowed`);
  }
  if (url.username || url.password) {
    throw new SafeFetchError('invalid_url', 'Credentials in the URL are not allowed');
  }
  return url;
}

/** Rejects literal private IPs, and hostnames where any resolved address is private. */
async function assertPublicHost(hostname: string, signal: AbortSignal): Promise<void> {
  // URL keeps IPv6 literals in brackets: "[::1]".
  const host = hostname.replace(/^\[|\]$/g, '');

  if (isIP(host)) {
    if (isBlockedAddress(host)) throw new SafeFetchError('blocked_host', `Address ${host} is not allowed`);
    return;
  }

  // Don't start a lookup once the overall timeout has fired (e.g. on a redirect hop).
  signal.throwIfAborted();

  let addresses: { address: string }[];
  try {
    // dns.lookup takes no AbortSignal, so race it against the overall timeout.
    addresses = await raceAbort(dns.promises.lookup(host, { all: true }), signal);
  } catch (error) {
    if (signal.aborted) throw error;
    throw new SafeFetchError('invalid_url', `Could not resolve ${host}`);
  }
  if (addresses.length === 0 || addresses.some(({ address }) => isBlockedAddress(address))) {
    throw new SafeFetchError('blocked_host', `Host ${host} resolves to an address that is not allowed`);
  }
}

/** Reads the body as a stream, aborting once it passes the size cap. */
async function readCapped(response: Response, contentType: string): Promise<string> {
  const declared = Number(response.headers.get('content-length'));
  if (declared > SAFE_FETCH_MAX_BYTES) {
    await response.body?.cancel();
    throw new SafeFetchError('too_large', `Declared size ${declared} bytes is over the limit`);
  }
  if (!response.body) return '';

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > SAFE_FETCH_MAX_BYTES) {
      await reader.cancel();
      throw new SafeFetchError('too_large', `Body is over ${SAFE_FETCH_MAX_BYTES} bytes`);
    }
    chunks.push(value);
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return decoderFor(contentType).decode(body);
}

function decoderFor(contentType: string): TextDecoder {
  const charset = /charset=["']?([\w-]+)/.exec(contentType)?.[1];
  try {
    return new TextDecoder(charset || 'utf-8');
  } catch {
    return new TextDecoder('utf-8');
  }
}

// --- Address classification -------------------------------------------------

// [network, prefix length] — private, loopback, link-local, CGNAT, benchmarking,
// and everything from multicast (224/4) upwards.
const BLOCKED_IPV4: [string, number][] = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 3],
];

export function isBlockedAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return isBlockedIPv4(ipv4ToInt(address));
  if (version === 6) return isBlockedIPv6(address);
  // Not an IP at all: refuse rather than guess.
  return true;
}

function ipv4ToInt(address: string): number {
  return address.split('.').reduce((acc, octet) => acc * 256 + Number(octet), 0);
}

function isBlockedIPv4(ip: number): boolean {
  return BLOCKED_IPV4.some(([network, prefix]) => {
    const size = 2 ** (32 - prefix);
    const start = ipv4ToInt(network);
    return ip >= start && ip < start + size;
  });
}

function isBlockedIPv6(address: string): boolean {
  const h = expandIPv6(address);
  if (!h) return true;

  const allZeroPrefix = h.slice(0, 5).every((x) => x === 0);
  // IPv4-mapped (::ffff:a.b.c.d) and the deprecated IPv4-compatible
  // (::a.b.c.d) forms reach IPv4 hosts, so judge them by that address.
  if (allZeroPrefix && (h[5] === 0xffff || (h[5] === 0 && (h[6] !== 0 || h[7] > 1)))) {
    return isBlockedIPv4(h[6] * 0x10000 + h[7]);
  }
  // NAT64 (64:ff9b::/96) and 6to4 (2002::/16) also carry an IPv4 address
  // that a gateway on the path would forward to.
  if (h[0] === 0x64 && h[1] === 0xff9b && h.slice(2, 6).every((x) => x === 0)) {
    return isBlockedIPv4(h[6] * 0x10000 + h[7]);
  }
  if (h[0] === 0x64 && h[1] === 0xff9b && h[2] === 1) return true; // 64:ff9b:1::/48 local-use NAT64
  if (h[0] === 0x2002) return isBlockedIPv4(h[1] * 0x10000 + h[2]);
  if (h.every((x) => x === 0)) return true; // ::
  if (h.slice(0, 7).every((x) => x === 0) && h[7] === 1) return true; // ::1
  if ((h[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((h[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((h[0] & 0xffc0) === 0xfec0) return true; // fec0::/10 deprecated site-local
  if ((h[0] & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  return false;
}

/** Expands an IPv6 address (incl. "::" and a dotted IPv4 tail) to 8 hextets. */
function expandIPv6(address: string): number[] | null {
  let addr = address.split('%')[0].toLowerCase(); // drop any zone id

  const v4Tail = /(\d+\.\d+\.\d+\.\d+)$/.exec(addr);
  if (v4Tail) {
    const n = ipv4ToInt(v4Tail[1]);
    addr = addr.slice(0, -v4Tail[1].length) + `${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`;
  }

  const [head, tail, ...rest] = addr.split('::');
  if (rest.length > 0) return null;
  const headParts = head ? head.split(':') : [];
  const tailParts = tail !== undefined && tail !== '' ? tail.split(':') : [];
  const missing = 8 - headParts.length - tailParts.length;
  if (tail === undefined ? missing !== 0 : missing < 0) return null;

  const parts = [...headParts, ...Array(tail === undefined ? 0 : missing).fill('0'), ...tailParts];
  const hextets = parts.map((p) => parseInt(p, 16));
  return hextets.length === 8 && hextets.every((x) => Number.isInteger(x) && x >= 0 && x <= 0xffff)
    ? hextets
    : null;
}
