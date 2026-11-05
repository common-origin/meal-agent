/**
 * The side panel: this week's approved list next to the user's Coles tab.
 * Remembered products come pre-ticked; nothing is added until the user
 * clicks "Add ticked to trolley". A line with no product opens a Coles search
 * in the same tab, and whatever the user adds there is remembered for it.
 *
 * On opening, it also imports any new past Coles orders (#185), which fills
 * product memory with what the household buys, and asks the user to check
 * the matches AI suggested.
 */

import { loadActiveItem, loadColesSession, loadSettings, setActiveItem } from './storage.js';
import {
  COLES_ORIGIN,
  type ContentMessage,
  type ExtensionListItem,
  type ExtensionListResponse,
  type ImportResponse,
  type MatchSuggestion,
  type PanelMessage,
  type PurchasesResponse,
  type ReadOrdersResult,
  type TrolleyResult,
} from './types.js';

/** How far back past orders are imported (the app keeps the same). */
const HISTORY_MONTHS = 12;

type LineState = 'idle' | 'finding' | 'adding' | 'added' | 'failed';

interface Line {
  item: ExtensionListItem;
  ticked: boolean;
  state: LineState;
  note?: string;
}

const lines = new Map<string, Line>();
let weekStart = '';
let busy = false;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const listEl = $('list');
const statusEl = $('status');
const addButton = $<HTMLButtonElement>('add');
const matchesEl = $('matches');
const matchListEl = $('match-list');
const importStatusEl = $('import-status');

function setStatus(text: string, tone: 'info' | 'error' | 'ok' = 'info'): void {
  statusEl.textContent = text;
  statusEl.dataset.tone = tone;
}

async function colesTab(): Promise<chrome.tabs.Tab | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id !== undefined && tab.url?.startsWith(COLES_ORIGIN) ? tab : null;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...children: Array<Node | string>): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

function render(): void {
  listEl.replaceChildren();
  const byCategory = new Map<string, Line[]>();
  for (const line of lines.values()) {
    const group = byCategory.get(line.item.category) ?? [];
    group.push(line);
    byCategory.set(line.item.category, group);
  }

  for (const [category, group] of byCategory) {
    listEl.append(el('h2', { textContent: category }));
    for (const line of group) {
      const { item } = line;
      const checkbox = el('input', { type: 'checkbox', checked: line.ticked, disabled: !item.product || line.state === 'added' || busy });
      checkbox.setAttribute('aria-label', `Add ${item.name}`);
      checkbox.addEventListener('change', () => { line.ticked = checkbox.checked; updateAddButton(); });

      const detail = item.product
        ? `${item.product.name} × ${item.packs}`
        : 'No product yet: click Find';
      const find = el('button', { className: 'link', textContent: item.product ? 'Change' : 'Find', disabled: busy });
      find.addEventListener('click', () => { findProduct(line).catch(showError); });

      const state = {
        idle: '', finding: 'Add the product you want on the page', adding: 'Adding…', added: 'In trolley', failed: line.note ?? 'Not added',
      }[line.state];

      listEl.append(el('div', { className: `line ${line.state}` },
        checkbox,
        el('div', { className: 'text' },
          el('div', { className: 'name' }, item.name, el('span', { className: 'qty', textContent: item.shoppingLabel })),
          el('div', { className: 'detail', textContent: detail }),
          ...(state ? [el('div', { className: 'state', textContent: state })] : []),
        ),
        find,
      ));
    }
  }
  updateAddButton();
}

function updateAddButton(): void {
  const ticked = [...lines.values()].filter(l => l.ticked && l.item.product && l.state !== 'added').length;
  addButton.textContent = ticked ? `Add ${ticked} ticked to trolley` : 'Add ticked to trolley';
  addButton.disabled = busy || ticked === 0;
  $<HTMLButtonElement>('reload').disabled = busy;
}

