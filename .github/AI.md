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
The request goes to `POST /api/generate-recipes`, whose actual request/
response shape is defined by `RecipeGenerationRequest` and
`GeneratedRecipeResponse` in `aiRecipeGenerator.ts` — read those types
directly rather than a hand-copied JSON example here, since that's
exactly the kind of thing that drifts out of sync with the code silently.

## Rate limiting

`generate-recipes` enforces 3 requests per minute per IP
(`MAX_REQUESTS_PER_WINDOW` in `apps/web/src/app/api/generate-recipes/route.ts`)
— a 429 with "Rate limit exceeded" means wait a minute, not a bug.

## Troubleshooting

**"GEMINI_API_KEY is not configured"** — check the key is actually in
`apps/web/.env.local` (not the repo root), then restart the dev server.

**"Rate limit exceeded"** — see above; only click Generate once per
attempt.

**"Failed to parse AI response" / malformed JSON** — usually transient;
retry. If persistent, check Gemini API status and that the key hasn't
expired.

**Empty or missing recipes array** — check the browser console and
server terminal for the actual error (both sides log meaningfully around
this call); check API key validity at Google AI Studio.

**Diagnosing step by step**:
1. Visit `/api/test-gemini` directly — confirms the key is configured and
   the API is reachable, independent of the full recipe-generation flow
2. Check the browser console and the `pnpm dev` terminal for errors when
   generating from `/plan`
3. Check the Network tab for the actual request/response to
   `/api/generate-recipes` — status code and body tell you more than
   guessing

## Cost

Gemini's free tier and pricing change independently of this repo — check
[Google AI Studio](https://aistudio.google.com/app/apikey) for current
numbers rather than trusting a specific quota written here.
