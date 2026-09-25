# Development Guide

**For AI Agents & Human Developers**

Last Updated: 27 October 2025

---

## 🚀 Quick Start for AI Agents

### Tech Stack Overview
- **Framework**: Next.js 16.0.0 (App Router, Turbopack)
- **UI Library**: React 19.2.0
- **Language**: TypeScript 5.9.3 (strict mode enabled)
- **Package Manager**: PNPM v10.19.0 (monorepo)
- **Design System**: @common-origin/design-system v1.4.0
- **Node Version**: 20+

### Key Constraints
- ✅ TypeScript strict mode - NO `any` types allowed
- ✅ All imports must be explicitly typed
- ✅ Use design system components (no custom CSS where possible)
- ✅ Client components require `"use client"` directive
- ✅ File-based routing (Next.js App Router)

### Recipe Data Architecture

```
┌─────────────────────────┐
│ AI RECIPE GENERATION    │ /api/generate-recipes
│ - Gemini API            │ Context-aware generation
│ - Family settings       │
│ - Dietary preferences   │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ URL RECIPE EXTRACTION   │ /api/extract-recipe-from-url
│ - User provides URL     │ Gemini-powered parsing
│ - Auto-extracts recipe  │
│ - Normalizes structure  │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ RECIPE LIBRARY          │ apps/web/src/lib/library.ts
│ - Manages custom recipes│ Runtime: loads on app start
│ - Provides search API   │
│ - Filters & sorting     │
│ - AI + user recipes     │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ APP COMPONENTS          │ apps/web/src/app/
│ - composeWeek()         │ User-facing features
│ - MealCard, SwapDrawer  │
│ - Shopping list export  │
└─────────────────────────┘
```

---

## 📁 Project Structure

```
meal-agent/
├── PRODUCT.md                   # Why this exists (start here)
├── .github/                    # Documentation & project management
│   ├── DEVELOPMENT.md          # This file
│   ├── ARCHITECTURE.md         # System design
│   └── archive/                # Historical, point-in-time planning docs
│
├── apps/
│   └── web/                    # Next.js application
│       ├── src/
│       │   ├── app/            # Routes (App Router)
│       │   │   ├── page.tsx                    # Home (/)
│       │   │   ├── plan/page.tsx               # Meal planner (/plan)
│       │   │   ├── shopping-list/page.tsx      # Grocery list
│       │   │   └── onboarding/page.tsx         # User setup
│       │   │
│       │   ├── components/app/ # App-specific components
│       │   │   ├── MealCard.tsx
│       │   │   ├── WeekPlannerGrid.tsx
│       │   │   ├── SwapDrawer.tsx
│       │   │   └── ...
│       │   │
│       │   └── lib/            # Business logic & utilities
│       │       ├── compose.ts              # Meal planning algorithm
│       │       ├── library.ts              # Recipe library (AI + user recipes)
│       │       ├── storage.ts              # LocalStorage helpers
│       │       ├── analytics.ts            # Event tracking
│       │       └── types/
│       │           └── recipe.ts           # Type definitions
│       │
│       ├── tsconfig.json       # TypeScript config (strict mode)
│       └── next.config.ts      # Next.js config
│
└── pnpm-workspace.yaml         # Monorepo config
```

---

## 🔧 Common Development Tasks

### Starting Development Server
```bash
pnpm dev
# → http://localhost:3000
# Uses Turbopack for fast HMR
```

### Adding Recipes
Recipes are added through the application:
- **AI Generation**: Use `/api/generate-recipes` endpoint via the weekly planning wizard
- **URL Extraction**: Import from any recipe website via `/api/extract-recipe-from-url`
- **Manual Entry**: Add recipes manually through the `/recipes/add` page

### Running Type Checks
```bash
cd apps/web
pnpm tsc --noEmit
```

### Clearing Next.js Cache
```bash
rm -rf apps/web/.next
pnpm dev
```

---

## 🎯 Key Files & Their Roles

### Recipe Data Types

**Recipe** (`apps/web/src/lib/types/recipe.ts`)
```typescript
{
  id: string;
  title: string;
  source: {
    url?: string;                // Optional for AI-generated recipes
    domain?: string;
    chef?: string;
    fetchedAt: string;
  };
  timeMins?: number;
  serves?: number;
  tags: string[];
  ingredients: Ingredient[];
  costPerServeEst?: number;      // Calculated from ingredients
}
```

### Core Business Logic

**composeWeek()** - `apps/web/src/lib/compose.ts`
- Generates weekly meal plan
- Applies filters: kid-friendly, max time, protein variety
- Uses RecipeLibrary.search() to find candidates
- Returns PlanWeek with cost estimate

**RecipeLibrary** - `apps/web/src/lib/library.ts`
- Manages custom recipes (AI-generated, user-added, URL-extracted)
- Methods: `search()`, `getById()`, `getAll()`, `addRecipe()`, `deleteRecipe()`
- Search supports: tags, maxTime, excludeIds, limit
- Persists recipes to Supabase (authenticated) or localStorage (anonymous)

---