async function loadList(): Promise<void> {
  if (busy) return;
  const { appUrl, token } = await loadSettings();
  if (!token) {
    setStatus('Add your extension token in Options first.', 'error');
    return;
  }
  setStatus('Loading your list…');
  const res = await fetch(`${appUrl}/api/coles/list`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
  const body = await res.json().catch(() => ({})) as ExtensionListResponse & { error?: string };
  if (!res.ok) {
    setStatus(body.error ?? `Could not load the list (HTTP ${res.status}).`, 'error');
    return;
  }
  // An add started while this was loading owns the lines; don't swap them out from under it.
  if (busy) return;
  // What was added only carries over within the same week's list.
  const previous = body.weekStart === weekStart ? new Map(lines) : new Map<string, Line>();
  weekStart = body.weekStart;
  lines.clear();
  const active = await loadActiveItem();
  for (const item of body.items) {
    const old = previous.get(item.key);
    lines.set(item.key, {
      item,
      ticked: old?.state === 'added' ? false : old?.ticked ?? item.product !== null,
      state: old?.state === 'added' ? 'added' : active?.key === item.key ? 'finding' : 'idle',
    });
  }
  const remembered = body.items.filter(i => i.product).length;
  setStatus(`Week of ${weekStart}: ${body.items.length} items, ${remembered} with a remembered product.`);
  render();
}

async function findProduct(line: Line): Promise<void> {
  const tab = await colesTab();
  if (!tab?.id) {
    setStatus('Switch to your coles.com.au tab first.', 'error');
    return;
  }
  for (const other of lines.values()) if (other.state === 'finding') other.state = 'idle';
  line.state = 'finding';
  await setActiveItem({ key: line.item.key, name: line.item.name });
  render();
  await chrome.tabs.update(tab.id, { url: `${COLES_ORIGIN}/search/products?q=${encodeURIComponent(line.item.name)}` });
}

function waitForLoad(tabId: number): Promise<void> {
  return new Promise(resolve => {
    const listener = (id: number, info: chrome.tabs.OnUpdatedInfo) => {
      if (id === tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

/** Fallback for anything the trolley call couldn't add: open the product and click its own buttons. */
async function addByClicking(tabId: number, line: Line): Promise<void> {
  const url = line.item.product?.url;
  if (!url) {
    line.state = 'failed';
    line.note = 'Couldn’t add: no product page saved. Use Change.';
    return;
  }
  const loaded = waitForLoad(tabId);
  await chrome.tabs.update(tabId, { url });
  await loaded;
  const message: ContentMessage = { type: 'clickAdd', packs: line.item.packs, productId: line.item.product!.productId, session: await loadColesSession() };
  const result = await chrome.tabs.sendMessage(tabId, message).catch(() => ({ ok: false, error: 'Page not ready' })) as { ok: boolean; error?: string };
  line.state = result.ok ? 'added' : 'failed';
  line.note = result.ok ? undefined : `Couldn’t add: ${result.error ?? 'unknown error'}`;
  if (result.ok) line.ticked = false;
}

async function addTicked(): Promise<void> {
  const tab = await colesTab();
  if (!tab?.id) {
    setStatus('Switch to your coles.com.au tab first.', 'error');
    return;
  }
  const tabId = tab.id;
  const toAdd = [...lines.values()].filter(l => l.ticked && l.item.product && l.state !== 'added');
  if (toAdd.length === 0) return;

  // Adds made from here aren't new choices, so don't remember them against a line being found.
  await setActiveItem(null);
  busy = true;
  toAdd.forEach(line => { line.state = 'adding'; line.note = undefined; });
  render();

  const session = await loadColesSession();
  let results: TrolleyResult[] = [];
  // Why the direct add didn't work, shown alongside the fallback's results.
  let apiProblem = session?.storeId ? '' : 'no Coles session seen yet; browse a Coles page first';
  if (session?.storeId) {
    setStatus(`Adding ${toAdd.length} items…`);
    const message: ContentMessage = {
      type: 'addToTrolley',
      session,
      adds: toAdd.map(line => ({ productId: line.item.product!.productId, packs: line.item.packs })),
    };
    results = await chrome.tabs.sendMessage(tabId, message).catch(() => {
      apiProblem = 'the Coles page wasn’t ready; reload it';
      return [];
    }) as TrolleyResult[] | undefined ?? [];
    apiProblem ||= results.find(r => !r.ok)?.error ?? '';
  }
  const okIds = new Set(results.filter(r => r.ok).map(r => r.productId));
  const viaApi = toAdd.filter(line => okIds.has(line.item.product!.productId));
  viaApi.forEach(line => { line.state = 'added'; line.ticked = false; });
  render();

  const remaining = toAdd.filter(line => !okIds.has(line.item.product!.productId));
  for (const [index, line] of remaining.entries()) {
    setStatus(`Adding ${line.item.name} from its product page (${index + 1} of ${remaining.length})…`);
    await addByClicking(tabId, line);
    render();
  }

  busy = false;
  const failed = toAdd.filter(line => line.state === 'failed').length;
  const method = remaining.length === 0 ? 'directly' : viaApi.length === 0 ? 'by clicking each product page' : `${viaApi.length} directly, ${remaining.length} by clicking product pages`;
  const why = remaining.length && apiProblem ? ` Direct add didn’t work: ${apiProblem}.` : '';
  setStatus(
    (failed
      ? `Added ${toAdd.length - failed} of ${toAdd.length} (${method}). Check the ones marked below.`
      : `Added ${toAdd.length} items (${method}). Review your trolley on coles.com.au, then check out there.`) + why,
    failed ? 'error' : 'ok',
  );
  render();
}

function showError(error: unknown): void {
  busy = false;
  setStatus(error instanceof Error ? error.message : String(error), 'error');
  render();
}

async function appFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const { appUrl, token } = await loadSettings();
  return fetch(`${appUrl}${path}`, {
    ...init,
    cache: 'no-store',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
}

function showSuggestions(suggestions: MatchSuggestion[]): void {
  matchListEl.replaceChildren(...suggestions.map(suggestion => {
    const row = el('div', { className: 'match' },
      el('div', { className: 'text' },
        el('div', { textContent: suggestion.productName }),
        el('div', { className: 'product', textContent: `for ${suggestion.ingredientName}` }),
      ),
    );
    const answer = (accept: boolean) => {
      row.querySelectorAll('button').forEach(button => { button.disabled = true; });
      confirmMatch(suggestion, accept)
        .then(remembered => {
          row.remove();
          matchesEl.hidden = matchListEl.childElementCount === 0;
          if (accept) {
            const onList = [...lines.values()].some(line => line.item.key === suggestion.key);
            importStatusEl.textContent = onList
              ? `Remembered ${suggestion.productName} for ${suggestion.ingredientName}.`
              : `Remembered ${suggestion.productName} for when ${suggestion.ingredientName} is on your list.`;
          }
          if (remembered > 0) return loadList();
          return undefined;
        })
        .catch(error => {
          row.querySelectorAll('button').forEach(button => { button.disabled = false; });
          importStatusEl.textContent = `Couldn’t save that: ${error instanceof Error ? error.message : String(error)}`;
        });
    };
    const yes = el('button', { className: 'link', textContent: 'Yes' });
    const no = el('button', { className: 'link', textContent: 'No' });
    yes.addEventListener('click', () => answer(true));
    no.addEventListener('click', () => answer(false));
    row.append(yes, no);
    return row;
  }));
  matchesEl.hidden = suggestions.length === 0;
}

async function confirmMatch(suggestion: MatchSuggestion, accept: boolean): Promise<number> {
  const res = await appFetch('/api/coles/purchases/confirm', {
    method: 'POST',
    body: JSON.stringify({ productId: suggestion.productId, key: suggestion.key, accept }),
  });
  const body = await res.json().catch(() => ({})) as { remembered?: number; error?: string };
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body.remembered ?? 0;
}

/**
 * Imports past Coles orders the app hasn't seen (#185). Needs the Coles tab
 * and the headers its API calls carry, so on a first open before browsing
 * Coles it only shows the waiting suggestions and tries again next time.
 */
async function importOrders(): Promise<void> {
  const { token } = await loadSettings();
  if (!token) return;
  const res = await appFetch('/api/coles/purchases');
  if (!res.ok) return;
  const known = await res.json() as PurchasesResponse;
  showSuggestions(known.suggestions);

  const [session, tab] = await Promise.all([loadColesSession(), colesTab()]);
  if (!session || !tab?.id) return;
  const since = new Date();
  since.setMonth(since.getMonth() - HISTORY_MONTHS);
  importStatusEl.textContent = 'Checking your past Coles orders…';
  const message: ContentMessage = { type: 'readOrders', session, since: since.toISOString(), skip: known.importedOrderIds };
  const read = await chrome.tabs.sendMessage(tab.id, message).catch(() => null) as ReadOrdersResult | null;
  if (!read || 'error' in read) {
    importStatusEl.textContent = read ? `Couldn’t read past orders (${read.error}). Will try again next time.` : '';
    return;
  }

  // Posted even with no new orders, so lines AI hasn't looked at yet get another go.
  const imported = await appFetch('/api/coles/purchases', { method: 'POST', body: JSON.stringify({ orders: read.orders }) });
  const result = await imported.json().catch(() => ({})) as Partial<ImportResponse> & { error?: string };
  if (!imported.ok) {
    importStatusEl.textContent = `Couldn’t save past orders: ${result.error ?? `HTTP ${imported.status}`}`;
    return;
  }
  showSuggestions(result.suggestions ?? []);
  const parts = [
    result.imported ? `Imported ${result.imported} past order${result.imported === 1 ? '' : 's'}` : '',
    result.remembered ? `${result.remembered} product${result.remembered === 1 ? '' : 's'} remembered` : '',
  ].filter(Boolean);
  importStatusEl.textContent = parts.length ? `${parts.join('; ')}.` : '';
  if (result.remembered) await loadList();
}

chrome.runtime.onMessage.addListener((message: PanelMessage) => {
  const line = lines.get(message.key);
  if (!line) return;
  if (message.type === 'remembered') {
    // The user already added it on the page, so it's in the trolley; next week it comes pre-ticked.
    line.item = {
      ...line.item,
      product: { productId: message.product.productId, name: message.product.name, url: message.product.url, packSize: null, packUnit: null, lastPrice: message.product.price, timesBought: 1 },
    };
    line.state = 'added';
    line.ticked = false;
    setStatus(`Remembered ${message.product.name} for ${line.item.name}.`, 'ok');
  } else {
    line.state = 'failed';
    line.note = message.added ? `Added, but not remembered: ${message.error}` : `${message.error}. Try Add again on the page.`;
  }
  render();
});

addButton.addEventListener('click', () => { addTicked().catch(showError); });
// Reload also imports, so orders are picked up once a Coles page has been browsed.
$('reload').addEventListener('click', () => { loadList().then(() => importOrders()).catch(showError); });
$('options').addEventListener('click', () => { chrome.runtime.openOptionsPage().catch(showError); });

loadList().then(() => importOrders()).catch(showError);
