/**
 * Runs on coles.com.au. Content scripts can't be ES modules, so this file
 * has no imports; its message shapes match ContentMessage in types.ts.
 *
 * - addToTrolley: calls Coles's trolley endpoint from the page, with the
 *   user's cookies and the headers the background worker copied.
 * - productInfo: reads a product's name, URL and price off the page.
 * - clickAdd: the fallback, clicking the product page's own Add and + buttons.
 */

interface ContentSession { headers: Record<string, string>; storeId: string }
interface ContentAdd { productId: string; packs: number }
type IncomingMessage =
  | { type: 'addToTrolley'; session: ContentSession; adds: ContentAdd[] }
  | { type: 'productInfo'; productId: string }
  | { type: 'clickAdd'; packs: number };

const OWN_REQUEST = { 'x-meal-agent-extension': '1' };

function trolleyUrl(storeId: string): string {
  return `/api/bff/trolley/store/${storeId}`;
}

/** productId → quantity already in the trolley, found anywhere in the response. */
function quantitiesIn(json: unknown, into = new Map<string, number>()): Map<string, number> {
  if (Array.isArray(json)) {
    json.forEach(value => quantitiesIn(value, into));
  } else if (json && typeof json === 'object') {
    const record = json as Record<string, unknown>;
    const id = record.productId ?? record.id;
    if ((typeof id === 'string' || typeof id === 'number') && typeof record.quantity === 'number') {
      into.set(String(id), Math.max(into.get(String(id)) ?? 0, record.quantity));
    }
    Object.values(record).forEach(value => quantitiesIn(value, into));
  }
  return into;
}

async function addToTrolley(session: ContentSession, adds: ContentAdd[]) {
  const headers = { ...session.headers, ...OWN_REQUEST, 'Content-Type': 'application/json' };
  const current = await fetch(trolleyUrl(session.storeId), { headers, credentials: 'include' })
    .then(res => (res.ok ? res.json() : null))
    .then(json => quantitiesIn(json))
    .catch(() => new Map<string, number>());

  const results = [];
  for (const add of adds) {
    // quantity is the line's total, not an increment (spike on #184).
    const quantity = (current.get(add.productId) ?? 0) + add.packs;
    try {
      const res = await fetch(trolleyUrl(session.storeId), {
        method: 'PATCH',
        headers,
        credentials: 'include',
        body: JSON.stringify({ items: [{ actions: [{ productId: add.productId, quantity }] }] }),
      });
      results.push(res.ok ? { productId: add.productId, ok: true } : { productId: add.productId, ok: false, error: `HTTP ${res.status}` });
    } catch (error) {
      results.push({ productId: add.productId, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return results;
}

function productInfo(productId: string) {
  const link = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="/product/"]'))
    .find(a => new RegExp(`-${productId}(?:[?#]|$)`).test(a.getAttribute('href') ?? ''));
  const onProductPage = new RegExp(`-${productId}(?:[?#]|$)`).test(location.pathname);
  const tile = link?.closest('section, article, li, [data-testid="product-tile"]') ?? (onProductPage ? document.querySelector('main') : null);
  const addButton = tile?.querySelector<HTMLButtonElement>('button[data-testid="add-to-cart-button"]');
  const name = addButton?.getAttribute('aria-label')?.replace(/^Add to trolley:\s*/i, '')
    ?? (onProductPage ? document.querySelector('h1')?.textContent?.trim() : link?.textContent?.trim())
    ?? `Coles product ${productId}`;
  const priceText = tile?.textContent?.match(/\$(\d+(?:\.\d{2})?)/)?.[1];
  const href = onProductPage ? location.pathname : link?.getAttribute('href');
  return {
    name,
    url: href ? new URL(href, location.origin).href.split(/[?#]/)[0] : null,
    price: priceText ? parseFloat(priceText) : null,
  };
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function waitFor<T extends Element>(selector: string, timeoutMs = 8000): Promise<T | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const el = document.querySelector<T>(selector);
    if (el) return el;
    await wait(200);
  }
  return null;
}

/** Fallback: click the product page's own buttons. */
async function clickAdd(packs: number) {
  const add = await waitFor<HTMLButtonElement>('main button[data-testid="add-to-cart-button"]');
  if (!add) return { ok: false, error: 'No Add button on this page' };
  add.click();
  for (let i = 1; i < packs; i++) {
    const plus = await waitFor<HTMLButtonElement>('main button[data-testid="plus-btn"]');
    if (!plus) return { ok: false, error: `Added 1 of ${packs}` };
    await wait(600);
    plus.click();
  }
  return { ok: true };
}

chrome.runtime.onMessage.addListener((message: IncomingMessage, _sender, sendResponse) => {
  if (message.type === 'addToTrolley') {
    addToTrolley(message.session, message.adds).then(sendResponse);
    return true;
  }
  if (message.type === 'productInfo') {
    sendResponse(productInfo(message.productId));
    return false;
  }
  if (message.type === 'clickAdd') {
    clickAdd(message.packs).then(sendResponse);
    return true;
  }
  return false;
});
