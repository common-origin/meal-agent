// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import dns from 'node:dns';
import { safeFetchHtml, isBlockedAddress, SafeFetchError, SAFE_FETCH_MAX_BYTES } from '../safeFetch';

const fetchMock = vi.fn();
let lookupMock: MockInstance;

function resolvesTo(...addresses: string[]) {
  lookupMock.mockResolvedValue(addresses.map((address) => ({ address, family: address.includes(':') ? 6 : 4 })) as never);
}

function html(body = '<html><h1>Soup</h1></html>', headers: Record<string, string> = {}) {
  return new Response(body, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', ...headers } });
}

function redirect(location: string) {
  return new Response(null, { status: 302, headers: { location } });
}

async function expectCode(promise: Promise<unknown>, code: SafeFetchError['code']) {
  await expect(promise).rejects.toMatchObject({ name: 'SafeFetchError', code });
}

beforeEach(() => {
  fetchMock.mockReset();
  lookupMock = vi.spyOn(dns.promises, 'lookup');
  vi.stubGlobal('fetch', fetchMock);
  resolvesTo('93.184.215.14');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('safeFetchHtml', () => {
  it('returns the HTML and final URL for a public page', async () => {
    fetchMock.mockResolvedValue(html());
    await expect(safeFetchHtml('https://example.com/soup')).resolves.toEqual({
      html: '<html><h1>Soup</h1></html>',
      finalUrl: 'https://example.com/soup',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      new URL('https://example.com/soup'),
      expect.objectContaining({ redirect: 'manual' })
    );
  });

  it.each(['file:///etc/passwd', 'ftp://example.com/recipe', 'javascript:alert(1)', 'not a url'])(
    'rejects %s as an invalid URL',
    async (url) => {
      await expectCode(safeFetchHtml(url), 'invalid_url');
      expect(fetchMock).not.toHaveBeenCalled();
    }
  );

  it('rejects non-default ports and credentials', async () => {
    await expectCode(safeFetchHtml('http://example.com:8080/'), 'invalid_url');
    await expectCode(safeFetchHtml('https://user:pass@example.com/'), 'invalid_url');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('allows explicit ports 80 and 443', async () => {
    fetchMock.mockResolvedValue(html());
    await expect(safeFetchHtml('http://example.com:443/')).resolves.toBeDefined();
  });

  it.each([
    'http://127.0.0.1/',
    'http://[::1]/',
    'http://169.254.169.254/latest/meta-data/',
    'http://0x7f.1/', // normalised by URL to 127.0.0.1
    'http://[::ffff:127.0.0.1]/',
    'http://[fd00::1]/',
  ])('rejects the private literal address %s', async (url) => {
    await expectCode(safeFetchHtml(url), 'blocked_host');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it('rejects a hostname that resolves to a private address', async () => {
    resolvesTo('10.0.0.5');
    await expectCode(safeFetchHtml('https://intranet.example.com/'), 'blocked_host');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a hostname if any of its addresses is private', async () => {
    resolvesTo('93.184.215.14', '192.168.1.1');
    await expectCode(safeFetchHtml('https://example.com/'), 'blocked_host');
  });

  it('rejects a hostname that does not resolve', async () => {
    lookupMock.mockRejectedValue(Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' }));
    await expectCode(safeFetchHtml('https://no-such-host.example/'), 'invalid_url');
  });

  it('rejects a redirect to a private IP', async () => {
    fetchMock.mockResolvedValueOnce(redirect('http://169.254.169.254/latest/meta-data/'));
    await expectCode(safeFetchHtml('https://example.com/r'), 'blocked_host');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('re-resolves each redirect hop', async () => {
    fetchMock.mockResolvedValueOnce(redirect('https://evil.example/'));
    lookupMock
      .mockResolvedValueOnce([{ address: '93.184.215.14', family: 4 }] as never)
      .mockResolvedValueOnce([{ address: '10.1.2.3', family: 4 }] as never);
    await expectCode(safeFetchHtml('https://example.com/r'), 'blocked_host');
  });

  it('rejects a redirect to a disallowed scheme', async () => {
    fetchMock.mockResolvedValueOnce(redirect('file:///etc/passwd'));
    await expectCode(safeFetchHtml('https://example.com/r'), 'invalid_url');
  });

  it('follows up to 3 redirects, resolving relative locations', async () => {
    fetchMock
      .mockResolvedValueOnce(redirect('/one'))
      .mockResolvedValueOnce(redirect('/two'))
      .mockResolvedValueOnce(redirect('https://www.example.com/three'))
      .mockResolvedValueOnce(html());
    await expect(safeFetchHtml('https://example.com/start')).resolves.toMatchObject({
      finalUrl: 'https://www.example.com/three',
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('rejects a 4th redirect', async () => {
    fetchMock.mockResolvedValue(redirect('/again'));
    await expectCode(safeFetchHtml('https://example.com/loop'), 'http_error');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('rejects a 3.5 MB body', async () => {
    fetchMock.mockResolvedValue(html('x'.repeat(3.5 * 1024 * 1024)));
    await expectCode(safeFetchHtml('https://example.com/huge'), 'too_large');
  });

  it('rejects a declared Content-Length over the cap without reading the body', async () => {
    fetchMock.mockResolvedValue(html('<html></html>', { 'content-length': String(SAFE_FETCH_MAX_BYTES + 1) }));
    await expectCode(safeFetchHtml('https://example.com/huge'), 'too_large');
  });

  it('accepts a body right at the cap', async () => {
    fetchMock.mockResolvedValue(html('x'.repeat(SAFE_FETCH_MAX_BYTES)));
    await expect(safeFetchHtml('https://example.com/big')).resolves.toBeDefined();
  });

  it.each(['application/pdf', 'application/json', 'text/plain'])('rejects content type "%s"', async (type) => {
    fetchMock.mockResolvedValue(new Response('%PDF-1.7', { headers: { 'content-type': type } }));
    await expectCode(safeFetchHtml('https://example.com/file'), 'not_html');
  });

  it('rejects a response with no content type', async () => {
    // A byte body, unlike a string body, gets no default content type.
    const response = new Response(new TextEncoder().encode('<html></html>'));
    expect(response.headers.get('content-type')).toBeNull();
    fetchMock.mockResolvedValue(response);
    await expectCode(safeFetchHtml('https://example.com/file'), 'not_html');
  });

  it('accepts application/xhtml+xml', async () => {
    fetchMock.mockResolvedValue(new Response('<html/>', { headers: { 'content-type': 'application/xhtml+xml' } }));
    await expect(safeFetchHtml('https://example.com/x')).resolves.toBeDefined();
  });

  it('rejects an HTTP error status', async () => {
    fetchMock.mockResolvedValue(new Response('nope', { status: 404, headers: { 'content-type': 'text/html' } }));
    await expectCode(safeFetchHtml('https://example.com/missing'), 'http_error');
  });

  it('reports a timeout when the overall signal fires', async () => {
    const controller = new AbortController();
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
    fetchMock.mockImplementation((_url, init: RequestInit) => {
      controller.abort(new DOMException('timed out', 'TimeoutError'));
      return Promise.reject(init.signal?.reason);
    });
    await expectCode(safeFetchHtml('https://example.com/slow'), 'timeout');
  });
});

describe('isBlockedAddress', () => {
  it.each([
    '0.0.0.0', '10.1.2.3', '100.64.0.1', '100.127.255.255', '127.0.0.1', '169.254.169.254',
    '172.16.0.1', '172.31.255.255', '192.168.0.1', '198.18.0.1', '198.19.255.255',
    '224.0.0.1', '239.255.255.255', '255.255.255.255',
    '::', '::1', 'fc00::1', 'fdff::1', 'fe80::1', 'febf::1', 'ff02::1',
    '::ffff:10.0.0.1', '::ffff:7f00:1', '::127.0.0.1', 'fe80::1%eth0', 'fec0::1',
    '64:ff9b::a9fe:a9fe', '64:ff9b::10.0.0.1', '64:ff9b:1::1', '2002:7f00:1::', '2002:c0a8:101::1',
  ])('blocks %s', (address) => {
    expect(isBlockedAddress(address)).toBe(true);
  });

  it.each([
    '93.184.215.14', '8.8.8.8', '100.63.255.255', '100.128.0.0', '172.15.255.255', '172.32.0.0',
    '198.17.255.255', '198.20.0.0', '223.255.255.255',
    '2606:2800:220:1::1', '::ffff:8.8.8.8', '64:ff9b::8.8.8.8', '2002:808:808::1',
  ])('allows %s', (address) => {
    expect(isBlockedAddress(address)).toBe(false);
  });
});
