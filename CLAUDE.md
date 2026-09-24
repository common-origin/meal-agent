# CLAUDE.md

## What this is

Meal Agent is a multi-user, AI-powered weekly meal-planning app for households (built with Next.js/React/TypeScript, Supabase Postgres + Auth, and Google Gemini). A household configures family settings (cuisine, dietary needs, budget, cooking skill/effort, household size) and the app composes a weekly dinner plan from a recipe library plus AI-generated recipes, explains *why* each meal was chosen, estimates cost against real Coles product prices, and produces an aisle-grouped shopping list. Secondary features: pantry scanning from photos, recipe extraction from arbitrary URLs, swap/regenerate flows, and privacy-first local analytics. Target user: a family/household member planning what to cook and shop for each week, not a general recipe-browsing audience.

## Where things live (read the file, don't rely on this doc for depth)

- **`.github/ARCHITECTURE.md`** — system architecture, layer breakdown, data flow, DB schema. Treat the storage-layer diagram and test-coverage numbers with suspicion (see Known Drift below).
- **`.github/PROJECT_STATUS.md`** — feature/phase status, roadmap ("Next Steps"), tech stack, key file index. Several "Complete ✅" items and version numbers here are stale — verify against code before trusting.
- **`.github/PROJECT_INSTRUCTIONS.md`** — original dev conventions and design-system component inventory (short, worth reading in full once).
- **`.github/API_REFERENCE.md`** — function-level reference for `apps/web/src/lib/*`.
- **`.github/DEVELOPMENT.md`** — dev workflows, testing, deployment steps, ingredient-analytics workflow.
- **`.github/QUICK_START.md`** — 10-minute onboarding/setup guide.
- **`.github/AI_SETUP.md`** / **`.github/DEBUGGING_AI.md`** — Gemini API setup and troubleshooting.
- **`.github/DESIGN_SYSTEM_MIGRATION.md`** — component migration tracker (version number here is also stale, see below).
- **`.github/PHASE_3_CHECKOUT_INTEGRATION.md`** — Coles checkout integration research/plan (not yet built).
- **`.github/COPILOT_BUILD.md`** — a GitHub Copilot bootstrapping playbook from the project's original scaffolding phase. It's a historical artifact, not current guidance — it predates the app actually being built and describes treating the design system as a local placeholder package. Don't follow it for conventions; use PROJECT_INSTRUCTIONS.md / DEVELOPMENT.md instead.

## Known drift — verify before trusting

The docs above are not kept in sync with the code. Confirmed discrepancies (as of 2026-09-24):

- **Design system version**: PROJECT_INSTRUCTIONS.md says v1.14.0, DEVELOPMENT.md says v1.4.0, DESIGN_SYSTEM_MIGRATION.md says v1.14.0 — actual installed version in `apps/web/package.json` is `^2.12.0` (see commit "Upgrade design system to v2.12.0"). Always check `package.json` directly, not the docs, for the real version.
- **Gemini model names**: ARCHITECTURE.md and PROJECT_STATUS.md repeatedly say `gemini-2.0-flash-exp`. No AI call site uses that model. Actual usage is mixed per call site: `gemini-2.5-pro` (`lib/aiRecipeGenerator.ts` main path, with a `gemini-1.5-pro` fallback), `gemini-2.5-flash` (`extract-recipe-from-url`, `scan-pantry-image`), `gemini-1.5-pro` (`extract-recipe-from-image`). Check the route/lib file directly for the model in use, not the docs. The stale string is also displayed as static UI copy on the About page (`apps/web/src/app/about/page.tsx:284`), alongside a stale design-system version (`v1.14.0`) on the line above it — that page's "Technology Stack" list needs the same fixes as the docs.
- **Storage architecture**: ARCHITECTURE.md draws a clean 4-layer pipeline (storage.ts → storageAsync.ts → hybridStorage.ts → supabaseStorage.ts). In practice app code calls all of these layers directly/interchangeably rather than only through the router, and `pantryPreferences.ts`, `recencyTracker.ts`, `ingredientAnalytics.ts`, and `userPriceReports.ts` write straight to `localStorage`, bypassing all four layers. Don't assume a single storage entry point when tracing data flow. Tracked in GitHub issue: storage layering simplification.
- **Test suite health**: docs report "30 tests" with no caveat. Currently 12 of 30 fail (`pnpm test`) because the recipe library has no seed data in the Node test environment. There is no test coverage on the storage layers, `scoring.ts`, or any API route — treat any doc claim of "tested"/"validated" behavior in those areas skeptically. Tracked in GitHub issue: fix broken test suite.
- **Scheduling/export**: `schedule.ts` is client-side "plan your week" reminder logic only. There is no ICS/calendar export code and no server-side cron anywhere in the repo (no Vercel cron config, no scheduled GitHub workflow) — don't assume "scheduling" mentioned in docs implies real scheduling infrastructure exists. Tracked in GitHub issues: ICS export, server-side scheduling.

## Dev conventions worth knowing up front

- **Package manager is PNPM (v9+/v10+), not npm or yarn** — this is a PNPM monorepo (`apps/web`, `packages/utils`). Use `pnpm`, not `npm install`/`npx`.
- **TypeScript strict mode, no `any`** (`tsconfig.json` has `strict: true`, and `lib/` has zero `any` usage today — keep it that way). Use `import type { ... }` for type-only imports (already the convention throughout `lib/`), not a plain `import`.
- **Use `@common-origin/design-system` components instead of custom CSS/components** where a suitable component exists — check actual installed version (`^2.12.0`) and its docs at https://common-origin-design-system.vercel.app/, not the stale component lists in PROJECT_INSTRUCTIONS.md.
- Client components need `"use client"` (Next.js App Router, file-based routing).
- Run `pnpm test` before assuming changes to `lib/` are safe — but expect 12 pre-existing failures unrelated to your change (see Known Drift); don't treat all-green as a bar you must personally restore unless the user asks for it.
- **All new work goes through a PR — never commit directly to `main`.** Create a feature branch, push it, and open a PR with `gh pr create` even for small changes like a doc update. This applies to Claude Code sessions too.
