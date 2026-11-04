/**
 * Service worker. Two jobs:
 *
 * 1. Copy the headers Coles's API needs (its Ocp-Apim-Subscription-Key and
 *    friends) and the store id from the site's own requests, so the side
 *    panel can call the trolley endpoint the same way the site does.
 *    Cookies are left to the browser.
 * 2. When the user clicks a product's Add button while finding one for a
 *    list line, remember that product for the line in the app.
 */

import { loadActiveItem, loadColesSession, loadSettings, saveColesSession, setActiveItem } from './storage.js';
import { COLES_ORIGIN, type BackgroundMessage, type PanelMessage, type UserAddedProduct } from './types.js';

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
    // Only trolley URLs carry the store id, so keep the last one seen.
    loadColesSession().then(previous =>
      saveColesSession({ headers: copied, storeId: storeId ?? previous?.storeId ?? '' }),
    ).catch(console.error);
    return undefined;
  },
  { urls: API_URLS },
  ['requestHeaders', 'extraHeaders'],
);

function tellPanel(message: PanelMessage): void {
  // The panel may be closed; that's fine.
  chrome.runtime.sendMessage(message).catch(() => undefined);
}

/** Saves the product the user just added on the page against the line they're finding one for. */
async function rememberAdd(product: UserAddedProduct): Promise<void> {
  const active = await loadActiveItem();
  if (!active) return;
  await setActiveItem(null);

  const { appUrl, token } = await loadSettings();
  try {
    const res = await fetch(`${appUrl}/api/coles/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ingredientKey: active.key, ...product }),
    });
    if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `HTTP ${res.status}`);
    tellPanel({ type: 'remembered', key: active.key, product });
  } catch (error) {
    tellPanel({ type: 'rememberFailed', key: active.key, error: error instanceof Error ? error.message : String(error) });
  }
}

// content.ts reports the user's own clicks on a product's Add button. Other
// trolley changes (+/−, the trolley drawer) aren't new choices, so they're ignored.
chrome.runtime.onMessage.addListener((message: BackgroundMessage, sender) => {
  if (message.type === 'userAdded' && sender.tab?.url?.startsWith(COLES_ORIGIN)) {
    rememberAdd(message.product).catch(console.error);
  }
  return false;
});
