# AI (Gemini) setup and troubleshooting

Merges what used to be two separate files (`AI_SETUP.md`, `DEBUGGING_AI.md`)
per #35 — they overlapped heavily and both hardcoded a model name
(`gemini-1.5-flash`) that no call site actually uses. See
[`ARCHITECTURE.md`](./ARCHITECTURE.md#api-routes-appswebsrcappapi) for the
real per-route model table; this file is intentionally light on
model-specific detail so it can't drift the same way again.

## Getting an API key

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in, click **Get API key** → **Create API key**
3. Add it to `apps/web/.env.local`:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```
4. Restart the dev server — it won't pick up a new `.env.local` value
   otherwise

## Using AI generation in the app

`/settings` → configure family preferences → `/plan` → "Generate with AI."
The request goes to `POST /api/generate-recipes`. Its request type
(`RecipeGenerationRequest`) is defined in
`apps/web/src/lib/prompts/recipeGeneration.ts`, not in
`aiRecipeGenerator.ts` where the generation logic itself lives — and the
actual HTTP response isn't the generator's raw internal result type
either: the route wraps it as `{ success: true, recipes, count }` on
success or `{ error, details }` on failure
(`apps/web/src/app/api/generate-recipes/route.ts`). Read the route file
directly for the real contract rather than a hand-copied JSON example
here, since that's exactly the kind of thing that drifts out of sync
with the code silently — as this line itself did on a previous version.

## Auth, rate limiting and validation

Every AI route (`generate-recipes`, `scan-pantry-image`,
`extract-recipe-from-image`, `extract-recipe-from-url`) requires a signed-in
user (401, `code: "unauthenticated"`) and applies a per-user sliding-window
limit (429, `code: "rate_limited"`): 20 per 10 minutes for
`generate-recipes` and `extract-recipe-from-url`, 10 per 10 minutes for the
two image routes. The limits are set in `apps/web/src/lib/api/rateLimit.ts`.
They are in-memory, so each server instance counts separately; they're burst
control, not a daily cap (that's #85). JSON request bodies
(`generate-recipes`, `extract-recipe-from-url`) are validated with the Zod
schemas in `apps/web/src/lib/api/schemas.ts`; the photo routes validate their
multipart `image` field with `readImageUpload` in
`apps/web/src/lib/api/guard.ts` (see below). Either way an invalid body gets
400, `code: "invalid_request"`, with the problem logged server-side. A 429
means wait a few minutes, not a bug.

`extract-recipe-from-url` fetches the page with `safeFetchHtml`
(`apps/web/src/lib/api/safeFetch.ts`): public http(s) hosts on default
ports only (private, loopback, link-local and similar addresses refused,
including IPv6 forms that embed them), every redirect hop re-checked (max 3), 10 s and 3 MB limits,
and HTML content types only. A refusal returns 400/422 with a `code`
(`invalid_url`, `blocked_host`, `timeout`, `too_large`, `not_html`,
`http_error`) and the same friendly message for all of them.

Every AI call runs under one overall deadline shared by its retries
(`callWithDeadline` in `apps/web/src/lib/api/aiCall.ts`; values in
`AI_DEADLINES_MS`, `apps/web/src/lib/constants.ts`): 90 s for
`generate-recipes`, 45 s for `extract-recipe-from-image`, 30 s for
`scan-pantry-image` and for the AI step of `extract-recipe-from-url`. The
deadline's signal is passed to the SDK, so an in-flight call is cut off.
Up to 2 retries (1 s then 2 s backoff) happen only on HTTP 429/500/502/503/504
or a network error, never after the deadline. Each route's `maxDuration`
sits above its deadline. Running out of time returns 504,
`code: "timeout"`.

The two photo routes (`scan-pantry-image`, `extract-recipe-from-image`) take
multipart `FormData` with an `image` field, which must be `image/*`; the
route passes the file's real MIME type to Gemini. The browser resizes every
photo first (`resizeImageForUpload` in
`apps/web/src/lib/client/resizeImage.ts`: long edge at most 1600 px, JPEG
quality 0.8) to stay far under Vercel's 4.5 MB request limit. If the browser
can't decode a photo (e.g. HEIC in Chrome) it sends the original only when
it's at most 4 MB; otherwise, or on a 413, the user sees "That photo is too
large. Try a screenshot or a smaller photo."

## Troubleshooting

**"GEMINI_API_KEY is not configured"** — check the key is actually in
`apps/web/.env.local` (not the repo root), then restart the dev server.

**"You've hit the limit for now"** — the per-user limit above; wait a
few minutes.

**"That took too long. Please try again."** — the AI call hit its
deadline (see above). Usually transient; if it keeps happening, the model
is slow or overloaded.

**"Please sign in to use this feature"** — the session has expired; the
app sends you to `/login` and back.

**"Failed to parse AI response" / malformed JSON** — usually transient;
retry. If persistent, check Gemini API status and that the key hasn't
expired.

**Empty or missing recipes array** — check the browser console and
server terminal for the actual error (both sides log meaningfully around
this call); check API key validity at Google AI Studio.

**Diagnosing step by step** (there's deliberately no health-check
endpoint — a public route that spends quota is the wrong tool):
1. Check `GEMINI_API_KEY` is in `apps/web/.env.local` (not the repo root)
   and restart `pnpm dev`
2. Reproduce the failing flow and read the server output (the `pnpm dev`
   terminal locally, Vercel logs in production). The SDK error names the
   cause: 400 bad request, 403 key or permission, 404 model not found,
   429 quota
3. Check the key and its quota in
   [Google AI Studio](https://aistudio.google.com/app/apikey)

## Cost

Gemini's free tier and pricing change independently of this repo — check
[Google AI Studio](https://aistudio.google.com/app/apikey) for current
numbers rather than trusting a specific quota written here.
