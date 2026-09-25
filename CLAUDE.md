# CLAUDE.md

## What this is

Meal Agent is a multi-user, AI-powered weekly meal-planning app for households (built with Next.js/React/TypeScript, Supabase Postgres + Auth, and Google Gemini). A household configures family settings (cuisine, dietary needs, budget, cooking skill/effort, household size) and the app composes a weekly dinner plan from a recipe library plus AI-generated recipes, explains *why* each meal was chosen, estimates cost against real Coles product prices, and produces an aisle-grouped shopping list. Secondary features: pantry scanning from photos, recipe extraction from arbitrary URLs, swap/regenerate flows, and privacy-first local analytics. Target user: a family/household member planning what to cook and shop for each week, not a general recipe-browsing audience.

## Where things live (read the file, don't rely on this doc for depth)

- **`PRODUCT.md`** — *why* this exists and what it needs to achieve, from the project owner directly. Read this before `ARCHITECTURE.md`: if the two ever disagree, `PRODUCT.md` wins.
- **`.github/ARCHITECTURE.md`** — system architecture, layer breakdown, data flow, DB schema. Rewritten as part of #35 to match reality, including the parts that aren't clean (storage layering, no scheduling) — no longer needs the same "treat with suspicion" caveat this line used to carry, but verify against code if something here seems off, same as any doc.
- **`.github/DEVELOPMENT.md`** — day-to-day dev workflows, testing, common tasks, ingredient-analytics workflow. Merges what used to be a separate QUICK_START.md.
- **`.github/AI.md`** — Gemini API setup and troubleshooting. Merges what used to be separate AI_SETUP.md/DEBUGGING_AI.md files.
- **`.github/DESIGN_SYSTEM_MIGRATION.md`** — component migration tracker (version number here is also stale, see below).

Retired as of #35, don't recreate:
- **Deleted outright** (living docs meant to reflect current state, which is exactly the job that failed): `.github/PROJECT_STATUS.md`, `.github/README.md` (a hand-maintained status/roadmap and a second doc index, both already stale and duplicating what `PRODUCT.md`/`CLAUDE.md`/GitHub Issues now cover live) and `.github/API_REFERENCE.md` (a 919-line hand-maintained function reference that documented types and functions — `RecipeFilters`, `saveFavorites()`/`loadFavorites()` — that don't exist anywhere in the codebase; not just stale, fabricated). Git history has all three if ever needed.
- **Moved to `.github/archive/`** (point-in-time planning docs, matching this repo's existing convention there — see the Phase 1/2 docs already present): `COPILOT_BUILD.md` (pre-build bootstrap playbook), `PHASE_3_CHECKOUT_INTEGRATION.md` (research now tracked as issue #36), and `PROJECT_INSTRUCTIONS.md` (another pre-build planning doc — describes an `/onboarding` route that was never built and treats already-shipped features as future work; despite its name it was never "current conventions").

## Known drift — verify before trusting

The docs above are not kept in sync with the code. Confirmed discrepancies (as of 2026-09-25):

- **Design system version**: `.github/archive/PROJECT_INSTRUCTIONS.md` (archived, not current) and `DESIGN_SYSTEM_MIGRATION.md` say v1.14.0 — actual installed version in `apps/web/package.json` is `^2.12.1` and moves via Dependabot regularly. `DEVELOPMENT.md` was rewritten as part of #35 to point at `package.json` instead of stating a version, precisely to stop this from recurring there. Always check `package.json` directly, not prose in any doc, for the real version.
- **Gemini model names**: `.github/archive/PROJECT_INSTRUCTIONS.md` (archived, not current) says `gemini-2.0-flash-exp`. No AI call site uses that model — see `ARCHITECTURE.md`'s API routes table for what's actually configured per route (it's mixed, not one constant). Check the route/lib file directly, not any doc, if `ARCHITECTURE.md`'s table itself ever seems out of date. The stale string is also displayed as static UI copy on the About page (`apps/web/src/app/about/page.tsx:284`), alongside a stale design-system version (`v1.14.0`) on the line above it — that page's "Technology Stack" list still needs fixing (not part of #35, which only covers `.github/*.md` docs, not app UI copy).
- **Scheduling**: `schedule.ts` is still just client-side "plan your week" reminder logic. There is no server-side cron anywhere in the repo (no Vercel cron config, no scheduled GitHub workflow) — don't assume "scheduling" mentioned in docs implies real scheduling infrastructure exists. Tracked in issue #4. (The ICS calendar export this bullet used to also flag as missing now exists — see `apps/web/src/app/api/plan/ics/[token]/route.ts`, issue #3, merged.)

## Dev conventions worth knowing up front

- **Package manager is PNPM (v9+/v10+), not npm or yarn** — this is a PNPM monorepo (`apps/web`, `packages/utils`). Use `pnpm`, not `npm install`/`npx`.
- **TypeScript strict mode, no `any`** (`tsconfig.json` has `strict: true`, and `lib/` has zero `any` usage today — keep it that way). Use `import type { ... }` for type-only imports (already the convention throughout `lib/`), not a plain `import`.
- **Use `@common-origin/design-system` components instead of custom CSS/components** where a suitable component exists — check `apps/web/package.json` for the actual installed version and https://common-origin-design-system.vercel.app/ for its current docs, not any component list written into a doc in this repo (every one found so far has gone stale).
- Client components need `"use client"` (Next.js App Router, file-based routing).
- Run `pnpm test` before assuming changes to `lib/` are safe — but expect 12 pre-existing failures unrelated to your change (see Known Drift); don't treat all-green as a bar you must personally restore unless the user asks for it.
- **All new work goes through a PR — never commit directly to `main`.** Create a feature branch, push it, and open a PR with `gh pr create` even for small changes like a doc update. This applies to Claude Code sessions too.
- **`main` has branch protection**: the `build` CI check is required before merge (no required reviews — solo-maintained repo).
- **Dependabot PRs for routine bumps auto-merge** once CI passes (`.github/workflows/dependabot-auto-merge.yml`): any GitHub Actions version bump, or a patch/minor npm dependency bump. A major npm/pnpm version bump is left for manual review — CI passing doesn't guarantee a major bump is safe.
