# Architecture

This describes *how* the code achieves what [`PRODUCT.md`](../PRODUCT.md)
says the product needs to. Read `PRODUCT.md` first — if the two ever
disagree, `PRODUCT.md` wins and this document needs to change to match it,
not the other way around.

This file describes the system as it actually is, including the parts that
aren't clean yet. Where reality falls short of the ideal, that's noted
explicitly with a link to the tracked issue, rather than smoothed over.

## System overview

Meal Agent is a Next.js app that composes a household's weekly meal plan
from a mix of user-added and AI-generated recipes, explains why each meal
was chosen, estimates cost against real Coles product prices, and produces
a shopping list. Supabase provides authentication and PostgreSQL storage
for signed-in households; anonymous use falls back to localStorage.

- **Next.js 16 / React 19 / TypeScript**, pnpm monorepo (`apps/web`)
- **Supabase**: Postgres with Row-Level Security, Google OAuth + Magic Link
  auth
- **Google Gemini**: recipe generation, pantry/recipe photo scanning, URL
  recipe extraction
- **Vercel**: hosting, deployed on every push to `main` — independently of
  CI (see [CI/CD and deployment](#cicd-and-deployment) below)

## Request flow: proxy and auth

`apps/web/src/proxy.ts` runs before the routes it's scoped to and
refreshes the Supabase session, redirecting unauthenticated visitors away
from routes that need a session and signed-in visitors away from
`/login`/`/signup`. (Migrated from the deprecated `middleware.ts` file
convention to `proxy.ts` in issue #22 — same behavior, Next.js 16.3.x just
renamed the convention.)

Its `matcher` is deliberately narrow — only `/plan`, `/shopping-list`,
`/recipes`, `/settings`, `/debug`, `/login`, and `/signup` — not "every
route." Earlier it matched almost everything, including the homepage, and
the `supabase.auth.getUser()` call inside it had no timeout: a slow
Supabase response could hang the proxy and 504 the *entire site*, not
just the pages that actually need a session. That's what happened in
production once (see issue #19, now fixed) — the matcher was narrowed and
the auth check now races a 3-second timeout, treating a timeout the same
as "no user" rather than hanging the request.

## Layers

### UI (`apps/web/src/app/`, `apps/web/src/components/app/`)

Pages, by area:

- **Auth**: `/login`, `/signup`, `/auth/callback` (OAuth callback handler)
- **Planning**: `/plan`, `/plan/review`
- **Recipes**: `/recipes`, `/recipes/add` (URL/image/manual entry),
  `/recipe/[id]`
- **Shopping**: `/shopping-list`
- **Household**: `/settings`, `/settings/data-export`
- **Other**: `/about`, `/analytics`
- **Debug**: `/debug/api-usage`, `/debug/coles-api-test`,
  `/debug/ingredient-analytics`, `/debug/persistent-cache`,
  `/debug/search-mapping` (auth-gated — the proxy matcher covers
  `/debug/:path*`)
- **Admin**: `/admin/debug` (not auth-gated — outside the proxy's matcher)

Key components: `WeekPlannerGrid`, `SwapDrawer`, `RegenerateDrawer`,
`WeeklyOverridesSheet`, `WeeklyPlanWizard` (planning); `PantrySheet`
(pantry photo scanning); `MealCard`, `LeftoverCard`; `ColesShoppingModal`,
`ColesProductCard`, `BudgetBar`, `BudgetSummary`, `PriceSourceBadge`,
`ReportPriceModal` (shopping/pricing).

UI is built on `@common-origin/design-system` — check
`apps/web/package.json` for the version actually installed rather than
trusting a number written here; it updates via Dependabot and this file
won't be kept in sync with every bump.

### API routes (`apps/web/src/app/api/`)

Not every route is an AI call — grouped by what they actually do:

**AI (Gemini)**:
| Route | Model | Purpose |
|---|---|---|
| `generate-recipes` | `gemini-2.5-pro` | AI recipe generation from family settings |
| `extract-recipe-from-url` | `gemini-2.5-flash` | Parse a recipe from an arbitrary URL |
| `extract-recipe-from-image` | `gemini-1.5-pro` | Extract a recipe from a photo |
| `scan-pantry-image` | `gemini-2.5-flash` | Detect ingredients from a pantry/fridge photo |
| `gemini-list-models`, `list-models`, `test-gemini`, `test-gemini-rest` | — | Diagnostics, not used in the main app flow |

Model choice is per-route, not a single constant — check the route file
directly for what's actually configured, not this table, since it's the
kind of fact that's already drifted in this doc's history (see `CLAUDE.md`
Known Drift). `aiRecipeGenerator.ts`'s `generateRecipes()` has no fallback
model; a separate `testGeminiConnection()` helper in the same file uses a
different model for its own diagnostic purposes only.

**Pricing/shopping**: `coles-search` (product lookup), `ingredient-analytics`
(client-side analytics metadata)

**Calendar export**: `plan/ics/[token]` — unauthenticated ICS feed of a
household's current-and-future meal plan, gated by a secret token rather
than a session (see [Calendar export](#calendar-export) below);
`household/ics-url` — session-authenticated, returns the signed-in user's
feed URL for display in Settings

**Other**: `share-recipe-email`, `debug/custom-recipes`

### Logic (`apps/web/src/lib/`)

- **Meal composition**: `compose.ts` orchestrates `scoring.ts` (recipe
  scoring rules), `recencyTracker.ts` (avoids recent repeats),
  `tagNormalizer.ts`, `explainer.ts` (generates the "why this meal" reason
  chips), and `schedule.ts` (week-start date math — despite the name, this
  is *not* a scheduling/cron layer; see
  [Known limitations](#known-limitations))
- **Shopping & pricing**: `shoppingListAggregator.ts` (unit normalization,
  dedup, pantry-staple detection) feeds `colesMapping.ts` (a large,
  hand-maintained SKU/price mapping — check the file directly for current
  size rather than trusting a specific count here) and
  `ingredientPricing.ts` (category-based fallback pricing when nothing
  matches). `colesApi.ts` wraps a third-party RapidAPI product-price
  endpoint (free tier, rate-limited, 24h cache) — Coles has no public API
  or partner program, so this is a workaround, not an official
  integration (see issue #36)
- **Recipes**: `library.ts` (`RecipeLibrary`) manages custom recipes,
  AI-generated recipes, and syncing between them and Supabase — see
  [Storage](#storage) for why this is more involved than it should be
- **Analytics**: `analytics.ts` (privacy-first local event tracking),
  `ingredientAnalytics.ts` (usage frequency, informs which ingredients are
  worth adding to `colesMapping.ts` next)

### Storage

**Simplified as issue #2** (PRs #44/#45/#46): three modules now, not four —
`storage.ts` (synchronous localStorage utilities, used internally by the
other two), `hybridStorage.ts` (the single auth-aware entry point app code
should import: routes between localStorage and Supabase, including
`saveCurrentWeekPlan`/`loadCurrentWeekPlan`'s array-format adapter over
`saveMealPlan`/`loadMealPlan`), and `supabaseStorage.ts` (Postgres CRUD).
`storageAsync.ts`, a pass-through layer with no logic of its own, was
deleted in #44.

Of the four modules that used to bypass all of the above and read/write
`localStorage` directly with their own keys:
- `pantryPreferences.ts` — the shopping-list page's bypass is fixed (#45),
  now routing through `hybridStorage.ts`'s `savePantryItems`/`loadPantryItems`
  so pantry staples sync for authenticated users. `pantryPreferences.ts`
  itself remains the local cache primitive underneath, still imported
  directly by `app/settings/data-export/page.tsx` (an explicit "export a
  local backup" feature, not a sync gap) and by `shoppingListAggregator.ts`'s
  synchronous `isInPantryPreferences` check.
- `recencyTracker.ts` — now syncs cross-device (#46) via
  `hybridStorage.ts`'s `hydrateRecencyFromSupabase`/`syncRecencyToSupabase`,
  called around `compose.ts`'s `composeWeek()` rather than threaded through
  it — `composeWeek()` and `getSuggestedSwaps()` stay synchronous
  deliberately, since making them auth-aware internally would force their
  whole call graph (including `compose.test.ts`) async for no behavior
  change. Backed by the new `recipe_history` table (migration 007).
- `ingredientAnalytics.ts` — deliberately left localStorage-only: it's
  maintainer tooling for prioritizing `colesMapping.ts` entries (see
  `/api/ingredient-analytics` and `/debug/ingredient-analytics`), not
  user-facing household data.
- `userPriceReports.ts` — still bypasses, unaddressed. Not folded into #2:
  a price report isn't household-scoped data like everything else in this
  schema (a Coles price is the same regardless of who reports it), and
  nothing reads reports back into pricing yet, so this needs its own
  data-model decision, not a sync fix. Tracked in issue #47.

Fixed in issue #49: `Header.tsx`'s sign-out handler now calls
`storage.ts`'s `clearHouseholdScopedCaches()`, which clears every
household-scoped cache above (including `RecipeLibrary`'s in-memory
cache, not just localStorage — necessary since sign-out redirects via
client-side navigation, no full page reload) so a browser switching
between households doesn't inherit stale data. Deliberately leaves
`ingredientAnalytics.ts` and the device-level `apiQuota.ts`/`colesApi.ts`
caches untouched, since those are meant to persist regardless of who's
signed in.

A related, earlier instance of the same class of problem: `library.ts`'s
`addCustomRecipes()` (recipes added via URL/image/manual entry) used to
only write to localStorage, never Supabase, unlike AI-generated recipes —
so custom recipes silently never made it to the cloud. Fixed in issue #32,
including the read-path bug that was still misclassifying restored custom
recipes even after the write path was fixed. Worth reading that issue's
history, and #45/#46's, as concrete examples of how this storage layer's
looseness causes real bugs, not just architectural untidiness.

### Database (Supabase Postgres)

9 tables, all with Row-Level Security scoping access to the requesting
user's own household (`get_user_household_id()` helper function; a new
household's owner and default settings are created automatically on
signup):

- **`households`** — `id`, `name`, `ics_token` (migration 006 — a secret
  separate from `id`, used only to authorize the unauthenticated ICS feed)
- **`household_members`** — links `auth.users` to `households`, with an
  `owner`/`member` role
- **`family_settings`** — meal-planning preferences; `full_settings` is a
  JSONB column (migration 004) holding the complete settings object, with
  a handful of columns duplicated out of it for querying
- **`recipes`** — `id` is `TEXT`, not `UUID` (migration 003 — supports
  semantic IDs like `ai-recipe-name` alongside real UUIDs), plus
  `nutrition` JSONB (migration 005)
- **`meal_plans`** — one row per household per week (`UNIQUE(household_id,
  week_start)`), `meals` is a JSONB object keyed by lowercase day name
  (`monday`..`sunday`)
- **`shopping_lists`**, **`pantry_preferences`**, **`api_usage`**
- **`recipe_history`** (migration 007) — one row per recipe used in a
  composed week, `UNIQUE(household_id, recipe_id, week_start)`; backs
  cross-device recency/variety-enforcement sync (see [Storage](#storage))

Migrations run in order, 001 through 007 — see `supabase/README.md` for
the exact steps. There's no migration-runner in CI; each one is applied by
hand in the Supabase SQL editor, same as every migration so far.

## Calendar export

`GET /api/plan/ics/[token]` (issue #3) serializes a household's
current-week-onward `meal_plans` rows into an ICS feed, meant to be polled
by something like [GAS-ICS-Sync](https://github.com/derekantrican/GAS-ICS-Sync)
to push meals into a shared Google Calendar automatically. Every meal
exports at a fixed 6–7pm slot (`Australia/Sydney`) — there's no per-meal
time field, by deliberate choice to avoid a schema change for a feature
whose goal was to be low-effort (see issue #3's history). The route uses
the Supabase service-role client (bypasses RLS) since an external poller
can't hold a session; access is authorized by `households.ics_token`
instead.

## CI/CD and deployment

GitHub Actions (`ci.yml`) runs lint, typecheck, tests, and build on every
PR, and
is a required status check on `main` (no required reviews — solo-maintained
repo). Dependabot is configured for weekly dependency and GitHub Actions
updates; routine bumps (any Actions version bump, or a patch/minor npm
bump) auto-merge once CI passes via `dependabot-auto-merge.yml` — a major
npm/pnpm bump still waits for manual review, since a passing build doesn't
guarantee a major version is behaviorally safe.

**Vercel deployment is entirely decoupled from this** — it has its own
GitHub App integration and deploys on every push to `main` regardless of
CI's result. For roughly 8 months before this was noticed, CI failed on
every single run (a tooling misconfiguration in `ci.yml`, fixed in PR #7)
while production kept deploying successfully the entire time, because
nothing ever connected the two. CI passing is a genuine
signal now, but it was never actually gating what reached production.

## Known limitations

- **No real scheduling.** `schedule.ts` is a client-side "plan your week"
  reminder that only fires if the app is open on a Sunday — not server-side
  scheduling. There's no cron anywhere in the project (no Vercel Cron
  config, no scheduled GitHub workflow), so nothing regenerates a plan or
  refreshes the ICS feed on its own. Tracked in issue #4.
- **Coles pricing is a third-party workaround, not an official
  integration.** See [Logic](#logic-appswebsrclib) above and issue #36.
- **No path from a shopping list to an actual order or delivery.** The
  product's real goal is planning through to delivery at a chosen time
  (see `PRODUCT.md`), and today the flow stops at a list. Same root cause
  as the pricing limitation — no public Coles API. Issue #36 has the
  researched options.
- **No coverage on the storage layer or any API route.** `pnpm test`
  passes in full (fixed in issue #5 — the root scripts weren't applying
  `apps/web/vitest.config.ts`, and `RecipeLibrary`/`scoring.ts` now have
  real test coverage), but the storage layers and every API route are
  still untested.
- **Editing an existing plan is more effort than it should be** — swapping
  out one night's meal isn't as seamless as the rest of the product aims
  for. Flagged in issue #38 as needing real UX research, not a quick fix.
- **Sign-out's cache clearing doesn't cover an operation already in
  flight.** `clearHouseholdScopedCaches()` (issue #49) is a one-shot
  cleanup; the "Sign out" button is now disabled while AI recipe
  generation is running (via `GenerationActivityProvider`) to narrow the
  window, but this is a deliberate stopgap, not a fix for the general
  case — a proper fix needs a cancellation/session-generation guard across
  every async local-write path. Issue #73.

## Key design decisions

**Row-Level Security over application-level authorization.** Household
data isolation is enforced by Postgres RLS policies, not just application
code — so a bug in a query can't leak another household's data, and the
enforcement holds even if application-layer checks are wrong or missing.

**No static/seed recipe library.** All recipes are added at runtime — by
AI generation, URL/image extraction, or manual entry — rather than shipped
with the app. Each household builds its own collection from nothing; there
is deliberately no pre-built starter set today.

**Recipes as a personalization signal, not just content.** Per
`PRODUCT.md`: every recipe added, however it was added, is meant to help
the system learn what a household actually likes, which should inform
future AI generation — not just sit in a list of things to cook.

**Type-safe recipe schema.** `types/recipe.ts` defines strict types for
`Recipe`, `PlanWeek`/`PlanDay`, `Household`, etc., shared across the
composition logic, storage layers, and UI.

**The scoring logic is a pure function; composition around it isn't.**
`scoreRecipe()` in `scoring.ts` is genuinely side-effect-free, which makes
it straightforward to test in isolation (where tests exist — see [Known
limitations](#known-limitations)). `composeWeek()` itself is not pure,
despite an earlier version of this document claiming otherwise: it reads
recent-recipe history and the current `RecipeLibrary` state directly, and
records the week's selections as a side effect — same inputs can produce
different output depending on what's changed in storage since the last
call.

**Tags as flexible strings, not an enum.** Recipe categorization uses
`string[]` tags rather than fixed boolean flags, trading some type safety
for the ability to add new categories without a schema change; tag
normalization (`tagNormalizer.ts`) keeps the vocabulary from fragmenting.

## Further work

Anything speculative or not-yet-built belongs in [GitHub
Issues](https://github.com/common-origin/meal-agent/issues), not a
roadmap section in this file — a static "Future Enhancements" list is
exactly the kind of thing that goes stale unnoticed (the version of this
document before #35 had one claiming shopping lists and user accounts as
*future* work, when both were already fully built).

## References

- [`PRODUCT.md`](../PRODUCT.md) — why this exists, read first
- [`CLAUDE.md`](../CLAUDE.md) — doc index and known doc/code drift
- [`DEVELOPMENT.md`](./DEVELOPMENT.md) — dev workflows, testing, deployment
- [`AI.md`](./AI.md) — Gemini setup and troubleshooting
