/**
 * Service worker. Two jobs, both by watching coles.com.au's own requests:
 *
 * 1. Copy the headers Coles's API needs (its Ocp-Apim-Subscription-Key and
 *    friends) and the store id, so the side panel can call the trolley
 *    endpoint the same way the site does. Cookies are left to the browser.
 * 2. When the user adds a product to their trolley while finding one for a
 *    list line, remember that product for the line in the app.
 */

import { loadActiveItem, loadSettings, saveColesSession, setActiveItem } from './storage.js';
import type { ContentMessage, PanelMessage, ProductInfo } from './types.js';

const API_URLS = ['https://www.coles.com.au/api/bff/*'];
/** Marks the extension's own calls (set in content.ts), so their headers aren't copied back. */
const OWN_REQUEST_HEADER = 'x-meal-agent-extension';

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);

/** Headers worth replaying: Coles's API key and custom x- headers, not cookies or browser-set ones. */
function replayable(name: string): boolean {
  const lower = name.toLowerCase();
  if (lower === OWN_REQUEST_HEADER || lower === 'x-forwarded-for') return false;
  return lower.startsWith('ocp-apim-') || lower.startsWith('x-') || lower === 'authorization';
}

chrome.webRequest.onBeforeSendHeaders.addListener(
  details => {
    const headers = details.requestHeaders ?? [];
    if (headers.some(h => h.name.toLowerCase() === OWN_REQUEST_HEADER)) return undefined;
    const storeId = details.url.match(/\/trolley\/store\/(\d+)/)?.[1];
    const copied = Object.fromEntries(
      headers.filter(h => h.value !== undefined && replayable(h.name)).map(h => [h.name, h.value as string]),
    );
    if (!Object.keys(copied).some(k => k.toLowerCase() === 'ocp-apim-subscription-key')) return undefined;
    // Keep the last store id seen; only trolley URLs carry it.
    chrome.storage.session.get('colesSession').then(({ colesSession }) => {
      const previous = (colesSession as { storeId?: string } | undefined)?.storeId ?? '';
      return saveColesSession({ headers: copied, storeId: storeId ?? previous });
    }).catch(console.error);
    return undefined;
  },
  { urls: API_URLS },
  ['requestHeaders', 'extraHeaders'],
);

/** productId → quantity from a trolley PATCH body: { items: [{ actions: [{ productId, quantity }] }] }. */
function addsInBody(details: chrome.webRequest.OnBeforeRequestDetails): Array<{ productId: string; quantity: number }> {
  const bytes = details.requestBody?.raw?.[0]?.bytes;
  if (!bytes) return [];
  try {
    const body = JSON.parse(new TextDecoder().decode(bytes)) as { items?: Array<{ actions?: Array<{ productId?: unknown; quantity?: unknown }> }> };
    return (body.items ?? []).flatMap(item => item.actions ?? [])
      .filter(a => (typeof a.productId === 'string' || typeof a.productId === 'number') && typeof a.quantity === 'number')
      .map(a => ({ productId: String(a.productId), quantity: a.quantity as number }));
  } catch {
    return [];
  }
}

function tellPanel(message: PanelMessage): void {
  // The panel may be closed; that's fine.
  chrome.runtime.sendMessage(message).catch(() => undefined);
}

async function rememberAdd(tabId: number, productId: string): Promise<void> {
  const active = await loadActiveItem();
  if (!active) return;
  await setActiveItem(null);

  let info: ProductInfo = { name: `Coles product ${productId}`, url: null, price: null };
  try {
    const message: ContentMessage = { type: 'productInfo', productId };
    info = (await chrome.tabs.sendMessage(tabId, message) as ProductInfo | undefined) ?? info;
  } catch {
    // Content script not ready; the id alone is enough to add it again.
  }

  const { appUrl, token } = await loadSettings();
  try {
    const res = await fetch(`${appUrl}/api/coles/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ingredientKey: active.key, productId, name: info.name, url: info.url, price: info.price }),
    });
    if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `HTTP ${res.status}`);
    tellPanel({ type: 'remembered', key: active.key, product: { productId, ...info } });
  } catch (error) {
    tellPanel({ type: 'rememberFailed', key: active.key, error: error instanceof Error ? error.message : String(error) });
  }
}

chrome.webRequest.onBeforeRequest.addListener(
  details => {
    if (details.method !== 'PATCH' || details.tabId < 0) return undefined;
    const added = addsInBody(details).find(a => a.quantity > 0);
    if (added) rememberAdd(details.tabId, added.productId).catch(console.error);
    return undefined;
  },
  { urls: ['https://www.coles.com.au/api/bff/trolley/store/*'] },
  ['requestBody'],
);
