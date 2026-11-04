import { DEFAULT_APP_URL, type ActiveItem, type ColesSession, type Settings } from './types.js';

/** App URL and token, from the options page. The token stays on this device. */
export async function loadSettings(): Promise<Settings> {
  const { appUrl, token } = await chrome.storage.local.get(['appUrl', 'token']);
  return {
    appUrl: typeof appUrl === 'string' && appUrl ? appUrl.replace(/\/+$/, '') : DEFAULT_APP_URL,
    token: typeof token === 'string' ? token : '',
  };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set(settings);
}

// Coles's API headers live in session storage: cleared when the browser
// closes, and never synced. The store id rarely changes, so it's kept in local
// storage too, ready before the site next requests the trolley.

export async function loadColesSession(): Promise<ColesSession | null> {
  const [{ colesHeaders }, { storeId }] = await Promise.all([
    chrome.storage.session.get('colesHeaders'),
    chrome.storage.local.get('storeId'),
  ]);
  if (!colesHeaders) return null;
  return { headers: colesHeaders as Record<string, string>, storeId: typeof storeId === 'string' ? storeId : '' };
}

export async function saveColesSession(session: ColesSession): Promise<void> {
  await Promise.all([
    chrome.storage.session.set({ colesHeaders: session.headers }),
    session.storeId ? chrome.storage.local.set({ storeId: session.storeId }) : Promise.resolve(),
  ]);
}

export async function loadActiveItem(): Promise<ActiveItem | null> {
  const { activeItem } = await chrome.storage.session.get('activeItem');
  return (activeItem as ActiveItem | undefined) ?? null;
}

export async function setActiveItem(item: ActiveItem | null): Promise<void> {
  if (item) await chrome.storage.session.set({ activeItem: item });
  else await chrome.storage.session.remove('activeItem');
}
