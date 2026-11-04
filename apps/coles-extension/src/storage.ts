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

// Session storage: cleared when the browser closes, and never synced.

export async function loadColesSession(): Promise<ColesSession | null> {
  const { colesSession } = await chrome.storage.session.get('colesSession');
  return (colesSession as ColesSession | undefined) ?? null;
}

export async function saveColesSession(session: ColesSession): Promise<void> {
  await chrome.storage.session.set({ colesSession: session });
}

export async function loadActiveItem(): Promise<ActiveItem | null> {
  const { activeItem } = await chrome.storage.session.get('activeItem');
  return (activeItem as ActiveItem | undefined) ?? null;
}

export async function setActiveItem(item: ActiveItem | null): Promise<void> {
  if (item) await chrome.storage.session.set({ activeItem: item });
  else await chrome.storage.session.remove('activeItem');
}
