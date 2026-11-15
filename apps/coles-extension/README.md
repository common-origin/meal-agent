# Meal Agent for Coles

A Chrome side panel that puts this week's approved Meal Agent shopping list
beside your coles.com.au tab and fills the trolley from it (#184). It stops
at a filled trolley: you review it, choose a slot and check out on
coles.com.au.

## Set up

It works in desktop Chrome (and Chromium browsers such as Edge and Brave).

1. In Meal Agent, go to **Settings → Coles extension**, click **Download
   the extension**, and unzip it. Keep the `meal-agent-for-coles` folder
   somewhere it won't be deleted: Chrome runs it from there.
2. In Chrome, open `chrome://extensions`, turn on **Developer mode**, click
   **Load unpacked** and choose the `meal-agent-for-coles` folder.
3. Copy the token from **Settings → Coles extension**.
4. Open the extension's **Options** (right-click its icon), paste the token,
   and leave the app URL as `https://meal-agent.vercel.app` (or use
   `http://localhost:3000` for a local copy). Save.

To update, download it again, replace the folder's contents, and click the
extension's reload button in `chrome://extensions`.

### Where the download comes from

Each build of the web app (`pnpm -C apps/web build`, so every Vercel deploy
and CI run) builds this extension and zips `dist/` into
`apps/web/public/coles-extension.zip` with `scripts/package.mjs` (#229),
plus `coles-extension.json` with the manifest's version, which Settings
shows. Neither is committed. Bump `version` in `static/manifest.json` when
the extension changes, so households can tell they need the new one.

### Developing

```bash
pnpm -C apps/coles-extension build
```

Then **Load unpacked** `apps/coles-extension/dist` instead, and click the
extension's reload button after each rebuild. `pnpm dev` builds the zip once
as it starts, so the download works locally too.

## Each week

1. On the shopping list, click **Shop at Coles**. That saves the list and
   opens coles.com.au.
2. Log in to Coles if needed, then click the extension icon to open the
   panel.
3. Items whose product you've bought before are ticked, showing the product
   and how many to add. Untick anything you don't want, then click **Add
   ticked to trolley**.
4. For an item with no product yet, click **Find**. The Coles tab searches
   for it; add the product you want with the site's own button. The
   extension remembers it, so next week it comes ticked.
5. Review the trolley and check out on coles.com.au, then click **Mark
   shopping done** on the shopping list.

## Past orders

Each time the panel opens (or you click **Reload**) with a Coles tab
active, it reads your past online orders from the last 12 months that it
hasn't seen before, and sends them to Meal Agent. Products it can match to
an ingredient by name are remembered straight away, using whichever one you
buy most, so those lines come ticked. A product you picked with **Find** or
**Change** is never replaced.

Products are matched to the ingredient names your shopping lists use, so
"Baby Spinach 120g" goes with Baby spinach rather than plain spinach.
Products it can't match by name go to AI. Its guesses appear at the top of
the panel under "Is this what you buy?": **Yes** remembers the product for
that ingredient, so it comes ticked whenever that ingredient is on your
list, and **No** ignores it. Neither adds anything to this week's list.

## How it adds to the trolley

The background worker copies the API headers coles.com.au sends with its
own requests (its `Ocp-Apim-Subscription-Key` and similar), plus your store
id. The panel then calls the site's trolley endpoint from the page, with
your Coles login cookies, the same way the site does. Browse a Coles page
once before adding, so the headers have been seen.

If that call fails, the panel opens each product's page and clicks its own
Add and + buttons instead, and says so in its status line.

Coles doesn't publish this API, so a change to coles.com.au can break it.
If adding stops working, check the request the site sends when you click
Add (DevTools → Network → `trolley/store`) against `content.ts`.

## Code

- `src/background.ts` copies the headers and remembers products you add while
  finding one for an item.
- `src/content.ts` runs on coles.com.au: it calls the trolley API, does the
  click fallback, reports your own clicks on a product's Add button, and
  reads past orders.
- `src/sidepanel.ts` is the list.
- `src/options.ts` is the token setup.

The app side is `apps/web/src/app/api/coles/*`,
`apps/web/src/lib/coles/` and migrations `011_coles_extension.sql` and
`012_coles_purchase_history.sql`.
