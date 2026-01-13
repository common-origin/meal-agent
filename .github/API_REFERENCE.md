# API Reference

**Last Updated**: October 27, 2025  
**Version**: Phase 1

This document provides API references for all core libraries in the Meal Agent system.

---

## Table of Contents

1. [Recipe Library](#recipe-library)
2. [Composition Engine](#composition-engine)
3. [Scoring System](#scoring-system)
4. [Shopping List](#shopping-list)
5. [Coles Integration](#coles-integration)
6. [Analytics](#analytics)
7. [Storage](#storage)
8. [Utilities](#utilities)

---

## Recipe Library

**File**: `apps/web/src/lib/library.ts`

### RecipeLibrary

Central singleton for accessing and searching recipes.

#### Methods

##### `getAll(): Recipe[]`
Returns all recipes in the library.

```typescript
const allRecipes = RecipeLibrary.getAll();
// Returns: Recipe[] (all recipes in library)
```

##### `getById(id: string): Recipe | undefined`
Retrieves a single recipe by ID.

```typescript
const recipe = RecipeLibrary.getById("my-recipe-id");
// Returns: Recipe | undefined
```

##### `search(filters: RecipeFilters): Recipe[]`
Searches recipes with optional filters.

```typescript
interface RecipeFilters {
  tags?: string[];           // Match ANY of these tags
  maxTimeMins?: number;      // Maximum cooking time
  maxIngredients?: number;   // Maximum ingredient count
  chef?: string;             // Specific chef
  query?: string;            // Text search in title/tags
}

const quickChicken = RecipeLibrary.search({
  tags: ["chicken", "quick_weeknight"],
  maxTimeMins: 40
});
```

##### `getByTags(tags: string[]): Recipe[]`
Shorthand for searching by tags only.

```typescript
const vegetarian = RecipeLibrary.getByTags(["vegetarian"]);
```

---

## Composition Engine

**File**: `apps/web/src/lib/compose.ts`

### composeWeek()

Generates a 7-day meal plan with variety enforcement and constraint satisfaction.

#### Signature

```typescript
function composeWeek(
  household: Household,
  overrides?: WeeklyOverrides
): PlanWeek
```

#### Parameters

**`household: Household`**
```typescript
interface Household {
  adults: number;
  children: number;
  weeknightMaxMinutes: number; // Default: 40
  pantry: string[];            // Pantry staples
  dietaryRestrictions: string[];
}
```

**`overrides?: WeeklyOverrides`**
```typescript
interface WeeklyOverrides {
  pinnedDays?: Record<number, string>; // dayIndex → recipeId
  maxCost?: number;
  excludeRecipes?: string[];
  preferences?: {
    maximizeReuse?: boolean;
    kidFriendlyOnly?: boolean;
  };
}
```

#### Returns

```typescript
interface PlanWeek {
  days: Array<{
    recipeId: string;
    reasons: string[];
    notes?: string;
  }>;
  costEstimate: number;
  conflicts: string[];
}
```

#### Example

```typescript
import { composeWeek } from "@/lib/compose";
import { loadHousehold } from "@/lib/storage";

const household = loadHousehold() || {
  adults: 2,
  children: 1,
  weeknightMaxMinutes: 40,
  pantry: ["salt", "pepper", "olive oil"],
  dietaryRestrictions: []
};

const plan = composeWeek(household, {
  pinnedDays: { 0: "my-recipe-id" }, // Pin Monday
  maxCost: 100,
  preferences: { maximizeReuse: true }
});

console.log(plan.days);
// [
//   { recipeId: "my-recipe-id", reasons: ["pinned"], notes: undefined },
//   { recipeId: "beef-stew", reasons: ["bulk_cook"], notes: "Bulk cook" },
//   { recipeId: "beef-stew-leftover", reasons: ["leftover_efficiency"], notes: "Leftovers from Tuesday's Beef Stew" },
//   ...
// ]
```

#### Behavior

**Variety Enforcement**:
- No consecutive days with same protein
- Cuisine rotation over 3-day window
- Cooking method diversity

**Constraint Satisfaction**:
- Weeknight meals ≤40 minutes (Mon-Fri)
- Budget target (if specified)
- Pinned days always preserved

**Bulk Cook Support**:
- Detects `bulk_cook` tag
- Inserts leftover day automatically
- Marks with `notes: "Leftovers from ..."`

---

## Scoring System

**File**: `apps/web/src/lib/scoring.ts`

### scoreRecipe()

Evaluates a recipe's suitability for a specific day based on multiple rules.

#### Signature

```typescript
function scoreRecipe(
  recipe: Recipe,
  context: ScoringContext
): number
```

#### Parameters

```typescript
interface ScoringContext {
  dayOfWeek: number;           // 0 (Mon) to 6 (Sun)
  recentRecipes: string[];     // Recently cooked recipe IDs
  weekRecipes: string[];       // Recipes already in this week
  household: Household;
  favorites: string[];         // Favorited recipe IDs
}
```

#### Returns

`number` - Score (higher is better, typical range: 0-100)

#### Scoring Rules

| Rule | Score Impact | Description |
|------|--------------|-------------|
| Recency Penalty | -30 per week | Penalizes recently cooked recipes |
| Protein Rotation | +15 | Bonus if different protein from yesterday |
| Cuisine Diversity | +10 | Bonus if different cuisine from last 3 days |
| Weeknight Constraint | +20 | Bonus if ≤40 mins on Mon-Fri |
| Weekend Flexibility | 0 | No time penalty on Sat-Sun |
| Kid-Friendly | +10 | Bonus if household has children |
| Favorite | +25 | Bonus if marked as favorite |
| Bulk Cook | +15 | Bonus for bulk-cookable recipes |
| Method Variety | +8 | Bonus if different cooking method |
| Ingredient Reuse | +5 per match | Bonus for shared ingredients |

#### Example

```typescript
import { scoreRecipe } from "@/lib/scoring";

const score = scoreRecipe(recipe, {
  dayOfWeek: 2, // Wednesday
  recentRecipes: ["recipe-1", "recipe-2"],
  weekRecipes: ["recipe-3"],
  household: { adults: 2, children: 1 },
  favorites: ["recipe-4"]
});

console.log(score); // e.g., 75
```

### SCORING_WEIGHTS

Global weights for tuning scoring behavior.

```typescript
export const SCORING_WEIGHTS = {
  recency: 1.0,      // Importance of avoiding repetition
  variety: 1.0,      // Importance of protein/cuisine diversity
  timing: 1.2,       // Importance of weeknight time constraint
  familyFit: 1.0,    // Importance of kid-friendly meals
  bulkCook: 0.8      // Importance of bulk cook strategy
};
```

**Customize**:
```typescript
import { SCORING_WEIGHTS } from "@/lib/scoring";

// Increase emphasis on quick weeknight meals
SCORING_WEIGHTS.timing = 1.5;

// Decrease bulk cook preference
SCORING_WEIGHTS.bulkCook = 0.5;
```

---

## Shopping List

**File**: `apps/web/src/lib/shoppingListAggregator.ts`

### aggregateShoppingList()

Deduplicates and normalizes ingredients across all meals in a plan.

#### Signature

```typescript
function aggregateShoppingList(
  plan: PlanWeek,
  options?: AggregationOptions
): AggregatedIngredient[]
```

#### Parameters

```typescript
interface AggregationOptions {
  excludePantryStaples?: boolean;
  pantryItems?: string[];
}
```

#### Returns

```typescript
interface AggregatedIngredient {
  name: string;              // Display name (from first occurrence)
  normalizedName: string;    // Normalized for deduplication
  totalQty: number;          // Aggregated quantity
  unit: string;              // Normalized unit
  sourceRecipes: Array<{
    recipeId: string;
    recipeTitle: string;
    qty: number;
  }>;
  isPantryStaple: boolean;
}
```

#### Example

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
//     normalizedName: "chicken breast",
//     totalQty: 1.5,
//     unit: "kg",
//     sourceRecipes: [
//       { recipeId: "chicken-parm", recipeTitle: "Chicken Parmesan", qty: 0.8 },
//       { recipeId: "chicken-stir-fry", recipeTitle: "Chicken Stir Fry", qty: 0.7 }
//     ],
//     isPantryStaple: false
//   },
//   ...
// ]
```

### toLegacyFormat()

Converts aggregated ingredients to legacy grouped format.

```typescript
function toLegacyFormat(
  items: AggregatedIngredient[]
): GroupedIngredients
```

---

## Coles Integration

**File**: `apps/web/src/lib/colesMapping.ts`

### estimateIngredientCost()

Maps an ingredient to Coles products and estimates cost.

#### Signature

```typescript
function estimateIngredientCost(
  normalizedName: string,
  qty: number,
  unit: string
): ColesEstimate
```

#### Returns

```typescript
interface ColesEstimate {
  mapped: boolean;
  confidence: 'high' | 'medium' | 'low';
  requiresChoice: boolean;
  estimatedCost: number;
  packsNeeded: number;
  product?: ColesProduct;
}

interface ColesProduct {
  sku: string;
  name: string;
  brand?: string;
  price: number;
  packSize: number;
  packUnit: string;
}
```

#### Example

```typescript
import { estimateIngredientCost } from "@/lib/colesMapping";

const estimate = estimateIngredientCost("chicken breast", 1.5, "kg");

console.log(estimate);
// {
//   mapped: true,
//   confidence: "high",
//   requiresChoice: false,
//   estimatedCost: 18.00,
//   packsNeeded: 2,
//   product: {
//     sku: "COLES-CHICKEN-BREAST-1KG",
//     name: "Chicken Breast Fillets",
//     brand: "Coles",
//     price: 12.00,
//     packSize: 1,
//     packUnit: "kg"
//   }
// }
```

#### Supported Ingredients

30+ ingredients mapped including:
- **Proteins**: chicken breast, beef mince, pork chops, salmon, white fish
- **Vegetables**: onion, garlic, tomatoes, carrots, broccoli, capsicum
- **Pantry**: rice, pasta, soy sauce, olive oil, flour
- **Dairy**: milk, cheese, butter, cream
- **Spices**: paprika, cumin, oregano, basil

---

## Analytics

**File**: `apps/web/src/lib/analytics.ts`

### track()

Records an analytics event to localStorage.

#### Signature

```typescript
function track<T extends AnalyticsEventType>(
  eventType: T,
  metadata?: EventMetadataMap[T]
): void
```

#### Event Types

```typescript
type AnalyticsEventType =
  | 'page_view'
  | 'plan_composed'
  | 'plan_reviewed'
  | 'plan_regenerated'
  | 'plan_confirmed'
  | 'shopping_list_viewed'
  | 'shopping_list_exported'
  | 'cost_optimized'
  | 'recipe_favorited'
  | 'recipe_unfavorited'
  | 'analytics_viewed';
```

#### Metadata Interfaces

```typescript
interface PlanComposedMeta {
  leftoverDays: number;
  proteinTypes: number;
  avgCookTime: number;
  costEstimate: number;
}

interface PlanRegeneratedMeta {
  pinnedDaysCount: number;
  budgetChanged: boolean;
  preferencesApplied: string[];
}

interface CostOptimizedMeta {
  reusedIngredients: number;
  estimatedSavings: number;
  totalCost: number;
}

interface ShoppingListExportedMeta {
  itemCount: number;
  totalCost: number;
  excludedPantry: boolean;
}

interface RecipeFavoriteMeta {
  recipeId: string;
  currentFavoriteCount: number;
}
```

#### Example

```typescript
import { track } from "@/lib/analytics";

// Page view
track('page_view', { page: '/plan' });

// Plan composition
track('plan_composed', {
  leftoverDays: 2,
  proteinTypes: 4,
  avgCookTime: 35,
  costEstimate: 87.50
});

// Cost optimization
track('cost_optimized', {
  reusedIngredients: 8,
  estimatedSavings: 12.50,
  totalCost: 87.50
});
```

### Metric Functions

#### getEventCounts()
```typescript
function getEventCounts(): Record<AnalyticsEventType, number>
```

#### getPlanCompositionMetrics()
```typescript
function getPlanCompositionMetrics(): {
  avgLeftoverDays: number;
  avgProteinTypes: number;
  avgCookTime: number;
  avgCost: number;
  totalPlans: number;
}
```

#### getCostOptimizationMetrics()
```typescript
function getCostOptimizationMetrics(): {
  avgSavings: number;
  avgReuseCount: number;
  totalOptimizations: number;
}
```

#### getEngagementMetrics()
```typescript
function getEngagementMetrics(): {
  totalPageViews: number;
  plansConfirmed: number;
  confirmationRate: number;
}
```

#### getRegenerationMetrics()
```typescript
function getRegenerationMetrics(): {
  totalRegenerations: number;
  avgPinnedDays: number;
  budgetChangeRate: number;
}
```

---

## Storage

**File**: `apps/web/src/lib/storage.ts`

### Household Management

#### saveHousehold()
```typescript
function saveHousehold(household: Household): void
```

#### loadHousehold()
```typescript
function loadHousehold(): Household | null
```

#### getDefaultHousehold()
```typescript
function getDefaultHousehold(): Household
// Returns: { adults: 2, children: 0, weeknightMaxMinutes: 40, pantry: [], dietaryRestrictions: [] }
```

### Weekly Overrides

#### saveWeeklyOverrides()
```typescript
function saveWeeklyOverrides(
  weekISO: string,
  overrides: WeeklyOverrides
): void
```

#### loadWeeklyOverrides()
```typescript
function loadWeeklyOverrides(weekISO: string): WeeklyOverrides | null
```

### Favorites

#### saveFavorites()
```typescript
function saveFavorites(recipeIds: string[]): void
```

#### loadFavorites()
```typescript
function loadFavorites(): string[]
```

#### toggleFavorite()
```typescript
function toggleFavorite(recipeId: string): boolean
// Returns: true if now favorited, false if unfavorited
```

---

## Utilities

### Tag Normalizer

**File**: `apps/web/src/lib/tagNormalizer.ts`

#### normalizeRecipeTags()
```typescript
function normalizeRecipeTags(recipe: Recipe): string[]
```

Converts raw recipe tags to normalized vocabulary.

**Example**:
```typescript
import { normalizeRecipeTags } from "@/lib/tagNormalizer";

const normalized = normalizeRecipeTags({
  tags: ["poultry", "asian-inspired", "30-minute-meal"]
});

console.log(normalized);
// ["chicken", "asian", "quick_weeknight"]
```

### Explainer

**File**: `apps/web/src/lib/explainer.ts`

#### explain()
```typescript
function explain(
  reasons: string[],
  recipeTitle: string
): ReasonChip[]
```

Converts reason codes to visual chips.

```typescript
interface ReasonChip {
  type: 'positive' | 'neutral' | 'warning';
  emoji: string;
  label: string;
  tooltip: string;
}
```

**Example**:
```typescript
import { explain } from "@/lib/explainer";

const chips = explain(["protein_variety", "quick_weeknight"], "Chicken Stir Fry");

console.log(chips);
// [
//   { type: 'positive', emoji: '🔄', label: 'Protein Variety', tooltip: 'Different protein from yesterday' },
//   { type: 'positive', emoji: '⚡', label: 'Quick (≤40 mins)', tooltip: 'Perfect for busy weeknights' }
// ]
```

### Schedule

**File**: `apps/web/src/lib/schedule.ts`

#### nextWeekMondayISO()
```typescript
function nextWeekMondayISO(): string
// Returns: "2025-11-03" (ISO date string for next Monday)
```

#### getCurrentWeekISO()
```typescript
function getCurrentWeekISO(): string
// Returns: "2025-10-27" (ISO date string for this Monday)
```

### CSV Export

**File**: `apps/web/src/lib/csv.ts`

#### generateShoppingListCSV()
```typescript
function generateShoppingListCSV(
  items: AggregatedIngredient[]
): string
```

#### downloadCSV()
```typescript
function downloadCSV(csvContent: string, filename: string): void
```

**Example**:
```typescript
import { generateShoppingListCSV, downloadCSV } from "@/lib/csv";

const csv = generateShoppingListCSV(items);
downloadCSV(csv, "shopping-list-2025-11-03.csv");
```

---

## Type Definitions

### Core Types

```typescript
// Recipe
interface Recipe {
  id: string;
  title: string;
  source: {
    chef: string;
    url: string;
  };
  timeMins: number;
  servings: number;
  tags: string[];
  normalizedTags: string[];
  ingredients: Array<{
    name: string;
    qty: number;
    unit: string;
  }>;
  steps: string[];
}

// Household
interface Household {
  adults: number;
  children: number;
  weeknightMaxMinutes: number;
  pantry: string[];
  dietaryRestrictions: string[];
}

// Plan Week
interface PlanWeek {
  days: Array<{
    recipeId: string;
    reasons: string[];
    notes?: string;
  }>;
  costEstimate: number;
  conflicts: string[];
}

// Weekly Overrides
interface WeeklyOverrides {
  pinnedDays?: Record<number, string>;
  maxCost?: number;
  excludeRecipes?: string[];
  preferences?: {
    maximizeReuse?: boolean;
    kidFriendlyOnly?: boolean;
  };
}
```

---

## Error Handling

All library functions follow these patterns:

### Graceful Degradation
```typescript
// Returns undefined instead of throwing
const recipe = RecipeLibrary.getById("invalid-id");
// recipe === undefined

// Returns empty array instead of throwing
const results = RecipeLibrary.search({ tags: ["nonexistent"] });
// results === []
```

### Validation
```typescript
// Validates input before processing
const plan = composeWeek(household, overrides);
// Ensures household has required fields
// Validates pinnedDays are within 0-6 range
// Checks recipes exist before assigning
```

### Fallbacks
```typescript
// Provides sensible defaults
const household = loadHousehold() || getDefaultHousehold();

// Uses empty arrays when no data
const favorites = loadFavorites(); // Returns [] if none saved
```

---

## Best Practices

### Performance

1. **Cache expensive operations**:
   ```typescript
   // Good: Cache library reference
   const recipes = RecipeLibrary.getAll();
   const filtered = recipes.filter(...);
   
   // Bad: Multiple library calls
   RecipeLibrary.getAll().forEach(...);
   RecipeLibrary.getAll().filter(...);
   ```

2. **Use specific searches**:
   ```typescript
   // Good: Narrow search
   RecipeLibrary.search({ tags: ["chicken"], maxTimeMins: 40 });
   
   // Bad: Filter all recipes
   RecipeLibrary.getAll().filter(r => r.tags.includes("chicken") && r.timeMins <= 40);
   ```

### Type Safety

1. **Use interfaces**:
   ```typescript
   // Good: Type-safe
   import type { Recipe, Household } from "@/lib/types/recipe";
   
   function processRecipe(recipe: Recipe): void { ... }
   ```

2. **Validate localStorage data**:
   ```typescript
   // Good: Validate loaded data
   const household = loadHousehold();
   if (!household || !household.adults) {
     return getDefaultHousehold();
   }
   ```

### Analytics

1. **Track meaningful events**:
   ```typescript
   // Good: Track user actions
   track('plan_confirmed');
   track('cost_optimized', { estimatedSavings: 12.50 });
   
   // Bad: Over-tracking
   track('button_hover');
   track('page_scroll');
   ```

2. **Include context**:
   ```typescript
   // Good: Rich metadata
   track('plan_composed', {
     leftoverDays: 2,
     proteinTypes: 4,
     avgCookTime: 35,
     costEstimate: 87.50
   });
   
   // Bad: No context
   track('plan_composed');
   ```

---

## Migration Guide

### From Mock Library

If you're upgrading from mock data to real recipes:

```typescript
// Recipe library
import { RecipeLibrary } from "@/lib/library";
const recipes = RecipeLibrary.getAll();

// Loads recipes from AI generation, URL extraction, and manual entry
// Enhanced with tag normalization and smart search
```

Recipes are sourced from AI generation, URL extraction, and manual entry.

---

## Support

For questions or issues:
- Review the [Phase 1 Implementation Guide](./PHASE_1_IMPLEMENTATION.md)
- Check the [Architecture Documentation](./ARCHITECTURE.md)
- See example usage in `/apps/web/src/app/` pages
