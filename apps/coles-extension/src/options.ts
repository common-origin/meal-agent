import { loadSettings, saveSettings } from './storage.js';

const appUrlInput = document.getElementById('appUrl') as HTMLInputElement;
const tokenInput = document.getElementById('token') as HTMLInputElement;
const statusEl = document.getElementById('status') as HTMLElement;

loadSettings().then(({ appUrl, token }) => {
  appUrlInput.value = appUrl;
  tokenInput.value = token;
}).catch(console.error);

document.getElementById('save')?.addEventListener('click', async () => {
  const appUrl = appUrlInput.value.trim().replace(/\/+$/, '');
  const token = tokenInput.value.trim();
  try {
    const origin = new URL(appUrl).origin;
    // The extension needs permission to call a self-hosted or local copy of the app.
    const granted = await chrome.permissions.request({ origins: [`${origin}/*`] });
    if (!granted) throw new Error(`Permission to reach ${origin} was declined.`);
    await saveSettings({ appUrl, token });
    const res = await fetch(`${appUrl}/api/coles/list`, { headers: { Authorization: `Bearer ${token}` } });
    statusEl.textContent = res.status === 401
      ? 'Saved, but the app didn’t recognise that token. Copy it again from Settings.'
      : 'Saved. Open coles.com.au and click the extension icon.';
  } catch (error) {
    statusEl.textContent = error instanceof Error ? error.message : String(error);
  }
});
