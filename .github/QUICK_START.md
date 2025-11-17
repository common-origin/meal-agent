# Quick Start Guide

**For**: Developers onboarding to Meal Agent  
**Time**: 10 minutes to get up and running

---

## Prerequisites

- Node.js 20+ installed
- pnpm 9+ installed
- Basic TypeScript knowledge
- Familiarity with Next.js (helpful but not required)

---

## Setup (2 minutes)

### 1. Install Dependencies

```bash
cd meal-agent
pnpm install
```

### 2. Start Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Project Structure (1 minute read)

```
meal-agent/
├── apps/web/src/
│   ├── app/                    # Next.js pages
│   │   ├── plan/review/        # Plan review page
│   │   ├── shopping-list/      # Shopping list page
│   │   └── analytics/          # Analytics dashboard
│   │
│   ├── components/app/         # React components
│   │   ├── MealCard.tsx
│   │   ├── LeftoverCard.tsx
│   │   ├── ShoppingListItem.tsx
│   │   └── RegenerateDrawer.tsx
│   │
│   └── lib/                    # Core business logic
│       ├── library.ts          # Recipe library
│       ├── compose.ts          # Meal planning algorithm
│       ├── scoring.ts          # Recipe scoring (10+ rules)
│       ├── explainer.ts        # Human-readable explanations
│       ├── recencyTracker.ts   # Prevent repetition
│       ├── shoppingListAggregator.ts  # Deduplication
│       ├── colesMapping.ts     # Price estimation
│       ├── analytics.ts        # Privacy-first tracking
│       ├── storage.ts          # localStorage utilities
│       └── tagNormalizer.ts    # Tag vocabulary
│
├── data/library/
│   ├── recipes.generated.json  # 50+ recipes (static)
│   └── nagi/*.json             # Individual recipe files
│
├── scripts/
│   └── indexChefs.ts           # Recipe scraping tool
│
└── .github/
    ├── PROJECT_STATUS.md       # Current status
    ├── PHASE_1_IMPLEMENTATION.md  # Work order details
    ├── API_REFERENCE.md        # Library API docs
    └── ARCHITECTURE.md         # System architecture
```

---

## Key Concepts (3 minutes read)

### 1. Meal Planning Flow

```
User → composeWeek() → PlanWeek
                 │
                 ├─ Score all recipes (scoring.ts)
                 ├─ Select best for each day
                 ├─ Enforce variety (protein, cuisine)
                 ├─ Handle bulk cook + leftovers
                 └─ Track reasons for each choice
```

### 2. Scoring System

Recipes are evaluated with 10+ rules:
- **Recency**: -30 points per week since cooked
- **Protein Rotation**: +15 if different from yesterday
- **Weeknight Constraint**: +20 if ≤40 mins (Mon-Fri)
- **Kid-Friendly**: +10 if household has children
- **Favorite**: +25 if marked as favorite
- **And 5+ more rules...**

