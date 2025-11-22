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

### Data Flow Architecture

```
┌─────────────────┐
│ Chef Websites   │ (RecipeTin Eats, Jamie Oliver, etc.)
│ (recipe pages)  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│ 1. INDEXER              │ scripts/indexChefs.ts
│ - Crawls sitemaps       │ Manual: pnpm index-chefs
│ - Extracts JSON-LD      │
│ - Applies filters       │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ data/library/           │ Indexed recipes (JSON-LD format)
│ └─ nagi/                │ 50 recipes from RecipeTin Eats
│    ├─ recipe1.json      │
│    └─ recipe2.json      │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ 2. BUILD SCRIPT         │ scripts/buildRecipeLibrary.ts
│ - Reads all JSON files  │ Auto: runs before Next.js build
│ - Converts to app format│ Manual: npx tsx scripts/buildRecipeLibrary.ts
│ - Validates structure   │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ recipes.generated.json  │ Static recipe data (app format)
│ (3,700+ lines)          │ 50 recipes ready for consumption
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ 3. RECIPE LIBRARY       │ apps/web/src/lib/library.ts
│ - Imports static JSON   │ Runtime: loads on app start
│ - Provides search API   │
│ - Filters & sorting     │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ 4. APP COMPONENTS       │ apps/web/src/app/
│ - composeWeek()         │ User-facing features
│ - MealCard, SwapDrawer  │
│ - Shopping list export  │
└─────────────────────────┘
```

---

## 📁 Project Structure

```
meal-agent/
├── .github/                    # Documentation & project management
│   ├── DEVELOPMENT.md          # This file
│   ├── ARCHITECTURE.md         # System design
│   ├── PROJECT_STATUS.md       # Current status & roadmap
│   └── COPILOT_BUILD.md        # Historical build instructions
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
│       │       ├── library.ts              # Recipe search & filtering
│       │       ├── recipes.ts              # Static recipe import wrapper
│       │       ├── recipes.generated.json  # Generated recipe data
│       │       ├── storage.ts              # LocalStorage helpers
│       │       ├── analytics.ts            # Event tracking
│       │       └── types/
│       │           └── recipe.ts           # Type definitions
│       │
│       ├── tsconfig.json       # TypeScript config (strict mode)
│       └── next.config.ts      # Next.js config
│
├── scripts/                    # Build & indexing scripts
│   ├── indexChefs.ts           # Recipe indexer (manual)
│   └── buildRecipeLibrary.ts   # JSON generator (auto)
│
├── data/
│   └── library/                # Indexed recipes (JSON-LD)
│       └── nagi/               # RecipeTin Eats (50 recipes)
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

### Indexing New Recipes (Manual)
```bash
# 1. Configure chef in scripts/indexChefs.ts
# 2. Run indexer
pnpm index-chefs

# Output: data/library/{chef-name}/*.json
```

### Building Recipe Library (Usually Automatic)
```bash
# Converts indexed recipes to app format
npx tsx scripts/buildRecipeLibrary.ts

