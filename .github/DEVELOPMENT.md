# Development Guide

For AI agents and human developers. See [`PRODUCT.md`](../PRODUCT.md) for
why this exists and [`ARCHITECTURE.md`](./ARCHITECTURE.md) for how it's
built — this file is about the day-to-day mechanics of working in the
codebase.

## Getting started

Prerequisites: Node 20+, pnpm 9+.

```bash
pnpm install
pnpm dev              # http://localhost:3000, Turbopack + hot reload
```

Environment variables go in `apps/web/.env.local` — see the root
`.env.local.example` for what's needed and `supabase/README.md` for
database setup.

## Project structure

```
meal-agent/
├── PRODUCT.md                  # Why this exists (start here)
├── CLAUDE.md                   # Doc index + known doc/code drift
├── .github/
│   ├── ARCHITECTURE.md         # System design
│   ├── DEVELOPMENT.md          # This file
│   └── archive/                # Historical, point-in-time planning docs
├── apps/web/src/
│   ├── app/                    # Routes (App Router) — see ARCHITECTURE.md
│   │                              for the actual current page list
│   ├── components/app/         # App-specific components
│   ├── proxy.ts                # Auth gate — see ARCHITECTURE.md
│   └── lib/                    # Business logic — compose.ts, library.ts,
│                                  scoring.ts, storage layers, etc.
└── pnpm-workspace.yaml         # Monorepo config
```

Don't trust a hand-copied page/component list to stay accurate here —
`ARCHITECTURE.md`'s UI section is kept closer to current and is the
better reference for "what pages/components actually exist."

## Core concepts

**Meal planning flow**: `composeWeek(household, overrides?)` in
`compose.ts` scores every candidate recipe (`scoring.ts`), picks the best
fit per day while enforcing variety (protein, cuisine, recency), and
returns a `PlanWeek`. `scoreRecipe()` itself is a pure function, but
`composeWeek()` is not — it reads recent-recipe history via
`getRecentRecipeIds()`, queries the current `RecipeLibrary` state
directly, and calls `recordWeekRecipes()` as a side effect at the end.
Same inputs can produce different plans depending on what's changed in
storage since the last call, and calling it has a side effect. (An
earlier version of this doc, and of `ARCHITECTURE.md`, incorrectly
called this pure — caught by review, corrected here.)

**Explainability**: every meal selection carries reason codes
(`explainer.ts` maps them to human-readable chips, e.g. `"quick_weeknight"`
→ "⚡ Quick (≤40 mins)"), so the UI can show *why* a meal was chosen, not
just what was chosen.

**Shopping list**: `shoppingListAggregator.ts` normalizes ingredient names
and units, sums quantities across the week's recipes, flags pantry
staples, then `colesMapping.ts` attaches pricing where a mapping exists
(it's a large, hand-maintained file that's grown well past its original
size — check it directly rather than trusting a specific count anywhere
in prose, including here).

**Analytics**: `analytics.ts` tracks events entirely client-side
(localStorage, never transmitted) — check the file directly for the
current event list rather than trusting a specific count.

## Common development tasks

```bash
pnpm dev                          # dev server
pnpm -C apps/web build             # production build
cd apps/web && pnpm tsc --noEmit  # type check only, no build
pnpm test                         # run the test suite (see Testing below)
rm -rf apps/web/.next && pnpm dev # clear the Next.js cache
```

**Adding recipes** happens through the app itself, not by editing a data
file — there's no static/seed recipe library (see `PRODUCT.md` on why):
AI generation via the weekly planning wizard, URL import or manual entry
via `/recipes/add`, or photo scanning.

## Key files to read first

1. **`apps/web/src/lib/compose.ts`** — the core planning algorithm
2. **`apps/web/src/lib/scoring.ts`** — the scoring rules that drive it
3. **`apps/web/src/lib/library.ts`** (`RecipeLibrary`) — recipe storage
   and retrieval; check this file directly for its actual public methods
   (`getAll`, `search`, `getById`, `getCustomRecipes`,
   `addCustomRecipes`, `addTempAIRecipes`, `syncSupabaseRecipes`, etc.) —
   older docs in this repo have named methods that don't exist
   (`addRecipe`, `deleteRecipe`), so verify against the file, not prose
4. **`apps/web/src/lib/shoppingListAggregator.ts`** — ingredient
   normalization and dedup

## Known issues & gotchas

**VS Code TypeScript server cache**: import errors for files that
actually resolve fine (the app compiles) usually mean VS Code's TS
server is stale — `Cmd+Shift+P` → "TypeScript: Restart TS Server," or
reload the window.

**Port already in use / stale lock file**:
```bash
pkill -9 -f "next dev"
rm -rf apps/web/.next/dev/lock
pnpm dev
```

## Testing

```bash
pnpm test          # run once
pnpm test:watch    # watch mode
pnpm test:ui       # visual UI
```

Three suites exist (`compose.test.ts`, `library.test.ts`, `scoring.test.ts`).
The root `pnpm test` used to run bare `vitest run` with no config, which
skipped `apps/web/vitest.config.ts` entirely (its `happy-dom` environment
and setup file never applied) — combined with `RecipeLibrary` having no
built-in seed data, that's what caused 12 of 30 tests to fail. Both are
fixed (issue #5): the root scripts now pass `--root apps/web`, and
`compose.test.ts`/`library.test.ts` seed a fixture recipe set via
`__tests__/fixtures/`. There's still no coverage on the storage layers or
any API route.

Manual testing checklist for planning changes:
- [ ] `/plan` loads a weekly grid
- [ ] "Swap" on a meal opens suggestions and updates the plan on selection
- [ ] `/shopping-list` reflects the current plan's ingredients
- [ ] `/settings` changes persist and affect the next generated plan

## Debugging tips

**Recipe not appearing?** Check `RecipeLibrary.getAll().length` in the
console; check whether it was actually saved (Supabase dashboard for
authenticated users, localStorage for anonymous); recipes added via
URL/image/manual entry didn't reliably sync to Supabase before issue #32
fixed it — worth knowing if debugging an old report.

**TypeScript errors?** Clear the cache (`rm -rf apps/web/.next`),
restart the TS server, then confirm with `pnpm tsc --noEmit` from
`apps/web`.

**Inspecting local state**: `localStorage.getItem('meal-agent:...')` keys
hold most anonymous-user state — check `storage.ts` for the exact key
names in use, since several modules bypass the shared storage layers
entirely with their own keys (see `ARCHITECTURE.md`'s Storage section,
issue #2).

## Ingredient analytics & price mapping

`ingredientAnalytics.ts` automatically tracks ingredient usage frequency
whenever a plan is generated or viewed, so `colesMapping.ts` can be
expanded starting with whatever's actually used most, rather than
guessing. Dashboard at `/debug/ingredient-analytics`: coverage
(mapped vs. unmapped), a priority report of the most-used unmapped
ingredients, and a JSON export.

## AI agent guidelines

1. Check types first — this is a strict TypeScript project, no `any`
2. Read the existing code before adding a pattern — don't reinvent one
   that already exists elsewhere in `lib/`
3. Use `@common-origin/design-system` components over custom CSS/markup
4. Verify manually in the browser, not just via typecheck/build
5. Ask before changing core types (`types/recipe.ts`) or the
   composition/scoring algorithms — those are load-bearing for the whole
   app

## Related documentation

- [`PRODUCT.md`](../PRODUCT.md) — why this exists
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — system design & data flow
- [`AI.md`](./AI.md) — Gemini setup and troubleshooting
- [`CLAUDE.md`](../CLAUDE.md) — doc index, known doc/code drift