See [API_REFERENCE.md](./API_REFERENCE.md#scoring-system) for full list.

### 3. Explainability

Every meal selection includes **reason codes** that are converted to human-readable chips:

```typescript
// Reason codes
["protein_variety", "quick_weeknight"]

// Becomes
[
  { emoji: "🔄", label: "Protein Variety", type: "positive" },
  { emoji: "⚡", label: "Quick (≤40 mins)", type: "positive" }
]
```

### 4. Shopping List

Ingredients are:
1. **Normalized**: "chicken breast" = "chicken breasts"
2. **Unit-converted**: 2 tsp → 0.67 tbsp
3. **Aggregated**: Sum quantities across recipes
4. **Priced**: Mapped to Coles products (30+ SKUs)

### 5. Analytics (Privacy-First)

- **11 event types** tracked (plan_composed, shopping_list_viewed, etc.)
- **localStorage only** (no server transmission)
- **User-controlled** (clear data button in /analytics)

---

## Common Tasks

### Generate a Meal Plan

```typescript
import { composeWeek } from "@/lib/compose";
import { loadHousehold, getDefaultHousehold } from "@/lib/storage";

const household = loadHousehold() || getDefaultHousehold();

const plan = composeWeek(household, {
  pinnedDays: { 0: "chicken-parm-nagi" }, // Pin Monday
  maxCost: 100,
  preferences: { maximizeReuse: true }
});

console.log(plan);
// {
//   days: [...],
//   costEstimate: 87.50,
//   conflicts: []
// }
```

### Search Recipes

```typescript
import { RecipeLibrary } from "@/lib/library";

// Get all recipes
const all = RecipeLibrary.getAll();

// Search with filters
const quickChicken = RecipeLibrary.search({
  tags: ["chicken", "quick_weeknight"],
  maxTimeMins: 40
});

// Get by ID
const recipe = RecipeLibrary.getById("chicken-parm-nagi");
```

### Generate Shopping List

```typescript
import { aggregateShoppingList } from "@/lib/shoppingListAggregator";

const items = aggregateShoppingList(plan, {
  excludePantryStaples: true,
  pantryItems: ["salt", "pepper", "olive oil"]
});

console.log(items);
// [
//   {
//     name: "chicken breast",
//     totalQty: 1.5,
//     unit: "kg",
//     sourceRecipes: [...]
//   },
//   ...
// ]
```

### Track Analytics

```typescript
import { track } from "@/lib/analytics";

// Track an event
track('plan_composed', {
  leftoverDays: 2,
  proteinTypes: 4,
  avgCookTime: 35,
  costEstimate: 87.50
});

// Query metrics
import { getPlanCompositionMetrics } from "@/lib/analytics";
const metrics = getPlanCompositionMetrics();
console.log(metrics);
// {
//   avgLeftoverDays: 1.8,
//   avgProteinTypes: 3.5,
//   avgCost: 85.20,
//   totalPlans: 12
// }
```

### Configure Family Settings

```typescript
import { saveFamilySettings, getFamilySettings } from "@/lib/storage";

// Get current settings
const settings = getFamilySettings();

// Update settings
saveFamilySettings({
  ...settings,
  adults: 2,
  children: [{ age: 5 }, { age: 7 }],
  cuisines: ['mexican', 'italian', 'thai'],
  spiceTolerance: 'medium',
  cookingSkill: 'intermediate',
  effortPreference: 'balanced',
  flavorProfileDescription: 'fresh & herby, avoids heavy cream',
  location: {
    city: 'Melbourne',
    country: 'Australia',
    hemisphere: 'southern'
  },
  budgetPerMeal: { min: 15, max: 20 },
  maxCookTime: { weeknight: 30, weekend: 45 }
});

// Settings are now available at /settings page
```

---

## Development Commands

```bash
# Start dev server (with hot reload)
pnpm dev

# Build for production
pnpm build

# Type check (no compilation)
pnpm type-check

# Index new recipes (scraping)
pnpm index-chefs

# Build recipe library (from indexed files)
pnpm build-library
```

---

## Key Files to Read First

1. **`apps/web/src/lib/compose.ts`** (220 lines)
   - Core meal planning algorithm
   - See how variety enforcement works
   - Understand bulk cook + leftover logic

2. **`apps/web/src/lib/scoring.ts`** (280 lines)
   - All 10+ scoring rules
   - Configurable weights
   - Context-aware evaluation

3. **`apps/web/src/app/plan/review/page.tsx`** (380 lines)
   - Full-stack example of using compose + explainer
   - Summary stats calculation
   - RegenerateDrawer integration

4. **`apps/web/src/lib/shoppingListAggregator.ts`** (300+ lines)
   - Ingredient normalization logic
   - Unit conversion mappings
   - Deduplication algorithm

---

## Making Changes

### Adding a New Scoring Rule

**File**: `apps/web/src/lib/scoring.ts`

```typescript
// Add to scoreRecipe() function
if (recipe.tags.includes("healthy")) {
  score += 12 * SCORING_WEIGHTS.familyFit;
  reasons.push("healthy_choice");
}
```

### Adding a New Reason Chip

**File**: `apps/web/src/lib/explainer.ts`

```typescript
const REASON_MAP: Record<string, ReasonChip> = {
  // ... existing reasons
  "healthy_choice": {
    type: 'positive',
    emoji: '🥗',
    label: 'Healthy Choice',
    tooltip: 'Low in calories and high in nutrition'
  }
};
```

### Adding a Coles Product Mapping

**File**: `apps/web/src/lib/colesMapping.ts`

```typescript
const INGREDIENT_MAPPINGS: IngredientMapping[] = [
  // ... existing mappings
  {
    name: "quinoa",
    products: [
      {
        sku: "COLES-QUINOA-500G",
        name: "Organic Quinoa",
        brand: "Coles",
        price: 6.50,
        packSize: 500,
        packUnit: "g"
      }
    ],
    confidence: "high",
    requiresChoice: false
  }
];
```

---

## Testing Your Changes

### Manual Testing Checklist

1. **Generate a Plan**
   - Navigate to `/plan`
   - Click "Generate Plan"
   - Verify meals are selected

2. **Check Explanations**
   - Look at reason chips on each MealCard
   - Verify explanations make sense

3. **Review Shopping List**
   - Navigate to `/shopping-list`
   - Verify ingredient aggregation
   - Check Coles pricing (if mapped)

4. **Test Regeneration**
   - Click "Regenerate with Constraints"
   - Pin some days
   - Adjust budget slider
   - Regenerate and verify pinned days preserved

5. **Check Analytics**
   - Navigate to `/analytics`
   - Verify events are tracked
   - Check metrics are calculated

### Keyboard Testing

- Tab through all interactive elements
- Press Enter/Space on buttons
- Press Escape to close modals
- Verify focus is visible

---

## Debugging Tips

### Check Recipe Library

```typescript
import { RecipeLibrary } from "@/lib/library";
console.log(RecipeLibrary.getAll().length); // Should be 50+
```

### Inspect Scoring

```typescript
import { scoreRecipe } from "@/lib/scoring";
import { RecipeLibrary } from "@/lib/library";

const recipe = RecipeLibrary.getById("chicken-parm-nagi");
const score = scoreRecipe(recipe, {
  dayOfWeek: 2, // Wednesday
  recentRecipes: [],
  weekRecipes: [],
  household: { adults: 2, children: 1 },
  favorites: []
});
console.log("Score:", score); // e.g., 75
```

### View Analytics Events

```typescript
// In browser console
const events = JSON.parse(localStorage.getItem('analytics_events') || '[]');
console.log(events);
```

### Clear All Data

```typescript
// In browser console
localStorage.clear();
location.reload();
```

---

## Common Issues & Solutions

### "No recipes found"
**Solution**: Run `pnpm build-library` to regenerate recipes.generated.json

### "TypeScript errors"
**Solution**: Run `pnpm type-check` to see all errors

### "Shopping list empty"
**Solution**: Ensure you've generated a plan first

### "Coles prices not showing"
**Solution**: Only 30+ ingredients are mapped. Others show as unmapped.

---

## Next Steps

1. **Read the docs**:
   - [PHASE_1_IMPLEMENTATION.md](./PHASE_1_IMPLEMENTATION.md) - Work order details
   - [API_REFERENCE.md](./API_REFERENCE.md) - Library API
   - [ARCHITECTURE.md](./ARCHITECTURE.md) - System design

2. **Explore the code**:
   - Start with `/apps/web/src/lib/compose.ts`
   - Follow the data flow through scoring → explainer → UI

3. **Make a change**:
   - Add a new scoring rule
   - Create a new reason chip
   - Map more Coles ingredients

4. **Run the app**:
   - Generate plans
   - Test regeneration
   - Export shopping lists
   - Check analytics

---

## Getting Help

- **Code comments**: All libraries have JSDoc comments
- **Type definitions**: Hover over functions in VS Code
- **Example usage**: Check page components for patterns
- **Documentation**: See `.github/` folder

---

## Phase 1 Summary

**What's built**:
- ✅ Intelligent meal planning (10+ scoring rules)
- ✅ Explainability (reason chips)
- ✅ Cost transparency (Coles integration)
- ✅ Shopping list (deduplication, pricing)
- ✅ Analytics (privacy-first tracking)
- ✅ Accessibility (WCAG 2.1 AA)

**What's next** (Phase 2+):
- 🔮 LLM integration (GPT-4 scoring)
- 🔮 Real-time Coles API
- 🔮 Nutrition tracking
- 🔮 Social features

---

**Ready to start?** Run `pnpm dev` and explore! 🚀