# Output: apps/web/src/lib/recipes.generated.json
```

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

**IndexedRecipe** (`data/library/nagi/*.json`)
```typescript
{
  id: string;                    // Generated slug
  sourceUrl: string;             // Original recipe URL
  chef: string;                  // Chef identifier
  domain: string;                // Source domain
  indexedAt: string;             // ISO timestamp
  recipe: {                      // JSON-LD from website
    "@type": "Recipe",
    name: string,
    recipeIngredient: string[],
    totalTime: "PT45M",          // ISO 8601 duration
    recipeYield: ["4"] | "4",    // Array or string
    // ... more fields
  }
}
```

**Recipe** (`apps/web/src/lib/types/recipe.ts`)
```typescript
{
  id: string;
  title: string;
  source: {
    url: string;
    domain: string;
    chef: 'jamie_oliver' | 'recipe_tin_eats';
    license: 'permitted';
    fetchedAt: string;
  };
  timeMins: number;              // Parsed from ISO 8601
  serves: number;                // Parsed from yield
  tags: string[];                // Generated from categories
  ingredients: Ingredient[];     // Parsed & structured
  costPerServeEst: number;       // Calculated heuristic
}
```

### Core Business Logic

**composeWeek()** - `apps/web/src/lib/compose.ts`
- Generates weekly meal plan
- Applies filters: kid-friendly, max time, protein variety
- Uses RecipeLibrary.search() to find candidates
- Returns PlanWeek with cost estimate

**RecipeLibrary** - `apps/web/src/lib/library.ts`
- Static class, loads recipes.generated.json
- Methods: `search()`, `getById()`, `getAll()`
- Search supports: tags, maxTime, chef, excludeIds, limit

**buildRecipeLibrary()** - `scripts/buildRecipeLibrary.ts`
- Transforms IndexedRecipe → Recipe
- Parses ISO 8601 durations (PT1H30M → 90 minutes)
- Handles recipeYield as array or string
- Estimates cost based on ingredient count
- Extracts tags from categories

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

### 2. JSON Import Type Issues
**Problem**: Direct JSON imports don't work well with TypeScript strict mode

**Solution**: Always use the wrapper
```typescript
// ❌ Don't do this
import data from "./recipes.generated.json";

// ✅ Do this instead
import { recipes } from "./recipes";
```

**Implementation**: See `apps/web/src/lib/recipes.ts`

### 3. Recipe Filters Configuration
**Location**: `scripts/indexChefs.ts`

```typescript
const RECIPE_FILTERS: RecipeFilters = {
  maxTotalTimeMinutes: 60,        // Max cook time
  maxIngredients: 18,              // Max ingredient count
  excludeCategories: [             // Skip these categories
    "Breakfast", "Brunch", "Dessert", "Baking", 
    "Drinks", "Cocktails", "Snack", "Cupcake"
  ],
  requireDinnerFocused: true       // Only dinner recipes
};
```

**To modify**: Edit this object, re-run `pnpm index-chefs`

### 4. RecipeYield Type Inconsistency
**Problem**: Some sites use `["4"]`, others use `"4"` or `4`

**Solution**: Parser handles all three
```typescript
function parseServings(yield_?: string | number | string[]): number {
  if (typeof yield_ === 'number') return yield_;
  if (Array.isArray(yield_)) return parseInt(String(yield_[0]));
  return parseInt(String(yield_).match(/(\d+)/)?.[1] || '4');
}
```

### 5. Port Conflicts
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

## 📝 Adding New Features

### Example: Add a New Recipe Source

1. **Update Indexer Config** (`scripts/indexChefs.ts`)
```typescript
const CHEFS: ChefConfig[] = [
  // ... existing
  {
    name: "new-chef-slug",
    domain: "example.com",
    robotsTxtUrl: "https://example.com/robots.txt",
    sitemapUrl: "https://example.com/sitemap.xml",
    excludePatterns: ["/blog/", "/about/"],
  }
];
```

2. **Run Indexer**
```bash
pnpm index-chefs
# Check: data/library/new-chef-slug/ should exist
```

3. **Rebuild Library**
```bash
npx tsx scripts/buildRecipeLibrary.ts
# Check: recipes.generated.json updated
```

4. **Update Chef Type** (if needed)
```typescript
// apps/web/src/lib/types/recipe.ts
type Chef = 'jamie_oliver' | 'recipe_tin_eats' | 'new_chef';
```

5. **Test in App**
```bash
pnpm dev
# Navigate to /plan
# Verify new recipes appear
```

---

## 🔍 Debugging Tips

### Recipe Not Appearing in App?
1. Check if indexed: `ls data/library/nagi/`
2. Check if built: `grep "recipe-id" apps/web/src/lib/recipes.generated.json`
3. Check filters: Does it pass quality criteria?
4. Check search: `RecipeLibrary.search({ tags: ['dinner'] })`

### Indexer Failing?
1. Check robots.txt: `curl https://example.com/robots.txt`
2. Check sitemap: `curl https://example.com/sitemap.xml`
3. Check JSON-LD: View page source, look for `<script type="application/ld+json">`
4. Check filters: Recipe might be excluded by category/time/ingredients

### TypeScript Errors?
1. Clear cache: `rm -rf apps/web/.next`
2. Restart TS server: VS Code Command Palette
3. Check types: `cd apps/web && pnpm tsc --noEmit`
4. Verify imports: Use exact paths from types/recipe.ts

---

## 📚 Related Documentation

- **ARCHITECTURE.md** - System design & data flow diagrams
- **PROJECT_STATUS.md** - Current status & next steps
- **INDEXER_ENHANCEMENT_PLAN.md** - Indexer development history
- **COPILOT_BUILD.md** - Original build instructions

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
5. **Validate data flow** - Understand indexer → build → runtime
6. **Ask before major changes** - Especially to core types or algorithms

### Common AI Agent Tasks

**"Add a new filter to meal planning"**
→ Update `composeWeek()` in compose.ts
→ Add to `LibrarySearchOptions` interface
→ Update `RecipeLibrary.search()` implementation

**"Index recipes from a new site"**
→ Add to `CHEFS` array in indexChefs.ts
→ Test sitemap structure
→ Run indexer, verify output
→ Rebuild library

**"Add a new UI component"**
→ Use design system components
→ Add to `apps/web/src/components/app/`
→ Export from component file
→ Import in page/layout

**"Fix a bug in recipe parsing"**
→ Check `buildRecipeLibrary.ts`
→ Add handling for edge case
→ Rebuild library
→ Test in app

---

**Questions?** Check PROJECT_STATUS.md or ARCHITECTURE.md first!
