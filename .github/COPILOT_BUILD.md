# COPILOT_BUILD.md — Bootstrapping the Meal Agent repo

**Goal:** create a fresh GitHub repo and have **GitHub Copilot** + VS Code scaffold the Meal Agent UI using the **Common Origin Design System** (CODS). This file acts as Copilot’s playbook: paste it into an empty folder and follow the steps below.

---

## 0) Prereqs

* Node **20+**, PNPM **9+** (`corepack enable && corepack prepare pnpm@latest --activate`)
* Git + a GitHub account
* **VS Code** with **GitHub Copilot** & **Copilot Chat** extensions
* (Optional) Vercel CLI

---

## 1) Create and push an empty repo

```bash
# In an empty directory
git init
gh repo create meal-agent --public --source=. --remote=origin --push
printf "# Meal Agent\n\nScaffolded with Common Origin Design System.\n" > README.md
printf "node_modules\n.out\n.next\n.env\n.vercel\n.DS_Store\n" > .gitignore
git add . && git commit -m "chore: init repo"
```

Open the folder in **VS Code**.

---

## 2) Tell Copilot the plan (Chat prompt)

Open **Copilot Chat** and paste:

> You are my repo assistant. We’re building a PNPM monorepo with a Next.js app that consumes my **Common Origin Design System** package (local workspace). Use this spec file (COPILOT_BUILD.md) as the source of truth. Create the workspace, Next.js app, providers, routes, and stub components exactly as described. Do not invent package names—use placeholders that I will replace with the real CODS import paths. Ask only if a filename or path is missing.

---

## 3) Workspace & app skeleton (ask Copilot to run/create files)

In Chat, run this *work order*:

> **WORK ORDER 1: Workspace & Next app**
>
> * Create `pnpm-workspace.yaml` with packages `apps/*` and `packages/*`.
> * Create folders: `apps/web`, `packages/utils`.
> * Scaffold Next.js app **in `apps/web`** (TypeScript, App Router).
> * Add scripts to `apps/web/package.json`: dev/build/start/lint/typecheck.
> * Add dependencies: `zod`, `dayjs`, `@common-origin/design-system@1.14.0`, `@google/generative-ai`.
> * Configure import alias `@/*`.

If Copilot can't run terminal commands, let it generate the files; you run terminal bits:

```bash
printf "packages:\n  - apps/*\n  - packages/*\n" > pnpm-workspace.yaml
mkdir -p apps/web packages/utils
pnpm create next-app apps/web --ts --eslint --app --src-dir --tailwind false --import-alias @/*
cd apps/web && pnpm add zod dayjs @common-origin/design-system@1.14.0 @google/generative-ai && cd ../../
pnpm i
```

Commit:

```bash
git add . && git commit -m "feat: workspace + Next.js app"
```

---

## 4) Install the Common Origin Design System

The design system is available as an NPM package. Install it directly:

```bash
cd apps/web
pnpm add @common-origin/design-system@1.14.0

---

## 4) Wire the Common Origin Design System (placeholder)

We’ll treat CODS as a local workspace package for now. Add a placeholder package.json:

```bash
cat > packages/common-origin-ds/package.json << 'JSON'
{
  "name": "common-origin-ds",
  "version": "0.0.0",
  "main": "index.js",
  "types": "index.d.ts"
}
JSON
```

**Available Components (v1.14.0)**:
- Layout: Container, Stack, Box, ResponsiveGrid, Divider
- Forms: TextField, NumberInput, PasswordField, Slider, Checkbox, Dropdown
- Interactive: Button, IconButton, Sheet, Chip
- Typography: Typography, Avatar

Documentation: https://common-origin-design-system.vercel.app/

---

## 5) Setup Environment Variables

Create a `.env.local` file for API keys:

```bash
cat > apps/web/.env.local << 'ENV'
# Google Gemini API Key (get from https://aistudio.google.com/apikey)
GEMINI_API_KEY=your_api_key_here

# GitHub Personal Access Token (optional, for recipe sync)
GITHUB_TOKEN=your_token_here
ENV

## 6) App structure & providers

Use this *work order* in Copilot:

> **WORK ORDER 2: Providers & Layouts**
> Create `apps/web/src/app/layout.tsx` and `apps/web/src/app/providers.tsx` that wrap the app in `ThemeProvider` from CODS **(placeholder import)** and load CODS styles. Keep tokens undefined initially. Also create a simple Welcome page at `apps/web/src/app/page.tsx` with CTA links to `/onboarding` and `/plan`.

**Acceptance Criteria**