## 🐛 Known Issues & Gotchas

### 1. VS Code TypeScript Server Cache
**Symptom**: Import errors for `@/lib/library` even though app compiles fine

**Solution**:
```bash
# In VS Code
Cmd+Shift+P → "TypeScript: Restart TS Server"
# OR
Cmd+Shift+P → "Developer: Reload Window"
```

**Why**: VS Code caches module resolution, especially for JSON imports

### 2. Recipe Sources
Recipes come from multiple sources:
- AI-generated via Gemini API
- User uploads via URL extraction
- Manual entry via the recipes page

### 3. RecipeYield Type Inconsistency
**Problem**: Some sites use `["4"]`, others use `"4"` or `4`

**Solution**: Parser handles all three
```typescript
function parseServings(yield_?: string | number | string[]): number {
  if (typeof yield_ === 'number') return yield_;
  if (Array.isArray(yield_)) return parseInt(String(yield_[0]));
  return parseInt(String(yield_).match(/(\d+)/)?.[1] || '4');
}
```


**Symptom**: "Port 3000 is in use" or lock file errors

**Solution**:
```bash
# Kill all Next.js processes
pkill -9 -f "next dev"

# Clear lock files
rm -rf apps/web/.next/dev/lock

# Restart
pnpm dev
```

---

## 🧪 Testing Strategy

### Manual Testing Checklist
- [ ] Navigate to /plan - weekly meal plan loads
- [ ] Click "Swap" on a meal - drawer opens with 3 suggestions
- [ ] Select a swap - meal updates, budget recalculates
- [ ] Check recipe details - shows real RecipeTin Eats data
- [ ] Export shopping list - CSV downloads correctly
- [ ] Check /admin/debug - analytics tracking works

### Automated Tests (Coming Soon)
See Step 2 in this guide for Vitest setup

---

---

## 🔍 Debugging Tips

### Recipe Not Appearing in App?
1. Check if recipe was saved: Look in Supabase dashboard or localStorage
2. Check search: `RecipeLibrary.search({ tags: ['dinner'] })`
3. Clear cache and reload: Recipes may be cached

### TypeScript Errors?
1. Clear cache: `rm -rf apps/web/.next`
2. Restart TS server: VS Code Command Palette
3. Check types: `cd apps/web && pnpm tsc --noEmit`
4. Verify imports: Use exact paths from types/recipe.ts

---

## 📚 Related Documentation

- **PRODUCT.md** - Why this exists and what it needs to achieve
- **ARCHITECTURE.md** - System design & data flow diagrams
- **CLAUDE.md** - Index of the full doc set, plus known doc/code drift

---

## 📊 Ingredient Analytics & Price Mapping

### Overview
The system automatically tracks ingredient usage frequency to help prioritize which ingredients need Coles price mappings.

### How It Works

**Automatic Tracking**:
- Triggered automatically when users generate or view meal plans
- Extracts all ingredients from selected recipes
- Normalizes ingredient names (removes "fresh", "chopped", etc.)
- Increments frequency counters in localStorage
- Checks each ingredient against 179 mapped Coles products

**Analytics Dashboard**: `/debug/ingredient-analytics`
- View total recipes tracked and ingredient counts
- See coverage statistics (mapped vs unmapped %)
- Top 10 unmapped ingredients needing prices
- Generate full priority report (top 50-100 ingredients)
- Export data as JSON for analysis

**Key Functions** - `apps/web/src/lib/ingredientAnalytics.ts`:
```typescript
trackIngredientUsage(recipeIds: string[])      // Auto-called on plan generation
getIngredientAnalytics()                        // Returns comprehensive stats
generatePriorityReport()                        // Creates formatted text report
exportIngredientData()                          // JSON export
resetIngredientAnalytics()                      // Clear all data
```

**Storage**: localStorage key `meal-agent:ingredient-frequency:v1`

**Use Case**: 
When expanding price mappings in `colesMapping.ts`, use the analytics dashboard to identify which 50-100 ingredients are most frequently used in real meal plans, ensuring you're adding the most valuable mappings first.

---

## 🤖 AI Agent Guidelines

When working on this codebase:

1. **Always check types first** - This is a strict TypeScript project
2. **Read existing code** - Don't reinvent patterns
3. **Use design system** - Import from @common-origin/design-system
4. **Test manually** - Run `pnpm dev` and verify in browser
5. **Validate data flow** - Understand AI generation → library → runtime
6. **Ask before major changes** - Especially to core types or algorithms

### Common AI Agent Tasks

**"Add a new filter to meal planning"**
→ Update `composeWeek()` in compose.ts
→ Add to `LibrarySearchOptions` interface
→ Update `RecipeLibrary.search()` implementation

**"Add a new UI component"**
→ Use design system components
→ Add to `apps/web/src/components/app/`
→ Export from component file
→ Import in page/layout

**"Fix a bug in recipe handling"**
→ Check `library.ts` for recipe management
→ Check API routes for extraction/generation
→ Test in app

---

**Questions?** Check ARCHITECTURE.md or PRODUCT.md first!
