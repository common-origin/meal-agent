/**
 * Runs on coles.com.au. Content scripts can't be ES modules, so this file
 * has no imports; its message shapes match ContentMessage in types.ts.
 *
 * - addToTrolley: calls Coles's trolley endpoint from the page, with the
 *   user's cookies and the headers the background worker copied.
 * - clickAdd: the fallback, clicking the product page's own Add and + buttons.
 *
 * It also tells the background worker when the user clicks a product's Add
 * button, so a product found for a list line can be remembered.
 */

interface ContentSession { headers: Record<string, string>; storeId: string }
interface ContentAdd { productId: string; packs: number }
type IncomingMessage =
  | { type: 'addToTrolley'; session: ContentSession; adds: ContentAdd[] }
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
    const id = record.productId;
    if ((typeof id === 'string' || typeof id === 'number') && typeof record.quantity === 'number') {
      into.set(String(id), Math.max(into.get(String(id)) ?? 0, record.quantity));
    }
    Object.values(record).forEach(value => quantitiesIn(value, into));
  }
  return into;
}

async function addToTrolley(session: ContentSession, adds: ContentAdd[]) {
  const headers = { ...session.headers, ...OWN_REQUEST, 'Content-Type': 'application/json' };
  // quantity is the line's total, so without the current trolley a PATCH could lower what's there.
  // Fail everything instead and let the panel fall back to clicking.
  const trolley = await fetch(trolleyUrl(session.storeId), { headers, credentials: 'include' })
    .then(res => (res.ok ? res.json() as Promise<unknown> : Promise.reject(new Error(`HTTP ${res.status}`))))
    .catch((error: Error) => error);
  if (trolley instanceof Error) {
    return adds.map(add => ({ productId: add.productId, ok: false, error: `Couldn’t read the trolley (${trolley.message})` }));
  }
  const current = quantitiesIn(trolley);

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

const PRODUCT_PATH = /\/product\/[^?#]*-(\d+)(?:[?#]|$)/;

/**
 * The product an Add button belongs to: the tile's own product link on a
 * search or category page, or the page itself on a product page.
 */
function productForButton(button: HTMLButtonElement) {
  let tile: Element | null = button.parentElement;
  let link: HTMLAnchorElement | null = null;
  // Walk up to the smallest ancestor with exactly one product, so a grid isn't mistaken for a tile.
  while (tile && tile !== document.body) {
    const ids = new Set(Array.from(tile.querySelectorAll<HTMLAnchorElement>('a[href*="/product/"]'))
      .map(a => a.getAttribute('href')?.match(PRODUCT_PATH)?.[1]).filter(Boolean));
    if (ids.size > 1) break;
    if (ids.size === 1) {
      link = tile.querySelector<HTMLAnchorElement>('a[href*="/product/"]');
      break;
    }
    tile = tile.parentElement;
  }
  const href = link?.getAttribute('href') ?? (PRODUCT_PATH.test(location.pathname) ? location.pathname : null);
  const productId = href?.match(PRODUCT_PATH)?.[1];
  if (!href || !productId) return null;
  const name = (link ? null : document.querySelector('h1')?.textContent?.trim())
    ?? button.getAttribute('aria-label')?.replace(/^Add to trolley:\s*/i, '')
    ?? `Coles product ${productId}`;
  const priceText = (link ? tile : button.closest('section, main'))?.textContent?.match(/\$(\d+(?:\.\d{2})?)/)?.[1];
  return {
    productId,
    name,
    url: new URL(href, location.origin).href.split(/[?#]/)[0],
    price: priceText ? parseFloat(priceText) : null,
  };
}

// The user's own Add clicks (isTrusted), not the fallback's programmatic ones.
document.addEventListener('click', event => {
  if (!event.isTrusted || !(event.target instanceof Element)) return;
  const button = event.target.closest<HTMLButtonElement>('button[data-testid="add-to-cart-button"]');
  const product = button ? productForButton(button) : null;
  if (product) chrome.runtime.sendMessage({ type: 'userAdded', product }).catch(() => undefined);
}, true);

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function waitFor<T extends Element>(selector: string, root: ParentNode = document, timeoutMs = 8000): Promise<T | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const el = root.querySelector<T>(selector);
    if (el) return el;
    await wait(200);
  }
  return null;
}

/**
 * Fallback: click the product page's own buttons. The page's product is the
 * one whose Add button names the page heading; recommendation tiles further
 * down have Add buttons too.
 */
async function clickAdd(packs: number) {
  await waitFor('main button[data-testid="add-to-cart-button"]');
  const heading = document.querySelector('h1')?.textContent?.trim().toLowerCase() ?? '';
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('main button[data-testid="add-to-cart-button"]'));
  const add = buttons.find(b => {
    const label = b.getAttribute('aria-label')?.replace(/^Add to trolley:\s*/i, '').toLowerCase();
    return !!label && heading.startsWith(label);
  }) ?? buttons[0];
  if (!add) return { ok: false, error: 'No Add button on this page (already in the trolley?)' };
  // The + button replaces Add in the same spot, so look for it there.
  const controls = add.parentElement?.parentElement ?? document;
  add.click();
  for (let i = 1; i < packs; i++) {
    const plus = await waitFor<HTMLButtonElement>('button[data-testid="plus-btn"]', controls);
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
  if (message.type === 'clickAdd') {
    clickAdd(message.packs).then(sendResponse);
    return true;
  }
  return false;
});