* `layout.tsx` imports `./providers` and sets basic metadata
* `providers.tsx` wraps children in `<ThemeProvider tokens={undefined as any}>`
* Welcome page renders two buttons

Commit after review.

---

## 6) Routes & components

Send this *work order*:

> **WORK ORDER 3: Routes & stubs**
> Create these routes under `apps/web/src/app/`:
>
> * `/onboarding/page.tsx` (multi-step stub)
> * `/plan/page.tsx` (weekly grid + BudgetBar)
> * `/recipe/[id]/page.tsx` (provenance + link to original)
> * `/shopping-list/page.tsx` (aisle groups + Export CSV button)
>   And these components under `apps/web/src/components/app/`:
> * `ProvenanceChip.tsx`, `ConflictChip.tsx`, `BudgetBar.tsx`, `MealCard.tsx`, `WeekPlannerGrid.tsx`, `ChefPicker.tsx`
>   And these libs under `apps/web/src/lib/`:
> * `mockData.ts`, `csv.ts`, `categories.ts`, `storage.ts`, `schedule.ts`
>   Use CODS primitives (`Card`, `Button`, `Chip`, `Avatar`, `Progress`, `Text`, etc.) with **placeholder imports**.

**Acceptance Criteria**

* `/plan` shows 7 MealCards from mock data
* BudgetBar renders and displays a fake total
* `/shopping-list` exports a CSV file when clicking the button

Commit after it builds locally.

---

## 7) Sunday 08:00 prompt (stub)

Send this *work order*:

> **WORK ORDER 4: Auto-proposal stub**
> Implement `scheduleSundayToast()` in `src/lib/schedule.ts` to check local time and, if Sunday 08:00, trigger a toast (use CODS Toast if available or a temporary alert). Call this in `/plan/page.tsx` via `useEffect`.

Commit.

---

## 8) CSV & aisle grouping acceptance

Run app and verify:

```bash
pnpm -F web dev
# http://localhost:3000 (or configured port)
```

* `/shopping-list` → **Export CSV** downloads a clean CSV with header `Category,Qty,Unit,Item`.
* `/plan` shows a weekly grid with MealCards and a **Lock plan** button linking to `/shopping-list`.

Commit any fixes.

---

## 9) First PR & Vercel preview

```bash
git checkout -b feat/scaffold
git push -u origin feat/scaffold
# Open PR on GitHub
```

If you use Vercel, set up the project and enable **Preview Deployments per PR**.

---

## 10) Replace CODS placeholders with real imports

Once ready, copy your real **Common Origin Design System** into `packages/common-origin-ds/` **or** switch `apps/web/package.json` to consume your published package. Then update imports (ThemeProvider, components, styles). Commit.

---

## 11) Copilot quick prompts (handy snippets)

* *“Generate a simple CSV exporter utility that accepts grouped items and returns a quoted CSV string.”*
* *“Create a MealCard using my DS Card, Chip, and Button with props: title, chef, timeMins, kidsFriendly, conflicts[].”*
* *“Build a 7-column responsive grid that becomes a vertical list on mobile.”*
* *“Implement a drawer-based swap flow on mobile and drag-swap placeholder on desktop.”*

---

## 12) Definition of Done (MVP scaffold)

* Shared login (stub) and onboarding screens exist
* Plan page renders 4–7 dinners from mock data
* Recipe page shows attribution + external link (no verbatim methods)
* Shopping list exports CSV grouped by aisle
* Sunday 08:00 toast appears (stub)
* CI scripts in place: `lint` + `typecheck`

---

## 13) Next tasks

1. Swap mobile drawer + keyboard-accessible swap on desktop
2. Token audit: reuse existing tones; list any **new tokens needed**
3. Admin ImportFromURLModal (UI only)
4. Local analytics (page views, swaps, export) in localStorage
5. Prepare for recipe import (schema.org) and Coles mapping in the next phase

---

## 14) CI: GitHub Actions (lint + typecheck)

Create `.github/workflows/ci.yml`:

```yaml
name: CI
on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - name: Install
        run: pnpm i --frozen-lockfile=false
      - name: Lint
        run: pnpm -C apps/web lint
      - name: Typecheck
        run: pnpm -C apps/web typecheck
      # Optional: add basic a11y checks later
      # - name: A11y (axe) — TODO
      #   run: pnpm -C apps/web test:a11y
```

Commit and push. This will validate every PR and push to `main`.

---

## 15) Bootstrap script (optional)

Create `scripts/bootstrap.sh` to automate the boring parts. **Run once** on a fresh repo.

```bash
#!/usr/bin/env bash
set -euo pipefail

# --- Config ---
APP_NAME=${APP_NAME:-web}
DS_PKG_DIR=packages/common-origin-ds

# --- Checks ---
command -v node >/dev/null || { echo "Node is required"; exit 1; }
command -v pnpm >/dev/null || { echo "PNPM is required (corepack enable)"; exit 1; }

# --- Workspace ---
mkdir -p apps "$DS_PKG_DIR" packages/utils
cat > pnpm-workspace.yaml <<'YAML'
packages:
  - apps/*
  - packages/*
YAML

# --- Next.js app ---
if [ ! -d "apps/$APP_NAME" ]; then
  pnpm create next-app "apps/$APP_NAME" --ts --eslint --app --src-dir --tailwind false --import-alias @/* --yes
fi

# --- Deps ---
pnpm -C "apps/$APP_NAME" add zod dayjs

# --- DS placeholder ---
if [ ! -f "$DS_PKG_DIR/package.json" ]; then
  mkdir -p "$DS_PKG_DIR"
  cat > "$DS_PKG_DIR/package.json" <<'JSON'
{
  "name": "common-origin-ds",
  "version": "0.0.0",
  "main": "index.js",
  "types": "index.d.ts"
}
JSON
fi

# --- Providers & pages (minimal stubs) ---
APP_SRC="apps/$APP_NAME/src/app"
mkdir -p "$APP_SRC/onboarding" "$APP_SRC/plan" "$APP_SRC/recipe/[id]" "$APP_SRC/shopping-list"

cat > "$APP_SRC/providers.tsx" <<'TSX'
"use client";
import { ThemeProvider } from "common-origin-ds"; // TODO: replace with real import
export default function Providers({ children }: { children: React.ReactNode }) {
  return <ThemeProvider tokens={undefined as any}>{children}</ThemeProvider>;
}
TSX

cat > "$APP_SRC/layout.tsx" <<'TSX'
import type { Metadata } from "next";
import Providers from "./providers";
export const metadata: Metadata = { title: "Meal Agent", description: "Family meal planning" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body><Providers>{children}</Providers></body></html>);
}
TSX

cat > "$APP_SRC/page.tsx" <<'TSX'
import Link from "next/link";
export default function Page(){
  return (
    <main style={{padding:24}}>
      <h1>Meal Agent</h1>
      <p>Plan dinners, export a Coles-ready list.</p>
      <p>
        <Link href="/onboarding">Start planning</Link> · <Link href="/plan">Try sample week</Link>
      </p>
    </main>
  );
}
TSX

cat > "$APP_SRC/onboarding/page.tsx" <<'TSX'
export default function Onboarding(){ return <main style={{padding:24}}>Onboarding (stub)</main>; }
TSX

cat > "$APP_SRC/plan/page.tsx" <<'TSX'
export default function Plan(){ return <main style={{padding:24}}>Plan (stub)</main>; }
TSX

cat > "$APP_SRC/recipe/[id]/page.tsx" <<'TSX'
export default function Recipe(){ return <main style={{padding:24}}>Recipe (stub)</main>; }
TSX

cat > "$APP_SRC/shopping-list/page.tsx" <<'TSX'
export default function ShoppingList(){ return <main style={{padding:24}}>Shopping List (stub)</main>; }
TSX

# --- Scripts ---
node -e "const p=require('./apps/$APP_NAME/package.json');p.scripts={...p.scripts,lint:'eslint .',typecheck:'tsc --noEmit'};require('fs').writeFileSync('./apps/$APP_NAME/package.json',JSON.stringify(p,null,2))"

# --- Git ---
if [ -d .git ]; then
  git add .
  git commit -m "chore: bootstrap workspace and app" || true
fi

echo "
Done. Next steps:
- Replace DS placeholder with your real Common Origin DS or npm package.
- Run: pnpm -F apps/$APP_NAME dev
"
```

Make it executable and run:

```bash
chmod +x scripts/bootstrap.sh
./scripts/bootstrap.sh
```

Commit the script and CI:

```bash
git add .github/workflows/ci.yml scripts/bootstrap.sh
git commit -m "ci: add actions; chore: bootstrap script"
```

---

## 16) Using Copilot effectively with this repo

* Keep **COPILOT_BUILD.md** up to date—Copilot will use it as context.
* Issue **WORK ORDER** prompts for discrete tasks (files, routes, components) and include **Acceptance Criteria**.
* After each Copilot change, **review diffs** and run `pnpm -F web dev` to validate.
* Prefer small PRs so Vercel previews map cleanly to each slice.
